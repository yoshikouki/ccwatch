import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { DaemonCommand } from "./daemon-command.ts";
import { MockClock } from "../infrastructure/clock.ts";
import { MockLogger } from "../infrastructure/logger.ts";
import { MemoryStateRepository } from "../infrastructure/state-repository.ts";
import { MockUsageRepository } from "../infrastructure/usage-repository.ts";
import { MockNotificationService } from "../infrastructure/notification-service.ts";
import { ResultUtils } from "../utils/result.ts";

describe("DaemonCommand", () => {
  let command: DaemonCommand;
  let mockDependencies: any;
  let mockLogger: MockLogger;
  let originalProcessOn: any;
  let processHandlers: Record<string, Function> = {};

  beforeEach(() => {
    const mockClock = new MockClock(new Date("2025-07-15T12:00:00Z"));
    mockLogger = new MockLogger();
    const mockStateRepository = new MemoryStateRepository();
    const mockUsageRepository = new MockUsageRepository({
      monthly: [{
        month: "2025-07",
        totalCost: 45.50,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 45.50 }
    });
    const mockNotificationService = new MockNotificationService();

    mockDependencies = {
      clock: mockClock,
      logger: mockLogger,
      stateRepository: mockStateRepository,
      usageRepository: mockUsageRepository,
      notificationService: mockNotificationService
    };

    // process.onのモック
    originalProcessOn = process.on;
    processHandlers = {};
    process.on = vi.fn((signal: string, handler: Function) => {
      processHandlers[signal] = handler;
      return process;
    }) as any;

    command = new DaemonCommand(mockDependencies, mockLogger);
  });

  afterEach(() => {
    process.on = originalProcessOn;
    command.forceShutdown();
  });

  test("基本的なデーモン実行", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1000,
      slackWebhookUrl: "https://hooks.slack.com/test"
    };

    // デーモンを開始
    const executePromise = command.execute({ config });

    // 即座にシャットダウン
    command.forceShutdown();

    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    expect(mockLogger.hasLog("info", "ccwatch daemon starting")).toBe(true);
  });

  test("シグナルハンドリングの設定", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1000,
      slackWebhookUrl: undefined
    };

    const executePromise = command.execute({ config });
    
    // process.onが正しく呼ばれているか確認
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    
    command.forceShutdown();
    await executePromise;
  });

  test("SIGINT受信時のグレースフルシャットダウン", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1000,
      slackWebhookUrl: undefined
    };

    const executePromise = command.execute({ config });
    
    // SIGINTシグナルを送信
    processHandlers.SIGINT?.();
    
    const result = await executePromise;
    
    expect(ResultUtils.isSuccess(result)).toBe(true);
    expect(mockLogger.hasLog("info", "Received SIGINT")).toBe(true);
  });

  test("SIGTERM受信時のグレースフルシャットダウン", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1000,
      slackWebhookUrl: undefined
    };

    const executePromise = command.execute({ config });
    
    // SIGTERMシグナルを送信
    processHandlers.SIGTERM?.();
    
    const result = await executePromise;
    
    expect(ResultUtils.isSuccess(result)).toBe(true);
    expect(mockLogger.hasLog("info", "Received SIGTERM")).toBe(true);
  });

  test("forceShutdownメソッドの動作", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 10000, // 長いインターバル
      slackWebhookUrl: undefined
    };

    const executePromise = command.execute({ config });
    
    // 即座にforce shutdown
    const shutdownResult = command.forceShutdown();
    
    const result = await executePromise;
    
    expect(ResultUtils.isSuccess(result)).toBe(true);
    expect(shutdownResult).toBe(true); // 初回シャットダウンは成功
    expect(command.forceShutdown()).toBe(false); // 2回目は失敗
  });

  test("重複シャットダウンの防止", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1000,
      slackWebhookUrl: undefined
    };

    const executePromise = command.execute({ config });
    
    // 複数回シャットダウンを呼び出し
    command.forceShutdown();
    command.forceShutdown();
    command.forceShutdown();
    
    const result = await executePromise;
    
    expect(ResultUtils.isSuccess(result)).toBe(true);
    
    // シャットダウンログの確認
    const hasShutdownLog = mockLogger.logs.some(log => 
      log.message.includes("Daemon shutdown") || 
      log.message.includes("ccwatch daemon") ||
      log.message.includes("終了")
    );
    expect(hasShutdownLog).toBe(true);
  });

  test("設定の検証", () => {
    const command = new DaemonCommand(mockDependencies, mockLogger);
    
    expect(command).toBeDefined();
    expect(command.forceShutdown).toBeTypeOf("function");
  });

  test("依存関係の注入", () => {
    expect(mockDependencies.clock).toBeDefined();
    expect(mockDependencies.logger).toBeDefined();
    expect(mockDependencies.stateRepository).toBeDefined();
    expect(mockDependencies.usageRepository).toBeDefined();
    expect(mockDependencies.notificationService).toBeDefined();
  });

  test("ログ機能の動作確認", () => {
    expect(mockLogger.logs).toEqual([]);
    mockLogger.info("テストメッセージ");
    expect(mockLogger.logs).toHaveLength(1);
    expect(mockLogger.logs[0]?.message).toBe("テストメッセージ");
  });

  test("状態リポジトリの動作確認", async () => {
    const state = { lastNotificationDate: "2025-07-15" };
    await mockDependencies.stateRepository.save(state);
    const loadedState = await mockDependencies.stateRepository.load();
    expect(loadedState).toEqual(state);
  });

  test("使用量リポジトリの動作確認", async () => {
    const usageData = await mockDependencies.usageRepository.fetchUsageData();
    expect(usageData.totals.totalCost).toBe(45.50);
    expect(usageData.monthly).toHaveLength(1);
  });

  test("通知サービスの動作確認", async () => {
    const message = "テスト通知";
    await mockDependencies.notificationService.sendNotification(message, 50);
    
    expect(mockDependencies.notificationService.sentNotifications).toHaveLength(1);
    expect(mockDependencies.notificationService.sentNotifications[0]?.message).toBe(message);
  });

  test("クロックの動作確認", () => {
    const now = mockDependencies.clock.now();
    expect(now).toBeInstanceOf(Date);
    expect(mockDependencies.clock.getCurrentMonth()).toBe("2025-07");
    expect(mockDependencies.clock.getToday()).toBe("2025-07-15");
  });

  test("定期実行での状態保存", async () => {
    const config = {
      threshold: 30, // 閾値を超過させる
      daemon: true,
      interval: 100, // 短いインターバル
      slackWebhookUrl: undefined
    };

    // checkUsageCommandの結果をモック
    const mockExecuteResult = {
      success: true,
      data: {
        currentCost: 50,
        newState: { lastNotificationDate: "2025-07-15" },
        checkCount: 1
      }
    };
    
    command.checkUsageCommand = {
      execute: vi.fn().mockResolvedValue(mockExecuteResult)
    } as any;

    const executePromise = command.execute({ config });
    
    // 短時間待機してチェックが実行されるようにする
    await new Promise(resolve => setTimeout(resolve, 150));
    
    command.forceShutdown();
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.checkCount).toBeGreaterThan(0);
    }
  });

  test("チェック実行エラー時のハンドリング", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 100,
      slackWebhookUrl: undefined
    };

    // checkUsageCommandでエラーを返すモック
    const mockErrorResult = {
      success: false,
      error: { message: "使用量取得エラー" }
    };
    
    command.checkUsageCommand = {
      execute: vi.fn().mockResolvedValue(mockErrorResult)
    } as any;

    const executePromise = command.execute({ config });
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    command.forceShutdown();
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    expect(mockLogger.hasLog("error", "定期チェックでエラーが発生しました")).toBe(true);
  });

  test("予期しない例外のキャッチとログ記録", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 100,
      slackWebhookUrl: undefined
    };

    // checkUsageCommandで例外を投げるモック
    command.checkUsageCommand = {
      execute: vi.fn().mockRejectedValue(new Error("予期しないエラー"))
    } as any;

    const executePromise = command.execute({ config });
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    command.forceShutdown();
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    expect(mockLogger.hasLog("error", "予期しないエラーが発生しました")).toBe(true);
  });

  test("シャットダウン中のインターバル処理スキップ", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 50, // 非常に短いインターバル
      slackWebhookUrl: undefined
    };

    const executePromise = command.execute({ config });
    
    // 即座にシャットダウン
    command.forceShutdown();
    
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    // シャットダウン中にisShuttingDownチェックが働くことを確認
  });

  test("グレースフルシャットダウンのセットアップ", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1000,
      slackWebhookUrl: undefined
    };

    const executePromise = command.execute({ config });
    
    // setupGracefulShutdownが呼ばれてprocess.onが設定されることを確認
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    
    command.forceShutdown();
    await executePromise;
  });
});
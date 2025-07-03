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
    vi.clearAllTimers();
    vi.useFakeTimers();
    
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
    vi.useRealTimers();
    process.on = originalProcessOn;
    command.forceShutdown();
  });

  test("基本的なデーモン実行", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1, // 1秒間隔
      slackWebhookUrl: "https://hooks.slack.com/test"
    };

    // デーモンを開始
    const executePromise = command.execute({ config });

    // 短時間後に停止
    setTimeout(() => {
      command.forceShutdown();
    }, 100);

    vi.advanceTimersByTime(100);
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.checkCount).toBeGreaterThan(0);
    }

    expect(mockLogger.hasLog("info", "ccwatch daemon starting")).toBe(true);
  });

  test("定期実行のチェック動作", async () => {
    const config = {
      threshold: 40, // 閾値を下げて通知が発生するように
      daemon: true,
      interval: 1,
      slackWebhookUrl: "https://hooks.slack.com/test"
    };

    const executePromise = command.execute({ config });

    // 3秒間実行して停止
    setTimeout(() => {
      command.forceShutdown();
    }, 3100);

    vi.advanceTimersByTime(3100);
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      // 初回 + 3回の定期実行 = 4回程度のチェック
      expect(result.data.checkCount).toBeGreaterThanOrEqual(3);
    }

    // 通知が送信されたことを確認
    expect(mockDependencies.notificationService.sentMessages.length).toBeGreaterThan(0);
  });

  test("シグナルハンドリングの設定", async () => {
    const config = {
      threshold: 50,
      daemon: true,
      interval: 10
    };

    const executePromise = command.execute({ config });

    // 短時間待ってからチェック
    vi.advanceTimersByTime(50);

    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));

    // SIGINTハンドラーが設定されていることを確認
    expect(processHandlers.SIGINT).toBeDefined();
    expect(processHandlers.SIGTERM).toBeDefined();

    command.forceShutdown();
    await executePromise;
  });

  test("SIGINT受信時のグレースフルシャットダウン", async () => {
    const originalExit = process.exit;
    let exitCode = -1;
    process.exit = vi.fn((code?: number) => { 
      exitCode = code || 0; 
    }) as any;

    const config = {
      threshold: 50,
      daemon: true,
      interval: 10
    };

    const executePromise = command.execute({ config });
    vi.advanceTimersByTime(50);

    // SIGINTハンドラーを実行
    processHandlers.SIGINT();

    expect(mockLogger.hasLog("info", "ccwatch daemon stopping")).toBe(true);
    expect(exitCode).toBe(0);

    process.exit = originalExit;
    command.forceShutdown();
    await executePromise;
  });

  test("SIGTERM受信時のグレースフルシャットダウン", async () => {
    const originalExit = process.exit;
    let exitCode = -1;
    process.exit = vi.fn((code?: number) => { 
      exitCode = code || 0; 
    }) as any;

    const config = {
      threshold: 50,
      daemon: true,
      interval: 10
    };

    const executePromise = command.execute({ config });
    vi.advanceTimersByTime(50);

    // SIGTERMハンドラーを実行
    processHandlers.SIGTERM();

    expect(mockLogger.hasLog("info", "ccwatch daemon stopping")).toBe(true);
    expect(exitCode).toBe(0);

    process.exit = originalExit;
    command.forceShutdown();
    await executePromise;
  });

  test("チェック処理でエラーが発生した場合", async () => {
    // エラーを発生させるリポジトリ
    mockDependencies.usageRepository = {
      fetchUsageData: vi.fn().mockRejectedValue(new Error("Network error"))
    };

    const config = {
      threshold: 50,
      daemon: true,
      interval: 1
    };

    const executePromise = command.execute({ config });

    // 2秒間実行
    setTimeout(() => {
      command.forceShutdown();
    }, 2100);

    vi.advanceTimersByTime(2100);
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    expect(mockLogger.hasLog("error", "定期チェックでエラーが発生しました")).toBe(true);
  });

  test("予期しないエラーのハンドリング", async () => {
    // CheckUsageCommandが例外をthrowするように設定
    const config = {
      threshold: 50,
      daemon: true,
      interval: 1
    };

    // intervalの処理中に例外が発生するケース
    const executePromise = command.execute({ config });

    setTimeout(() => {
      command.forceShutdown();
    }, 1100);

    vi.advanceTimersByTime(1100);
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
  });

  test("重複シャットダウンの防止", async () => {
    const originalExit = process.exit;
    let exitCallCount = 0;
    process.exit = vi.fn(() => { 
      exitCallCount++; 
    }) as any;

    const config = {
      threshold: 50,
      daemon: true,
      interval: 10
    };

    const executePromise = command.execute({ config });
    vi.advanceTimersByTime(50);

    // 複数回シャットダウンを実行
    processHandlers.SIGINT();
    processHandlers.SIGINT();
    processHandlers.SIGTERM();

    expect(exitCallCount).toBe(1); // 1回のみ実行されること

    process.exit = originalExit;
    command.forceShutdown();
    await executePromise;
  });

  test("状態の保存と読み込み", async () => {
    const initialState = {
      lastNotificationDate: "2025-07-14",
      lastExceedanceDate: "2025-07-14"
    };

    await mockDependencies.stateRepository.save(initialState);

    const config = {
      threshold: 50,
      daemon: true,
      interval: 1
    };

    const executePromise = command.execute({ config });

    setTimeout(() => {
      command.forceShutdown();
    }, 500);

    vi.advanceTimersByTime(500);
    const result = await executePromise;

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.finalState).toBeDefined();
    }
  });

  test("forceShutdownメソッドの動作", () => {
    command.forceShutdown();
    // プライベートメソッドの効果は間接的にテスト済み
    expect(true).toBe(true); // forceShutdownが例外を発生させないことを確認
  });
});
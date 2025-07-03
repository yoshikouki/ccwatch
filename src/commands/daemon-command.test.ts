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
    const webhookUrl = "https://hooks.slack.com/test";
    await mockDependencies.notificationService.send(message, webhookUrl);
    
    expect(mockDependencies.notificationService.sentMessages).toHaveLength(1);
    expect(mockDependencies.notificationService.sentMessages[0]?.message).toBe(message);
    expect(mockDependencies.notificationService.sentMessages[0]?.webhookUrl).toBe(webhookUrl);
  });

  test("クロックの動作確認", () => {
    const now = mockDependencies.clock.now();
    expect(now).toBeInstanceOf(Date);
    expect(mockDependencies.clock.getCurrentMonth()).toBe("2025-07");
    expect(mockDependencies.clock.getToday()).toBe("2025-07-15");
  });

  test("コンストラクタでの初期化", () => {
    const newCommand = new DaemonCommand(mockDependencies, mockLogger);
    expect(newCommand).toBeInstanceOf(DaemonCommand);
    expect((newCommand as any).dependencies).toBe(mockDependencies);
    expect((newCommand as any).logger).toBe(mockLogger);
  });

  test("forceShutdownの基本動作", () => {
    // 初回シャットダウン
    const result1 = command.forceShutdown();
    expect(result1).toBe(true);
    
    // 2回目は失敗
    const result2 = command.forceShutdown();
    expect(result2).toBe(false);
  });

  test("isShuttingDownフラグの確認", () => {
    expect((command as any).isShuttingDown).toBe(false);
    command.forceShutdown();
    expect((command as any).isShuttingDown).toBe(true);
  });

  test("checkCountの初期値", () => {
    expect((command as any).checkCount).toBe(0);
  });

  test("依存関係の型チェック", () => {
    expect(typeof mockDependencies.clock.now).toBe("function");
    expect(typeof mockDependencies.logger.info).toBe("function");
    expect(typeof mockDependencies.stateRepository.save).toBe("function");
    expect(typeof mockDependencies.usageRepository.fetchUsageData).toBe("function");
    expect(typeof mockDependencies.notificationService.send).toBe("function");
  });

  test("MockClockの時刻設定", () => {
    const newTime = new Date("2025-12-31T23:59:59Z");
    mockDependencies.clock.setTime(newTime);
    expect(mockDependencies.clock.now()).toEqual(newTime);
    expect(mockDependencies.clock.getToday()).toBe("2025-12-31");
  });

  test("MockLoggerのクリア機能", () => {
    mockLogger.info("テスト1");
    mockLogger.error("テスト2");
    expect(mockLogger.logs).toHaveLength(2);
    
    mockLogger.clear();
    expect(mockLogger.logs).toHaveLength(0);
  });

  test("MemoryStateRepositoryのクリア機能", () => {
    const memoryRepo = mockDependencies.stateRepository as MemoryStateRepository;
    memoryRepo.clear();
    // クリア後は空の状態を返す
    expect(memoryRepo.load()).resolves.toEqual({});
  });

  test("MockUsageRepositoryのデータ変更", () => {
    const newData = {
      monthly: [{ month: "2025-08", totalCost: 100, modelsUsed: [], modelBreakdowns: [] }],
      totals: { totalCost: 100 }
    };
    
    mockDependencies.usageRepository.setMockData(newData);
    expect(mockDependencies.usageRepository.fetchUsageData()).resolves.toEqual(newData);
  });

  test("MockNotificationServiceのクリア機能", () => {
    mockDependencies.notificationService.sentMessages.push({ 
      message: "test", 
      webhookUrl: "test" 
    });
    expect(mockDependencies.notificationService.sentMessages).toHaveLength(1);
    
    mockDependencies.notificationService.clear();
    expect(mockDependencies.notificationService.sentMessages).toHaveLength(0);
  });
});
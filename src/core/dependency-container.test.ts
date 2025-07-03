import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { DependencyContainer } from "./dependency-container.ts";
import { MockClock } from "../infrastructure/clock.ts";
import { MockLogger } from "../infrastructure/logger.ts";
import { MemoryStateRepository } from "../infrastructure/state-repository.ts";
import { MockUsageRepository } from "../infrastructure/usage-repository.ts";
import { MockNotificationService } from "../infrastructure/notification-service.ts";

describe("DependencyContainer", () => {
  let container: DependencyContainer;
  let originalProcessEnv: any;

  beforeEach(() => {
    // 環境変数をバックアップ
    originalProcessEnv = { ...process.env };
    
    // 新しいコンテナインスタンスを取得
    container = DependencyContainer.getInstance();
    
    // コンテナをリセット（テスト間の独立性確保）
    container.reset();
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalProcessEnv;
    
    // コンテナをリセット
    container.reset();
  });

  describe("シングルトンパターン", () => {
    test("同じインスタンスを返す", () => {
      const container1 = DependencyContainer.getInstance();
      const container2 = DependencyContainer.getInstance();
      
      expect(container1).toBe(container2);
    });

    test("リセット後も同じインスタンス", () => {
      const container1 = DependencyContainer.getInstance();
      container1.reset();
      const container2 = DependencyContainer.getInstance();
      
      expect(container1).toBe(container2);
    });
  });

  describe("Clock依存性", () => {
    test("プロダクションモードでSystemClockを返す", () => {
      process.env.NODE_ENV = "production";
      
      const clock1 = container.getClock();
      const clock2 = container.getClock();
      
      // 同じインスタンスを返すことを確認
      expect(clock1).toBe(clock2);
      
      // SystemClockのインスタンスであることを確認
      expect(clock1.constructor.name).toBe("SystemClock");
    });

    test("テストモードでMockClockを返す", () => {
      process.env.NODE_ENV = "test";
      
      const clock1 = container.getClock();
      const clock2 = container.getClock();
      
      expect(clock1).toBe(clock2);
      expect(clock1.constructor.name).toBe("MockClock");
    });

    test("NODE_ENV未設定時はSystemClockを返す", () => {
      delete process.env.NODE_ENV;
      
      const clock = container.getClock();
      expect(clock.constructor.name).toBe("SystemClock");
    });

    test("カスタムClockの設定", () => {
      const customClock = new MockClock(new Date(123456789));
      
      container.setClock(customClock);
      const retrievedClock = container.getClock();
      
      expect(retrievedClock).toBe(customClock);
      expect(retrievedClock.now().getTime()).toBe(123456789);
    });

    test("リセット後のClock再生成", () => {
      const clock1 = container.getClock();
      container.reset();
      const clock2 = container.getClock();
      
      // リセット後は新しいインスタンスが生成される
      expect(clock1).not.toBe(clock2);
    });
  });

  describe("Logger依存性", () => {
    test("構造化ログ有効時", () => {
      process.env.CCWATCH_STRUCTURED_LOGS = "true";
      process.env.NODE_ENV = "production";
      container.reset(); // 環境変数変更後にリセット
      
      const logger1 = container.getLogger();
      const logger2 = container.getLogger();
      
      expect(logger1).toBe(logger2);
      expect(logger1.constructor.name).toBe("ConsoleLogger");
    });

    test("構造化ログ無効時", () => {
      process.env.CCWATCH_STRUCTURED_LOGS = "false";
      process.env.NODE_ENV = "production";
      container.reset(); // 環境変数変更後にリセット
      
      const logger = container.getLogger();
      expect(logger.constructor.name).toBe("ConsoleLogger");
    });

    test("環境変数未設定時", () => {
      delete process.env.CCWATCH_STRUCTURED_LOGS;
      process.env.NODE_ENV = "production";
      container.reset(); // 環境変数変更後にリセット
      
      const logger = container.getLogger();
      expect(logger.constructor.name).toBe("ConsoleLogger");
    });

    test("テストモードでMockLoggerを返す", () => {
      process.env.NODE_ENV = "test";
      
      const logger1 = container.getLogger();
      const logger2 = container.getLogger();
      
      expect(logger1).toBe(logger2);
      expect(logger1.constructor.name).toBe("MockLogger");
    });

    test("カスタムLoggerの設定", () => {
      const customLogger = new MockLogger();
      
      container.setLogger(customLogger);
      const retrievedLogger = container.getLogger();
      
      expect(retrievedLogger).toBe(customLogger);
    });
  });

  describe("StateRepository依存性", () => {
    test("プロダクションモードでFileStateRepositoryを返す", () => {
      process.env.NODE_ENV = "production";
      
      const repo1 = container.getStateRepository();
      const repo2 = container.getStateRepository();
      
      expect(repo1).toBe(repo2);
      expect(repo1.constructor.name).toBe("FileStateRepository");
    });

    test("テストモードでMemoryStateRepositoryを返す", () => {
      process.env.NODE_ENV = "test";
      
      const repo1 = container.getStateRepository();
      const repo2 = container.getStateRepository();
      
      expect(repo1).toBe(repo2);
      expect(repo1.constructor.name).toBe("MemoryStateRepository");
    });

    test("カスタムStateRepositoryの設定", () => {
      const customRepo = new MemoryStateRepository();
      
      container.setStateRepository(customRepo);
      const retrievedRepo = container.getStateRepository();
      
      expect(retrievedRepo).toBe(customRepo);
    });
  });

  describe("UsageRepository依存性", () => {
    test("プロダクションモードでCCUsageRepositoryを返す", () => {
      process.env.NODE_ENV = "production";
      
      const repo1 = container.getUsageRepository();
      const repo2 = container.getUsageRepository();
      
      expect(repo1).toBe(repo2);
      expect(repo1.constructor.name).toBe("CCUsageRepository");
    });

    test("テストモードでMockUsageRepositoryを返す", () => {
      process.env.NODE_ENV = "test";
      
      const repo1 = container.getUsageRepository();
      const repo2 = container.getUsageRepository();
      
      expect(repo1).toBe(repo2);
      expect(repo1.constructor.name).toBe("MockUsageRepository");
    });

    test("カスタムUsageRepositoryの設定", () => {
      const testData = {
        monthly: [{ month: "2025-07", totalCost: 50, modelsUsed: [], modelBreakdowns: [] }],
        totals: { totalCost: 50 }
      };
      const customRepo = new MockUsageRepository(testData);
      
      container.setUsageRepository(customRepo);
      const retrievedRepo = container.getUsageRepository();
      
      expect(retrievedRepo).toBe(customRepo);
    });
  });

  describe("NotificationService依存性", () => {
    test("プロダクションモードでSlackNotificationServiceを返す", () => {
      process.env.NODE_ENV = "production";
      
      const service1 = container.getNotificationService();
      const service2 = container.getNotificationService();
      
      expect(service1).toBe(service2);
      expect(service1.constructor.name).toBe("SlackNotificationService");
    });

    test("テストモードでMockNotificationServiceを返す", () => {
      process.env.NODE_ENV = "test";
      
      const service1 = container.getNotificationService();
      const service2 = container.getNotificationService();
      
      expect(service1).toBe(service2);
      expect(service1.constructor.name).toBe("MockNotificationService");
    });

    test("カスタムNotificationServiceの設定", () => {
      const customService = new MockNotificationService();
      
      container.setNotificationService(customService);
      const retrievedService = container.getNotificationService();
      
      expect(retrievedService).toBe(customService);
    });
  });

  describe("依存性の注入と取得", () => {
    test("全ての依存性が正しく注入される", () => {
      process.env.NODE_ENV = "test";
      
      const clock = container.getClock();
      const logger = container.getLogger();
      const stateRepo = container.getStateRepository();
      const usageRepo = container.getUsageRepository();
      const notificationService = container.getNotificationService();
      
      expect(clock).toBeDefined();
      expect(logger).toBeDefined();
      expect(stateRepo).toBeDefined();
      expect(usageRepo).toBeDefined();
      expect(notificationService).toBeDefined();
      
      // 再取得時に同じインスタンスを返すことを確認
      expect(container.getClock()).toBe(clock);
      expect(container.getLogger()).toBe(logger);
      expect(container.getStateRepository()).toBe(stateRepo);
      expect(container.getUsageRepository()).toBe(usageRepo);
      expect(container.getNotificationService()).toBe(notificationService);
    });

    test("カスタム依存性の組み合わせ", () => {
      const customClock = new MockClock(new Date(999999));
      const customLogger = new MockLogger();
      const customStateRepo = new MemoryStateRepository();
      const customUsageRepo = new MockUsageRepository({
        monthly: [],
        totals: { totalCost: 0 }
      });
      const customNotificationService = new MockNotificationService();
      
      container.setClock(customClock);
      container.setLogger(customLogger);
      container.setStateRepository(customStateRepo);
      container.setUsageRepository(customUsageRepo);
      container.setNotificationService(customNotificationService);
      
      expect(container.getClock()).toBe(customClock);
      expect(container.getLogger()).toBe(customLogger);
      expect(container.getStateRepository()).toBe(customStateRepo);
      expect(container.getUsageRepository()).toBe(customUsageRepo);
      expect(container.getNotificationService()).toBe(customNotificationService);
    });
  });

  describe("リセット機能", () => {
    test("リセット後に新しいインスタンスが生成される", () => {
      process.env.NODE_ENV = "test";
      
      const clock1 = container.getClock();
      const logger1 = container.getLogger();
      const stateRepo1 = container.getStateRepository();
      const usageRepo1 = container.getUsageRepository();
      const notificationService1 = container.getNotificationService();
      
      container.reset();
      
      const clock2 = container.getClock();
      const logger2 = container.getLogger();
      const stateRepo2 = container.getStateRepository();
      const usageRepo2 = container.getUsageRepository();
      const notificationService2 = container.getNotificationService();
      
      expect(clock2).not.toBe(clock1);
      expect(logger2).not.toBe(logger1);
      expect(stateRepo2).not.toBe(stateRepo1);
      expect(usageRepo2).not.toBe(usageRepo1);
      expect(notificationService2).not.toBe(notificationService1);
    });

    test("カスタム依存性もリセットされる", () => {
      const customClock = new MockClock(new Date(123456));
      
      container.setClock(customClock);
      expect(container.getClock()).toBe(customClock);
      
      container.reset();
      expect(container.getClock()).not.toBe(customClock);
    });
  });

  describe("環境変数の変更への対応", () => {
    test("CCWATCH_STRUCTURED_LOGSの動的変更", () => {
      process.env.CCWATCH_STRUCTURED_LOGS = "false";
      const logger1 = container.getLogger();
      
      // 環境変数を変更してもキャッシュされたインスタンスを返す
      process.env.CCWATCH_STRUCTURED_LOGS = "true";
      const logger2 = container.getLogger();
      
      expect(logger1).toBe(logger2);
      
      // リセット後は新しい設定が反映される
      container.reset();
      const logger3 = container.getLogger();
      
      expect(logger3).not.toBe(logger1);
    });

    test("NODE_ENVの動的変更", () => {
      process.env.NODE_ENV = "production";
      const clock1 = container.getClock();
      expect(clock1.constructor.name).toBe("SystemClock");
      
      process.env.NODE_ENV = "test";
      const clock2 = container.getClock();
      expect(clock2).toBe(clock1); // キャッシュされている
      
      container.reset();
      const clock3 = container.getClock();
      expect(clock3.constructor.name).toBe("MockClock");
    });
  });

  describe("エッジケース", () => {
    test("環境変数が存在しない場合のデフォルト動作", () => {
      delete process.env.NODE_ENV;
      delete process.env.CCWATCH_STRUCTURED_LOGS;
      
      const clock = container.getClock();
      const logger = container.getLogger();
      const stateRepo = container.getStateRepository();
      const usageRepo = container.getUsageRepository();
      const notificationService = container.getNotificationService();
      
      expect(clock.constructor.name).toBe("SystemClock");
      expect(logger.constructor.name).toBe("ConsoleLogger");
      expect(stateRepo.constructor.name).toBe("FileStateRepository");
      expect(usageRepo.constructor.name).toBe("CCUsageRepository");
      expect(notificationService.constructor.name).toBe("SlackNotificationService");
    });

    test("空文字列の環境変数", () => {
      process.env.NODE_ENV = "";
      process.env.CCWATCH_STRUCTURED_LOGS = "";
      
      const clock = container.getClock();
      const logger = container.getLogger();
      
      expect(clock.constructor.name).toBe("SystemClock");
      expect(logger.constructor.name).toBe("ConsoleLogger");
    });

    test("予期しない環境変数値", () => {
      process.env.NODE_ENV = "unknown";
      process.env.CCWATCH_STRUCTURED_LOGS = "invalid";
      
      const clock = container.getClock();
      const logger = container.getLogger();
      
      expect(clock.constructor.name).toBe("SystemClock");
      expect(logger.constructor.name).toBe("ConsoleLogger");
    });
  });
});
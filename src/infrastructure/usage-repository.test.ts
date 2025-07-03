import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { CCUsageRepository, MockUsageRepository } from "./usage-repository.ts";
import { MockLogger } from "./logger.ts";
import { MockSemaphore } from "./semaphore.ts";

// カスタムCCUsageRepositoryテスト用クラス
class TestableUsageRepository extends CCUsageRepository {
  constructor(
    logger: MockLogger,
    semaphore: MockSemaphore,
    private mockCommand?: () => Promise<string>
  ) {
    super(logger, semaphore);
  }

  // テスト用にコマンド実行部分をオーバーライド
  protected override async executeCommand(): Promise<string> {
    if (this.mockCommand) {
      return this.mockCommand();
    }
    return super.executeCommand();
  }
}

describe("CCUsageRepository", () => {
  let repository: TestableUsageRepository;
  let mockLogger: MockLogger;
  let mockSemaphore: MockSemaphore;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockSemaphore = new MockSemaphore();
  });

  test("基本的なインスタンス作成", () => {
    repository = new TestableUsageRepository(mockLogger, mockSemaphore);
    expect(repository).toBeInstanceOf(CCUsageRepository);
    expect(repository.fetchUsageData).toBeDefined();
    expect(typeof repository.fetchUsageData).toBe("function");
  });

  describe("並列実行制限", () => {
    test("セマフォ取得成功時の正常動作", async () => {
      // ccusageコマンドの正常実行をモック
      const mockCommand = vi.fn().mockResolvedValue(JSON.stringify({
        monthly: [{ month: "2025-07", totalCost: 50, modelsUsed: [], modelBreakdowns: [] }],
        totals: { totalCost: 50 }
      }));
      
      repository = new TestableUsageRepository(mockLogger, mockSemaphore, mockCommand);

      const result = await repository.fetchUsageData();

      expect(result.totals.totalCost).toBe(50);
      expect(mockSemaphore.getAcquireCount()).toBe(1);
      expect(mockSemaphore.getReleaseCount()).toBe(1);
      expect(mockLogger.hasLog("debug", "ccusage実行権取得完了")).toBe(true);
      expect(mockLogger.hasLog("debug", "ccusage実行権解放完了")).toBe(true);
    });

    test("セマフォ取得失敗時のタイムアウトエラー", async () => {
      repository = new TestableUsageRepository(mockLogger, mockSemaphore);
      
      // セマフォを既に取得状態に設定
      await mockSemaphore.acquire();

      await expect(repository.fetchUsageData()).rejects.toThrow(
        "ccusage実行タイムアウト: 他のプロセスが実行中または応答なし"
      );

      expect(mockSemaphore.getAcquireCount()).toBe(2); // 初回 + テスト内
      expect(mockLogger.hasLog("error", "ccusage実行タイムアウト")).toBe(true);
    });

    test("ccusage実行エラー時のセマフォ確実解放", async () => {
      const mockCommand = vi.fn().mockRejectedValue(new Error("ccusage execution failed"));
      repository = new TestableUsageRepository(mockLogger, mockSemaphore, mockCommand);

      await expect(repository.fetchUsageData()).rejects.toThrow("CCUsage data fetch failed");

      // エラーが発生してもセマフォが解放されることを確認
      expect(mockSemaphore.getAcquireCount()).toBe(1);
      expect(mockSemaphore.getReleaseCount()).toBe(1);
      expect(mockLogger.hasLog("debug", "ccusage実行権解放完了")).toBe(true);
    });

    test("データサイズ制限超過時のセマフォ確実解放", async () => {
      // 10MB超のデータをシミュレート
      const largeData = "x".repeat(11 * 1024 * 1024);
      const mockCommand = vi.fn().mockResolvedValue(largeData);
      repository = new TestableUsageRepository(mockLogger, mockSemaphore, mockCommand);

      await expect(repository.fetchUsageData()).rejects.toThrow("Usage data too large");

      expect(mockSemaphore.getAcquireCount()).toBe(1);
      expect(mockSemaphore.getReleaseCount()).toBe(1);
    });
  });

  describe("メモリ使用量制限", () => {
    test("データサイズ制限チェック", async () => {
      const mockCommand = vi.fn().mockResolvedValue("x".repeat(11 * 1024 * 1024)); // 11MB
      repository = new TestableUsageRepository(mockLogger, mockSemaphore, mockCommand);

      await expect(repository.fetchUsageData()).rejects.toThrow(
        /Usage data too large: \d+ bytes \(max: 10485760\)/
      );

      expect(mockLogger.hasLog("error", "使用量データ取得エラー")).toBe(true);
    });

    test("正常サイズのデータ処理", async () => {
      const normalData = {
        monthly: [{ month: "2025-07", totalCost: 100, modelsUsed: [], modelBreakdowns: [] }],
        totals: { totalCost: 100 }
      };
      
      const mockCommand = vi.fn().mockResolvedValue(JSON.stringify(normalData));
      repository = new TestableUsageRepository(mockLogger, mockSemaphore, mockCommand);

      const result = await repository.fetchUsageData();

      expect(result).toEqual(normalData);
      expect(mockLogger.hasLog("debug", "使用量データ取得完了")).toBe(true);
    });
  });

  describe("ログ機能", () => {
    test("セマフォ状態のログ記録", async () => {
      const mockCommand = vi.fn().mockResolvedValue(JSON.stringify({
        monthly: [],
        totals: { totalCost: 0 }
      }));
      repository = new TestableUsageRepository(mockLogger, mockSemaphore, mockCommand);

      await repository.fetchUsageData();

      // セマフォ状態がログに記録されていることを確認
      const startLog = mockLogger.logs.find(log => 
        log.message.includes("使用量データ取得開始") &&
        log.context?.semaphoreAvailable !== undefined
      );
      expect(startLog).toBeDefined();
    });
  });

});

describe("MockUsageRepository", () => {
  test("モックデータの返却", async () => {
    const testData = {
      monthly: [{
        month: "2025-07",
        totalCost: 100,
        modelsUsed: ["test-model"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 100 }
    };

    const mockRepo = new MockUsageRepository(testData);
    const result = await mockRepo.fetchUsageData();

    expect(result).toEqual(testData);
  });

  test("モックデータの変更", async () => {
    const initialData = {
      monthly: [{
        month: "2025-07",
        totalCost: 50,
        modelsUsed: ["model1"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 50 }
    };

    const updatedData = {
      monthly: [{
        month: "2025-07",
        totalCost: 75,
        modelsUsed: ["model2"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 75 }
    };

    const mockRepo = new MockUsageRepository(initialData);
    
    let result = await mockRepo.fetchUsageData();
    expect(result).toEqual(initialData);

    mockRepo.setMockData(updatedData);
    
    result = await mockRepo.fetchUsageData();
    expect(result).toEqual(updatedData);
  });

  test("オブジェクトの参照独立性", async () => {
    const originalData = {
      monthly: [{
        month: "2025-07",
        totalCost: 50,
        modelsUsed: ["model1"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 50 }
    };

    const mockRepo = new MockUsageRepository(originalData);
    const result = await mockRepo.fetchUsageData();

    // オリジナルデータを変更
    originalData.totals.totalCost = 100;

    // 取得したデータは影響を受けないことを確認（deep copyのため）
    expect(result.totals.totalCost).toBe(50);

    // 新しく取得したデータは変更後のオリジナルデータを反映
    const newResult = await mockRepo.fetchUsageData();
    expect(newResult.totals.totalCost).toBe(100);
  });

  test("空のデータセット", async () => {
    const emptyData = {
      monthly: [],
      totals: { totalCost: 0 }
    };

    const mockRepo = new MockUsageRepository(emptyData);
    const result = await mockRepo.fetchUsageData();

    expect(result).toEqual(emptyData);
    expect(result.monthly).toHaveLength(0);
  });

  test("複雑なデータ構造", async () => {
    const complexData = {
      monthly: [{
        month: "2025-07",
        totalCost: 123.45,
        modelsUsed: ["claude-sonnet-4", "claude-haiku-3"],
        modelBreakdowns: [
          {
            model: "claude-sonnet-4",
            inputTokens: 10000,
            outputTokens: 5000,
            cost: 100.00
          },
          {
            model: "claude-haiku-3",
            inputTokens: 5000,
            outputTokens: 2500,
            cost: 23.45
          }
        ]
      }],
      totals: { totalCost: 123.45 }
    };

    const mockRepo = new MockUsageRepository(complexData);
    const result = await mockRepo.fetchUsageData();

    expect(result).toEqual(complexData);
    expect(result.monthly[0]?.modelBreakdowns).toHaveLength(2);
  });
});
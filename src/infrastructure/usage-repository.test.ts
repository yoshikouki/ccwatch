import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { CCUsageRepository, MockUsageRepository } from "./usage-repository.ts";
import { MockLogger } from "./logger.ts";

describe("CCUsageRepository", () => {
  let repository: CCUsageRepository;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    repository = new CCUsageRepository(mockLogger);
  });

  test("正常なデータ取得", async () => {
    const mockData = {
      monthly: [{
        month: "2025-07",
        totalCost: 45.50,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 45.50 }
    };

    // Bunのdynamic importとプロセス実行をモック
    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue(JSON.stringify(mockData))
      })
    };

    // Dynamic importをモック
    vi.doMock("bun", () => mockBun);

    const result = await repository.fetchUsageData();

    expect(result).toEqual(mockData);
    expect(mockLogger.hasLog("debug", "使用量データ取得開始")).toBe(true);
    expect(mockLogger.hasLog("debug", "使用量データ取得完了")).toBe(true);
  });

  test("ccusageコマンドが存在しない場合", async () => {
    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockRejectedValue(new Error("Command not found: ccusage"))
      })
    };

    vi.doMock("bun", () => mockBun);

    await expect(repository.fetchUsageData()).rejects.toThrow("CCUsage data fetch failed");
    expect(mockLogger.hasLog("error", "使用量データ取得エラー")).toBe(true);
  });

  test("無効なJSONレスポンス", async () => {
    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue("invalid json response")
      })
    };

    vi.doMock("bun", () => mockBun);

    await expect(repository.fetchUsageData()).rejects.toThrow("CCUsage data fetch failed");
    expect(mockLogger.hasLog("error", "使用量データ取得エラー")).toBe(true);
  });

  test("ネットワークエラー", async () => {
    const networkError = new Error("Network timeout");
    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockRejectedValue(networkError)
      })
    };

    vi.doMock("bun", () => mockBun);

    await expect(repository.fetchUsageData()).rejects.toThrow("CCUsage data fetch failed: Network timeout");
    expect(mockLogger.hasLog("error", "使用量データ取得エラー")).toBe(true);
  });

  test("ccusageコマンドの権限エラー", async () => {
    const permissionError = new Error("Permission denied");
    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockRejectedValue(permissionError)
      })
    };

    vi.doMock("bun", () => mockBun);

    await expect(repository.fetchUsageData()).rejects.toThrow("CCUsage data fetch failed: Permission denied");
  });

  test("空のレスポンス", async () => {
    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue("")
      })
    };

    vi.doMock("bun", () => mockBun);

    await expect(repository.fetchUsageData()).rejects.toThrow("CCUsage data fetch failed");
  });

  test("部分的なデータレスポンス", async () => {
    const partialData = {
      monthly: [],
      totals: { totalCost: 0 }
    };

    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue(JSON.stringify(partialData))
      })
    };

    vi.doMock("bun", () => mockBun);

    const result = await repository.fetchUsageData();

    expect(result).toEqual(partialData);
    expect(mockLogger.logs.some(log => 
      log.level === "debug" && 
      log.context?.monthCount === 0
    )).toBe(true);
  });

  test("大量データのレスポンス", async () => {
    const largeData = {
      monthly: Array.from({ length: 12 }, (_, i) => ({
        month: `2025-${(i + 1).toString().padStart(2, '0')}`,
        totalCost: (i + 1) * 10,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      })),
      totals: { totalCost: 780 }
    };

    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue(JSON.stringify(largeData))
      })
    };

    vi.doMock("bun", () => mockBun);

    const result = await repository.fetchUsageData();

    expect(result).toEqual(largeData);
    expect(mockLogger.logs.some(log => 
      log.level === "debug" && 
      log.context?.monthCount === 12
    )).toBe(true);
  });

  test("非Error例外のハンドリング", async () => {
    const mockBun = {
      $: vi.fn().mockReturnValue({
        text: vi.fn().mockRejectedValue("String error")
      })
    };

    vi.doMock("bun", () => mockBun);

    await expect(repository.fetchUsageData()).rejects.toThrow("CCUsage data fetch failed: String error");
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

    // 取得したデータは影響を受けないことを確認
    expect(result.totals.totalCost).toBe(50);

    // 新しく取得したデータも影響を受けないことを確認
    const newResult = await mockRepo.fetchUsageData();
    expect(newResult.totals.totalCost).toBe(50);
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
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

  test("基本的なインスタンス作成", () => {
    expect(repository).toBeInstanceOf(CCUsageRepository);
    expect(repository.fetchUsageData).toBeDefined();
    expect(typeof repository.fetchUsageData).toBe("function");
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
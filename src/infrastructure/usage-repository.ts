import type { UsageDataRepository, CCUsageData, Logger } from "../core/interfaces.ts";

export class CCUsageRepository implements UsageDataRepository {
  constructor(private logger: Logger) {}

  async fetchUsageData(): Promise<CCUsageData> {
    this.logger.debug("使用量データ取得開始", { component: 'usage-repository' });

    try {
      const { $ } = await import("bun");
      const result = await $`ccusage --format json`.text();
      
      const parsedData = JSON.parse(result) as CCUsageData;
      
      this.logger.debug("使用量データ取得完了", { 
        component: 'usage-repository',
        monthCount: parsedData.monthly.length 
      });
      
      return parsedData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error("使用量データ取得エラー", {
        component: 'usage-repository',
        error: errorMessage
      });
      throw new Error(`CCUsage data fetch failed: ${errorMessage}`);
    }
  }
}

// テスト用のモック実装
export class MockUsageRepository implements UsageDataRepository {
  constructor(private mockData: CCUsageData) {}

  async fetchUsageData(): Promise<CCUsageData> {
    return { ...this.mockData };
  }

  setMockData(data: CCUsageData): void {
    this.mockData = data;
  }
}
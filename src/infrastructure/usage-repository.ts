import type { UsageDataRepository, CCUsageData, Logger } from "../core/interfaces.ts";

export class CCUsageRepository implements UsageDataRepository {
  private readonly MAX_DATA_SIZE = 10 * 1024 * 1024; // 10MB制限

  constructor(private logger: Logger) {}

  async fetchUsageData(): Promise<CCUsageData> {
    this.logger.debug("使用量データ取得開始", { component: 'usage-repository' });

    try {
      const { $ } = await import("bun");
      const result = await $`ccusage --format json`.text();
      
      // データサイズチェックでメモリ使用量制限
      if (result.length > this.MAX_DATA_SIZE) {
        throw new Error(`Usage data too large: ${result.length} bytes (max: ${this.MAX_DATA_SIZE})`);
      }
      
      const parsedData = JSON.parse(result) as CCUsageData;
      
      this.logger.debug("使用量データ取得完了", { 
        component: 'usage-repository',
        monthCount: parsedData.monthly.length,
        dataSize: result.length
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
    // 構造化クローニングでより効率的なディープコピー
    // JSON.parse/stringifyより高速でメモリ効率が良い
    try {
      return structuredClone(this.mockData);
    } catch {
      // structuredCloneが利用できない環境ではフォールバック
      return JSON.parse(JSON.stringify(this.mockData));
    }
  }

  setMockData(data: CCUsageData): void {
    this.mockData = data;
  }
}
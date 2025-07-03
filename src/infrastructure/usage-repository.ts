import type { UsageDataRepository, CCUsageData, Logger } from "../core/interfaces.ts";
import { BinarySemaphore, type Semaphore } from "./semaphore.ts";
import { NodeCommandExecutor, type CommandExecutor } from "./command-executor.ts";

export class CCUsageRepository implements UsageDataRepository {
  private readonly MAX_DATA_SIZE = 10 * 1024 * 1024; // 10MB制限
  private readonly EXECUTION_TIMEOUT = 30000; // 30秒タイムアウト
  private readonly executionSemaphore: Semaphore;
  private readonly commandExecutor: CommandExecutor;

  constructor(
    private logger: Logger,
    semaphore?: Semaphore,
    commandExecutor?: CommandExecutor
  ) {
    this.executionSemaphore = semaphore || new BinarySemaphore('ccusage-execution');
    this.commandExecutor = commandExecutor || new NodeCommandExecutor();
  }

  async fetchUsageData(): Promise<CCUsageData> {
    this.logger.debug("使用量データ取得開始", { 
      component: 'usage-repository',
      semaphoreAvailable: this.executionSemaphore.getAvailablePermits()
    });

    // セマフォによる並列実行制限
    const acquired = await this.executionSemaphore.acquire(this.EXECUTION_TIMEOUT);
    if (!acquired) {
      const error = "ccusage実行タイムアウト: 他のプロセスが実行中または応答なし";
      this.logger.error(error, {
        component: 'usage-repository',
        timeout: this.EXECUTION_TIMEOUT
      });
      throw new Error(error);
    }

    try {
      this.logger.debug("ccusage実行権取得完了", { 
        component: 'usage-repository'
      });

      const result = await this.commandExecutor.execute("ccusage --format json", {
        maxBuffer: this.MAX_DATA_SIZE
      });
      
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
    } finally {
      // 必ずセマフォを解放
      this.executionSemaphore.release();
      this.logger.debug("ccusage実行権解放完了", { 
        component: 'usage-repository'
      });
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
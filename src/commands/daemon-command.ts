import { BaseCommand } from "./base-command.ts";
import { CheckUsageCommand } from "./check-usage-command.ts";
import type { CheckUsageDependencies } from "./check-usage-command.ts";
import type { Config, Result, DaemonState, Logger } from "../core/interfaces.ts";
import { ResultUtils } from "../utils/result.ts";

export interface DaemonInput {
  config: Config;
}

export interface DaemonOutput {
  finalState: DaemonState;
  checkCount: number;
}

export class DaemonCommand extends BaseCommand<DaemonInput, DaemonOutput> {
  private isShuttingDown = false;
  private intervalId: Timer | null = null;
  private checkCount = 0;

  constructor(
    private dependencies: CheckUsageDependencies,
    private logger: Logger
  ) {
    super();
  }

  async execute(input: DaemonInput): Promise<Result<DaemonOutput>> {
    return this.safeExecute(async () => {
      const { config } = input;
      
      this.logger.info("ccwatch daemon starting", { 
        threshold: config.threshold,
        interval: config.interval,
        component: 'daemon' 
      });

      // 初期状態読み込み
      let currentState = await this.dependencies.stateRepository.load();
      
      // シグナルハンドリング設定
      await this.setupGracefulShutdown();

      // 初回実行
      const checkUsageCommand = new CheckUsageCommand(this.dependencies);
      const firstResult = await checkUsageCommand.execute({ config, state: currentState });
      
      if (ResultUtils.isSuccess(firstResult)) {
        currentState = firstResult.data.newState;
        await this.dependencies.stateRepository.save(currentState);
        this.checkCount++;
      }

      // 定期実行開始
      await this.startPeriodicChecks(config, currentState, checkUsageCommand);

      return {
        finalState: currentState,
        checkCount: this.checkCount
      };
    }, "デーモン実行に失敗しました");
  }

  private async startPeriodicChecks(
    config: Config, 
    initialState: DaemonState,
    checkUsageCommand: CheckUsageCommand
  ): Promise<void> {
    let currentState = initialState;

    return new Promise((resolve, reject) => {
      this.intervalId = setInterval(async () => {
        if (this.isShuttingDown) {
          this.cleanup();
          resolve();
          return;
        }

        try {
          const result = await checkUsageCommand.execute({ config, state: currentState });
          
          if (ResultUtils.isSuccess(result)) {
            currentState = result.data.newState;
            await this.dependencies.stateRepository.save(currentState);
            this.checkCount++;
          } else {
            this.logger.error("定期チェックでエラーが発生しました", {
              error: result.error.message,
              component: 'daemon'
            });
          }
        } catch (error) {
          this.logger.error("予期しないエラーが発生しました", {
            error: error instanceof Error ? error.message : String(error),
            component: 'daemon'
          });
        }
      }, config.interval * 1000);
    });
  }

  private async setupGracefulShutdown(): Promise<void> {
    const shutdown = () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      this.logger.info("ccwatch daemon stopping", { component: 'daemon' });
      this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  private cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // テスト用のメソッド
  public forceShutdown(): boolean {
    if (this.isShuttingDown) {
      return false; // 既にシャットダウン中
    }
    this.isShuttingDown = true;
    this.cleanup();
    return true; // シャットダウン実行成功
  }
}
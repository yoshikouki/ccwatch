import { ArgumentParser } from "./cli/argument-parser.ts";
import { DependencyContainer } from "./core/dependency-container.ts";
import { CheckUsageCommand } from "./commands/check-usage-command.ts";
import { DaemonCommand } from "./commands/daemon-command.ts";
import { ResultUtils } from "./utils/result.ts";

export class Application {
  private container = DependencyContainer.getInstance();

  async run(): Promise<void> {
    const parser = new ArgumentParser();
    const configResult = parser.parse();
    
    if (ResultUtils.isFailure(configResult)) {
      if (configResult.error.message === "HELP_REQUESTED") {
        process.exit(0);
        return; // 念のため
      }
      console.error("❌ 設定エラー:", configResult.error.message);
      process.exit(1);
    }

    const config = configResult.data;
    const useStructuredLogging = process.env.CCWATCH_STRUCTURED_LOGGING === 'true';
    const dependencies = this.container.getDependencies(useStructuredLogging);

    try {
      if (config.daemon) {
        await this.runDaemonMode(config, dependencies);
      } else {
        await this.runOnceMode(config, dependencies);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      dependencies.logger.error("アプリケーション実行エラー", {
        error: errorMessage,
        component: 'application'
      });
      process.exit(1);
    }
  }

  private async runDaemonMode(config: any, dependencies: any): Promise<void> {
    const daemonCommand = new DaemonCommand(dependencies, dependencies.logger);
    const result = await daemonCommand.execute({ config });
    
    if (ResultUtils.isFailure(result)) {
      throw result.error;
    }
    
    dependencies.logger.info("デーモン実行完了", {
      checkCount: result.data.checkCount,
      component: 'application'
    });
  }

  private async runOnceMode(config: any, dependencies: any): Promise<void> {
    dependencies.logger.info(`Claude Code使用量監視開始 (閾値: $${config.threshold})`, {
      threshold: config.threshold,
      component: 'application'
    });

    // 初期状態読み込み
    const initialState = await dependencies.stateRepository.load();
    
    // 使用量チェック実行
    const checkUsageCommand = new CheckUsageCommand(dependencies);
    const result = await checkUsageCommand.execute({ config, state: initialState });
    
    if (ResultUtils.isFailure(result)) {
      throw result.error;
    }

    const { newState, thresholdExceeded, notificationSent } = result.data;
    
    // 状態保存
    await dependencies.stateRepository.save(newState);
    
    dependencies.logger.info("単発実行完了", {
      thresholdExceeded,
      notificationSent,
      component: 'application'
    });
  }

  // テスト用: 依存関係を設定
  setDependencies(dependencies: any): void {
    this.container.setDependencies(dependencies);
  }
}

// メイン実行
if (import.meta.main) {
  const app = new Application();
  app.run().catch((error) => {
    console.error("予期しないエラーが発生しました:", error);
    process.exit(1);
  });
}
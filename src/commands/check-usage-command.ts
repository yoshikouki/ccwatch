import { BaseCommand } from "./base-command.ts";
import { 
  Config, 
  Result, 
  DaemonState, 
  Clock, 
  Logger, 
  UsageDataRepository, 
  NotificationService,
  StateRepository 
} from "../core/interfaces.ts";
import { ResultUtils } from "../utils/result.ts";

export interface CheckUsageInput {
  config: Config;
  state: DaemonState;
}

export interface CheckUsageOutput {
  newState: DaemonState;
  thresholdExceeded: boolean;
  notificationSent: boolean;
}

export interface CheckUsageDependencies {
  clock: Clock;
  logger: Logger;
  usageRepository: UsageDataRepository;
  notificationService: NotificationService;
  stateRepository: StateRepository;
}

export class CheckUsageCommand extends BaseCommand<CheckUsageInput, CheckUsageOutput> {
  constructor(private dependencies: CheckUsageDependencies) {
    super();
  }

  async execute(input: CheckUsageInput): Promise<Result<CheckUsageOutput>> {
    return this.safeExecute(async () => {
      const { config, state } = input;
      const { clock, logger, usageRepository, notificationService } = this.dependencies;

      logger.info("使用量チェック開始", { 
        threshold: config.threshold,
        component: 'usage-checker' 
      });

      // 使用量データ取得
      const usageDataResult = await this.fetchUsageData();
      if (ResultUtils.isFailure(usageDataResult)) {
        throw usageDataResult.error;
      }

      const usageData = usageDataResult.data;
      const currentMonth = clock.getCurrentMonth();
      
      // 当月データを検索
      const currentMonthUsage = usageData.monthly.find(
        (month) => month.month === currentMonth
      );

      if (!currentMonthUsage) {
        logger.warn(`${currentMonth}の使用データが見つかりません`, {
          component: 'usage-checker'
        });
        return {
          newState: state,
          thresholdExceeded: false,
          notificationSent: false
        };
      }

      const currentCost = currentMonthUsage.totalCost;
      logger.info(`${currentMonth}の現在のコスト: $${currentCost.toFixed(2)}`, {
        component: 'usage-checker',
        cost: currentCost,
        threshold: config.threshold
      });

      const thresholdExceeded = currentCost > config.threshold;
      let notificationSent = false;
      let newState = state;

      if (thresholdExceeded) {
        const excess = currentCost - config.threshold;
        logger.warn(`閾値超過！ 超過額: $${excess.toFixed(2)}`, {
          component: 'usage-checker',
          excess,
          threshold: config.threshold
        });

        // 通知判定
        if (this.shouldSendNotification(state, thresholdExceeded)) {
          if (config.slackWebhookUrl) {
            const message = this.formatCostMessage(currentMonthUsage, config.threshold);
            await notificationService.send(message, config.slackWebhookUrl);
            
            logger.info("Slack通知を送信しました", { component: 'usage-checker' });
            notificationSent = true;
            
            // 状態更新
            newState = {
              ...state,
              lastNotificationDate: clock.getToday(),
              lastExceedanceDate: clock.getToday()
            };
          } else {
            logger.warn("CCWATCH_SLACK_WEBHOOK_URL環境変数が設定されていないため、Slack通知をスキップします", {
              component: 'usage-checker'
            });
          }
        } else {
          logger.info("通知は既に送信済みのためスキップします", {
            component: 'usage-checker'
          });
        }
      } else {
        const remaining = config.threshold - currentCost;
        logger.info(`現在は閾値内です (残り: $${remaining.toFixed(2)})`, {
          component: 'usage-checker',
          remaining,
          threshold: config.threshold
        });
      }

      return {
        newState,
        thresholdExceeded,
        notificationSent
      };
    }, "使用量チェックに失敗しました");
  }

  private async fetchUsageData() {
    return this.safeExecute(
      () => this.dependencies.usageRepository.fetchUsageData(),
      "使用量データの取得に失敗しました"
    );
  }

  private shouldSendNotification(state: DaemonState, exceeded: boolean): boolean {
    if (!exceeded) {
      return false;
    }

    const today = this.dependencies.clock.getToday();
    
    // 今日既に通知済みの場合はスキップ
    if (state.lastNotificationDate === today) {
      return false;
    }

    // 前回の超過日と異なる日に超過している場合は通知
    if (state.lastExceedanceDate !== today) {
      return true;
    }

    // 同日内での初回通知の場合
    return state.lastNotificationDate !== today;
  }

  private formatCostMessage(usage: any, threshold: number): string {
    const excess = usage.totalCost - threshold;
    const models = usage.modelsUsed.length > 0 ? usage.modelsUsed.join(", ") : "不明";
    
    return `🚨 *Claude Code使用料金が閾値を超過しました* 🚨

📊 **${usage.month}の使用状況**
• 現在のコスト: $${usage.totalCost.toFixed(2)}
• 設定閾値: $${threshold.toFixed(2)}
• 超過額: $${excess.toFixed(2)}
• 使用モデル: ${models}

適切な使用量管理をお願いします。`;
  }
}
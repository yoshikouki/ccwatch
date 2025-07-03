import type { Config, ValidationError, Result } from "../core/interfaces.ts";
import { ResultUtils } from "../utils/result.ts";

export class ArgumentParser {
  parse(): Result<Config> {
    try {
      const args = process.argv.slice(2);
      
      if (args.includes('-h') || args.includes('--help')) {
        this.showHelp();
        return ResultUtils.failure(new Error("HELP_REQUESTED"));
      }

      // 闾値を見つける（フラグでない最初の引数、または負の数値）
      let threshold: number | undefined;
      let thresholdArg: string | undefined;
      for (const arg of args) {
        if (!arg.startsWith('-') || /^-?\d+(\.\d+)?$/.test(arg)) {
          thresholdArg = arg;
          const parsed = parseFloat(arg);
          if (!isNaN(parsed)) {
            threshold = parsed;
          }
          break;
        }
      }

      if (thresholdArg === undefined) {
        return ResultUtils.failure(new Error("Threshold argument is required"));
      }
      
      if (threshold === undefined) {
        return ResultUtils.failure(new Error("Threshold must be a valid number"));
      }

      const daemon = args.includes('--daemon');
      let interval = 3600; // デフォルト1時間

      const intervalIndex = args.findIndex(arg => arg === '--interval');
      if (intervalIndex !== -1 && intervalIndex + 1 < args.length) {
        interval = parseInt(args[intervalIndex + 1]!, 10);
      }

      const slackWebhookUrl = process.env.CCWATCH_SLACK_WEBHOOK_URL;

      // バリデーション
      const validationErrors = this.validate({ threshold, daemon, interval, slackWebhookUrl });
      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map(e => e.message).join(', ');
        return ResultUtils.failure(new Error(errorMessages));
      }

      return ResultUtils.success({
        threshold,
        daemon,
        interval,
        slackWebhookUrl
      });
    } catch (error) {
      return ResultUtils.failure(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private validate(config: Partial<Config>): ValidationError[] {
    const errors: ValidationError[] = [];

    // 閾値検証
    if (config.threshold !== undefined) {
      const thresholdError = this.validateThreshold(config.threshold);
      if (thresholdError) errors.push(thresholdError);
    }

    // インターバル検証
    if (config.interval !== undefined) {
      const intervalError = this.validateInterval(config.interval);
      if (intervalError) errors.push(intervalError);
    }

    // Slack URL検証
    if (config.slackWebhookUrl) {
      const urlError = this.validateSlackWebhookUrl(config.slackWebhookUrl);
      if (urlError) errors.push(urlError);
    }

    return errors;
  }

  private validateThreshold(threshold: number): ValidationError | null {
    if (isNaN(threshold)) {
      return {
        field: 'threshold',
        value: threshold,
        message: 'Threshold must be a valid number'
      };
    }
    
    if (!isFinite(threshold)) {
      return {
        field: 'threshold',
        value: threshold,
        message: 'Threshold must be finite'
      };
    }
    
    if (threshold <= 0) {
      return {
        field: 'threshold',
        value: threshold,
        message: 'Threshold must be greater than 0'
      };
    }
    
    if (threshold > 10000) {
      return {
        field: 'threshold',
        value: threshold,
        message: 'Threshold must be less than $10,000'
      };
    }
    
    return null;
  }

  private validateInterval(interval: number): ValidationError | null {
    if (isNaN(interval) || !isFinite(interval)) {
      return {
        field: 'interval',
        value: interval,
        message: 'Interval must be a valid number'
      };
    }
    
    if (interval < 10) {
      return {
        field: 'interval',
        value: interval,
        message: 'Interval must be at least 10 seconds'
      };
    }
    
    if (interval > 86400) {
      return {
        field: 'interval',
        value: interval,
        message: 'Interval must be less than 24 hours (86400 seconds)'
      };
    }
    
    return null;
  }

  private validateSlackWebhookUrl(url: string): ValidationError | null {
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.hostname.includes('slack.com')) {
        return {
          field: 'slackWebhookUrl',
          value: url,
          message: 'Slack webhook URL must be from slack.com domain'
        };
      }
      return null;
    } catch {
      return {
        field: 'slackWebhookUrl',
        value: url,
        message: 'Invalid Slack webhook URL format'
      };
    }
  }

  private showHelp(): void {
    console.log(`ccwatch - Claude Code usage monitor with Slack notifications

USAGE:
  ccwatch <threshold> [OPTIONS]

ARGUMENTS:
  <threshold>           Dollar amount threshold (e.g., 33 for $33)

OPTIONS:
  -h, --help           Show this help message
  --daemon             Run in daemon mode (continuous monitoring)
  --interval <sec>     Check interval in seconds (default: 3600)

EXAMPLES:
  ccwatch 33                              # Check once with $33 threshold
  ccwatch 50 --daemon                     # Monitor continuously every hour
  ccwatch 33 --daemon --interval 1800     # Monitor every 30 minutes
  
  # Background execution:
  nohup ccwatch 33 --daemon > ccwatch.log 2>&1 &

ENVIRONMENT VARIABLES:
  CCWATCH_SLACK_WEBHOOK_URL      Slack webhook URL for notifications (optional)

DAEMON MODE FEATURES:
  • Automatic periodic monitoring
  • Duplicate notification prevention (once per day)
  • Graceful shutdown with Ctrl+C
  • State persistence in ~/.ccwatch-state.json
  • Timestamped logging

For more information, visit: https://github.com/yoshikouki/ccwatch`);
  }
}
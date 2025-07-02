#!/usr/bin/env node

import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

interface MonthlyUsage {
  readonly month: string;
  readonly totalCost: number;
  readonly modelsUsed: readonly string[];
  readonly modelBreakdowns: readonly {
    readonly modelName: string;
    readonly cost: number;
  }[];
}

interface CCUsageData {
  readonly monthly: readonly MonthlyUsage[];
  readonly totals: {
    readonly totalCost: number;
  };
}

interface Config {
  readonly threshold: number;
  readonly slackWebhookUrl?: string;
  readonly checkCurrentMonth?: boolean;
  readonly daemon?: boolean;
  readonly interval?: number;
}

interface ValidationError {
  readonly field: string;
  readonly value: unknown;
  readonly message: string;
}

class ConfigValidationError extends Error {
  constructor(public readonly errors: readonly ValidationError[]) {
    super(`Configuration validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'ConfigValidationError';
  }
}

// 外部依存の抽象化（DI対応）
interface Dependencies {
  readonly fetchUsageData: () => Promise<CCUsageData>;
  readonly sendNotification: (message: string, webhookUrl: string) => Promise<void>;
  readonly readState: () => Promise<DaemonState>;
  readonly saveState: (state: DaemonState) => Promise<void>;
  readonly logger: Logger;
}

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogContext {
  readonly timestamp?: string;
  readonly level?: LogLevel;
  readonly component?: string;
  readonly correlationId?: string;
  readonly [key: string]: unknown;
}

interface Logger {
  readonly debug: (message: string, context?: LogContext) => void;
  readonly info: (message: string, context?: LogContext) => void;
  readonly warn: (message: string, context?: LogContext) => void;
  readonly error: (message: string, context?: LogContext) => void;
  readonly log: (message: string) => void; // 後方互換性
  readonly logWithTimestamp: (message: string) => void; // 後方互換性
}

class StructuredLogger implements Logger {
  private readonly minLevel: LogLevel;
  private readonly component: string;
  
  constructor(minLevel: LogLevel = LogLevel.INFO, component: string = 'ccwatch') {
    this.minLevel = minLevel;
    this.component = component;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }
  
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = context?.timestamp || new Date().toISOString();
    const levelName = LogLevel[level];
    const component = context?.component || this.component;
    const correlationId = context?.correlationId || '';
    
    const baseLog = {
      timestamp,
      level: levelName,
      component,
      message,
      ...(correlationId && { correlationId }),
      ...context
    };
    
    // 構造化ログとして出力
    return JSON.stringify(baseLog);
  }
  
  private write(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;
    
    const formatted = this.formatMessage(level, message, context);
    
    if (level >= LogLevel.ERROR) {
      console.error(formatted);
    } else if (level >= LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
  
  debug(message: string, context?: LogContext): void {
    this.write(LogLevel.DEBUG, message, context);
  }
  
  info(message: string, context?: LogContext): void {
    this.write(LogLevel.INFO, message, context);
  }
  
  warn(message: string, context?: LogContext): void {
    this.write(LogLevel.WARN, message, context);
  }
  
  error(message: string, context?: LogContext): void {
    this.write(LogLevel.ERROR, message, context);
  }
  
  // 後方互換性のためのメソッド
  log(message: string): void {
    this.info(message);
  }
  
  logWithTimestamp(message: string): void {
    this.info(message, { timestamp: new Date().toISOString() });
  }
}

class DefaultLogger implements Logger {
  debug(message: string, context?: LogContext): void {
    console.log(`[DEBUG] ${message}`);
  }
  
  info(message: string, context?: LogContext): void {
    console.log(`[INFO] ${message}`);
  }
  
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`);
  }
  
  error(message: string, context?: LogContext): void {
    console.error(`[ERROR] ${message}`);
  }
  
  log(message: string): void {
    console.log(message);
  }
  
  logWithTimestamp(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }
}

function createDefaultDependencies(useStructuredLogging: boolean = false): Dependencies {
  const logger = useStructuredLogging 
    ? new StructuredLogger(LogLevel.INFO, 'ccwatch')
    : new DefaultLogger();
  
  return {
    fetchUsageData: getCCUsageData,
    sendNotification: sendSlackNotification,
    readState: loadDaemonState,
    saveState: saveDaemonState,
    logger
  };
}

interface DaemonState {
  readonly lastNotificationDate?: string;
  readonly lastExceedanceDate?: string;
}

let isShuttingDown: boolean = false;
let intervalId: Timer | null = null;

export function showHelp(): void {
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

function validateThreshold(threshold: number): ValidationError | null {
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
      message: 'Threshold must be a finite number (not Infinity or -Infinity)'
    };
  }
  
  if (threshold <= 0) {
    return {
      field: 'threshold',
      value: threshold, 
      message: 'Threshold must be a positive number greater than 0'
    };
  }
  
  if (threshold > 1000000) {
    return {
      field: 'threshold',
      value: threshold,
      message: 'Threshold must be less than $1,000,000 for practical usage'
    };
  }
  
  return null;
}

function validateInterval(interval: number): ValidationError | null {
  if (isNaN(interval)) {
    return {
      field: 'interval',
      value: interval,
      message: 'Interval must be a valid number'
    };
  }
  
  if (!isFinite(interval)) {
    return {
      field: 'interval',
      value: interval, 
      message: 'Interval must be a finite number'
    };
  }
  
  if (interval <= 0) {
    return {
      field: 'interval',
      value: interval,
      message: 'Interval must be a positive number greater than 0'
    };
  }
  
  if (interval < 10) {
    return {
      field: 'interval',
      value: interval,
      message: 'Interval must be at least 10 seconds to avoid excessive API calls'
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

function validateSlackWebhookUrl(url: string): ValidationError | null {
  if (!url || url.trim() === '') {
    return {
      field: 'slackWebhookUrl',
      value: url,
      message: 'Slack webhook URL cannot be empty'
    };
  }
  
  try {
    const urlObj = new URL(url);
    
    if (!urlObj.protocol.startsWith('http')) {
      return {
        field: 'slackWebhookUrl',
        value: url,
        message: 'Slack webhook URL must use HTTP or HTTPS protocol'
      };
    }
    
    if (!urlObj.hostname.includes('hooks.slack.com')) {
      return {
        field: 'slackWebhookUrl',
        value: url,
        message: 'URL must be a valid Slack webhook URL (hooks.slack.com)'
      };
    }
    
  } catch (error) {
    return {
      field: 'slackWebhookUrl',
      value: url,
      message: 'Slack webhook URL format is invalid'
    };
  }
  
  return null;
}

export { checkUsageOnce };

export function parseArgs(): Config {
  const args = process.argv.slice(2);
  
  // ヘルプオプションのチェック
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  if (args.length === 0) {
    console.error("Error: Missing threshold argument\n");
    showHelp();
    process.exit(1);
  }

  const threshold = parseFloat(args[0]!);
  const thresholdValidation = validateThreshold(threshold);
  if (thresholdValidation) {
    console.error(`Error: ${thresholdValidation.message}`);
    process.exit(1);
  }

  const daemon = args.includes('--daemon');
  let interval = 3600; // デフォルト1時間

  const intervalIndex = args.indexOf('--interval');
  if (intervalIndex !== -1 && intervalIndex + 1 < args.length) {
    const intervalValue = parseInt(args[intervalIndex + 1]!);
    const intervalValidation = validateInterval(intervalValue);
    if (intervalValidation) {
      console.error(`Error: ${intervalValidation.message}`);
      process.exit(1);
    }
    interval = intervalValue;
  }

  const config = {
    threshold,
    slackWebhookUrl: process.env.CCWATCH_SLACK_WEBHOOK_URL,
    checkCurrentMonth: true,
    daemon,
    interval,
  };

  // Slack Webhook URLの事前検証
  if (config.slackWebhookUrl) {
    const urlValidation = validateSlackWebhookUrl(config.slackWebhookUrl);
    if (urlValidation) {
      console.error(`Error: ${urlValidation.message}`);
      process.exit(1);
    }
  }

  return config;
}

async function getCCUsageData(): Promise<CCUsageData> {
  try {
    const result = execSync('npx ccusage monthly --json', { encoding: 'utf8' });
    return JSON.parse(result) as CCUsageData;
  } catch (error) {
    console.error("Error getting ccusage data:", error);
    throw error;
  }
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function sendSlackNotification(message: string, webhookUrl: string): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message,
        username: 'ccwatch',
        icon_emoji: ':warning:',
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    throw error;
  }
}

export function formatCostMessage(usage: MonthlyUsage, threshold: number): string {
  const cost = usage.totalCost;
  const excess = cost - threshold;
  const percentage = ((cost / threshold) * 100).toFixed(1);
  
  return `🚨 Claude Code使用量が閾値を超過しました！
📅 対象月: ${usage.month}
💰 現在のコスト: $${cost.toFixed(2)}
🎯 設定閾値: $${threshold.toFixed(2)}
📈 超過額: $${excess.toFixed(2)}
📊 閾値に対する割合: ${percentage}%

使用モデル: ${usage.modelsUsed.join(', ')}`;
}

function getStateFilePath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
  return join(homeDir, '.ccwatch-state.json');
}

async function loadDaemonState(): Promise<DaemonState> {
  const stateFile = getStateFilePath();
  
  if (!existsSync(stateFile)) {
    return {};
  }

  try {
    const data = readFileSync(stateFile, 'utf8');
    return JSON.parse(data) as DaemonState;
  } catch (error) {
    const logger = new DefaultLogger();
    logger.error(`状態ファイル読み込みエラー: ${error}`, { component: 'state-manager' });
    return {};
  }
}

async function saveDaemonState(state: DaemonState): Promise<void> {
  const stateFile = getStateFilePath();
  
  try {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    const logger = new DefaultLogger();
    logger.error(`状態ファイル保存エラー: ${error}`, { component: 'state-manager' });
  }
}

function logWithTimestamp(message: string): void {
  const defaultLogger = new DefaultLogger();
  defaultLogger.logWithTimestamp(message);
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]!;
}

function shouldSendNotification(state: DaemonState, exceeded: boolean): boolean {
  if (!exceeded) {
    return false;
  }

  const today = getToday();
  
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

async function setupGracefulShutdown(): Promise<void> {
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    const logger = new DefaultLogger();
    logger.info("ccwatch daemon stopping", { component: 'daemon' });
    
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGQUIT', shutdown);
}

async function checkUsageOnce(config: Config, state: DaemonState, deps?: Dependencies): Promise<DaemonState> {
  const dependencies = deps || createDefaultDependencies();
  
  try {
    const usageData = await dependencies.fetchUsageData();
    const currentMonth = getCurrentMonth();
    
    const currentMonthUsage = usageData.monthly.find(
      (month) => month.month === currentMonth
    );
    
    if (!currentMonthUsage) {
      dependencies.logger.warn(`${currentMonth}の使用データが見つかりません`, { 
      currentMonth, 
      component: 'usage-checker' 
    });
      return state;
    }
    
    const currentCost = currentMonthUsage.totalCost;
    const exceeded = currentCost > config.threshold;
    
    dependencies.logger.info(`現在のコスト: $${currentCost.toFixed(2)} (閾値: $${config.threshold})`, {
      currentMonth,
      currentCost,
      threshold: config.threshold,
      component: 'cost-monitor'
    });
    
    const newState = { ...state };
    
    if (exceeded) {
      const today = getToday();
      (newState as any).lastExceedanceDate = today;
      
      const excess = currentCost - config.threshold;
      dependencies.logger.error(`閾値超過`, {
        currentMonth,
        currentCost,
        threshold: config.threshold,
        excess,
        component: 'threshold-checker'
      });
      
      if (shouldSendNotification(state, exceeded)) {
        if (config.slackWebhookUrl) {
          const message = formatCostMessage(currentMonthUsage, config.threshold);
          await dependencies.sendNotification(message, config.slackWebhookUrl!);
          dependencies.logger.info("Slack通知を送信しました", {
            webhookUrl: config.slackWebhookUrl?.substring(0, 30) + '...',
            component: 'notification'
          });
          (newState as any).lastNotificationDate = today;
        } else {
          dependencies.logger.warn("Slack通知をスキップ: 環境変数未設定", {
            reason: 'CCWATCH_SLACK_WEBHOOK_URL not set',
            component: 'notification'
          });
        }
      } else {
        dependencies.logger.debug("Slack通知をスキップ: 本日既に通知済み", {
          lastNotificationDate: state.lastNotificationDate,
          component: 'notification'
        });
      }
    } else {
      const remaining = config.threshold - currentCost;
      dependencies.logger.info(`現在は閾値内です`, {
        currentMonth,
        currentCost,
        threshold: config.threshold,
        remaining,
        component: 'cost-monitor'
      });
    }
    
    return newState;
  } catch (error) {
    dependencies.logger.error(`チェック中にエラーが発生しました`, {
      error: error instanceof Error ? error.message : String(error),
      component: 'usage-checker'
    });
    return state;
  }
}

async function runDaemon(config: Config, deps?: Dependencies): Promise<void> {
  const dependencies = deps || createDefaultDependencies();
  
  dependencies.logger.info(`ccwatch daemon started`, {
    threshold: config.threshold,
    interval: config.interval,
    component: 'daemon'
  });
  
  await setupGracefulShutdown();
  
  let state = await dependencies.readState();
  
  // 初回実行
  state = await checkUsageOnce(config, state, dependencies);
  await dependencies.saveState(state);
  
  // 定期実行
  intervalId = setInterval(async () => {
    if (isShuttingDown) return;
    
    state = await checkUsageOnce(config, state, dependencies);
    await dependencies.saveState(state);
  }, config.interval! * 1000);
  
  // プロセスを維持
  while (!isShuttingDown) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main(): Promise<void> {
  const config = parseArgs();
  
  if (config.daemon) {
    // デーモンモード
    await runDaemon(config);
  } else {
    // 単発実行モード
    console.log(`💰 Claude Code使用量監視開始 (閾値: $${config.threshold})`);
    
    try {
      const usageData = await getCCUsageData();
      const currentMonth = getCurrentMonth();
      
      const currentMonthUsage = usageData.monthly.find(
        (month) => month.month === currentMonth
      );
      
      if (!currentMonthUsage) {
        console.log(`📊 ${currentMonth}の使用データが見つかりません`);
        return;
      }
      
      const currentCost = currentMonthUsage.totalCost;
      console.log(`📊 ${currentMonth}の現在のコスト: $${currentCost.toFixed(2)}`);
      
      if (currentCost > config.threshold) {
        const excess = currentCost - config.threshold;
        console.log(`🚨 閾値超過！ 超過額: $${excess.toFixed(2)}`);
        
        if (config.slackWebhookUrl) {
          const message = formatCostMessage(currentMonthUsage, config.threshold);
          await sendSlackNotification(message, config.slackWebhookUrl!);
          console.log("✅ Slack通知を送信しました");
        } else {
          console.log("⚠️ CCWATCH_SLACK_WEBHOOK_URL環境変数が設定されていないため、Slack通知をスキップします");
        }
      } else {
        const remaining = config.threshold - currentCost;
        console.log(`✅ 現在は閾値内です (残り: $${remaining.toFixed(2)})`);
      }
      
    } catch (error) {
      console.error("❌ エラーが発生しました:", error);
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  main();
}
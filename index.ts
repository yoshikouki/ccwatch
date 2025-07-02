#!/usr/bin/env node

import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

interface MonthlyUsage {
  month: string;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: Array<{
    modelName: string;
    cost: number;
  }>;
}

interface CCUsageData {
  monthly: MonthlyUsage[];
  totals: {
    totalCost: number;
  };
}

interface Config {
  threshold: number;
  slackWebhookUrl?: string;
  checkCurrentMonth?: boolean;
  daemon?: boolean;
  interval?: number;
}

interface DaemonState {
  lastNotificationDate?: string;
  lastExceedanceDate?: string;
}

let isShuttingDown = false;
let intervalId: Timer | null = null;

export function showHelp(): void {
  console.log(`claude-cost-watch - Claude Code usage monitor with Slack notifications

USAGE:
  claude-cost-watch <threshold> [OPTIONS]

ARGUMENTS:
  <threshold>           Dollar amount threshold (e.g., 33 for $33)

OPTIONS:
  -h, --help           Show this help message
  --daemon             Run in daemon mode (continuous monitoring)
  --interval <sec>     Check interval in seconds (default: 3600)

EXAMPLES:
  claude-cost-watch 33                              # Check once with $33 threshold
  claude-cost-watch 50 --daemon                     # Monitor continuously every hour
  claude-cost-watch 33 --daemon --interval 1800     # Monitor every 30 minutes
  
  # Background execution:
  nohup claude-cost-watch 33 --daemon > claude-cost-watch.log 2>&1 &

ENVIRONMENT VARIABLES:
  CCMONITOR_SLACK_WEBHOOK_URL    Slack webhook URL for notifications (optional)

DAEMON MODE FEATURES:
  • Automatic periodic monitoring
  • Duplicate notification prevention (once per day)
  • Graceful shutdown with Ctrl+C
  • State persistence in ~/.ccmonitor-state.json
  • Timestamped logging

For more information, visit: https://github.com/yoshikouki/ccmonitor`);
}

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

  const threshold = parseFloat(args[0]);
  if (isNaN(threshold) || threshold <= 0) {
    console.error("Error: Threshold must be a positive number");
    process.exit(1);
  }

  const daemon = args.includes('--daemon');
  let interval = 3600; // デフォルト1時間

  const intervalIndex = args.indexOf('--interval');
  if (intervalIndex !== -1 && intervalIndex + 1 < args.length) {
    const intervalValue = parseInt(args[intervalIndex + 1]);
    if (!isNaN(intervalValue) && intervalValue > 0) {
      interval = intervalValue;
    } else {
      console.error("Error: Interval must be a positive number");
      process.exit(1);
    }
  }

  return {
    threshold,
    slackWebhookUrl: process.env.CCMONITOR_SLACK_WEBHOOK_URL,
    checkCurrentMonth: true,
    daemon,
    interval,
  };
}

async function getCCUsageData(): Promise<CCUsageData> {
  try {
    const result = execSync('npx ccusage monthly --json', { encoding: 'utf8' });
    return JSON.parse(result);
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
        username: 'claude-cost-watch',
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
  return join(homeDir, '.ccmonitor-state.json');
}

async function loadDaemonState(): Promise<DaemonState> {
  const stateFile = getStateFilePath();
  
  if (!existsSync(stateFile)) {
    return {};
  }

  try {
    const data = readFileSync(stateFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logWithTimestamp(`状態ファイル読み込みエラー: ${error}`);
    return {};
  }
}

async function saveDaemonState(state: DaemonState): Promise<void> {
  const stateFile = getStateFilePath();
  
  try {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    logWithTimestamp(`状態ファイル保存エラー: ${error}`);
  }
}

function logWithTimestamp(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
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
    
    logWithTimestamp("🛑 claude-cost-watch daemon stopping...");
    
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

async function checkUsageOnce(config: Config, state: DaemonState): Promise<DaemonState> {
  try {
    const usageData = await getCCUsageData();
    const currentMonth = getCurrentMonth();
    
    const currentMonthUsage = usageData.monthly.find(
      (month) => month.month === currentMonth
    );
    
    if (!currentMonthUsage) {
      logWithTimestamp(`📊 ${currentMonth}の使用データが見つかりません`);
      return state;
    }
    
    const currentCost = currentMonthUsage.totalCost;
    const exceeded = currentCost > config.threshold;
    
    logWithTimestamp(`📊 ${currentMonth}の現在のコスト: $${currentCost.toFixed(2)} (閾値: $${config.threshold})`);
    
    const newState = { ...state };
    
    if (exceeded) {
      const today = getToday();
      newState.lastExceedanceDate = today;
      
      const excess = currentCost - config.threshold;
      logWithTimestamp(`🚨 閾値超過！ 超過額: $${excess.toFixed(2)}`);
      
      if (shouldSendNotification(state, exceeded)) {
        if (config.slackWebhookUrl) {
          const message = formatCostMessage(currentMonthUsage, config.threshold);
          await sendSlackNotification(message, config.slackWebhookUrl);
          logWithTimestamp("✅ Slack通知を送信しました");
          newState.lastNotificationDate = today;
        } else {
          logWithTimestamp("⚠️ CCMONITOR_SLACK_WEBHOOK_URL環境変数が設定されていないため、Slack通知をスキップします");
        }
      } else {
        logWithTimestamp("📤 本日は既に通知済みのため、Slack通知をスキップします");
      }
    } else {
      const remaining = config.threshold - currentCost;
      logWithTimestamp(`✅ 現在は閾値内です (残り: $${remaining.toFixed(2)})`);
    }
    
    return newState;
  } catch (error) {
    logWithTimestamp(`❌ チェック中にエラーが発生しました: ${error}`);
    return state;
  }
}

async function runDaemon(config: Config): Promise<void> {
  logWithTimestamp(`🤖 claude-cost-watch daemon started (閾値: $${config.threshold}, 間隔: ${config.interval}秒)`);
  
  await setupGracefulShutdown();
  
  let state = await loadDaemonState();
  
  // 初回実行
  state = await checkUsageOnce(config, state);
  await saveDaemonState(state);
  
  // 定期実行
  intervalId = setInterval(async () => {
    if (isShuttingDown) return;
    
    state = await checkUsageOnce(config, state);
    await saveDaemonState(state);
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
          await sendSlackNotification(message, config.slackWebhookUrl);
          console.log("✅ Slack通知を送信しました");
        } else {
          console.log("⚠️ CCMONITOR_SLACK_WEBHOOK_URL環境変数が設定されていないため、Slack通知をスキップします");
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
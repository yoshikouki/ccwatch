// Core interfaces for dependency injection and abstraction

export interface Clock {
  now(): Date;
  getCurrentMonth(): string;
  getToday(): string;
}

export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
  logWithTimestamp(message: string): void;
}

export interface StateRepository {
  load(): Promise<DaemonState>;
  save(state: DaemonState): Promise<void>;
}

export interface UsageDataRepository {
  fetchUsageData(): Promise<CCUsageData>;
}

export interface NotificationService {
  send(message: string, webhookUrl: string): Promise<void>;
}

// Result type for better error handling
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Domain types
export interface DaemonState {
  readonly lastNotificationDate?: string;
  readonly lastExceedanceDate?: string;
}

export interface CCUsageData {
  readonly monthly: MonthlyUsage[];
  readonly totals: { totalCost: number };
}

export interface MonthlyUsage {
  readonly month: string;
  readonly totalCost: number;
  readonly modelsUsed: string[];
  readonly modelBreakdowns: ModelBreakdown[];
}

export interface ModelBreakdown {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cost: number;
}

export interface Config {
  readonly threshold: number;
  readonly daemon: boolean;
  readonly interval: number;
  readonly slackWebhookUrl?: string;
}

export interface ValidationError {
  readonly field: string;
  readonly value: any;
  readonly message: string;
}
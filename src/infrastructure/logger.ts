import type { Logger } from "../core/interfaces.ts";

export class ConsoleLogger implements Logger {
  constructor(private enableStructuredLogging: boolean = false) {}

  debug(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      console.debug('[DEBUG]', JSON.stringify({ message, ...context }));
    } else {
      console.debug(`[DEBUG] ${message}`);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      console.info('[INFO]', JSON.stringify({ message, ...context }));
    } else {
      console.info(`[INFO] ${message}`);
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      console.warn('[WARN]', JSON.stringify({ message, ...context }));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }

  error(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      console.error('[ERROR]', JSON.stringify({ message, ...context }));
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  logWithTimestamp(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }
}

// テスト用のモック実装
export class MockLogger implements Logger {
  public logs: Array<{ level: string; message: string; context?: Record<string, any> }> = [];

  debug(message: string, context?: Record<string, any>): void {
    this.logs.push({ level: 'debug', message, context });
  }

  info(message: string, context?: Record<string, any>): void {
    this.logs.push({ level: 'info', message, context });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.logs.push({ level: 'warn', message, context });
  }

  error(message: string, context?: Record<string, any>): void {
    this.logs.push({ level: 'error', message, context });
  }

  logWithTimestamp(message: string): void {
    this.logs.push({ level: 'timestamp', message });
  }

  clear(): void {
    this.logs = [];
  }

  hasLog(level: string, messagePattern: string): boolean {
    return this.logs.some(log => 
      log.level === level && log.message.includes(messagePattern)
    );
  }
}
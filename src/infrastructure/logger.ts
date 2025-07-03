import type { Logger } from "../core/interfaces.ts";

export class ConsoleLogger implements Logger {
  private readonly MAX_STRING_LENGTH = 1000;
  private readonly MAX_CONTEXT_KEYS = 20;

  constructor(private enableStructuredLogging: boolean = false) {}

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    let keyCount = 0;
    
    for (const [key, value] of Object.entries(context)) {
      if (keyCount >= this.MAX_CONTEXT_KEYS) break;
      
      if (typeof value === 'string' && value.length > this.MAX_STRING_LENGTH) {
        result[key] = value.substring(0, this.MAX_STRING_LENGTH) + '...';
      } else if (typeof value === 'object' && value !== null) {
        // オブジェクトの深い入れ子を制限
        try {
          result[key] = JSON.parse(JSON.stringify(value).substring(0, this.MAX_STRING_LENGTH));
        } catch {
          result[key] = '[Object]';
        }
      } else {
        result[key] = value;
      }
      keyCount++;
    }
    
    return result;
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      const safeContext = this.sanitizeContext(context);
      console.debug('[DEBUG]', JSON.stringify({ message, ...safeContext }));
    } else {
      console.debug(`[DEBUG] ${message}`);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      const safeContext = this.sanitizeContext(context);
      console.info('[INFO]', JSON.stringify({ message, ...safeContext }));
    } else {
      console.info(`[INFO] ${message}`);
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      const safeContext = this.sanitizeContext(context);
      console.warn('[WARN]', JSON.stringify({ message, ...safeContext }));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }

  error(message: string, context?: Record<string, any>): void {
    if (this.enableStructuredLogging && context) {
      const safeContext = this.sanitizeContext(context);
      console.error('[ERROR]', JSON.stringify({ message, ...safeContext }));
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
  private maxLogs = 1000; // ログの最大保持数（メモリ使用量制限）

  private addLog(level: string, message: string, context?: Record<string, any>): void {
    this.logs.push({ level, message, context });
    
    // ログ数制限でメモリリークを防止
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.addLog('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.addLog('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.addLog('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.addLog('error', message, context);
  }

  logWithTimestamp(message: string): void {
    this.addLog('timestamp', message);
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
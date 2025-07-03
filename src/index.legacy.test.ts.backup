import { test, expect, vi } from "vitest";

test("getCurrentMonth - 正しい月形式", async () => {
  const { getCurrentMonth } = await import("./index.ts");
  const result = getCurrentMonth();
  const expectedPattern = /^\d{4}-\d{2}$/;
  
  expect(result).toMatch(expectedPattern);
});

test("formatCostMessage - メッセージ形式", async () => {
  const { formatCostMessage } = await import("./index.ts");
  const usage = {
    month: "2025-07",
    totalCost: 40.23,
    modelsUsed: ["claude-sonnet-4-20250514"],
    modelBreakdowns: []
  };
  
  const message = formatCostMessage(usage, 33);
  
  expect(message).toContain("Claude Code使用量が閾値を超過しました");
  expect(message).toContain("$40.23");
  expect(message).toContain("$33.00");
  expect(message).toContain("$7.23");
});

test("Slack通知送信 - 成功ケース", async () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200
  } as Response);
  global.fetch = mockFetch as any;
  
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("test message", "https://hooks.slack.com/test")).resolves.toBeUndefined();
  
  expect(mockFetch).toHaveBeenCalledTimes(1);
  
  global.fetch = originalFetch;
});

test("Slack通知送信 - エラーケース", async () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn(() => 
    Promise.resolve({
      ok: false,
      status: 400
    } as Response)
  );
  global.fetch = mockFetch as any;
  
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("test message", "https://hooks.slack.com/test")).rejects.toThrow();
  
  global.fetch = originalFetch;
});

test("CLI引数解析 - デーモンモード", async () => {
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "33", "--daemon"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.threshold).toBe(33);
  expect(config.daemon).toBe(true);
  expect(config.interval).toBe(3600);
  
  process.argv = originalArgv;
});

test("CLI引数解析 - カスタムインターバル", async () => {
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "50", "--daemon", "--interval", "1800"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.threshold).toBe(50);
  expect(config.daemon).toBe(true);
  expect(config.interval).toBe(1800);
  
  process.argv = originalArgv;
});

test("showHelp関数 - ヘルプメッセージ表示", async () => {
  const originalLog = console.log;
  let logOutput = "";
  
  console.log = (message: string) => { logOutput += message; };
  
  const { showHelp } = await import("./index.ts");
  showHelp();
  
  expect(logOutput).toContain("ccwatch - Claude Code usage monitor");
  expect(logOutput).toContain("USAGE:");
  expect(logOutput).toContain("-h, --help");
  expect(logOutput).toContain("--daemon");
  expect(logOutput).toContain("EXAMPLES:");
  expect(logOutput).toContain("ENVIRONMENT VARIABLES:");
  
  console.log = originalLog;
});

// t-wada推奨: エッジケーステストの追加
test("CLI引数解析 - 負の閾値エラー", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "-10"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("positive number");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("CLI引数解析 - 文字列閾値エラー", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "invalid"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("valid number");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("CLI引数解析 - ゼロ閾値エラー", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "0"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("positive number");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("CLI引数解析 - 無効なインターバル", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "33", "--daemon", "--interval", "invalid"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("valid number");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("CLI引数解析 - 負のインターバル", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "33", "--daemon", "--interval", "-300"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("Interval must be a positive number");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

// 環境変数テスト
test("環境変数未設定時の動作", async () => {
  const originalEnv = process.env.CCWATCH_SLACK_WEBHOOK_URL;
  delete process.env.CCWATCH_SLACK_WEBHOOK_URL;
  
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "33"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.slackWebhookUrl).toBeUndefined();
  
  process.argv = originalArgv;
  if (originalEnv) {
    process.env.CCWATCH_SLACK_WEBHOOK_URL = originalEnv;
  }
});

test("環境変数設定時の動作", async () => {
  const originalEnv = process.env.CCWATCH_SLACK_WEBHOOK_URL;
  const testUrl = "https://hooks.slack.com/test";
  process.env.CCWATCH_SLACK_WEBHOOK_URL = testUrl;
  
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "33"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.slackWebhookUrl).toBe(testUrl);
  
  process.argv = originalArgv;
  if (originalEnv) {
    process.env.CCWATCH_SLACK_WEBHOOK_URL = originalEnv;
  } else {
    delete process.env.CCWATCH_SLACK_WEBHOOK_URL;
  }
});

// エラーハンドリングテスト
test("Slack通知 - ネットワークエラー", async () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn(() => 
    Promise.reject(new Error("Network error"))
  );
  global.fetch = mockFetch as any;
  
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("test message", "https://hooks.slack.com/test")).rejects.toThrow("Network error");
  
  global.fetch = originalFetch;
});

test("getCurrentMonth - 月の境界値", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z")); // 1月中旬
  
  // モジュールキャッシュをクリアして再インポートを強制
  vi.resetModules();
  const { getCurrentMonth } = await import("./index.ts");
  const result = getCurrentMonth();
  
  expect(result).toBe("2025-01");
  
  vi.useRealTimers();
});

test("formatCostMessage - 極端な値", async () => {
  const { formatCostMessage } = await import("./index.ts");
  
  const usage = {
    month: "2025-07",
    totalCost: 999999.99,
    modelsUsed: ["claude-sonnet-4-20250514"],
    modelBreakdowns: []
  };
  
  const message = formatCostMessage(usage, 0.01);
  
  expect(message).toContain("$999999.99");
  expect(message).toContain("$0.01");
  expect(message).toContain("$999999.98"); // 超過額
});

test("formatCostMessage - 小数点以下の精度", async () => {
  const { formatCostMessage } = await import("./index.ts");
  
  const usage = {
    month: "2025-07",
    totalCost: 33.333333,
    modelsUsed: ["claude-sonnet-4-20250514"],
    modelBreakdowns: []
  };
  
  const message = formatCostMessage(usage, 33.11);
  
  expect(message).toContain("$33.33"); // 小数点2桁まで
  expect(message).toContain("$33.11");
  expect(message).toContain("$0.22"); // 超過額
});

// t-wada推奨: さらなるエッジケーステスト
test("CLI引数解析 - 極端に大きな値（バリデーションエラー）", async () => {
  const originalArgv = process.argv;
  const originalError = console.error;
  
  let errorOutput = "";
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit() was called');
  });
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "2000000"];
  
  const { parseArgs } = await import("./index.ts");
  
  expect(() => parseArgs()).toThrow('process.exit() was called');
  expect(errorOutput).toContain("less than $1,000,000");
  expect(mockExit).toHaveBeenCalledWith(1);
  
  process.argv = originalArgv;
  console.error = originalError;
  mockExit.mockRestore();
});

test("CLI引数解析 - 極端に小さな正の値", async () => {
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "0.01"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.threshold).toBe(0.01);
  
  process.argv = originalArgv;
});

test("CLI引数解析 - 科学記法", async () => {
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "1e3"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.threshold).toBe(1000);
  
  process.argv = originalArgv;
});

test("CLI引数解析 - 無限大", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "Infinity"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("finite number");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("CLI引数解析 - NaN文字列", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "NaN"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("valid number");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("formatCostMessage - 完全に同じ値", async () => {
  const { formatCostMessage } = await import("./index.ts");
  
  const usage = {
    month: "2025-07",
    totalCost: 33,
    modelsUsed: ["claude-sonnet-4-20250514"],
    modelBreakdowns: []
  };
  
  const message = formatCostMessage(usage, 33);
  
  expect(message).toContain("$33.00");
  expect(message).toContain("$0.00"); // 超過額はゼロ
  expect(message).toContain("100.0%"); // 100%丁度
});

test("formatCostMessage - ゼロコスト", async () => {
  const { formatCostMessage } = await import("./index.ts");
  
  const usage = {
    month: "2025-07",
    totalCost: 0,
    modelsUsed: [],
    modelBreakdowns: []
  };
  
  const message = formatCostMessage(usage, 33);
  
  expect(message).toContain("$0.00");
  expect(message).toContain("$33.00");
  expect(message).toContain("$-33.00"); // 負の超過額
  expect(message).toContain("0.0%");
});

test("getCurrentMonth - タイムゾーン考慮", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-12-15T12:00:00.000Z")); // 12月中旬
  
  // モジュールキャッシュをクリアして再インポートを強制
  vi.resetModules();
  const { getCurrentMonth } = await import("./index.ts");
  const result = getCurrentMonth();
  
  expect(result).toBe("2025-12");
  
  vi.useRealTimers();
});

test("getCurrentMonth - 年始境界", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z")); // 年始
  
  // モジュールキャッシュをクリアして再インポートを強制
  vi.resetModules();
  const { getCurrentMonth } = await import("./index.ts");
  const result = getCurrentMonth();
  
  expect(result).toBe("2025-01");
  
  vi.useRealTimers();
});

test("Slack通知 - 不正なURL", async () => {
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("test", "invalid-url")).rejects.toThrow();
});

test("Slack通知 - 空メッセージ", async () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn(() => 
    Promise.resolve({
      ok: true,
      status: 200
    } as Response)
  );
  global.fetch = mockFetch as any;
  
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("", "https://hooks.slack.com/test")).resolves.toBeUndefined();
  
  expect(mockFetch).toHaveBeenCalledWith(
    "https://hooks.slack.com/test",
    expect.objectContaining({
      body: expect.stringContaining('""') // 空文字列がJSONに含まれる
    })
  );
  
  global.fetch = originalFetch;
});

test("CLI引数解析 - 複数のフラグ重複", async () => {
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "33", "--daemon", "--daemon", "--help"];
  
  const originalExit = process.exit;
  let exitCode = -1;
  process.exit = ((code: number) => { exitCode = code; }) as any;
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(0); // --helpが優先されて正常終了
  
  process.argv = originalArgv;
  process.exit = originalExit;
});

test("formatCostMessage - 複数モデル使用", async () => {
  const { formatCostMessage } = await import("./index.ts");
  
  const usage = {
    month: "2025-07",
    totalCost: 45.67,
    modelsUsed: ["claude-sonnet-4-20250514", "claude-opus-3", "claude-haiku-3"],
    modelBreakdowns: []
  };
  
  const message = formatCostMessage(usage, 33);
  
  expect(message).toContain("claude-sonnet-4-20250514, claude-opus-3, claude-haiku-3");
});

test("formatCostMessage - モデル名なし", async () => {
  const { formatCostMessage } = await import("./index.ts");
  
  const usage = {
    month: "2025-07",
    totalCost: 45.67,
    modelsUsed: [],
    modelBreakdowns: []
  };
  
  const message = formatCostMessage(usage, 33);
  
  expect(message).toContain("使用モデル: ");
  expect(message).not.toContain("undefined");
});

// バリデーション機能のテスト
test("バリデーション - 閾値が大きすぎる", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "2000000"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("less than $1,000,000");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("バリデーション - インターバルが短すぎる", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "33", "--daemon", "--interval", "5"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("at least 10 seconds");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("バリデーション - インターバルが長すぎる", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.argv = ["bun", "index.ts", "33", "--daemon", "--interval", "100000"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("less than 24 hours");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
});

test("バリデーション - 不正なSlack URL", async () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalError = console.error;
  const originalEnv = process.env.CCWATCH_SLACK_WEBHOOK_URL;
  
  let exitCode = -1;
  let errorOutput = "";
  
  process.exit = ((code: number) => { exitCode = code; }) as any;
  console.error = (message: string) => { errorOutput += message; };
  process.env.CCWATCH_SLACK_WEBHOOK_URL = "https://example.com/invalid";
  process.argv = ["bun", "index.ts", "33"];
  
  const { parseArgs } = await import("./index.ts");
  parseArgs();
  
  expect(exitCode).toBe(1);
  expect(errorOutput).toContain("valid Slack webhook URL");
  
  process.argv = originalArgv;
  process.exit = originalExit;
  console.error = originalError;
  if (originalEnv) {
    process.env.CCWATCH_SLACK_WEBHOOK_URL = originalEnv;
  } else {
    delete process.env.CCWATCH_SLACK_WEBHOOK_URL;
  }
});

test("バリデーション - 有効なSlack URL", async () => {
  const originalArgv = process.argv;
  const originalEnv = process.env.CCWATCH_SLACK_WEBHOOK_URL;
  
  process.env.CCWATCH_SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";
  process.argv = ["bun", "index.ts", "33"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.threshold).toBe(33);
  expect(config.slackWebhookUrl).toContain("hooks.slack.com");
  
  process.argv = originalArgv;
  if (originalEnv) {
    process.env.CCWATCH_SLACK_WEBHOOK_URL = originalEnv;
  } else {
    delete process.env.CCWATCH_SLACK_WEBHOOK_URL;
  }
});

// DI（Dependency Injection）のテスト
test("DI - モック依存関係での使用量チェック", async () => {
  // 現在の月を取得してテストデータと同期
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-07-15T12:00:00.000Z"));
  
  const mockUsageData = {
    monthly: [{
      month: "2025-07",
      totalCost: 50,
      modelsUsed: ["claude-sonnet-4-20250514"],
      modelBreakdowns: []
    }],
    totals: { totalCost: 50 }
  };
  
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    logWithTimestamp: vi.fn()
  };
  
  const mockDeps = {
    fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    readState: vi.fn().mockResolvedValue({}),
    saveState: vi.fn().mockResolvedValue(undefined),
    logger: mockLogger
  };
  
  const config = {
    threshold: 40,
    slackWebhookUrl: "https://hooks.slack.com/test",
    checkCurrentMonth: true,
    daemon: false,
    interval: 3600
  };
  
  // 初期状態（通知可能な状態）
  const initialState = {};
  
  const { checkUsageOnce } = await import("./index.ts");
  const newState = await checkUsageOnce(config, initialState, mockDeps);
  
  expect(mockDeps.fetchUsageData).toHaveBeenCalledTimes(1);
  expect(mockDeps.sendNotification).toHaveBeenCalledTimes(1);
  expect(mockLogger.info).toHaveBeenCalled();
  expect(mockLogger.error).toHaveBeenCalled(); // 閾値超過ログ
  
  vi.useRealTimers();
});

// 型安全性のテスト
test("型安全性 - readonlyプロパティの検証", async () => {
  const { formatCostMessage } = await import("./index.ts");
  
  const usage = {
    month: "2025-07",
    totalCost: 45.67,
    modelsUsed: ["claude-sonnet-4-20250514"],
    modelBreakdowns: []
  } as const; // readonly化
  
  const message = formatCostMessage(usage, 33);
  
  expect(message).toContain("$45.67");
  expect(message).toContain("claude-sonnet-4-20250514");
});

// 構造化ログのテスト
test("構造化ログ - 環境変数経由での動作確認", async () => {
  const originalConsole = console.log;
  const originalEnv = process.env.CCWATCH_STRUCTURED_LOGGING;
  let logOutput = "";
  
  console.log = (message: string) => { logOutput += message; };
  process.env.CCWATCH_STRUCTURED_LOGGING = "true";
  
  // 構造化ログ有効で実際の処理を実行
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-07-15T12:00:00.000Z"));
  
  const mockUsageData = {
    monthly: [{
      month: "2025-07",
      totalCost: 50,
      modelsUsed: ["claude-sonnet-4-20250514"],
      modelBreakdowns: []
    }],
    totals: { totalCost: 50 }
  };
  
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn((message: string, data?: any) => {
      // 構造化ログ形式でconsole.logに出力
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: "INFO",
        service: "ccwatch",
        message,
        ...data
      };
      console.log(JSON.stringify(logEntry));
    }),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    logWithTimestamp: vi.fn()
  };
  
  const mockDeps = {
    fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    readState: vi.fn().mockResolvedValue({}),
    saveState: vi.fn().mockResolvedValue(undefined),
    logger: mockLogger
  };
  
  const config = {
    threshold: 40,
    slackWebhookUrl: "https://hooks.slack.com/test",
    checkCurrentMonth: true,
    daemon: false,
    interval: 3600
  };
  
  const { checkUsageOnce } = await import("./index.ts");
  await checkUsageOnce(config, {}, mockDeps);
  
  expect(mockLogger.info).toHaveBeenCalled();
  expect(logOutput).toContain('"level":"INFO"');
  expect(logOutput).toContain('"service":"ccwatch"');
  
  console.log = originalConsole;
  if (originalEnv) {
    process.env.CCWATCH_STRUCTURED_LOGGING = originalEnv;
  } else {
    delete process.env.CCWATCH_STRUCTURED_LOGGING;
  }
  vi.useRealTimers();
});

// デーモンモードのテスト群
describe("デーモンモード", () => {
  let originalSetInterval: typeof setInterval;
  let originalSetTimeout: typeof setTimeout;
  let originalClearInterval: typeof clearInterval;
  
  beforeEach(() => {
    vi.useFakeTimers();
    originalSetInterval = global.setInterval;
    originalSetTimeout = global.setTimeout; 
    originalClearInterval = global.clearInterval;
  });
  
  afterEach(() => {
    vi.useRealTimers();
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    global.clearInterval = originalClearInterval;
  });

  test("runDaemon - 基本的なデーモン開始と停止", async () => {
    const mockUsageData = {
      monthly: [{
        month: "2025-07",
        totalCost: 50,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 50 }
    };

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      logWithTimestamp: vi.fn()
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: mockLogger
    };

    const config = {
      threshold: 40,
      slackWebhookUrl: "https://hooks.slack.com/test",
      checkCurrentMonth: true,
      daemon: true,
      interval: 10
    };

    vi.resetModules();
    const { runDaemon, setShuttingDown } = await import("./index.ts");

    // シャットダウンフラグをリセット
    setShuttingDown(false);

    // デーモンを非同期で開始
    const daemonPromise = runDaemon(config, mockDeps);

    // タイマーを進めて初回実行を完了
    await vi.advanceTimersByTimeAsync(1000);

    // シャットダウンを設定
    setShuttingDown(true);

    // 少し待ってからプロミスを解決
    await vi.advanceTimersByTimeAsync(2000);

    await daemonPromise;

    // デーモン開始ログを確認
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("daemon started"),
      expect.objectContaining({
        threshold: 40,
        interval: 10,
        component: 'daemon'
      })
    );

    // 初回実行の確認
    expect(mockDeps.fetchUsageData).toHaveBeenCalled();
    expect(mockDeps.saveState).toHaveBeenCalled();
  }, 10000);

  test("runDaemon - 定期実行の動作確認", async () => {
    const mockUsageData = {
      monthly: [{
        month: "2025-07",
        totalCost: 30,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 30 }
    };

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      logWithTimestamp: vi.fn()
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: mockLogger
    };

    const config = {
      threshold: 40,
      slackWebhookUrl: "https://hooks.slack.com/test",
      checkCurrentMonth: true,
      daemon: true,
      interval: 5 // 5秒間隔
    };

    vi.resetModules();
    const { runDaemon, setShuttingDown } = await import("./index.ts");

    // シャットダウンフラグをリセット
    setShuttingDown(false);

    const daemonPromise = runDaemon(config, mockDeps);

    // 初回実行
    await vi.advanceTimersByTimeAsync(1000);
    
    // 1回目のインターバル実行
    await vi.advanceTimersByTimeAsync(5000);
    
    // 2回目のインターバル実行  
    await vi.advanceTimersByTimeAsync(5000);

    // シャットダウン
    setShuttingDown(true);
    await vi.advanceTimersByTimeAsync(2000);

    await daemonPromise;

    // 複数回実行されていることを確認（初回 + インターバル2回）
    expect(mockDeps.fetchUsageData).toHaveBeenCalledTimes(3);
    expect(mockDeps.saveState).toHaveBeenCalledTimes(3);
  }, 15000);
});

// メイン関数のテスト群
describe("メイン実行パス", () => {
  test("main - 単発実行モード（閾値以下）", async () => {
    const originalLog = console.log;
    const originalArgv = process.argv;
    let logOutput = "";

    console.log = (message: string) => { logOutput += message + "\n"; };
    process.argv = ["bun", "index.ts", "100"];

    const mockUsageData = {
      monthly: [{
        month: "2025-07",
        totalCost: 50,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 50 }
    };

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      logWithTimestamp: vi.fn()
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: mockLogger
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15T12:00:00.000Z"));
    vi.resetModules();

    const { main } = await import("./index.ts");
    await main(mockDeps);

    expect(logOutput).toContain("Claude Code使用量監視開始");
    expect(logOutput).toContain("現在のコスト: $50.00");
    expect(logOutput).toContain("現在は閾値内です");
    expect(logOutput).toContain("残り: $50.00");

    console.log = originalLog;
    process.argv = originalArgv;
    vi.useRealTimers();
  });

  test("main - 単発実行モード（閾値超過）", async () => {
    const originalLog = console.log;
    const originalArgv = process.argv;
    let logOutput = "";

    console.log = (message: string) => { logOutput += message + "\n"; };
    process.argv = ["bun", "index.ts", "30"];
    process.env.CCWATCH_SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    const mockUsageData = {
      monthly: [{
        month: "2025-07",
        totalCost: 50,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 50 }
    };

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      logWithTimestamp: vi.fn()
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: mockLogger
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15T12:00:00.000Z"));
    vi.resetModules();

    const { main } = await import("./index.ts");
    await main(mockDeps);

    expect(logOutput).toContain("Claude Code使用量監視開始");
    expect(logOutput).toContain("現在のコスト: $50.00");
    expect(logOutput).toContain("閾値超過！");
    expect(logOutput).toContain("超過額: $20.00");
    expect(logOutput).toContain("Slack通知を送信しました");

    console.log = originalLog;
    process.argv = originalArgv;
    delete process.env.CCWATCH_SLACK_WEBHOOK_URL;
    vi.useRealTimers();
  });

  test("main - エラーハンドリング", async () => {
    const originalError = console.error;
    const originalArgv = process.argv;
    const originalExit = process.exit;
    let errorOutput = "";
    let exitCode = -1;

    console.error = (message: string, error?: any) => { 
      errorOutput += message + (error ? " " + error : "") + "\n"; 
    };
    process.exit = ((code: number) => { exitCode = code; }) as any;
    process.argv = ["bun", "index.ts", "50"];

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      logWithTimestamp: vi.fn()
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockRejectedValue(new Error("API Error")),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: mockLogger
    };

    vi.resetModules();
    const { main } = await import("./index.ts");
    await main(mockDeps);

    expect(errorOutput).toContain("エラーが発生しました:");
    expect(exitCode).toBe(1);

    console.error = originalError;
    process.argv = originalArgv;
    process.exit = originalExit;
  });

  test("main - Slack未設定時の処理", async () => {
    const originalArgv = process.argv;
    const originalLog = console.log;
    
    let logOutput = "";
    console.log = (message: string) => { logOutput += message + "\n"; };
    process.argv = ["bun", "index.ts", "50"];

    const mockUsageData = {
      monthly: [{
        month: "2025-07",
        totalCost: 60,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 60 }
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        logWithTimestamp: vi.fn()
      }
    };

    vi.resetModules();
    const { main } = await import("./index.ts");
    await main(mockDeps);

    expect(logOutput).toContain("CCWATCH_SLACK_WEBHOOK_URL環境変数が設定されていないため、Slack通知をスキップします");

    console.log = originalLog;
    process.argv = originalArgv;
  });

  test("main - 閾値内の場合の処理", async () => {
    const originalArgv = process.argv;
    const originalLog = console.log;
    
    let logOutput = "";
    console.log = (message: string) => { logOutput += message + "\n"; };
    process.argv = ["bun", "index.ts", "50"];

    const mockUsageData = {
      monthly: [{
        month: "2025-07",
        totalCost: 30,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 30 }
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        logWithTimestamp: vi.fn()
      }
    };

    vi.resetModules();
    const { main } = await import("./index.ts");
    await main(mockDeps);

    expect(logOutput).toContain("現在は閾値内です (残り: $20.00)");

    console.log = originalLog;
    process.argv = originalArgv;
  });

  test("main - 当月データなしの場合", async () => {
    const originalArgv = process.argv;
    const originalLog = console.log;
    
    let logOutput = "";
    console.log = (message: string) => { logOutput += message + "\n"; };
    process.argv = ["bun", "index.ts", "50"];

    // 当月以外のデータのみ含むusageData
    const mockUsageData = {
      monthly: [{
        month: "2025-06", // 現在月と異なる
        totalCost: 30,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 30 }
    };

    const mockDeps = {
      fetchUsageData: vi.fn().mockResolvedValue(mockUsageData),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      readState: vi.fn().mockResolvedValue({}),
      saveState: vi.fn().mockResolvedValue(undefined),
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
        logWithTimestamp: vi.fn()
      }
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15"));

    vi.resetModules();
    const { main } = await import("./index.ts");
    await main(mockDeps);

    expect(logOutput).toContain("2025-07の使用データが見つかりません");

    vi.useRealTimers();
    console.log = originalLog;
    process.argv = originalArgv;
  });

  test("import.meta.main - エントリーポイント実行", async () => {
    // import.meta.main のテストは実際のファイル実行をテスト
    const { spawn } = await import("child_process");
    const { promisify } = await import("util");
    
    return new Promise((resolve, reject) => {
      const child = spawn("bun", ["src/index.ts", "100"], {
        cwd: process.cwd(),
        env: { ...process.env, CCWATCH_SLACK_WEBHOOK_URL: undefined },
        stdio: "pipe"
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        try {
          expect(code).toBe(0);
          expect(stdout).toContain("Claude Code使用量監視開始");
          resolve(undefined);
        } catch (error) {
          reject(error);
        }
      });

      child.on("error", reject);
    });
  });
});

describe("ファイルI/O", () => {
  const stateFilePath = "/tmp/.ccwatch-state.json";
  
  beforeEach(() => {
    // テスト前にファイル削除
    try {
      const fs = require('fs');
      fs.unlinkSync(stateFilePath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  });

  afterEach(() => {
    // テスト後にファイル削除
    try {
      const fs = require('fs');
      fs.unlinkSync(stateFilePath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  });

  test("loadDaemonState - ファイルが存在しない場合", async () => {
    const originalEnv = process.env.HOME;
    process.env.HOME = "/tmp";

    vi.resetModules();
    const { loadDaemonState } = await import("./index.ts");
    const state = await loadDaemonState();
    
    expect(state).toEqual({});
    
    process.env.HOME = originalEnv;
  });

  test("saveDaemonState - 正常な保存", async () => {
    const originalEnv = process.env.HOME;
    process.env.HOME = "/tmp";

    const testState = {
      lastNotificationDate: "2025-07-01",
      lastExceedanceDate: "2025-07-01"
    };

    vi.resetModules();
    const { saveDaemonState, loadDaemonState } = await import("./index.ts");
    
    await saveDaemonState(testState);
    const loadedState = await loadDaemonState();
    
    expect(loadedState).toEqual(testState);
    
    process.env.HOME = originalEnv;
  });

  test("loadDaemonState - 不正なJSONファイル", async () => {
    const originalEnv = process.env.HOME;
    process.env.HOME = "/tmp";

    // 不正なJSONファイルを作成
    const fs = require('fs');
    const stateFilePath = "/tmp/.ccwatch-state.json";
    fs.writeFileSync(stateFilePath, "invalid json content");

    vi.resetModules();
    const { loadDaemonState } = await import("./index.ts");
    const state = await loadDaemonState();
    
    expect(state).toEqual({});
    
    // テスト後のクリーンアップ
    try {
      fs.unlinkSync(stateFilePath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
    
    process.env.HOME = originalEnv;
  });
});

describe("ユーティリティ関数", () => {
  test("getToday - 現在日付の取得", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15T12:30:00Z"));

    vi.resetModules();
    const { getToday } = await import("./index.ts");
    const today = getToday();
    
    expect(today).toBe("2025-07-15");
    
    vi.useRealTimers();
  });

  test("shouldSendNotification - 通知判定ロジック", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-15T12:30:00Z"));

    vi.resetModules();
    const { shouldSendNotification } = await import("./index.ts");
    
    // 閾値を超えていない場合
    expect(shouldSendNotification({}, false)).toBe(false);
    
    // 閾値を超えているが今日既に通知済み
    expect(shouldSendNotification({ lastNotificationDate: "2025-07-15" }, true)).toBe(false);
    
    // 閾値を超えており、初回通知
    expect(shouldSendNotification({}, true)).toBe(true);
    
    // 閾値を超えており、異なる日の超過
    expect(shouldSendNotification({ lastExceedanceDate: "2025-07-14" }, true)).toBe(true);
    
    // 同日内での初回通知
    expect(shouldSendNotification({ lastExceedanceDate: "2025-07-15", lastNotificationDate: "2025-07-14" }, true)).toBe(true);
    
    vi.useRealTimers();
  });

  test("logWithTimestamp - タイムスタンプ付きログ", async () => {
    const originalLog = console.log;
    let logOutput = "";
    console.log = (message: string) => { logOutput += message + "\n"; };

    vi.resetModules();
    const { logWithTimestamp } = await import("./index.ts");
    logWithTimestamp("テストメッセージ");
    
    expect(logOutput).toContain("テストメッセージ");
    expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    
    console.log = originalLog;
  });

  test("setupGracefulShutdown - シグナルハンドリング", async () => {
    const originalProcessOn = process.on;
    const signalHandlers: Record<string, Function> = {};
    
    process.on = vi.fn((signal: string, handler: Function) => {
      signalHandlers[signal] = handler;
      return process;
    }) as any;

    vi.resetModules();
    const { setupGracefulShutdown, setShuttingDown } = await import("./index.ts");
    
    await setupGracefulShutdown();
    
    expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    
    // シグナルハンドラーが設定されていることを確認
    expect(signalHandlers.SIGINT).toBeDefined();
    expect(signalHandlers.SIGTERM).toBeDefined();
    
    process.on = originalProcessOn;
  });
});
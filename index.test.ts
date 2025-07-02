import { test, expect, mock } from "bun:test";

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
  const mockFetch = mock(() => 
    Promise.resolve({
      ok: true,
      status: 200
    } as Response)
  );
  global.fetch = mockFetch as any;
  
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("test message", "https://hooks.slack.com/test")).resolves.toBeUndefined();
  
  expect(mockFetch).toHaveBeenCalledTimes(1);
  
  global.fetch = originalFetch;
});

test("Slack通知送信 - エラーケース", async () => {
  const originalFetch = global.fetch;
  const mockFetch = mock(() => 
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
  expect(errorOutput).toContain("positive number");
  
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
  expect(errorOutput).toContain("Interval must be a positive number");
  
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
  const originalEnv = process.env.CCMONITOR_SLACK_WEBHOOK_URL;
  delete process.env.CCMONITOR_SLACK_WEBHOOK_URL;
  
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "33"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.slackWebhookUrl).toBeUndefined();
  
  process.argv = originalArgv;
  if (originalEnv) {
    process.env.CCMONITOR_SLACK_WEBHOOK_URL = originalEnv;
  }
});

test("環境変数設定時の動作", async () => {
  const originalEnv = process.env.CCMONITOR_SLACK_WEBHOOK_URL;
  const testUrl = "https://hooks.slack.com/test";
  process.env.CCMONITOR_SLACK_WEBHOOK_URL = testUrl;
  
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "33"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.slackWebhookUrl).toBe(testUrl);
  
  process.argv = originalArgv;
  if (originalEnv) {
    process.env.CCMONITOR_SLACK_WEBHOOK_URL = originalEnv;
  } else {
    delete process.env.CCMONITOR_SLACK_WEBHOOK_URL;
  }
});

// エラーハンドリングテスト
test("Slack通知 - ネットワークエラー", async () => {
  const originalFetch = global.fetch;
  const mockFetch = mock(() => 
    Promise.reject(new Error("Network error"))
  );
  global.fetch = mockFetch as any;
  
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("test message", "https://hooks.slack.com/test")).rejects.toThrow("Network error");
  
  global.fetch = originalFetch;
});

test("getCurrentMonth - 月の境界値", async () => {
  const originalDate = Date;
  global.Date = class extends Date {
    constructor() {
      super("2025-01-31T23:59:59.999Z"); // 月末ギリギリ
    }
  } as any;
  
  const { getCurrentMonth } = await import("./index.ts");
  const result = getCurrentMonth();
  
  expect(result).toBe("2025-01");
  
  global.Date = originalDate;
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
test("CLI引数解析 - 極端に大きな値", async () => {
  const originalArgv = process.argv;
  process.argv = ["bun", "index.ts", "999999999"];
  
  const { parseArgs } = await import("./index.ts");
  const config = parseArgs();
  
  expect(config.threshold).toBe(999999999);
  
  process.argv = originalArgv;
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
  expect(errorOutput).toContain("positive number");
  
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
  expect(errorOutput).toContain("positive number");
  
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
  const originalDate = Date;
  
  // UTC年末時点での月取得
  global.Date = class extends Date {
    constructor() {
      super("2025-12-31T23:59:59.999Z");
    }
  } as any;
  
  const { getCurrentMonth } = await import("./index.ts");
  const result = getCurrentMonth();
  
  expect(result).toBe("2025-12");
  
  global.Date = originalDate;
});

test("getCurrentMonth - 年始境界", async () => {
  const originalDate = Date;
  
  global.Date = class extends Date {
    constructor() {
      super("2025-01-01T00:00:00.000Z");
    }
  } as any;
  
  const { getCurrentMonth } = await import("./index.ts");
  const result = getCurrentMonth();
  
  expect(result).toBe("2025-01");
  
  global.Date = originalDate;
});

test("Slack通知 - 不正なURL", async () => {
  const { sendSlackNotification } = await import("./index.ts");
  
  await expect(sendSlackNotification("test", "invalid-url")).rejects.toThrow();
});

test("Slack通知 - 空メッセージ", async () => {
  const originalFetch = global.fetch;
  const mockFetch = mock(() => 
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
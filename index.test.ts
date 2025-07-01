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
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { SlackNotificationService } from "./notification-service.ts";
import { MockLogger } from "./logger.ts";

describe("SlackNotificationService", () => {
  let service: SlackNotificationService;
  let mockLogger: MockLogger;
  let originalFetch: any;

  beforeEach(() => {
    mockLogger = new MockLogger();
    service = new SlackNotificationService(mockLogger);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("正常なメッセージ送信", async () => {
    const mockResponse = {
      ok: true,
      status: 200
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

    const message = "テストメッセージ";
    const webhookUrl = "https://hooks.slack.com/services/test/webhook";

    await service.send(message, webhookUrl);

    expect(global.fetch).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: message })
      })
    );

    expect(mockLogger.hasLog("debug", "Slack通知送信開始")).toBe(true);
    expect(mockLogger.hasLog("info", "Slack通知送信完了")).toBe(true);
  });

  test("空メッセージのエラーハンドリング", async () => {
    const webhookUrl = "https://hooks.slack.com/services/test/webhook";

    await expect(service.send("", webhookUrl)).rejects.toThrow("Message cannot be empty");
    await expect(service.send("   ", webhookUrl)).rejects.toThrow("Message cannot be empty");
  });

  test("無効なURL形式のエラーハンドリング", async () => {
    const message = "テストメッセージ";
    const invalidUrl = "invalid-url";

    await expect(service.send(message, invalidUrl)).rejects.toThrow("Invalid webhook URL");
  });

  test("Slack API エラーレスポンス", async () => {
    const mockResponse = {
      ok: false,
      status: 400
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

    const message = "テストメッセージ";
    const webhookUrl = "https://hooks.slack.com/services/test/webhook";

    await expect(service.send(message, webhookUrl)).rejects.toThrow("Slack API error: 400");

    expect(mockLogger.hasLog("error", "Slack通知送信エラー")).toBe(true);
  });

  test("ネットワークエラー", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any;

    const message = "テストメッセージ";
    const webhookUrl = "https://hooks.slack.com/services/test/webhook";

    await expect(service.send(message, webhookUrl)).rejects.toThrow("Network error");

    expect(mockLogger.hasLog("error", "Slack通知送信エラー")).toBe(true);
  });

  test("非Error例外のハンドリング", async () => {
    global.fetch = vi.fn().mockRejectedValue("String error") as any;

    const message = "テストメッセージ";
    const webhookUrl = "https://hooks.slack.com/services/test/webhook";

    await expect(service.send(message, webhookUrl)).rejects.toThrow("String error");
  });

  test("異なるHTTPステータスコードのテスト", async () => {
    const testCases = [
      { status: 401, expected: "Slack API error: 401" },
      { status: 403, expected: "Slack API error: 403" },
      { status: 500, expected: "Slack API error: 500" }
    ];

    for (const testCase of testCases) {
      const mockResponse = {
        ok: false,
        status: testCase.status
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

      const message = "テストメッセージ";
      const webhookUrl = "https://hooks.slack.com/services/test/webhook";

      await expect(service.send(message, webhookUrl)).rejects.toThrow(testCase.expected);
    }
  });

  test("長いメッセージの送信", async () => {
    const mockResponse = {
      ok: true,
      status: 200
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

    const longMessage = "a".repeat(10000);
    const webhookUrl = "https://hooks.slack.com/services/test/webhook";

    await service.send(longMessage, webhookUrl);

    expect(mockLogger.logs.some(log => 
      log.level === "debug" && 
      log.context?.messageLength === 10000
    )).toBe(true);
  });

  test("特殊文字を含むメッセージ", async () => {
    const mockResponse = {
      ok: true,
      status: 200
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;

    const specialMessage = "テスト🚨メッセージ\n改行含む\"引用符";
    const webhookUrl = "https://hooks.slack.com/services/test/webhook";

    await service.send(specialMessage, webhookUrl);

    expect(global.fetch).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        body: JSON.stringify({ text: specialMessage })
      })
    );
  });
});

describe("MockNotificationService", () => {
  test("メッセージの記録と取得", async () => {
    const { MockNotificationService } = await import("./notification-service.ts");
    const mockService = new MockNotificationService();

    const message1 = "テストメッセージ1";
    const webhook1 = "https://hooks.slack.com/test1";
    const message2 = "テストメッセージ2";
    const webhook2 = "https://hooks.slack.com/test2";

    await mockService.send(message1, webhook1);
    await mockService.send(message2, webhook2);

    expect(mockService.sentMessages).toHaveLength(2);
    expect(mockService.sentMessages[0]).toEqual({ message: message1, webhookUrl: webhook1 });
    expect(mockService.sentMessages[1]).toEqual({ message: message2, webhookUrl: webhook2 });

    expect(mockService.getLastMessage()).toEqual({ message: message2, webhookUrl: webhook2 });
  });

  test("クリア機能", async () => {
    const { MockNotificationService } = await import("./notification-service.ts");
    const mockService = new MockNotificationService();

    await mockService.send("テスト", "https://hooks.slack.com/test");
    expect(mockService.sentMessages).toHaveLength(1);

    mockService.clear();
    expect(mockService.sentMessages).toHaveLength(0);
    expect(mockService.getLastMessage()).toBeUndefined();
  });
});
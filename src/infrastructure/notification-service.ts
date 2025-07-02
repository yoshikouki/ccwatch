import { NotificationService, Logger } from "../core/interfaces.ts";

export class SlackNotificationService implements NotificationService {
  constructor(private logger: Logger) {}

  async send(message: string, webhookUrl: string): Promise<void> {
    this.logger.debug("Slack通知送信開始", { 
      component: 'notification-service',
      messageLength: message.length 
    });

    if (!message || message.trim().length === 0) {
      throw new Error("Message cannot be empty");
    }

    try {
      new URL(webhookUrl); // URL検証
    } catch {
      throw new Error(`Invalid webhook URL: ${webhookUrl}`);
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      this.logger.info("Slack通知送信完了", { 
        component: 'notification-service',
        status: response.status 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error("Slack通知送信エラー", {
        component: 'notification-service',
        error: errorMessage
      });
      throw error;
    }
  }
}

// テスト用のモック実装
export class MockNotificationService implements NotificationService {
  public sentMessages: Array<{ message: string; webhookUrl: string }> = [];

  async send(message: string, webhookUrl: string): Promise<void> {
    this.sentMessages.push({ message, webhookUrl });
  }

  clear(): void {
    this.sentMessages = [];
  }

  getLastMessage(): { message: string; webhookUrl: string } | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }
}
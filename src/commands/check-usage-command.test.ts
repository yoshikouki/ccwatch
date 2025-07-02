import { describe, test, expect, beforeEach } from "vitest";
import { CheckUsageCommand } from "./check-usage-command.ts";
import { MockClock } from "../infrastructure/clock.ts";
import { MockLogger } from "../infrastructure/logger.ts";
import { MemoryStateRepository } from "../infrastructure/state-repository.ts";
import { MockUsageRepository } from "../infrastructure/usage-repository.ts";
import { MockNotificationService } from "../infrastructure/notification-service.ts";
import { ResultUtils } from "../utils/result.ts";

describe("CheckUsageCommand", () => {
  let command: CheckUsageCommand;
  let mockDependencies: any;

  beforeEach(() => {
    const mockClock = new MockClock(new Date("2025-07-15T12:00:00Z"));
    const mockLogger = new MockLogger();
    const mockStateRepository = new MemoryStateRepository();
    const mockUsageRepository = new MockUsageRepository({
      monthly: [{
        month: "2025-07",
        totalCost: 45.50,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 45.50 }
    });
    const mockNotificationService = new MockNotificationService();

    mockDependencies = {
      clock: mockClock,
      logger: mockLogger,
      stateRepository: mockStateRepository,
      usageRepository: mockUsageRepository,
      notificationService: mockNotificationService
    };

    command = new CheckUsageCommand(mockDependencies);
  });

  test("閾値超過時の通知送信", async () => {
    const config = {
      threshold: 40,
      daemon: false,
      interval: 3600,
      slackWebhookUrl: "https://hooks.slack.com/test"
    };
    const state = {};

    const result = await command.execute({ config, state });

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.thresholdExceeded).toBe(true);
      expect(result.data.notificationSent).toBe(true);
      expect(result.data.newState.lastNotificationDate).toBe("2025-07-15");
    }

    expect(mockDependencies.notificationService.sentMessages).toHaveLength(1);
    expect(mockDependencies.logger.hasLog("warn", "閾値超過")).toBe(true);
  });

  test("閾値内の場合", async () => {
    const config = {
      threshold: 50,
      daemon: false,
      interval: 3600
    };
    const state = {};

    const result = await command.execute({ config, state });

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.thresholdExceeded).toBe(false);
      expect(result.data.notificationSent).toBe(false);
    }

    expect(mockDependencies.notificationService.sentMessages).toHaveLength(0);
    expect(mockDependencies.logger.hasLog("info", "現在は閾値内です")).toBe(true);
  });

  test("当月データが存在しない場合", async () => {
    // 異なる月のデータに変更
    mockDependencies.usageRepository.setMockData({
      monthly: [{
        month: "2025-06",
        totalCost: 45.50,
        modelsUsed: ["claude-sonnet-4-20250514"],
        modelBreakdowns: []
      }],
      totals: { totalCost: 45.50 }
    });

    const config = {
      threshold: 40,
      daemon: false,
      interval: 3600
    };
    const state = {};

    const result = await command.execute({ config, state });

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.thresholdExceeded).toBe(false);
      expect(result.data.notificationSent).toBe(false);
    }

    expect(mockDependencies.logger.hasLog("warn", "2025-07の使用データが見つかりません")).toBe(true);
  });

  test("重複通知の防止", async () => {
    const config = {
      threshold: 40,
      daemon: false,
      interval: 3600,
      slackWebhookUrl: "https://hooks.slack.com/test"
    };
    const state = {
      lastNotificationDate: "2025-07-15" // 今日既に通知済み
    };

    const result = await command.execute({ config, state });

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.thresholdExceeded).toBe(true);
      expect(result.data.notificationSent).toBe(false); // 通知はスキップ
    }

    expect(mockDependencies.notificationService.sentMessages).toHaveLength(0);
    expect(mockDependencies.logger.hasLog("info", "通知は既に送信済み")).toBe(true);
  });

  test("Slack URL未設定時", async () => {
    const config = {
      threshold: 40,
      daemon: false,
      interval: 3600
      // slackWebhookUrl未設定
    };
    const state = {};

    const result = await command.execute({ config, state });

    expect(ResultUtils.isSuccess(result)).toBe(true);
    if (ResultUtils.isSuccess(result)) {
      expect(result.data.thresholdExceeded).toBe(true);
      expect(result.data.notificationSent).toBe(false);
    }

    expect(mockDependencies.notificationService.sentMessages).toHaveLength(0);
    expect(mockDependencies.logger.hasLog("warn", "CCWATCH_SLACK_WEBHOOK_URL環境変数が設定されていない")).toBe(true);
  });
});
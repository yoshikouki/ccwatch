import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ArgumentParser } from "./argument-parser.ts";
import { ResultUtils } from "../utils/result.ts";

describe("ArgumentParser", () => {
  let parser: ArgumentParser;
  let originalArgv: string[];
  let originalEnv: any;
  let originalConsoleLog: any;
  let originalProcessExit: any;

  beforeEach(() => {
    parser = new ArgumentParser();
    originalArgv = process.argv;
    originalEnv = { ...process.env };
    originalConsoleLog = console.log;
    originalProcessExit = process.exit;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    console.log = originalConsoleLog;
    process.exit = originalProcessExit;
  });

  describe("基本的な引数解析", () => {
    test("最小限の引数（閾値のみ）", () => {
      process.argv = ["bun", "script.ts", "50"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(50);
        expect(result.data.daemon).toBe(false);
        expect(result.data.interval).toBe(3600);
        expect(result.data.slackWebhookUrl).toBeUndefined();
      }
    });

    test("デーモンモードフラグ", () => {
      process.argv = ["bun", "script.ts", "33", "--daemon"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(33);
        expect(result.data.daemon).toBe(true);
        expect(result.data.interval).toBe(3600);
      }
    });

    test("カスタムインターバル", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "1800"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(50);
        expect(result.data.daemon).toBe(false);
        expect(result.data.interval).toBe(1800);
      }
    });

    test("すべてのオプション", () => {
      process.argv = ["bun", "script.ts", "75", "--daemon", "--interval", "900"];
      process.env.CCWATCH_SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(75);
        expect(result.data.daemon).toBe(true);
        expect(result.data.interval).toBe(900);
        expect(result.data.slackWebhookUrl).toBe("https://hooks.slack.com/services/test");
      }
    });
  });

  describe("ヘルプ表示", () => {
    test("-h フラグ", () => {
      process.argv = ["bun", "script.ts", "-h"];
      let helpOutput = "";
      console.log = vi.fn((message: string) => { helpOutput += message; });
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("HELP_REQUESTED");
      }
      expect(helpOutput).toContain("ccwatch - Claude Code usage monitor");
    });

    test("--help フラグ", () => {
      process.argv = ["bun", "script.ts", "--help"];
      let helpOutput = "";
      console.log = vi.fn((message: string) => { helpOutput += message; });
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("HELP_REQUESTED");
      }
      expect(helpOutput).toContain("USAGE:");
      expect(helpOutput).toContain("EXAMPLES:");
      expect(helpOutput).toContain("DAEMON MODE FEATURES:");
    });
  });

  describe("バリデーション - 閾値", () => {
    test("閾値が指定されていない", () => {
      process.argv = ["bun", "script.ts"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Threshold argument is required");
      }
    });

    test("負の閾値", () => {
      process.argv = ["bun", "script.ts", "-10"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Threshold must be greater than 0");
      }
    });

    test("ゼロ閾値", () => {
      process.argv = ["bun", "script.ts", "0"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Threshold must be greater than 0");
      }
    });

    test("非数値の閾値", () => {
      process.argv = ["bun", "script.ts", "abc"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Threshold must be a valid number");
      }
    });

    test("無限大の閾値", () => {
      process.argv = ["bun", "script.ts", "Infinity"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Threshold must be finite");
      }
    });

    test("NaNの閾値", () => {
      process.argv = ["bun", "script.ts", "NaN"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Threshold must be a valid number");
      }
    });

    test("極端に大きい閾値", () => {
      process.argv = ["bun", "script.ts", "50000"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Threshold must be less than $10,000");
      }
    });

    test("境界値テスト - 有効な最大値", () => {
      process.argv = ["bun", "script.ts", "9999"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(9999);
      }
    });

    test("境界値テスト - 有効な最小値", () => {
      process.argv = ["bun", "script.ts", "0.01"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(0.01);
      }
    });

    test("科学記法の閾値", () => {
      process.argv = ["bun", "script.ts", "1e2"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(100);
      }
    });
  });

  describe("バリデーション - インターバル", () => {
    test("短すぎるインターバル", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "5"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Interval must be at least 10 seconds");
      }
    });

    test("長すぎるインターバル", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "100000"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Interval must be less than 24 hours");
      }
    });

    test("無効なインターバル", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "abc"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Interval must be a valid number");
      }
    });

    test("負のインターバル", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "-100"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Interval must be at least 10 seconds");
      }
    });

    test("境界値テスト - 有効な最小値", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "10"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.interval).toBe(10);
      }
    });

    test("境界値テスト - 有効な最大値", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "86400"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.interval).toBe(86400);
      }
    });

    test("インターバル指定なし（--intervalフラグのみ）", () => {
      process.argv = ["bun", "script.ts", "50", "--interval"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.interval).toBe(3600); // デフォルト値
      }
    });
  });

  describe("バリデーション - Slack URL", () => {
    test("無効なURL形式", () => {
      process.argv = ["bun", "script.ts", "50"];
      process.env.CCWATCH_SLACK_WEBHOOK_URL = "invalid-url";
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Invalid Slack webhook URL format");
      }
    });

    test("slack.com以外のドメイン", () => {
      process.argv = ["bun", "script.ts", "50"];
      process.env.CCWATCH_SLACK_WEBHOOK_URL = "https://hooks.example.com/services/test";
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Slack webhook URL must be from slack.com domain");
      }
    });

    test("有効なSlack URL", () => {
      process.argv = ["bun", "script.ts", "50"];
      process.env.CCWATCH_SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T123/B456/xyz";
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.slackWebhookUrl).toBe("https://hooks.slack.com/services/T123/B456/xyz");
      }
    });

    test("Slack URL未設定", () => {
      process.argv = ["bun", "script.ts", "50"];
      delete process.env.CCWATCH_SLACK_WEBHOOK_URL;
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.slackWebhookUrl).toBeUndefined();
      }
    });
  });

  describe("複合バリデーション", () => {
    test("複数のエラーが存在する場合", () => {
      process.argv = ["bun", "script.ts", "-10", "--interval", "5"];
      process.env.CCWATCH_SLACK_WEBHOOK_URL = "invalid-url";
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        // 複数のエラーメッセージが含まれることを確認
        expect(result.error.message).toContain("greater than 0");
        expect(result.error.message).toContain("at least 10 seconds");
        expect(result.error.message).toContain("Invalid Slack webhook URL");
      }
    });

    test("一部有効、一部無効", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "5"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("at least 10 seconds");
        expect(result.error.message).not.toContain("Threshold");
      }
    });
  });

  describe("引数の順序とフォーマット", () => {
    test("フラグの順序変更", () => {
      process.argv = ["bun", "script.ts", "--daemon", "50", "--interval", "1800"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(50);
        expect(result.data.daemon).toBe(true);
        expect(result.data.interval).toBe(1800);
      }
    });

    test("重複フラグの処理", () => {
      process.argv = ["bun", "script.ts", "50", "--daemon", "--daemon"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.daemon).toBe(true);
      }
    });

    test("未知のフラグは無視", () => {
      process.argv = ["bun", "script.ts", "50", "--unknown-flag", "value"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(50);
      }
    });

    test("インターバル値の境界ケース", () => {
      process.argv = ["bun", "script.ts", "50", "--interval", "9"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
    });

    test("複数の閾値指定（最初のもの使用）", () => {
      process.argv = ["bun", "script.ts", "50", "100"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data.threshold).toBe(50);
      }
    });
  });

  describe("エラーハンドリング", () => {
    test("予期しない例外のキャッチ", () => {
      // process.argvを無効な状態にして例外を発生させる
      const originalParseFloat = global.parseFloat;
      global.parseFloat = (() => { throw new Error("Unexpected error"); }) as any;
      
      process.argv = ["bun", "script.ts", "50"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Unexpected error");
      }
      
      global.parseFloat = originalParseFloat;
    });

    test("非Error例外のハンドリング", () => {
      const originalParseFloat = global.parseFloat;
      global.parseFloat = (() => { throw "String error"; }) as any;
      
      process.argv = ["bun", "script.ts", "50"];
      
      const result = parser.parse();
      
      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("String error");
      }
      
      global.parseFloat = originalParseFloat;
    });
  });
});
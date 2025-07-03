import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleLogger, MockLogger } from "./logger.ts";

describe("ConsoleLogger", () => {
  let logger: ConsoleLogger;
  let originalConsole: any;
  let mockConsole: any;

  beforeEach(() => {
    originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
      log: console.log
    };

    mockConsole = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn()
    };

    console.debug = mockConsole.debug;
    console.info = mockConsole.info;
    console.warn = mockConsole.warn;
    console.error = mockConsole.error;
    console.log = mockConsole.log;
  });

  afterEach(() => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.log = originalConsole.log;
  });

  describe("非構造化ログモード", () => {
    beforeEach(() => {
      logger = new ConsoleLogger(false);
    });

    test("debugログ", () => {
      logger.debug("デバッグメッセージ");
      expect(mockConsole.debug).toHaveBeenCalledWith("[DEBUG] デバッグメッセージ");
    });

    test("infoログ", () => {
      logger.info("情報メッセージ");
      expect(mockConsole.info).toHaveBeenCalledWith("[INFO] 情報メッセージ");
    });

    test("warnログ", () => {
      logger.warn("警告メッセージ");
      expect(mockConsole.warn).toHaveBeenCalledWith("[WARN] 警告メッセージ");
    });

    test("errorログ", () => {
      logger.error("エラーメッセージ");
      expect(mockConsole.error).toHaveBeenCalledWith("[ERROR] エラーメッセージ");
    });

    test("logWithTimestamp", () => {
      const originalDate = Date;
      const mockDate = vi.fn(() => ({
        toISOString: () => "2025-07-15T12:00:00.000Z"
      }));
      global.Date = mockDate as any;

      logger.logWithTimestamp("タイムスタンプ付きメッセージ");
      
      expect(mockConsole.log).toHaveBeenCalledWith("[2025-07-15T12:00:00.000Z] タイムスタンプ付きメッセージ");
      
      global.Date = originalDate;
    });

    test("コンテキスト付きログ（無視される）", () => {
      const context = { userId: 123, action: "login" };
      logger.info("ユーザーログイン", context);
      
      expect(mockConsole.info).toHaveBeenCalledWith("[INFO] ユーザーログイン");
    });
  });

  describe("構造化ログモード", () => {
    beforeEach(() => {
      logger = new ConsoleLogger(true);
    });

    test("コンテキストなしデバッグログ", () => {
      logger.debug("デバッグメッセージ");
      expect(mockConsole.debug).toHaveBeenCalledWith("[DEBUG] デバッグメッセージ");
    });

    test("コンテキスト付きデバッグログ", () => {
      const context = { component: "auth", userId: 123 };
      logger.debug("認証処理開始", context);
      
      expect(mockConsole.debug).toHaveBeenCalledWith(
        "[DEBUG]",
        JSON.stringify({ message: "認証処理開始", component: "auth", userId: 123 })
      );
    });

    test("コンテキスト付きinfoログ", () => {
      const context = { requestId: "req-123", duration: 250 };
      logger.info("リクエスト完了", context);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        "[INFO]",
        JSON.stringify({ message: "リクエスト完了", requestId: "req-123", duration: 250 })
      );
    });

    test("コンテキスト付きwarnログ", () => {
      const context = { threshold: 100, current: 95 };
      logger.warn("閾値に近づいています", context);
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        "[WARN]",
        JSON.stringify({ message: "閾値に近づいています", threshold: 100, current: 95 })
      );
    });

    test("コンテキスト付きerrorログ", () => {
      const context = { errorCode: "E001", stack: "Error stack trace" };
      logger.error("システムエラー", context);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        "[ERROR]",
        JSON.stringify({ message: "システムエラー", errorCode: "E001", stack: "Error stack trace" })
      );
    });

    test("複雑なオブジェクトコンテキスト", () => {
      const context = {
        user: { id: 123, name: "Test User" },
        request: { method: "POST", path: "/api/data" },
        metadata: { timestamp: "2025-07-15", version: "1.0.0" }
      };
      
      logger.info("API呼び出し", context);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        "[INFO]",
        JSON.stringify({ message: "API呼び出し", ...context })
      );
    });

    test("空のコンテキスト", () => {
      logger.info("メッセージ", {});
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        "[INFO]",
        JSON.stringify({ message: "メッセージ" })
      );
    });

    test("logWithTimestamp（構造化ログでも同じ）", () => {
      const originalDate = Date;
      const mockDate = vi.fn(() => ({
        toISOString: () => "2025-07-15T12:00:00.000Z"
      }));
      global.Date = mockDate as any;

      logger.logWithTimestamp("タイムスタンプ付きメッセージ");
      
      expect(mockConsole.log).toHaveBeenCalledWith("[2025-07-15T12:00:00.000Z] タイムスタンプ付きメッセージ");
      
      global.Date = originalDate;
    });
  });

  describe("特殊文字とエッジケース", () => {
    beforeEach(() => {
      logger = new ConsoleLogger(true);
    });

    test("特殊文字を含むメッセージ", () => {
      const message = "特殊文字: \n\t\"'\\";
      const context = { key: "value with \"quotes\" and \n newlines" };
      
      logger.info(message, context);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        "[INFO]",
        JSON.stringify({ message, key: "value with \"quotes\" and \n newlines" })
      );
    });

    test("undefinedとnullを含むコンテキスト", () => {
      const context = { 
        definedValue: "test",
        undefinedValue: undefined,
        nullValue: null
      };
      
      logger.info("混合値テスト", context);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        "[INFO]",
        JSON.stringify({ message: "混合値テスト", ...context })
      );
    });

    test("循環参照のないオブジェクト", () => {
      const context = { 
        level1: { 
          level2: { 
            value: "deep nested" 
          } 
        } 
      };
      
      logger.info("ネストされたオブジェクト", context);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        "[INFO]",
        JSON.stringify({ message: "ネストされたオブジェクト", ...context })
      );
    });
  });

  describe("デフォルトコンストラクタ", () => {
    test("デフォルトは非構造化ログ", () => {
      const defaultLogger = new ConsoleLogger();
      const context = { test: "value" };
      
      defaultLogger.info("テストメッセージ", context);
      
      expect(mockConsole.info).toHaveBeenCalledWith("[INFO] テストメッセージ");
    });
  });
});

describe("MockLogger", () => {
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
  });

  describe("ログ記録機能", () => {
    test("各レベルのログ記録", () => {
      logger.debug("デバッグ");
      logger.info("情報");
      logger.warn("警告");
      logger.error("エラー");
      logger.logWithTimestamp("タイムスタンプ");

      expect(logger.logs).toHaveLength(5);
      expect(logger.logs[0]).toEqual({ level: "debug", message: "デバッグ", context: undefined });
      expect(logger.logs[1]).toEqual({ level: "info", message: "情報", context: undefined });
      expect(logger.logs[2]).toEqual({ level: "warn", message: "警告", context: undefined });
      expect(logger.logs[3]).toEqual({ level: "error", message: "エラー", context: undefined });
      expect(logger.logs[4]).toEqual({ level: "timestamp", message: "タイムスタンプ", context: undefined });
    });

    test("コンテキスト付きログ記録", () => {
      const context = { userId: 123, action: "login" };
      logger.info("ユーザーログイン", context);

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0]).toEqual({ 
        level: "info", 
        message: "ユーザーログイン", 
        context 
      });
    });

    test("複数ログの蓄積", () => {
      logger.debug("デバッグ1");
      logger.info("情報1", { key: "value1" });
      logger.debug("デバッグ2");
      logger.error("エラー1", { error: "test error" });

      expect(logger.logs).toHaveLength(4);
      expect(logger.logs.map(log => log.level)).toEqual(["debug", "info", "debug", "error"]);
    });
  });

  describe("ユーティリティメソッド", () => {
    test("clear機能", () => {
      logger.info("テスト1");
      logger.warn("テスト2");
      expect(logger.logs).toHaveLength(2);

      logger.clear();
      expect(logger.logs).toHaveLength(0);

      logger.error("テスト3");
      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0]?.level).toBe("error");
    });

    test("hasLog - レベルとメッセージでの検索", () => {
      logger.info("成功メッセージ");
      logger.error("エラーが発生しました");
      logger.debug("デバッグ情報: 詳細データ");

      expect(logger.hasLog("info", "成功")).toBe(true);
      expect(logger.hasLog("error", "エラーが発生")).toBe(true);
      expect(logger.hasLog("debug", "詳細データ")).toBe(true);
      
      expect(logger.hasLog("warn", "成功")).toBe(false);
      expect(logger.hasLog("info", "存在しない")).toBe(false);
      expect(logger.hasLog("error", "成功")).toBe(false);
    });

    test("hasLog - 部分マッチング", () => {
      logger.info("これは非常に長いメッセージです");
      
      expect(logger.hasLog("info", "非常に長い")).toBe(true);
      expect(logger.hasLog("info", "これは")).toBe(true);
      expect(logger.hasLog("info", "です")).toBe(true);
      expect(logger.hasLog("info", "存在しないテキスト")).toBe(false);
    });

    test("hasLog - 空文字列での検索", () => {
      logger.info("任意のメッセージ");
      
      expect(logger.hasLog("info", "")).toBe(true);
      expect(logger.hasLog("warn", "")).toBe(false);
    });

    test("hasLog - 特殊文字を含むメッセージ", () => {
      logger.error("エラー: ファイルが見つかりません [404]");
      
      expect(logger.hasLog("error", "[404]")).toBe(true);
      expect(logger.hasLog("error", "ファイルが見つかりません")).toBe(true);
    });
  });

  describe("エッジケース", () => {
    test("空のメッセージ", () => {
      logger.info("");
      
      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0]?.message).toBe("");
    });

    test("非常に長いメッセージ", () => {
      const longMessage = "a".repeat(10000);
      logger.info(longMessage);
      
      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0]?.message).toBe(longMessage);
    });

    test("大きなコンテキストオブジェクト", () => {
      const largeContext = {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };
      
      logger.info("大量データ", largeContext);
      
      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0]?.context?.data).toHaveLength(1000);
    });

    test("複雑なネストされたコンテキスト", () => {
      const complexContext = {
        user: {
          id: 123,
          profile: {
            name: "Test User",
            preferences: {
              theme: "dark",
              notifications: true
            }
          }
        },
        request: {
          headers: {
            "content-type": "application/json",
            "authorization": "Bearer token"
          }
        }
      };
      
      logger.info("複雑なコンテキスト", complexContext);
      
      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0]?.context).toEqual(complexContext);
    });
  });

  describe("独立性のテスト", () => {
    test("複数のMockLoggerインスタンスの独立性", () => {
      const logger1 = new MockLogger();
      const logger2 = new MockLogger();

      logger1.info("Logger1のメッセージ");
      logger2.error("Logger2のメッセージ");

      expect(logger1.logs).toHaveLength(1);
      expect(logger2.logs).toHaveLength(1);
      expect(logger1.logs[0]?.message).toBe("Logger1のメッセージ");
      expect(logger2.logs[0]?.message).toBe("Logger2のメッセージ");
    });
  });

  describe("メモリ使用量制限", () => {
    test("ログ数の上限制限", () => {
      const mockLogger = new MockLogger();
      
      // 1200個のログを生成（制限の1000個を超える）
      for (let i = 0; i < 1200; i++) {
        mockLogger.info(`テストメッセージ ${i}`);
      }
      
      // ログ数が1000個に制限されていることを確認
      expect(mockLogger.logs).toHaveLength(1000);
      
      // 最新の1000個が保持されていることを確認（200〜1199）
      expect(mockLogger.logs[0]?.message).toBe("テストメッセージ 200");
      expect(mockLogger.logs[999]?.message).toBe("テストメッセージ 1199");
    });

    test("メモリ制限下でのclear機能", () => {
      const mockLogger = new MockLogger();
      
      // 1500個のログを生成
      for (let i = 0; i < 1500; i++) {
        mockLogger.info(`大量ログ ${i}`);
      }
      
      // 制限されて1000個になっていることを確認
      expect(mockLogger.logs).toHaveLength(1000);
      
      // clearで完全に削除されることを確認
      mockLogger.clear();
      expect(mockLogger.logs).toHaveLength(0);
    });
  });
});
import { describe, test, expect } from "vitest";
import { BaseCommand } from "./base-command.ts";
import type { Result } from "../core/interfaces.ts";
import { ResultUtils } from "../utils/result.ts";

// テスト用の具象クラス
class TestCommand extends BaseCommand<string, string> {
  async execute(input: string): Promise<Result<string>> {
    return this.safeExecute(async () => {
      if (input === "error") {
        throw new Error("Test error");
      }
      if (input === "string-error") {
        throw "String error";
      }
      return `processed: ${input}`;
    }, "Test command failed");
  }

  // safeExecuteメソッドを直接テストするためのpublicメソッド
  async testSafeExecute<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<Result<T>> {
    return this.safeExecute(operation, errorMessage);
  }
}

describe("BaseCommand", () => {
  let testCommand: TestCommand;

  beforeEach(() => {
    testCommand = new TestCommand();
  });

  test("抽象クラスの実装", () => {
    expect(testCommand).toBeInstanceOf(BaseCommand);
    expect(testCommand).toBeInstanceOf(TestCommand);
    expect(typeof testCommand.execute).toBe("function");
  });

  describe("safeExecute", () => {
    test("成功時の結果", async () => {
      const result = await testCommand.testSafeExecute(
        async () => "success result",
        "Operation failed"
      );

      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data).toBe("success result");
      }
    });

    test("Error例外のハンドリング", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          throw new Error("Original error");
        },
        "Custom error message"
      );

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Custom error message: Original error");
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test("非Error例外のハンドリング", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          throw "String error";
        },
        "String error occurred"
      );

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("String error occurred: String error");
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test("null例外のハンドリング", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          throw null;
        },
        "Null error occurred"
      );

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Null error occurred: null");
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test("undefined例外のハンドリング", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          throw undefined;
        },
        "Undefined error occurred"
      );

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Undefined error occurred: undefined");
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test("数値例外のハンドリング", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          throw 404;
        },
        "Numeric error occurred"
      );

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Numeric error occurred: 404");
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test("オブジェクト例外のハンドリング", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          throw { code: 500, message: "Internal error" };
        },
        "Object error occurred"
      );

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toContain("Object error occurred:");
        expect(result.error.message).toContain("object Object");
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test("Promise拒否のハンドリング", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          return Promise.reject(new Error("Promise rejected"));
        },
        "Promise operation failed"
      );

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Promise operation failed: Promise rejected");
      }
    });

    test("非同期操作の成功", async () => {
      const result = await testCommand.testSafeExecute(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return "async success";
        },
        "Async operation failed"
      );

      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data).toBe("async success");
      }
    });
  });

  describe("execute実装", () => {
    test("正常な処理", async () => {
      const result = await testCommand.execute("test input");

      expect(ResultUtils.isSuccess(result)).toBe(true);
      if (ResultUtils.isSuccess(result)) {
        expect(result.data).toBe("processed: test input");
      }
    });

    test("Error例外発生", async () => {
      const result = await testCommand.execute("error");

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Test command failed: Test error");
      }
    });

    test("文字列例外発生", async () => {
      const result = await testCommand.execute("string-error");

      expect(ResultUtils.isFailure(result)).toBe(true);
      if (ResultUtils.isFailure(result)) {
        expect(result.error.message).toBe("Test command failed: String error");
      }
    });
  });

  test("継承関係の確認", () => {
    expect(testCommand instanceof BaseCommand).toBe(true);
    expect(testCommand.constructor.name).toBe("TestCommand");
  });

  test("型安全性の確認", () => {
    // TypeScript型システムによる型安全性の確認
    const command: BaseCommand<string, string> = testCommand;
    expect(typeof command.execute).toBe("function");
  });
});
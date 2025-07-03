import { describe, test, expect } from "vitest";
import { ResultUtils } from "./result.ts";
import type { Result } from "../core/interfaces.ts";

describe("ResultUtils", () => {
  describe("success", () => {
    test("成功結果の作成", () => {
      const data = "test data";
      const result = ResultUtils.success(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(data);
      }
    });

    test("オブジェクトデータの成功結果", () => {
      const data = { name: "test", value: 42 };
      const result = ResultUtils.success(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    test("nullデータの成功結果", () => {
      const result = ResultUtils.success(null);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    test("undefinedデータの成功結果", () => {
      const result = ResultUtils.success(undefined);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });
  });

  describe("failure", () => {
    test("エラー結果の作成", () => {
      const error = new Error("test error");
      const result = ResultUtils.failure(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });

    test("文字列エラーの結果", () => {
      const error = "string error";
      const result = ResultUtils.failure(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });

    test("カスタムエラータイプ", () => {
      interface CustomError {
        code: number;
        message: string;
      }

      const error: CustomError = { code: 404, message: "Not found" };
      const result: Result<string, CustomError> = ResultUtils.failure(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(error);
      }
    });
  });

  describe("isSuccess", () => {
    test("成功結果の判定", () => {
      const successResult = ResultUtils.success("data");
      expect(ResultUtils.isSuccess(successResult)).toBe(true);
    });

    test("失敗結果の判定", () => {
      const failureResult = ResultUtils.failure(new Error("error"));
      expect(ResultUtils.isSuccess(failureResult)).toBe(false);
    });

    test("型ガードとしての機能", () => {
      const result: Result<string> = ResultUtils.success("test");
      
      if (ResultUtils.isSuccess(result)) {
        // TypeScriptの型チェックで、result.dataにアクセス可能
        expect(result.data).toBe("test");
      }
    });
  });

  describe("isFailure", () => {
    test("失敗結果の判定", () => {
      const failureResult = ResultUtils.failure(new Error("error"));
      expect(ResultUtils.isFailure(failureResult)).toBe(true);
    });

    test("成功結果の判定", () => {
      const successResult = ResultUtils.success("data");
      expect(ResultUtils.isFailure(successResult)).toBe(false);
    });

    test("型ガードとしての機能", () => {
      const result: Result<string> = ResultUtils.failure(new Error("test"));
      
      if (ResultUtils.isFailure(result)) {
        // TypeScriptの型チェックで、result.errorにアクセス可能
        expect(result.error.message).toBe("test");
      }
    });
  });

  describe("map", () => {
    test("成功結果の変換", () => {
      const result = ResultUtils.success(10);
      const mapped = ResultUtils.map(result, (x) => x * 2);

      expect(ResultUtils.isSuccess(mapped)).toBe(true);
      if (ResultUtils.isSuccess(mapped)) {
        expect(mapped.data).toBe(20);
      }
    });

    test("失敗結果の変換（何もしない）", () => {
      const error = new Error("test error");
      const result = ResultUtils.failure<number>(error);
      const mapped = ResultUtils.map(result, (x) => x * 2);

      expect(ResultUtils.isFailure(mapped)).toBe(true);
      if (ResultUtils.isFailure(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });

    test("型変換のマッピング", () => {
      const result = ResultUtils.success(42);
      const mapped = ResultUtils.map(result, (num) => num.toString());

      expect(ResultUtils.isSuccess(mapped)).toBe(true);
      if (ResultUtils.isSuccess(mapped)) {
        expect(mapped.data).toBe("42");
        expect(typeof mapped.data).toBe("string");
      }
    });

    test("オブジェクトの変換", () => {
      const result = ResultUtils.success({ name: "test", age: 25 });
      const mapped = ResultUtils.map(result, (person) => ({ ...person, isAdult: person.age >= 18 }));

      expect(ResultUtils.isSuccess(mapped)).toBe(true);
      if (ResultUtils.isSuccess(mapped)) {
        expect(mapped.data.isAdult).toBe(true);
      }
    });
  });

  describe("flatMap", () => {
    test("成功結果のフラットマッピング", () => {
      const result = ResultUtils.success(10);
      const flatMapped = ResultUtils.flatMap(result, (x) => 
        x > 0 ? ResultUtils.success(x * 2) : ResultUtils.failure(new Error("negative"))
      );

      expect(ResultUtils.isSuccess(flatMapped)).toBe(true);
      if (ResultUtils.isSuccess(flatMapped)) {
        expect(flatMapped.data).toBe(20);
      }
    });

    test("成功結果から失敗結果への変換", () => {
      const result = ResultUtils.success(-5);
      const flatMapped = ResultUtils.flatMap(result, (x) => 
        x > 0 ? ResultUtils.success(x * 2) : ResultUtils.failure(new Error("negative"))
      );

      expect(ResultUtils.isFailure(flatMapped)).toBe(true);
      if (ResultUtils.isFailure(flatMapped)) {
        expect(flatMapped.error.message).toBe("negative");
      }
    });

    test("失敗結果のフラットマッピング（何もしない）", () => {
      const error = new Error("original error");
      const result = ResultUtils.failure<number>(error);
      const flatMapped = ResultUtils.flatMap(result, (x) => 
        ResultUtils.success(x * 2)
      );

      expect(ResultUtils.isFailure(flatMapped)).toBe(true);
      if (ResultUtils.isFailure(flatMapped)) {
        expect(flatMapped.error).toBe(error);
      }
    });

    test("チェーンの実装", () => {
      const result = ResultUtils.success("10");
      const parsed: Result<number, Error> = ResultUtils.flatMap(result, (str) => {
        const num = parseInt(str);
        return isNaN(num) ? ResultUtils.failure(new Error("Not a number")) : ResultUtils.success(num);
      });
      const doubled = ResultUtils.flatMap(parsed, (num) => ResultUtils.success(num * 2));

      expect(ResultUtils.isSuccess(doubled)).toBe(true);
      if (ResultUtils.isSuccess(doubled)) {
        expect(doubled.data).toBe(20);
      }
    });
  });

  describe("mapAsync", () => {
    test("成功結果の非同期変換", async () => {
      const result = ResultUtils.success(10);
      const mapped = await ResultUtils.mapAsync(result, async (x) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return x * 2;
      });

      expect(ResultUtils.isSuccess(mapped)).toBe(true);
      if (ResultUtils.isSuccess(mapped)) {
        expect(mapped.data).toBe(20);
      }
    });

    test("失敗結果の非同期変換（何もしない）", async () => {
      const error = new Error("test error");
      const result = ResultUtils.failure<number>(error);
      const mapped = await ResultUtils.mapAsync(result, async (x) => x * 2);

      expect(ResultUtils.isFailure(mapped)).toBe(true);
      if (ResultUtils.isFailure(mapped)) {
        expect(mapped.error).toBe(error);
      }
    });

    test("非同期処理でのエラーハンドリング", async () => {
      const result = ResultUtils.success(10);
      const mapped = await ResultUtils.mapAsync(result, async (x) => {
        throw new Error("async error");
      });

      expect(ResultUtils.isFailure(mapped)).toBe(true);
      if (ResultUtils.isFailure(mapped)) {
        expect(mapped.error.message).toBe("async error");
      }
    });

    test("Promise拒否のハンドリング", async () => {
      const result = ResultUtils.success(10);
      const mapped = await ResultUtils.mapAsync(result, async (x) => {
        return Promise.reject(new Error("rejected"));
      });

      expect(ResultUtils.isFailure(mapped)).toBe(true);
      if (ResultUtils.isFailure(mapped)) {
        expect(mapped.error.message).toBe("rejected");
      }
    });
  });

  describe("getOrThrow", () => {
    test("成功結果からデータを取得", () => {
      const result = ResultUtils.success("test data");
      const data = ResultUtils.getOrThrow(result);

      expect(data).toBe("test data");
    });

    test("失敗結果から例外をthrow", () => {
      const error = new Error("test error");
      const result = ResultUtils.failure(error);

      expect(() => ResultUtils.getOrThrow(result)).toThrow(error);
    });

    test("カスタムエラータイプの例外", () => {
      const error = "string error";
      const result = ResultUtils.failure(error);

      expect(() => ResultUtils.getOrThrow(result)).toThrow(error);
    });
  });

  describe("getOrDefault", () => {
    test("成功結果からデータを取得", () => {
      const result = ResultUtils.success("actual data");
      const data = ResultUtils.getOrDefault(result, "default data");

      expect(data).toBe("actual data");
    });

    test("失敗結果からデフォルト値を取得", () => {
      const result = ResultUtils.failure(new Error("error"));
      const data = ResultUtils.getOrDefault(result, "default data");

      expect(data).toBe("default data");
    });

    test("nullデータとデフォルト値", () => {
      const result = ResultUtils.success(null);
      const data = ResultUtils.getOrDefault(result, "default");

      expect(data).toBeNull();
    });

    test("異なる型のデフォルト値", () => {
      const result: Result<number> = ResultUtils.failure(new Error("error"));
      const data = ResultUtils.getOrDefault(result, 42);

      expect(data).toBe(42);
    });
  });

  describe("複合操作", () => {
    test("map と flatMap の組み合わせ", () => {
      const result = ResultUtils.success("10");
      
      const processed = ResultUtils.flatMap(
        ResultUtils.map(result, (str) => parseInt(str)),
        (num) => isNaN(num) 
          ? ResultUtils.failure(new Error("Invalid number"))
          : ResultUtils.success(num * 2)
      );

      expect(ResultUtils.isSuccess(processed)).toBe(true);
      if (ResultUtils.isSuccess(processed)) {
        expect(processed.data).toBe(20);
      }
    });

    test("エラーハンドリングチェーン", () => {
      const result = ResultUtils.success("invalid");
      
      const processed = ResultUtils.flatMap(
        ResultUtils.map(result, (str) => parseInt(str)),
        (num) => isNaN(num) 
          ? ResultUtils.failure(new Error("Invalid number"))
          : ResultUtils.success(num * 2)
      );

      expect(ResultUtils.isFailure(processed)).toBe(true);
      if (ResultUtils.isFailure(processed)) {
        expect(processed.error.message).toBe("Invalid number");
      }
    });

    test("getOrDefault による安全な値取得", () => {
      const parseNumber = (str: string): Result<number> => {
        const num = parseInt(str);
        return isNaN(num) 
          ? ResultUtils.failure(new Error("Invalid number"))
          : ResultUtils.success(num);
      };

      const validInput = "42";
      const invalidInput = "abc";

      expect(ResultUtils.getOrDefault(parseNumber(validInput), 0)).toBe(42);
      expect(ResultUtils.getOrDefault(parseNumber(invalidInput), 0)).toBe(0);
    });
  });
});
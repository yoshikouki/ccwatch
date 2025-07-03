import type { Result } from "../core/interfaces.ts";

export class ResultUtils {
  static success<T>(data: T): Result<T, never> {
    return { success: true, data };
  }

  static failure<T, E = Error>(error: E): Result<T, E> {
    return { success: false, error };
  }

  static isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
    return result.success;
  }

  static isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return !result.success;
  }

  static map<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => U
  ): Result<U, E> {
    return ResultUtils.isSuccess(result)
      ? { success: true, data: fn(result.data) }
      : { success: false, error: result.error };
  }

  static flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
  ): Result<U, E> {
    return ResultUtils.isSuccess(result)
      ? fn(result.data)
      : { success: false, error: result.error };
  }

  static async mapAsync<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Promise<U>
  ): Promise<Result<U, E | Error>> {
    if (ResultUtils.isSuccess(result)) {
      try {
        const data = await fn(result.data);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error as Error };
      }
    }
    return { success: false, error: result.error };
  }

  static getOrThrow<T, E>(result: Result<T, E>): T {
    if (ResultUtils.isSuccess(result)) {
      return result.data;
    }
    throw result.error;
  }

  static getOrDefault<T, E>(result: Result<T, E>, defaultValue: T): T {
    return ResultUtils.isSuccess(result) ? result.data : defaultValue;
  }
}
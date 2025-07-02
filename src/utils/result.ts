import { Result } from "../core/interfaces.ts";

export class ResultUtils {
  static success<T>(data: T): Result<T> {
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
      ? ResultUtils.success(fn(result.data))
      : result;
  }

  static flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
  ): Result<U, E> {
    return ResultUtils.isSuccess(result)
      ? fn(result.data)
      : result;
  }

  static async mapAsync<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Promise<U>
  ): Promise<Result<U, E>> {
    if (ResultUtils.isSuccess(result)) {
      try {
        const data = await fn(result.data);
        return ResultUtils.success(data);
      } catch (error) {
        return ResultUtils.failure(error as E);
      }
    }
    return result;
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
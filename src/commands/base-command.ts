import type { Result } from "../core/interfaces.ts";

export abstract class BaseCommand<TInput, TOutput> {
  abstract execute(input: TInput): Promise<Result<TOutput>>;
  
  protected async safeExecute<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<Result<T>> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      const errorInstance = error instanceof Error 
        ? error 
        : new Error(String(error));
      
      return { 
        success: false, 
        error: new Error(`${errorMessage}: ${errorInstance.message}`) 
      };
    }
  }
}
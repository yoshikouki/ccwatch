export interface CommandExecutor {
  execute(command: string, options?: CommandOptions): Promise<string>;
}

export interface CommandOptions {
  maxBuffer?: number;
  timeout?: number;
  encoding?: BufferEncoding;
}

export class NodeCommandExecutor implements CommandExecutor {
  async execute(command: string, options: CommandOptions = {}): Promise<string> {
    const { execSync } = await import("child_process");
    
    try {
      const result = execSync(command, {
        encoding: options.encoding || "utf8",
        maxBuffer: options.maxBuffer || 10 * 1024 * 1024, // 10MB default
        timeout: options.timeout
      });
      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    }
  }
}

export class MockCommandExecutor implements CommandExecutor {
  private mockResponses = new Map<string, string>();
  private executedCommands: string[] = [];

  setMockResponse(command: string, response: string): void {
    this.mockResponses.set(command, response);
  }

  async execute(command: string, options?: CommandOptions): Promise<string> {
    this.executedCommands.push(command);
    
    const response = this.mockResponses.get(command);
    if (response === undefined) {
      throw new Error(`No mock response set for command: ${command}`);
    }
    
    return response;
  }

  getExecutedCommands(): string[] {
    return [...this.executedCommands];
  }

  clear(): void {
    this.mockResponses.clear();
    this.executedCommands = [];
  }
}
import { describe, test, expect, beforeEach } from "vitest";
import { NodeCommandExecutor, MockCommandExecutor } from "./command-executor.ts";

describe("NodeCommandExecutor", () => {
  let executor: NodeCommandExecutor;

  beforeEach(() => {
    executor = new NodeCommandExecutor();
  });

  test("基本的なコマンド実行", async () => {
    // シンプルなechoコマンドで実行確認
    const result = await executor.execute("echo 'test'");
    
    expect(result.trim()).toBe("test");
  });

  test("コマンドオプションの適用", async () => {
    // encoding指定
    const result = await executor.execute("echo 'test'", {
      encoding: "utf8"
    });
    
    expect(typeof result).toBe("string");
    expect(result.trim()).toBe("test");
  });

  test("存在しないコマンドのエラーハンドリング", async () => {
    await expect(executor.execute("nonexistent-command-12345")).rejects.toThrow();
  });

  test("maxBuffer制限の確認", async () => {
    // 非常に小さなmaxBufferでテスト
    await expect(
      executor.execute("echo 'this is a test'", { maxBuffer: 5 })
    ).rejects.toThrow();
  });

  test("デフォルトオプション", async () => {
    // デフォルトオプションで実行（encoding: utf8, maxBuffer: 10MB）
    const result = await executor.execute("echo 'default test'");
    
    expect(typeof result).toBe("string");
    expect(result.trim()).toBe("default test");
  });
});

describe("MockCommandExecutor", () => {
  let mockExecutor: MockCommandExecutor;

  beforeEach(() => {
    mockExecutor = new MockCommandExecutor();
  });

  describe("基本機能", () => {
    test("モックレスポンスの設定と実行", async () => {
      const testCommand = "test-command";
      const testResponse = "test response";
      
      mockExecutor.setMockResponse(testCommand, testResponse);
      
      const result = await mockExecutor.execute(testCommand);
      
      expect(result).toBe(testResponse);
    });

    test("実行履歴の記録", async () => {
      const command1 = "command1";
      const command2 = "command2";
      
      mockExecutor.setMockResponse(command1, "response1");
      mockExecutor.setMockResponse(command2, "response2");
      
      await mockExecutor.execute(command1);
      await mockExecutor.execute(command2);
      
      const executedCommands = mockExecutor.getExecutedCommands();
      expect(executedCommands).toEqual([command1, command2]);
    });

    test("未設定コマンドのエラー", async () => {
      await expect(mockExecutor.execute("unknown-command")).rejects.toThrow(
        "No mock response set for command: unknown-command"
      );
    });
  });

  describe("状態管理", () => {
    test("複数回の同じコマンド実行", async () => {
      const command = "repeat-command";
      const response = "same response";
      
      mockExecutor.setMockResponse(command, response);
      
      await mockExecutor.execute(command);
      await mockExecutor.execute(command);
      await mockExecutor.execute(command);
      
      const executedCommands = mockExecutor.getExecutedCommands();
      expect(executedCommands).toEqual([command, command, command]);
    });

    test("クリア機能", async () => {
      mockExecutor.setMockResponse("test", "response");
      await mockExecutor.execute("test");
      
      expect(mockExecutor.getExecutedCommands()).toHaveLength(1);
      
      mockExecutor.clear();
      
      expect(mockExecutor.getExecutedCommands()).toHaveLength(0);
      
      // クリア後は未設定エラーになる
      await expect(mockExecutor.execute("test")).rejects.toThrow(
        "No mock response set for command: test"
      );
    });

    test("レスポンス上書き", async () => {
      const command = "overwrite-test";
      
      mockExecutor.setMockResponse(command, "first response");
      const firstResult = await mockExecutor.execute(command);
      expect(firstResult).toBe("first response");
      
      mockExecutor.setMockResponse(command, "second response");
      const secondResult = await mockExecutor.execute(command);
      expect(secondResult).toBe("second response");
    });
  });

  describe("複雑なシナリオ", () => {
    test("複数コマンドの混在実行", async () => {
      const commands = {
        "ls": "file1.txt\nfile2.txt",
        "pwd": "/home/user",
        "echo hello": "hello",
        "ccusage --format json": '{"totals": {"totalCost": 123}}'
      };
      
      // 全てのモックレスポンスを設定
      Object.entries(commands).forEach(([cmd, resp]) => {
        mockExecutor.setMockResponse(cmd, resp);
      });
      
      // 順不同で実行
      const results = {
        pwd: await mockExecutor.execute("pwd"),
        echo: await mockExecutor.execute("echo hello"),
        ls: await mockExecutor.execute("ls"),
        ccusage: await mockExecutor.execute("ccusage --format json")
      };
      
      expect(results.pwd).toBe("/home/user");
      expect(results.echo).toBe("hello");
      expect(results.ls).toBe("file1.txt\nfile2.txt");
      expect(results.ccusage).toBe('{"totals": {"totalCost": 123}}');
      
      const executedCommands = mockExecutor.getExecutedCommands();
      expect(executedCommands).toEqual([
        "pwd",
        "echo hello", 
        "ls",
        "ccusage --format json"
      ]);
    });

    test("エラーレスポンスのシミュレーション", async () => {
      // エラーを発生させるため、あえてレスポンスを設定しない
      await expect(mockExecutor.execute("error-command")).rejects.toThrow();
      
      // 実行履歴にはエラーのコマンドも記録される
      const executedCommands = mockExecutor.getExecutedCommands();
      expect(executedCommands).toEqual(["error-command"]);
    });

    test("大きなレスポンスデータ", async () => {
      const largeResponse = "x".repeat(1024 * 1024); // 1MB
      
      mockExecutor.setMockResponse("large-data", largeResponse);
      
      const result = await mockExecutor.execute("large-data");
      
      expect(result).toBe(largeResponse);
      expect(result.length).toBe(1024 * 1024);
    });
  });

  describe("オプション処理", () => {
    test("オプション指定（MockCommandExecutorでは無視される）", async () => {
      mockExecutor.setMockResponse("test", "response");
      
      // オプションを指定しても同じ結果
      const result1 = await mockExecutor.execute("test");
      const result2 = await mockExecutor.execute("test", { 
        maxBuffer: 100,
        timeout: 5000,
        encoding: "ascii" 
      });
      
      expect(result1).toBe("response");
      expect(result2).toBe("response");
      expect(result1).toBe(result2);
    });
  });
});
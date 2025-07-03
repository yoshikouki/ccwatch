import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { FileProcessManager, MockProcessManager } from "./process-manager.ts";
import { MockLogger } from "./logger.ts";
import { promises as fs } from "fs";
import { join } from "path";

describe("FileProcessManager", () => {
  let processManager: FileProcessManager;
  let mockLogger: MockLogger;
  let tempDir: string;

  beforeEach(() => {
    mockLogger = new MockLogger();
    tempDir = "/tmp/ccwatch-test";
    processManager = new FileProcessManager(mockLogger, tempDir);
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    await processManager.cleanup();
    
    // テンポラリファイルの削除
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        if (file.startsWith("ccwatch-")) {
          await fs.unlink(join(tempDir, file));
        }
      }
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  });

  describe("プロセスロック機能", () => {
    test("初回ロック取得成功", async () => {
      const result = await processManager.acquireLock("test-daemon");
      
      expect(result).toBe(true);
      expect(mockLogger.hasLog("info", "プロセスロック取得完了")).toBe(true);
      
      // PIDファイルが作成されていることを確認
      const pidFile = join(tempDir, "ccwatch-test-daemon.pid");
      const pidContent = await fs.readFile(pidFile, 'utf8');
      expect(parseInt(pidContent, 10)).toBe(process.pid);
    });

    test("重複ロック防止", async () => {
      // 最初のロック取得
      const firstResult = await processManager.acquireLock("test-daemon");
      expect(firstResult).toBe(true);
      
      // 同じプロセスマネージャーからの重複ロック試行
      const secondManager = new FileProcessManager(mockLogger, tempDir);
      const secondResult = await secondManager.acquireLock("test-daemon");
      
      expect(secondResult).toBe(false);
      expect(mockLogger.hasLog("warn", "既存のプロセスが検出されました")).toBe(true);
      
      await secondManager.cleanup();
    });

    test("古いPIDファイルの自動削除", async () => {
      const pidFile = join(tempDir, "ccwatch-test-daemon.pid");
      
      // 存在しないPIDでファイルを作成
      const stalePid = 999999;
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(pidFile, stalePid.toString());
      
      // ロック取得試行
      const result = await processManager.acquireLock("test-daemon");
      
      expect(result).toBe(true);
      expect(mockLogger.hasLog("debug", "古いPIDファイルを削除")).toBe(true);
      
      // 新しいPIDファイルが作成されていることを確認
      const newPidContent = await fs.readFile(pidFile, 'utf8');
      expect(parseInt(newPidContent, 10)).toBe(process.pid);
    });

    test("ロック解放", async () => {
      await processManager.acquireLock("test-daemon");
      
      await processManager.releaseLock("test-daemon");
      
      expect(mockLogger.hasLog("info", "プロセスロック解放完了")).toBe(true);
      
      // PIDファイルが削除されていることを確認
      const pidFile = join(tempDir, "ccwatch-test-daemon.pid");
      await expect(fs.access(pidFile)).rejects.toThrow();
    });

    test("存在しないロックの解放", async () => {
      await processManager.releaseLock("nonexistent-daemon");
      
      expect(mockLogger.hasLog("warn", "プロセスロック解放時の警告")).toBe(true);
    });
  });

  describe("プロセス状態確認", () => {
    test("現在のプロセス確認", () => {
      const result = processManager.isProcessRunning(process.pid);
      expect(result).toBe(true);
    });

    test("存在しないプロセス確認", () => {
      const result = processManager.isProcessRunning(999999);
      expect(result).toBe(false);
    });

    test("権限のないプロセス確認", () => {
      // プロセス1（init）は通常権限がないが存在する
      vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (pid === 1 && signal === 0) {
          const error = new Error('Operation not permitted') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }
        return true;
      });

      const result = processManager.isProcessRunning(1);
      expect(result).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe("クリーンアップ機能", () => {
    test("複数ロックのクリーンアップ", async () => {
      await processManager.acquireLock("daemon1");
      await processManager.acquireLock("daemon2");
      await processManager.acquireLock("daemon3");
      
      await processManager.cleanup();
      
      // すべてのログメッセージを確認
      const releaseCount = mockLogger.logs.filter(log => 
        log.message.includes("プロセスロック解放完了")
      ).length;
      expect(releaseCount).toBe(3);
      expect(mockLogger.hasLog("debug", "プロセスマネージャークリーンアップ完了")).toBe(true);
    });
  });

  describe("エラーハンドリング", () => {
    test("PIDファイル作成失敗", async () => {
      // 書き込み権限のないディレクトリを指定
      const readOnlyManager = new FileProcessManager(mockLogger, "/root/readonly");
      
      const result = await readOnlyManager.acquireLock("test-daemon");
      
      expect(result).toBe(false);
      expect(mockLogger.hasLog("error", "プロセスロック取得失敗")).toBe(true);
      
      await readOnlyManager.cleanup();
    });

    test("無効なPIDファイル内容", async () => {
      const pidFile = join(tempDir, "ccwatch-test-daemon.pid");
      
      // 無効な内容でPIDファイルを作成
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(pidFile, "invalid-pid-content");
      
      const result = await processManager.acquireLock("test-daemon");
      
      expect(result).toBe(true);
      expect(mockLogger.hasLog("debug", "古いPIDファイルを削除")).toBe(true);
    });
  });
});

describe("MockProcessManager", () => {
  let mockProcessManager: MockProcessManager;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockProcessManager = new MockProcessManager(mockLogger);
  });

  afterEach(async () => {
    await mockProcessManager.cleanup();
  });

  describe("基本機能", () => {
    test("ロック取得と解放", async () => {
      const result = await mockProcessManager.acquireLock("test-daemon");
      expect(result).toBe(true);
      
      await mockProcessManager.releaseLock("test-daemon");
      
      const locks = mockProcessManager.getLocks();
      expect(locks.has("test-daemon")).toBe(false);
    });

    test("重複ロック防止", async () => {
      mockProcessManager.setProcessRunning(process.pid, true);
      
      await mockProcessManager.acquireLock("test-daemon");
      const result = await mockProcessManager.acquireLock("test-daemon");
      
      expect(result).toBe(false);
    });

    test("プロセス状態管理", () => {
      const testPid = 12345;
      
      expect(mockProcessManager.isProcessRunning(testPid)).toBe(false);
      
      mockProcessManager.setProcessRunning(testPid, true);
      expect(mockProcessManager.isProcessRunning(testPid)).toBe(true);
      
      mockProcessManager.setProcessRunning(testPid, false);
      expect(mockProcessManager.isProcessRunning(testPid)).toBe(false);
    });

    test("クリーンアップ", async () => {
      await mockProcessManager.acquireLock("daemon1");
      await mockProcessManager.acquireLock("daemon2");
      
      await mockProcessManager.cleanup();
      
      const locks = mockProcessManager.getLocks();
      expect(locks.size).toBe(0);
    });
  });
});
import { promises as fs } from "fs";
import { join } from "path";
import type { Logger } from "../core/interfaces.ts";

export interface ProcessManager {
  acquireLock(name: string): Promise<boolean>;
  releaseLock(name: string): Promise<void>;
  isProcessRunning(pid: number): boolean;
  cleanup(): Promise<void>;
}

export class FileProcessManager implements ProcessManager {
  private readonly pidDir: string;
  private readonly acquiredLocks = new Set<string>();

  constructor(
    private logger: Logger,
    pidDir: string = "/tmp"
  ) {
    this.pidDir = pidDir;
  }

  async acquireLock(name: string): Promise<boolean> {
    const pidFile = join(this.pidDir, `ccwatch-${name}.pid`);
    
    try {
      // 既存のPIDファイルをチェック
      try {
        const existingPid = await fs.readFile(pidFile, 'utf8');
        const pid = parseInt(existingPid.trim(), 10);
        
        if (!isNaN(pid) && this.isProcessRunning(pid)) {
          this.logger.warn("既存のプロセスが検出されました", {
            component: 'process-manager',
            lockName: name,
            existingPid: pid
          });
          return false;
        }
        
        // 古いPIDファイルを削除
        await fs.unlink(pidFile);
        this.logger.debug("古いPIDファイルを削除", {
          component: 'process-manager',
          lockName: name,
          stalePid: pid
        });
      } catch (error) {
        // ファイルが存在しない場合は正常（初回実行）
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }

      // 新しいPIDファイルを作成
      const currentPid = process.pid;
      await fs.writeFile(pidFile, currentPid.toString(), { flag: 'wx' });
      
      this.acquiredLocks.add(name);
      
      this.logger.info("プロセスロック取得完了", {
        component: 'process-manager',
        lockName: name,
        pid: currentPid,
        pidFile
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error("プロセスロック取得失敗", {
        component: 'process-manager',
        lockName: name,
        error: errorMessage
      });
      return false;
    }
  }

  async releaseLock(name: string): Promise<void> {
    const pidFile = join(this.pidDir, `ccwatch-${name}.pid`);
    
    try {
      await fs.unlink(pidFile);
      this.acquiredLocks.delete(name);
      
      this.logger.info("プロセスロック解放完了", {
        component: 'process-manager',
        lockName: name,
        pidFile
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn("プロセスロック解放時の警告", {
        component: 'process-manager',
        lockName: name,
        error: errorMessage
      });
    }
  }

  isProcessRunning(pid: number): boolean {
    try {
      // プロセスが存在するかチェック（signal 0は実際にシグナルを送信しない）
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // ESRCH: No such process
      // EPERM: Operation not permitted (プロセスは存在するが権限なし)
      const err = error as NodeJS.ErrnoException;
      return err.code === 'EPERM';
    }
  }

  async cleanup(): Promise<void> {
    const lockNames = Array.from(this.acquiredLocks);
    
    for (const lockName of lockNames) {
      await this.releaseLock(lockName);
    }
    
    this.logger.debug("プロセスマネージャークリーンアップ完了", {
      component: 'process-manager',
      releasedLocks: lockNames.length
    });
  }
}

// テスト用のモック実装
export class MockProcessManager implements ProcessManager {
  private readonly locks = new Map<string, number>();
  private readonly runningProcesses = new Set<number>();

  constructor(private logger: Logger) {}

  async acquireLock(name: string): Promise<boolean> {
    if (this.locks.has(name)) {
      const existingPid = this.locks.get(name)!;
      if (this.isProcessRunning(existingPid)) {
        return false;
      }
    }
    
    this.locks.set(name, process.pid);
    return true;
  }

  async releaseLock(name: string): Promise<void> {
    this.locks.delete(name);
  }

  isProcessRunning(pid: number): boolean {
    return this.runningProcesses.has(pid);
  }

  async cleanup(): Promise<void> {
    this.locks.clear();
  }

  // テスト用ヘルパーメソッド
  setProcessRunning(pid: number, running: boolean): void {
    if (running) {
      this.runningProcesses.add(pid);
    } else {
      this.runningProcesses.delete(pid);
    }
  }

  getLocks(): Map<string, number> {
    return new Map(this.locks);
  }
}
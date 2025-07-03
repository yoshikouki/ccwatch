export interface Semaphore {
  acquire(timeoutMs?: number): Promise<boolean>;
  release(): void;
  getAvailablePermits(): number;
  isAcquired(): boolean;
}

export class BinarySemaphore implements Semaphore {
  private acquired = false;
  private readonly waitQueue: Array<{
    resolve: (value: boolean) => void;
    reject: (error: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];

  constructor(private name: string = 'unnamed') {}

  async acquire(timeoutMs: number = 30000): Promise<boolean> {
    if (!this.acquired) {
      this.acquired = true;
      return true;
    }

    // 既に取得されている場合はキューで待機
    return new Promise<boolean>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // タイムアウト時にキューから削除
        const index = this.waitQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        resolve(false); // タイムアウトの場合はfalseを返す
      }, timeoutMs);

      this.waitQueue.push({
        resolve,
        reject,
        timeoutId
      });
    });
  }

  release(): void {
    if (!this.acquired) {
      console.warn(`Semaphore ${this.name}: release() called but not acquired`);
      return;
    }

    this.acquired = false;

    // 待機中のタスクがあれば次のタスクに許可を与える
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      if (next.timeoutId) {
        clearTimeout(next.timeoutId);
      }
      this.acquired = true;
      next.resolve(true);
    }
  }

  getAvailablePermits(): number {
    return this.acquired ? 0 : 1;
  }

  isAcquired(): boolean {
    return this.acquired;
  }

  // デバッグ用メソッド
  getWaitQueueLength(): number {
    return this.waitQueue.length;
  }

  // 強制的にセマフォを解放（緊急時用）
  forceRelease(): void {
    this.acquired = false;
    
    // 待機中の全てのタスクをタイムアウトとして処理
    while (this.waitQueue.length > 0) {
      const item = this.waitQueue.shift()!;
      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }
      item.resolve(false);
    }
  }
}

// テスト用のモック実装
export class MockSemaphore implements Semaphore {
  private acquired = false;
  private acquireCount = 0;
  private releaseCount = 0;

  async acquire(timeoutMs?: number): Promise<boolean> {
    this.acquireCount++;
    
    if (!this.acquired) {
      this.acquired = true;
      return true;
    }
    
    // モックでは常にタイムアウトとして扱う
    return false;
  }

  release(): void {
    this.releaseCount++;
    this.acquired = false;
  }

  getAvailablePermits(): number {
    return this.acquired ? 0 : 1;
  }

  isAcquired(): boolean {
    return this.acquired;
  }

  // テスト用ヘルパーメソッド
  getAcquireCount(): number {
    return this.acquireCount;
  }

  getReleaseCount(): number {
    return this.releaseCount;
  }

  reset(): void {
    this.acquired = false;
    this.acquireCount = 0;
    this.releaseCount = 0;
  }
}
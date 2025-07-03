import { describe, test, expect, beforeEach, vi } from "vitest";
import { BinarySemaphore, MockSemaphore } from "./semaphore.ts";

describe("BinarySemaphore", () => {
  let semaphore: BinarySemaphore;

  beforeEach(() => {
    semaphore = new BinarySemaphore("test-semaphore");
  });

  describe("基本的な取得と解放", () => {
    test("初回取得成功", async () => {
      const result = await semaphore.acquire();
      
      expect(result).toBe(true);
      expect(semaphore.isAcquired()).toBe(true);
      expect(semaphore.getAvailablePermits()).toBe(0);
    });

    test("取得後の解放", async () => {
      await semaphore.acquire();
      
      semaphore.release();
      
      expect(semaphore.isAcquired()).toBe(false);
      expect(semaphore.getAvailablePermits()).toBe(1);
    });

    test("重複取得の防止", async () => {
      await semaphore.acquire();
      
      // 短いタイムアウトで2回目の取得を試行
      const result = await semaphore.acquire(100);
      
      expect(result).toBe(false);
      expect(semaphore.isAcquired()).toBe(true);
    });
  });

  describe("待機キューとタイムアウト", () => {
    test("待機後の取得成功", async () => {
      // 最初のタスクで取得
      await semaphore.acquire();
      
      // 2番目のタスクは待機
      const secondTask = semaphore.acquire(1000);
      
      // 少し待ってから解放
      setTimeout(() => {
        semaphore.release();
      }, 50);
      
      const result = await secondTask;
      expect(result).toBe(true);
      expect(semaphore.isAcquired()).toBe(true);
    });

    test("タイムアウト処理", async () => {
      await semaphore.acquire();
      
      const start = Date.now();
      const result = await semaphore.acquire(100);
      const elapsed = Date.now() - start;
      
      expect(result).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(90); // 多少の誤差を許容
      expect(elapsed).toBeLessThan(200);
    });

    test("複数タスクの待機処理", async () => {
      await semaphore.acquire();
      
      const task1 = semaphore.acquire(500);
      const task2 = semaphore.acquire(500);
      const task3 = semaphore.acquire(500);
      
      // 最初のタスクを解放
      setTimeout(() => semaphore.release(), 50);
      
      const results = await Promise.all([task1, task2, task3]);
      
      // 最初のタスクのみ成功、他はタイムアウト
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(false);
      expect(results[2]).toBe(false);
    });
  });

  describe("エラーハンドリング", () => {
    test("未取得状態での解放警告", () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      semaphore.release();
      
      expect(consoleSpy).toHaveBeenCalledWith("Semaphore test-semaphore: release() called but not acquired");
      
      consoleSpy.mockRestore();
    });

    test("強制解放機能", async () => {
      await semaphore.acquire();
      
      const waitingTask = semaphore.acquire(1000);
      
      // 強制解放実行
      semaphore.forceRelease();
      
      const result = await waitingTask;
      
      expect(result).toBe(false);
      expect(semaphore.isAcquired()).toBe(false);
      expect(semaphore.getAvailablePermits()).toBe(1);
    });
  });

  describe("同時実行防止の実証", () => {
    test("リソース保護シミュレーション", async () => {
      let sharedResource = 0;
      let concurrentAccess = false;
      
      const accessResource = async (taskId: number) => {
        const acquired = await semaphore.acquire(1000);
        if (!acquired) {
          return `Task ${taskId}: タイムアウト`;
        }
        
        try {
          if (sharedResource !== 0) {
            concurrentAccess = true;
          }
          
          sharedResource = taskId;
          await new Promise(resolve => setTimeout(resolve, 50));
          
          if (sharedResource !== taskId) {
            concurrentAccess = true;
          }
          
          sharedResource = 0;
          return `Task ${taskId}: 完了`;
        } finally {
          semaphore.release();
        }
      };
      
      // 複数タスクを同時実行
      const tasks = [1, 2, 3, 4, 5].map(i => accessResource(i));
      const results = await Promise.all(tasks);
      
      expect(concurrentAccess).toBe(false);
      expect(results.filter(r => r.includes("完了")).length).toBe(5);
    });
  });

  describe("デバッグ機能", () => {
    test("待機キュー長の監視", async () => {
      await semaphore.acquire();
      
      const task1 = semaphore.acquire(1000);
      const task2 = semaphore.acquire(1000);
      
      expect((semaphore as any).getWaitQueueLength()).toBe(2);
      
      semaphore.forceRelease();
      await Promise.all([task1, task2]);
    });
  });
});

describe("MockSemaphore", () => {
  let mockSemaphore: MockSemaphore;

  beforeEach(() => {
    mockSemaphore = new MockSemaphore();
  });

  describe("基本機能", () => {
    test("取得と解放", async () => {
      const result = await mockSemaphore.acquire();
      
      expect(result).toBe(true);
      expect(mockSemaphore.isAcquired()).toBe(true);
      expect(mockSemaphore.getAcquireCount()).toBe(1);
      
      mockSemaphore.release();
      
      expect(mockSemaphore.isAcquired()).toBe(false);
      expect(mockSemaphore.getReleaseCount()).toBe(1);
    });

    test("重複取得の失敗", async () => {
      await mockSemaphore.acquire();
      const result = await mockSemaphore.acquire();
      
      expect(result).toBe(false);
      expect(mockSemaphore.getAcquireCount()).toBe(2);
    });

    test("統計情報の追跡", async () => {
      await mockSemaphore.acquire();
      await mockSemaphore.acquire(); // 失敗
      mockSemaphore.release();
      await mockSemaphore.acquire();
      mockSemaphore.release();
      
      expect(mockSemaphore.getAcquireCount()).toBe(3);
      expect(mockSemaphore.getReleaseCount()).toBe(2);
    });

    test("リセット機能", async () => {
      await mockSemaphore.acquire();
      mockSemaphore.release();
      
      mockSemaphore.reset();
      
      expect(mockSemaphore.getAcquireCount()).toBe(0);
      expect(mockSemaphore.getReleaseCount()).toBe(0);
      expect(mockSemaphore.isAcquired()).toBe(false);
    });
  });
});
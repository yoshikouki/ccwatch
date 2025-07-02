import { Clock } from "../core/interfaces.ts";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  getCurrentMonth(): string {
    return this.now().toISOString().substring(0, 7);
  }

  getToday(): string {
    return this.now().toISOString().split('T')[0]!;
  }
}

// テスト用のモック実装
export class MockClock implements Clock {
  constructor(private fixedTime: Date) {}

  now(): Date {
    return new Date(this.fixedTime);
  }

  getCurrentMonth(): string {
    return this.now().toISOString().substring(0, 7);
  }

  getToday(): string {
    return this.now().toISOString().split('T')[0]!;
  }

  setTime(time: Date): void {
    this.fixedTime = time;
  }
}
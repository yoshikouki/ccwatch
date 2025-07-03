import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { SystemClock, MockClock } from "./clock.ts";

describe("SystemClock", () => {
  let clock: SystemClock;

  beforeEach(() => {
    clock = new SystemClock();
  });

  test("現在時刻の取得", () => {
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();

    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  test("現在時刻の連続取得", () => {
    const time1 = clock.now();
    const time2 = clock.now();

    expect(time2.getTime()).toBeGreaterThanOrEqual(time1.getTime());
  });

  test("現在月の取得", () => {
    const month = clock.getCurrentMonth();

    expect(month).toMatch(/^\d{4}-\d{2}$/);
    expect(month.length).toBe(7);
  });

  test("今日の日付取得", () => {
    const today = clock.getToday();

    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today.length).toBe(10);
  });

  test("固定時刻での月取得", () => {
    const originalDate = Date;
    const mockDate = new Date("2025-07-15T12:30:45.123Z");
    
    global.Date = vi.fn(() => mockDate) as any;
    global.Date.now = vi.fn(() => mockDate.getTime());

    const clock = new SystemClock();
    const month = clock.getCurrentMonth();
    const today = clock.getToday();

    expect(month).toBe("2025-07");
    expect(today).toBe("2025-07-15");

    global.Date = originalDate;
  });

  test("年末年始の境界値", () => {
    const originalDate = Date;
    
    // 年末のテスト
    const yearEnd = new Date("2025-12-31T23:59:59.999Z");
    global.Date = vi.fn(() => yearEnd) as any;
    global.Date.now = vi.fn(() => yearEnd.getTime());

    const clockYearEnd = new SystemClock();
    expect(clockYearEnd.getCurrentMonth()).toBe("2025-12");
    expect(clockYearEnd.getToday()).toBe("2025-12-31");

    // 年始のテスト
    const yearStart = new Date("2026-01-01T00:00:00.000Z");
    global.Date = vi.fn(() => yearStart) as any;
    global.Date.now = vi.fn(() => yearStart.getTime());

    const clockYearStart = new SystemClock();
    expect(clockYearStart.getCurrentMonth()).toBe("2026-01");
    expect(clockYearStart.getToday()).toBe("2026-01-01");

    global.Date = originalDate;
  });

  test("うるう年の2月29日", () => {
    const originalDate = Date;
    const leapDay = new Date("2024-02-29T12:00:00.000Z");
    
    global.Date = vi.fn(() => leapDay) as any;
    global.Date.now = vi.fn(() => leapDay.getTime());

    const clockLeap = new SystemClock();
    expect(clockLeap.getCurrentMonth()).toBe("2024-02");
    expect(clockLeap.getToday()).toBe("2024-02-29");

    global.Date = originalDate;
  });
});

describe("MockClock", () => {
  let clock: MockClock;
  let fixedTime: Date;

  beforeEach(() => {
    fixedTime = new Date("2025-07-15T12:30:45.000Z");
    clock = new MockClock(fixedTime);
  });

  test("固定時刻の返却", () => {
    const now1 = clock.now();
    const now2 = clock.now();
    const now3 = clock.now();

    expect(now1).toEqual(fixedTime);
    expect(now2).toEqual(fixedTime);
    expect(now3).toEqual(fixedTime);
    
    // 同じ時刻を返すが、異なるインスタンス
    expect(now1).not.toBe(now2);
    expect(now1.getTime()).toBe(now2.getTime());
  });

  test("時刻の設定と取得", () => {
    const newTime = new Date("2025-08-01T10:00:00.000Z");
    
    clock.setTime(newTime);
    const now = clock.now();
    
    expect(now).toEqual(newTime);
    expect(now.getTime()).toBe(newTime.getTime());
  });

  test("固定日付での月取得", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const month = testClock.getCurrentMonth();
    expect(month).toBe("2025-07");
  });

  test("固定日付での今日取得", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const today = testClock.getToday();
    expect(today).toBe("2025-07-15");
  });

  test("時刻変更後の月と日付", () => {
    const newTime = new Date("2025-12-31T23:59:59.000Z");
    clock.setTime(newTime);
    
    expect(clock.getCurrentMonth()).toBe("2025-12");
    expect(clock.getToday()).toBe("2025-12-31");
  });

  test("年をまたぐ時刻変更", () => {
    const testClock = new MockClock(new Date("2025-12-31T23:59:59.000Z"));
    const nextYear = new Date("2026-01-01T00:00:00.000Z");
    testClock.setTime(nextYear);
    
    expect(testClock.getCurrentMonth()).toBe("2026-01");
    expect(testClock.getToday()).toBe("2026-01-01");
  });

  test("過去の日付設定", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const pastTime = new Date("2020-03-15T09:30:00.000Z");
    testClock.setTime(pastTime);
    
    expect(testClock.getCurrentMonth()).toBe("2020-03");
    expect(testClock.getToday()).toBe("2020-03-15");
  });

  test("うるう年の日付設定", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const leapDay = new Date("2024-02-29T12:00:00.000Z");
    testClock.setTime(leapDay);
    
    expect(testClock.getCurrentMonth()).toBe("2024-02");
    expect(testClock.getToday()).toBe("2024-02-29");
  });

  test("独立性の確認（複数インスタンス）", () => {
    const time1 = new Date("2025-01-01T00:00:00.000Z");
    const time2 = new Date("2025-12-31T23:59:59.000Z");
    
    const clock1 = new MockClock(time1);
    const clock2 = new MockClock(time2);
    
    expect(clock1.now()).toEqual(time1);
    expect(clock2.now()).toEqual(time2);
    expect(clock1.getCurrentMonth()).toBe("2025-01");
    expect(clock2.getCurrentMonth()).toBe("2025-12");
  });

  test("一方の時刻変更が他に影響しない", () => {
    const time1 = new Date("2025-06-15T12:00:00.000Z");
    const time2 = new Date("2025-07-15T12:00:00.000Z");
    
    const clock1 = new MockClock(time1);
    const clock2 = new MockClock(time2);
    
    expect(clock1.getCurrentMonth()).toBe("2025-06");
    expect(clock2.getCurrentMonth()).toBe("2025-07");
    
    clock1.setTime(new Date("2025-08-01T00:00:00.000Z"));
    
    expect(clock1.getCurrentMonth()).toBe("2025-08");
    expect(clock2.getCurrentMonth()).toBe("2025-07"); // 変更されない
  });

  test("エッジケース - Unix epoch", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const epoch = new Date(0);
    testClock.setTime(epoch);
    
    expect(testClock.getCurrentMonth()).toBe("1970-01");
    expect(testClock.getToday()).toBe("1970-01-01");
  });

  test("エッジケース - 遠い未来", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const farFuture = new Date("3000-12-31T23:59:59.999Z");
    testClock.setTime(farFuture);
    
    expect(testClock.getCurrentMonth()).toBe("3000-12");
    expect(testClock.getToday()).toBe("3000-12-31");
  });

  test("エッジケース - ミリ秒精度", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const preciseTime = new Date("2025-07-15T12:30:45.123Z");
    testClock.setTime(preciseTime);
    
    const now = testClock.now();
    expect(now.getMilliseconds()).toBe(123);
    expect(testClock.getToday()).toBe("2025-07-15");
  });

  test("時刻変更の連続操作", () => {
    const testClock = new MockClock(new Date("2025-07-15T12:30:45.000Z"));
    const times = [
      new Date("2025-01-01T00:00:00.000Z"),
      new Date("2025-06-15T12:00:00.000Z"),
      new Date("2025-12-31T23:59:59.999Z")
    ];
    
    times.forEach((time, index) => {
      testClock.setTime(time);
      expect(testClock.now()).toEqual(time);
    });
    
    // 最後の時刻が保持されている
    expect(testClock.now()).toEqual(times[2]);
  });
});
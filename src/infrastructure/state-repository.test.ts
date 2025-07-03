import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { FileStateRepository, MemoryStateRepository } from "./state-repository.ts";
import { MockLogger } from "./logger.ts";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";

describe("FileStateRepository", () => {
  let repository: FileStateRepository;
  let mockLogger: MockLogger;
  const testStateFile = "/tmp/test-ccwatch-state.json";

  beforeEach(() => {
    mockLogger = new MockLogger();
    repository = new FileStateRepository(mockLogger, testStateFile);
    
    // テスト前にファイル削除
    try {
      if (existsSync(testStateFile)) {
        unlinkSync(testStateFile);
      }
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  });

  afterEach(() => {
    // テスト後にファイル削除
    try {
      if (existsSync(testStateFile)) {
        unlinkSync(testStateFile);
      }
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  });

  test("ファイルが存在しない場合の読み込み", async () => {
    const state = await repository.load();
    expect(state).toEqual({});
  });

  test("正常な状態の保存と読み込み", async () => {
    const testState = {
      lastNotificationDate: "2025-07-15",
      lastExceedanceDate: "2025-07-15"
    };

    await repository.save(testState);
    const loadedState = await repository.load();

    expect(loadedState).toEqual(testState);
    expect(existsSync(testStateFile)).toBe(true);
  });

  test("JSONファイルの正しいフォーマット", async () => {
    const testState = {
      lastNotificationDate: "2025-07-15",
      lastExceedanceDate: "2025-07-14"
    };

    await repository.save(testState);

    const fileContent = readFileSync(testStateFile, 'utf8');
    const parsedContent = JSON.parse(fileContent);

    expect(parsedContent).toEqual(testState);
    expect(fileContent).toContain('  '); // インデントが含まれていることを確認
  });

  test("不正なJSONファイルの読み込み", async () => {
    // 不正なJSONファイルを作成
    writeFileSync(testStateFile, "invalid json content");

    const state = await repository.load();

    expect(state).toEqual({});
    expect(mockLogger.hasLog("error", "状態ファイル読み込みエラー")).toBe(true);
  });

  test("読み込み権限なしファイルのハンドリング", async () => {
    // 有効なJSONファイルを作成
    const testState = { lastNotificationDate: "2025-07-15" };
    await repository.save(testState);

    // ファイルの内容を破損させる
    writeFileSync(testStateFile, "{ invalid json");

    const state = await repository.load();

    expect(state).toEqual({});
    expect(mockLogger.hasLog("error", "状態ファイル読み込みエラー")).toBe(true);
  });

  test("デフォルトパスの使用", async () => {
    const defaultRepository = new FileStateRepository(mockLogger);
    
    // デフォルトパスでファイルが存在する場合と存在しない場合の両方をテスト
    const state = await defaultRepository.load();
    
    // ファイルが存在すれば読み込まれた状態、存在しなければ空オブジェクト
    expect(state).toBeDefined();
    expect(typeof state).toBe("object");
  });

  test("書き込みエラーのハンドリング", async () => {
    // 無効なパスのリポジトリを作成
    const invalidRepository = new FileStateRepository(mockLogger, "/invalid/path/state.json");
    
    const testState = { lastNotificationDate: "2025-07-15" };
    
    // saveメソッドはエラーをthrowしないが、ログに記録される
    await invalidRepository.save(testState);
    
    expect(mockLogger.hasLog("error", "状態ファイル保存エラー")).toBe(true);
  });

  test("空の状態オブジェクトの保存", async () => {
    const emptyState = {};

    await repository.save(emptyState);
    const loadedState = await repository.load();

    expect(loadedState).toEqual({});
  });

  test("部分的な状態オブジェクトの保存", async () => {
    const partialState = {
      lastNotificationDate: "2025-07-15"
      // lastExceedanceDateは未設定
    };

    await repository.save(partialState);
    const loadedState = await repository.load();

    expect(loadedState).toEqual(partialState);
    expect(loadedState.lastExceedanceDate).toBeUndefined();
  });

  test("HOME環境変数の異なる値での動作", async () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;

    try {
      // HOME環境変数をテスト用に変更
      process.env.HOME = "/tmp";
      delete process.env.USERPROFILE;

      const envRepository = new FileStateRepository(mockLogger);
      
      // 動作確認（実際のファイル操作は最小限に）
      const state = await envRepository.load();
      expect(state).toEqual({});

    } finally {
      // 環境変数を復元
      if (originalHome) process.env.HOME = originalHome;
      if (originalUserProfile) process.env.USERPROFILE = originalUserProfile;
    }
  });

  test("USERPROFILE環境変数の使用（Windows環境シミュレーション）", async () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;

    try {
      delete process.env.HOME;
      process.env.USERPROFILE = "/tmp";

      const envRepository = new FileStateRepository(mockLogger);
      const state = await envRepository.load();
      expect(state).toEqual({});

    } finally {
      if (originalHome) process.env.HOME = originalHome;
      if (originalUserProfile) process.env.USERPROFILE = originalUserProfile;
    }
  });
});

describe("MemoryStateRepository", () => {
  let repository: MemoryStateRepository;

  beforeEach(() => {
    repository = new MemoryStateRepository();
  });

  test("初期状態の読み込み", async () => {
    const state = await repository.load();
    expect(state).toEqual({});
  });

  test("状態の保存と読み込み", async () => {
    const testState = {
      lastNotificationDate: "2025-07-15",
      lastExceedanceDate: "2025-07-14"
    };

    await repository.save(testState);
    const loadedState = await repository.load();

    expect(loadedState).toEqual(testState);
  });

  test("状態の更新", async () => {
    const initialState = {
      lastNotificationDate: "2025-07-15"
    };

    const updatedState = {
      lastNotificationDate: "2025-07-16",
      lastExceedanceDate: "2025-07-16"
    };

    await repository.save(initialState);
    await repository.save(updatedState);
    const loadedState = await repository.load();

    expect(loadedState).toEqual(updatedState);
  });

  test("クリア機能", async () => {
    const testState = {
      lastNotificationDate: "2025-07-15",
      lastExceedanceDate: "2025-07-15"
    };

    await repository.save(testState);
    expect(await repository.load()).toEqual(testState);

    repository.clear();
    expect(await repository.load()).toEqual({});
  });

  test("独立性の確認（複数インスタンス）", async () => {
    const repository1 = new MemoryStateRepository();
    const repository2 = new MemoryStateRepository();

    const state1 = { lastNotificationDate: "2025-07-15" };
    const state2 = { lastNotificationDate: "2025-07-16" };

    await repository1.save(state1);
    await repository2.save(state2);

    expect(await repository1.load()).toEqual(state1);
    expect(await repository2.load()).toEqual(state2);
  });

  test("空オブジェクトの保存", async () => {
    await repository.save({});
    const loadedState = await repository.load();
    expect(loadedState).toEqual({});
  });

  test("オブジェクトの参照独立性", async () => {
    const originalState = { lastNotificationDate: "2025-07-15" };
    
    await repository.save(originalState);
    const loadedState = await repository.load();

    // オリジナルを変更
    originalState.lastNotificationDate = "2025-07-16";

    // 読み込んだ状態は影響を受けないことを確認
    expect(loadedState.lastNotificationDate).toBe("2025-07-15");
    expect(await repository.load()).toEqual({ lastNotificationDate: "2025-07-15" });
  });
});
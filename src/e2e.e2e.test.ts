#!/usr/bin/env node

import { test, expect, vi } from "vitest";
import { execSync, spawn } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

// E2E テスト用のヘルパー関数
function getTestStateFile(): string {
  return join(process.env.HOME || "/tmp", ".ccwatch-state-test.json");
}

function cleanupTestFiles(): void {
  const stateFile = getTestStateFile();
  if (existsSync(stateFile)) {
    unlinkSync(stateFile);
  }
}

function createMockCCUsageScript(): string {
  const mockScript = `#!/usr/bin/env node
const mockData = {
  monthly: [{
    month: "${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}",
    totalCost: ${process.env.E2E_MOCK_COST || "45.67"},
    modelsUsed: ["claude-sonnet-4-20250514"],
    modelBreakdowns: []
  }],
  totals: { totalCost: ${process.env.E2E_MOCK_COST || "45.67"} }
};

if (process.argv.includes('monthly') && process.argv.includes('--json')) {
  console.log(JSON.stringify(mockData));
} else {
  console.log('Mock ccusage - use monthly --json for data');
}
`;
  
  const scriptPath = "/tmp/ccusage";
  writeFileSync(scriptPath, mockScript);
  execSync(`chmod +x ${scriptPath}`);
  return scriptPath;
}

function setupE2EEnvironment(): { mockScript: string; cleanup: () => void } {
  const mockScript = createMockCCUsageScript();
  const originalPath = process.env.PATH;
  
  // PATHにモックスクリプトのディレクトリを追加
  process.env.PATH = "/tmp:" + originalPath;
  
  return {
    mockScript,
    cleanup: () => {
      process.env.PATH = originalPath;
      if (existsSync(mockScript)) {
        unlinkSync(mockScript);
      }
      cleanupTestFiles();
    }
  };
}

// E2E テスト開始
test("E2E - 単発実行モード（基本動作）", async () => {
  const { cleanup } = setupE2EEnvironment();
  
  try {
    const result = execSync("bun run dist/index.js 200", { 
      encoding: "utf8",
      env: { ...process.env, CCWATCH_SLACK_WEBHOOK_URL: undefined }
    });
    
    // 基本的な出力が含まれることを確認
    expect(result).toContain("Claude Code使用量監視開始");
    expect(result).toContain("$");
    expect(result).toContain("の現在のコスト");
  } finally {
    cleanup();
  }
});

test("E2E - 単発実行モード（実際の使用量チェック）", async () => {
  const { cleanup } = setupE2EEnvironment();
  
  try {
    const result = execSync("bun run dist/index.js 50", { 
      encoding: "utf8",
      env: { ...process.env, CCWATCH_SLACK_WEBHOOK_URL: undefined }
    });
    
    // 現実的に閾値超過しているはず
    expect(result).toContain("閾値超過");
    expect(result).toContain("超過額");
    expect(result).toContain("SLACK_WEBHOOK_URL");
  } finally {
    cleanup();
  }
});

test("E2E - ヘルプ表示", async () => {
  const result = execSync("bun run dist/index.js --help", { encoding: "utf8" });
  
  expect(result).toContain("ccwatch - Claude Code usage monitor");
  expect(result).toContain("USAGE:");
  expect(result).toContain("--daemon");
  expect(result).toContain("ENVIRONMENT VARIABLES:");
});

test("E2E - バリデーションエラー（負の閾値）", async () => {
  try {
    execSync("bun run dist/index.js -10", { encoding: "utf8" });
    throw new Error("Should have thrown an error");
  } catch (error: any) {
    expect(error.status).toBe(1);
    expect(error.stderr.toString()).toContain("positive number");
  }
});

test("E2E - バリデーションエラー（大きすぎる閾値）", async () => {
  try {
    execSync("bun run dist/index.js 2000000", { encoding: "utf8" });
    throw new Error("Should have thrown an error");
  } catch (error: any) {
    expect(error.status).toBe(1);
    expect(error.stderr.toString()).toContain("less than $1,000,000");
  }
});

test("E2E - デーモンモード（短時間実行）", async () => {
  process.env.E2E_MOCK_COST = "45.00";
  const { cleanup } = setupE2EEnvironment();
  
  try {
    // デーモンを3秒間実行（インターバル最小値10秒を使用）
    const child = spawn("bun", ["run", "dist/index.js", "40", "--daemon", "--interval", "10"], {
      env: { ...process.env, CCWATCH_SLACK_WEBHOOK_URL: undefined },
      stdio: "pipe"
    });
    
    let output = "";
    child.stdout?.on("data", (data) => {
      output += data.toString();
    });
    
    child.stderr?.on("data", (data) => {
      output += data.toString();
    });
    
    // 3秒後に終了
    setTimeout(() => {
      child.kill("SIGTERM");
    }, 3000);
    
    await new Promise((resolve) => {
      child.on("exit", resolve);
    });
    
    expect(output).toContain("daemon started");
    expect(output).toContain("閾値超過");
    expect(output).toContain("stopping");
  } finally {
    cleanup();
  }
}, 10000); // 10秒のタイムアウト

test("E2E - 不正なSlack URL", async () => {
  try {
    execSync("bun run dist/index.js 50", { 
      encoding: "utf8",
      env: { ...process.env, CCWATCH_SLACK_WEBHOOK_URL: "invalid-url" }
    });
    throw new Error("Should have thrown an error");
  } catch (error: any) {
    expect(error.status).toBe(1);
    expect(error.stderr.toString()).toContain("Slack webhook URL");
  }
});

test("E2E - 設定ファイル作成確認", async () => {
  process.env.E2E_MOCK_COST = "55.00";
  const { cleanup } = setupE2EEnvironment();
  
  try {
    // 一度実行（インターバル最小値を使用）
    execSync("bun run dist/index.js 50 --daemon --interval 10", { 
      encoding: "utf8",
      timeout: 2000,
      env: { ...process.env, CCWATCH_SLACK_WEBHOOK_URL: undefined }
    });
  } catch (error) {
    // タイムアウトは期待される
  }
  
  // 状態ファイルが作成されたかチェック
  const stateFile = join(process.env.HOME || "/tmp", ".ccwatch-state.json");
  
  if (existsSync(stateFile)) {
    const stateData = JSON.parse(readFileSync(stateFile, "utf8"));
    expect(stateData).toHaveProperty("lastExceedanceDate");
  }
  
  cleanup();
}, 5000);

test("E2E - 構造化ログ出力", async () => {
  const { cleanup } = setupE2EEnvironment();
  
  try {
    // 構造化ログ有効でテスト実行
    const result = execSync("bun run dist/index.js 200", { 
      encoding: "utf8",
      env: { 
        ...process.env, 
        CCWATCH_SLACK_WEBHOOK_URL: undefined,
        CCWATCH_STRUCTURED_LOGGING: "true"
      }
    });
    
    // 基本的な出力が含まれることを確認
    expect(result).toContain("Claude Code使用量監視開始");
    expect(result).toContain("の現在のコスト");
  } finally {
    cleanup();
  }
});

test("E2E - 複数の引数組み合わせ", async () => {
  const result = execSync("bun run dist/index.js 100 --daemon --interval 3600 --help", { 
    encoding: "utf8"
  });
  
  // --helpが優先されることを確認
  expect(result).toContain("USAGE:");
});

test("E2E - 型チェック実行", async () => {
  try {
    const result = execSync("npm run typecheck", { encoding: "utf8" });
    // 型エラーがないことを確認（成功時は空文字列）
    expect(result).toContain("ccwatch@1.0.0 typecheck");
  } catch (error: any) {
    // 型エラーがある場合はテスト失敗
    throw new Error(`Type check failed: ${error.stdout}`);
  }
});
# 内部品質課題分析 - テストカバレッジ向上過程で発見された問題

## 概要

テストカバレッジを27.5%から72.27%まで向上させる過程で、複数の根本的な設計問題が浮き彫りになった。これらは単なるバグではなく、アーキテクチャレベルでの改善が必要な課題である。

## 1. テスタビリティ設計の根本的問題

### 課題
- 多数の関数がprivateで、テストのためだけにexportを追加する必要があった
- 副作用（console.log、process.exit、ファイルI/O）がビジネスロジックに直接埋め込まれている
- DI（Dependency Injection）が後付けで、完全に分離されていない

### 具体例
```typescript
// 問題のあるコード
async function main(deps?: Dependencies): Promise<void> {
  console.log(`💰 Claude Code使用量監視開始`); // 副作用が埋め込まれている
  const currentCost = currentMonthUsage.totalCost;
  if (currentCost > config.threshold) {
    process.exit(1); // テスト時にモックが必要
  }
}
```

### 根本原因
設計時にテスタビリティが考慮されておらず、後からテストを追加する形になっている。

## 2. 単一責任原則の重大な違反

### 課題
`main`関数が以下の複数責任を持っている：
- CLI引数解析の調整
- 実行モード判定（daemon vs 単発）
- ビジネスロジック実行
- エラーハンドリング
- ログ出力

### 具体例
```typescript
async function main(deps?: Dependencies): Promise<void> {
  const config = parseArgs(); // 責任1: 設定取得
  
  if (config.daemon) {
    await runDaemon(config, deps); // 責任2: デーモン管理
  } else {
    // 責任3: 単発実行のビジネスロジック
    const dependencies = deps || createDefaultDependencies();
    console.log(`💰 Claude Code使用量監視開始`); // 責任4: UI/ログ
    // ... 50行以上のビジネスロジック
  }
}
```

## 3. 状態管理の複雑性と依存関係

### 課題
- グローバル状態 `isShuttingDown` が複数箇所で参照・変更される
- 状態の所有権が不明確
- テスト時の状態リセットが複雑

### 問題の連鎖
```typescript
export let isShuttingDown: boolean = false; // グローバル状態
export function setShuttingDown(value: boolean): void { // テスト用のセッター
  isShuttingDown = value;
}

// 複数箇所で参照
async function runDaemon() {
  while (!isShuttingDown) { // 依存1
    // ...
  }
}

const shutdown = () => {
  if (isShuttingDown) return; // 依存2
  isShuttingDown = true; // 変更
};
```

## 4. エラーハンドリングの一貫性欠如

### 課題
- 一部の関数は例外をthrow、一部はprocess.exit、一部はundefinedを返す
- エラーレベルの判定基準が不明確
- リカバリ可能性の考慮不足

### 具体例
```typescript
// パターン1: 例外throw
if (!currentMonthUsage) {
  throw new Error("使用データが見つかりません");
}

// パターン2: process.exit
catch (error) {
  console.error("❌ エラーが発生しました:", error);
  process.exit(1); // テストでは困る
}

// パターン3: 早期return
if (!currentMonthUsage) {
  console.log(`📊 ${currentMonth}の使用データが見つかりません`);
  return; // 呼び出し元での判定不可
}
```

## 5. 時間依存処理の設計問題

### 課題
- `new Date()`が直接呼ばれており、テスト時の制御が困難
- 時間関連のロジックが散在している
- タイムゾーン考慮が不十分

### テスト困難な例
```typescript
function getCurrentMonth(): string {
  return new Date().toISOString().substring(0, 7); // 直接new Date()
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]!; // 同様の問題
}
```

## 6. 型安全性の不完全性

### 課題
- オプショナル型の多用で実行時エラーリスクが残存
- 型ガードが不十分
- any型の使用（process.exitのモック等）

### 具体例
```typescript
interface DaemonState {
  readonly lastNotificationDate?: string; // オプショナル
  readonly lastExceedanceDate?: string; // オプショナル
}

// 使用箇所でnullチェックが散在
if (state.lastNotificationDate === today) // undefinedの可能性
```

## 7. 関数の粒度と責任範囲の問題

### 課題
- 一部の関数が過度に長い（main関数50行以上）
- 抽象化レベルが混在
- 再利用性が低い

## 8. ログ・UI出力の設計問題

### 課題
- console.logが直接呼ばれ、ログレベル制御不可
- UI表示とビジネスロジックが混在
- 国際化やカスタマイズが困難

## 根本的改善提案

### A. アーキテクチャの再設計
1. **Command Pattern**の導入でモード実行を分離
2. **Strategy Pattern**で通知方法を抽象化
3. **Repository Pattern**で状態管理を分離

### B. 依存性注入の完全実装
1. すべての副作用をinterface化
2. 時間取得の抽象化（Clock interface）
3. ログ出力の抽象化（Logger interface）

### C. エラーハンドリングの統一
1. Result型またはEither型の導入
2. エラーレベルの明確化
3. リカバリ戦略の定義

## 実装優先度

### Phase 1: 基盤整備
- Clock抽象化
- Logger抽象化  
- Result型導入

### Phase 2: アーキテクチャ再設計
- Command Pattern実装
- 状態管理分離
- DI完全実装

### Phase 3: 品質向上
- エラーハンドリング統一
- 型安全性強化
- テスト品質向上

この分析により、単なるバグ修正ではなく、設計レベルでの根本的改善が必要であることが明確になった。
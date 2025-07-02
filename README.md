# ccmonitor

Claude Code使用量を監視し、月額の閾値を超過した際にSlack通知を送信するCLIツールです。

## 特徴

- 📊 Claude Codeの月次使用量を監視
- 💰 設定された閾値との比較
- 🚨 超過時のSlack通知
- 🔍 詳細な使用量レポート
- ⚡ 高速動作（Bun powered）

## インストール

```bash
# npmを使用
npm install -g ccmonitor

# bunを使用  
bun install -g ccmonitor

# npxで直接実行（推奨）
npx ccmonitor@latest 33
```

## 使用方法

### 基本的な使用法

```bash
# $33を閾値として一度だけチェック
ccmonitor 33

# $100を閾値として一度だけチェック
ccmonitor 100
```

### デーモンモード（常時監視）

```bash
# $33を閾値として常時監視（1時間間隔）
ccmonitor 33 --daemon

# $50を閾値として30分間隔で監視
ccmonitor 50 --daemon --interval 1800

# バックグラウンドで実行
nohup ccmonitor 33 --daemon > ccmonitor.log 2>&1 &
```

### Slack通知の設定

Slack通知を有効にするには、Slack Webhook URLを環境変数で設定してください：

```bash
export CCMONITOR_SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
ccmonitor 33
```

### 実行例

**単発実行:**
```bash
$ ccmonitor 33
💰 Claude Code使用量監視開始 (閾値: $33)
📊 2025-07の現在のコスト: $40.23
🚨 閾値超過！ 超過額: $7.23
✅ Slack通知を送信しました
```

閾値内の場合：
```bash
$ ccmonitor 50
💰 Claude Code使用量監視開始 (閾値: $50)
📊 2025-07の現在のコスト: $40.23
✅ 現在は閾値内です (残り: $9.77)
```

**デーモンモード:**
```bash
$ ccmonitor 33 --daemon --interval 10
[2025-07-01T15:33:07.881Z] 🤖 ccmonitor daemon started (閾値: $33, 間隔: 10秒)
[2025-07-01T15:33:08.678Z] 📊 2025-07の現在のコスト: $40.72 (閾値: $33)
[2025-07-01T15:33:08.678Z] 🚨 閾値超過！ 超過額: $7.72
[2025-07-01T15:33:08.678Z] ✅ Slack通知を送信しました
[2025-07-01T15:33:19.502Z] 📊 2025-07の現在のコスト: $40.72 (閾値: $33)
[2025-07-01T15:33:19.502Z] 🚨 閾値超過！ 超過額: $7.72
[2025-07-01T15:33:19.502Z] 📤 本日は既に通知済みのため、Slack通知をスキップします
# Ctrl+C で停止
[2025-07-01T15:33:25.123Z] 🛑 ccmonitor daemon stopping...
```

## Slack通知メッセージ例

```
🚨 Claude Code使用量が閾値を超過しました！
📅 対象月: 2025-07
💰 現在のコスト: $40.23
🎯 設定閾値: $33.00
📈 超過額: $7.23
📊 閾値に対する割合: 121.9%

使用モデル: claude-sonnet-4-20250514
```

## 開発

### 要件

- Bun v1.0以上
- ccusage（自動インストールされます）

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/yoshikouki/ccmonitor.git
cd ccmonitor

# 依存関係をインストール
bun install

# 開発モードで実行
bun dev 33

# テスト実行
bun test

# ビルド
bun run build
```

### 環境変数

| 変数名 | 説明 | 必須 |
|---------|------|------|
| `CCMONITOR_SLACK_WEBHOOK_URL` | Slack Webhook URL | Slack通知を使用する場合のみ |

## 機能詳細

### デーモンモードの特徴

- **定期監視**: 設定されたインターバルで自動チェック（デフォルト: 1時間）
- **重複通知防止**: 同じ日に複数回通知されることを防ぐ
- **状態保持**: `~/.ccmonitor-state.json`に状態を保存
- **Graceful shutdown**: Ctrl+C（SIGINT）での正常終了
- **タイムスタンプ付きログ**: すべての操作にタイムスタンプを記録

### 通知ルール

- 閾値を初回超過時: 即座に通知
- 同日内の再チェック: 通知をスキップ（ログのみ）
- 翌日以降の継続超過: 再度通知

## 仕組み

1. **ccusage**ライブラリを使用してClaude Codeの使用量データを取得
2. 現在の月の使用量と設定された閾値を比較
3. 閾値超過時にSlack Webhook経由で通知送信
4. 詳細な使用量レポートを表示
5. デーモンモードでは状態を保存して重複通知を防止

## 依存関係

- [ccusage](https://github.com/ryoppippi/ccusage): Claude Code使用量分析
- [Bun](https://bun.sh/): 高速なJavaScript runtime

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します！

## 関連プロジェクト

- [ccusage](https://github.com/ryoppippi/ccusage) - Claude Code使用量分析ツール
- [Claude Code](https://claude.ai/code) - AnthropicのCLIツール

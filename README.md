# Visual Regression Testing (VRT) Application

## 概要

このアプリケーションは、Web ページの視覚的な変更を検出・比較するための VRT (Visual Regression Testing) ツールです。Playwright を使用して Web ページのスクリーンショットを撮影し、2つの画像を比較して視覚的な差分を検出します。

## 主な機能

### スクリーンショット機能
- 指定した URL の Web ページのスクリーンショット撮影
- ページ読み込み後の待機時間設定が可能
- Playwright による高品質なフルページスクリーンショット

### 画像比較機能
- 3種類の比較モード
  - 差分表示: 変更箇所をハイライト表示
  - 横並び比較: 2つの画像を横に並べて比較
  - スライダー比較: スライダーで切り替えながら比較
- 差分検出感度のカスタマイズ
- 差分の強調表示色の変更
- 差分率の表示

### 自動クリーンアップ機能
- 古いスクリーンショットの自動削除
- 不要な差分画像の削除
- ディスク容量の効率的な管理

## 技術スタック

### フロントエンド
- React.js 18.2
- Tailwind CSS 3.2
- Axios for HTTP通信

### バックエンド
- Node.js + Express
- Playwright (スクリーンショット撮影)
- pixelmatch (画像差分検出)
- node-canvas (画像処理)

## インストール方法

1. リポジトリのクローン
```bash
git clone <repository-url>
cd vrt-app-claude
```

2. 依存関係のインストール
```bash
# サーバーの依存関係
cd server
npm install
npx playwright install chromium

# クライアントの依存関係
cd ../client
npm install
```

3. ディレクトリ構造の確認
サーバーディレクトリに以下のフォルダが存在することを確認:
- `screenshots/`: スクリーンショット保存用
- `diffs/`: 差分画像保存用
- `uploads/`: 静的ファイル提供用

## アプリケーションの起動

### 方法1: 起動スクリプトを使用（推奨）

```bash
./start-vrt-app.sh
```

このスクリプトは以下の処理を実行します:
- 既存のプロセスのクリーンアップ
- サーバーの起動（ポート 5002）
- クライアントの起動（ポート 3000）
- 終了時の適切なプロセスのクリーンアップ

### 方法2: 手動での起動

1. サーバーの起動
```bash
cd server
npm start
```

2. 別のターミナルでクライアントを起動
```bash
cd client
npm start
```

## 使用方法

1. ブラウザで http://localhost:3000 にアクセス

2. テスト設定
   - テストする URL を入力
   - スクリーンショット前の待機時間を設定
   - 差分検出のしきい値を調整（0.0 ～ 1.0）

3. スクリーンショットの取得
   - 「1回目スクリーンショット取得」をクリック
   - 必要に応じて URL を変更
   - 「2回目スクリーンショット取得」をクリック

4. 比較結果の確認
   - 差分表示モード: 変更箇所をハイライト
   - 横並び比較モード: 2つの画像を横に表示
   - スライダー比較モード: スライダーで切り替えながら比較

## API エンドポイント

### POST /api/screenshot
スクリーンショットを撮影します。

リクエスト:
```json
{
  "url": "https://example.com",
  "delay": 2
}
```

### POST /api/diff
2つの画像の差分を検出します。

リクエスト:
```json
{
  "img1": "image1.png",
  "img2": "image2.png",
  "threshold": 0.1
}
```

### POST /api/cleanup
不要な画像ファイルを削除します。

レスポンス:
```json
{
  "success": true,
  "message": "クリーンアップが完了しました",
  "deleted": {
    "screenshots": 10,
    "diffs": 5,
    "uploads": 15
  }
}
```

## トラブルシューティング

### スクリーンショットの取得に失敗する場合
1. URL が正しいことを確認
2. ページの読み込み完了まで十分な待機時間を設定
3. Playwright のブラウザが正しくインストールされているか確認
   ```bash
   cd server
   npx playwright install chromium
   ```

### 差分検出が正しく機能しない場合
1. 差分検出のしきい値を調整（小さくすると敏感に、大きくすると寛容に）
2. スクリーンショット前の待機時間を長くして、動的コンテンツの読み込みを待つ
3. ブラウザのウィンドウサイズやデバイスの設定を確認

### ポート競合が発生する場合
1. 使用中のポートを確認
   ```bash
   lsof -i :5002
   lsof -i :3000
   ```
2. 競合するプロセスを終了
3. 必要に応じてポート番号を変更（server/index.js と client/package.json の proxy 設定）

### メモリ使用量が多い場合
1. 不要な画像ファイルを定期的にクリーンアップ
2. スクリーンショットを撮影する前に /api/cleanup を実行
3. 大きなページのスクリーンショット時はメモリ使用量に注意

## 開発者向け情報

### ディレクトリ構造

```
.
├── client/                 # フロントエンド (React)
│   ├── src/
│   │   ├── App.js         # メインアプリケーション
│   │   ├── index.js       # エントリーポイント
│   │   └── *.css          # スタイル
│   ├── public/            # 静的ファイル
│   └── package.json       # 依存関係
├── server/                # バックエンド (Node.js)
│   ├── index.js          # サーバーエントリーポイント
│   ├── screenshot.js     # スクリーンショット機能
│   ├── diff.js           # 差分検出機能
│   ├── screenshots/      # スクリーンショット保存
│   ├── diffs/           # 差分画像保存
│   ├── uploads/         # 公開用ファイル
│   └── package.json     # 依存関係
└── start-vrt-app.sh     # 起動スクリプト
```

### Git 管理

以下のファイルは Git で管理されません:
- `node_modules/`
- `build/`
- `screenshots/*.png`
- `diffs/*.png`
- `uploads/*.png`

### 環境変数

- `PORT`: サーバーのポート番号（デフォルト: 5002）
- `NODE_ENV`: 環境設定（development/production）

## アップデート履歴

### 2025-08-11
- **Node.js v22.15.0対応**: canvasモジュールの互換性問題を修正
- **React Dev Server設定改善**: allowedHostsエラーを解決
- **Electronビルド設定改善**: 
  - Playwrightブラウザの自動バンドル機能を追加
  - 他のMac環境での実行時エラーを修正
  - afterPackスクリプトでブラウザの自動インストール
- **自動ブラウザ管理**: アプリ起動時にPlaywrightブラウザの存在確認と自動インストール機能を追加

## ライセンス

MIT License

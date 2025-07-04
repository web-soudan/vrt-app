# VRTテストアプリケーション プロジェクト概要

このプロジェクトは、Playwrightを使用してウェブサイトの視覚的回帰テスト(VRT)を行うためのアプリケーションです。以下の機能を提供しています。

## 主な機能

1. **スクリーンショット取得**
   - 指定したURLのウェブサイトのスクリーンショットを取得
   - 待機時間の設定が可能
   - Playwrightを使用した高品質なスクリーンショット

2. **差分検出**
   - 2つのスクリーンショットの差分を視覚的に検出
   - しきい値による検出感度の調整
   - pixelmatchライブラリによる精密な差分検出

3. **比較表示機能**
   - 差分表示: 変更部分をハイライト表示
   - 横並び比較: 2つのスクリーンショットを横に並べて比較
   - スライダー比較: スライダーで切り替えながら比較

## 技術スタック

- **フロントエンド**
  - React: UIフレームワーク
  - Tailwind CSS: スタイリング
  - Axios: HTTP通信

- **バックエンド**
  - Node.js: サーバーサイドJavaScript
  - Express: Webフレームワーク
  - Playwright: ブラウザ自動化とスクリーンショット撮影
  - pixelmatch: 画像差分検出
  - canvas: 画像処理

## アーキテクチャ

このアプリケーションはクライアント・サーバーアーキテクチャを採用しています。

- **クライアント側**では、ユーザーインターフェースを提供し、サーバーAPIと通信します。
- **サーバー側**では、PlaywrightとNodeJSを使用してスクリーンショットの取得と差分検出を行います。

## 使用方法

1. URLを指定してスクリーンショットを取得
2. 同じURLまたは別のURLで2つ目のスクリーンショットを取得
3. 差分を確認し、表示モードを切り替えて詳細を調査

## 拡張性

このプロジェクトは以下のように拡張できます：

- CI/CDパイプラインとの統合
- 複数URL一括テスト機能
- 定期的な自動テスト
- テスト結果の保存と履歴管理
- 認証が必要なサイトへの対応

## インストールと実行方法

詳細な手順は同梱の「INSTRUCTIONS.md」を参照してください。基本的な流れは以下の通りです：

1. 依存関係のインストール（クライアント・サーバー両方）
2. Playwrightブラウザのインストール
3. サーバーとクライアントの起動

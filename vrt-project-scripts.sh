#!/bin/bash

# VRTテストアプリケーション セットアップスクリプト

echo "VRTテストアプリケーションのセットアップを開始します..."

# 必要なディレクトリを作成
mkdir -p server/screenshots server/diffs server/uploads

# クライアント側の依存関係をインストール
echo "クライアント側の依存関係をインストールしています..."
cd client
npm install
cd ..

# サーバー側の依存関係をインストール
echo "サーバー側の依存関係をインストールしています..."
cd server
npm install

# Playwrightブラウザをインストール
echo "Playwrightのブラウザをインストールしています..."
npx playwright install chromium

echo "セットアップが完了しました！"
echo "サーバーを起動するには: cd server && npm start"
echo "クライアントを起動するには（別のターミナルで）: cd client && npm start"
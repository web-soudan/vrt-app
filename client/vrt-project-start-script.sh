#!/bin/bash

# VRTテストアプリケーション起動スクリプト

# サーバー起動（バックグラウンド）
echo "サーバーを起動しています..."
cd server
npm start &
SERVER_PID=$!
cd ..

# 少し待機してからクライアント起動
echo "5秒待機しています..."
sleep 5

# クライアント起動
echo "クライアントを起動しています..."
cd client
npm start

# Ctrl+C でプロセスを終了させる際の処理
trap "kill $SERVER_PID; exit" INT
wait
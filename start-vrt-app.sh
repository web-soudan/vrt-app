#!/bin/bash

# VRTアプリケーション起動スクリプト
echo "VRTアプリケーションを起動します..."

# 既存のサーバープロセスをチェックして終了
if [ -f /tmp/vrt-server.pid ]; then
  OLD_PID=$(cat /tmp/vrt-server.pid)
  if ps -p $OLD_PID > /dev/null; then
    echo "既存のサーバープロセス($OLD_PID)を終了しています..."
    kill $OLD_PID 2>/dev/null
    sleep 2
  fi
  rm /tmp/vrt-server.pid
fi

# 絶対パスを使用
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

# サーバーを起動（バックグラウンドで）
echo "サーバーを起動しています（ポート5002）..."
cd "$SERVER_DIR"
npm start &
SERVER_PID=$!

# プロセスIDを保存
echo $SERVER_PID > /tmp/vrt-server.pid
echo "サーバーのプロセスID: $SERVER_PID"

# サーバーが起動するまで少し待つ
echo "サーバーの起動を待機しています（5秒）..."
sleep 5

# クライアントを起動
echo "クライアントを起動しています（ポート3000）..."
cd "$CLIENT_DIR"
npm start

# このスクリプトが終了した時にサーバーも停止するようにする
cleanup() {
  echo "アプリケーションを終了しています..."
  if [ -f /tmp/vrt-server.pid ]; then
    SERVER_PID=$(cat /tmp/vrt-server.pid)
    if ps -p $SERVER_PID > /dev/null; then
      kill $SERVER_PID 2>/dev/null
    fi
    rm /tmp/vrt-server.pid
  fi
  exit 0
}

# Ctrl+C で終了した時にcleanup関数を呼び出す
trap cleanup INT TERM
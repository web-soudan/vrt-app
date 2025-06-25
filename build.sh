#!/bin/bash

# VRT Electron App Build Script
# Usage: ./build.sh [platform] [--dist]
# Platform options: mac, win, linux, all, current (default)
# --dist: Create distribution packages (DMG/ZIP for Mac)

set -e

echo "🎯 VRT Electron Build Script"
echo "=============================="

# デフォルトプラットフォーム
PLATFORM=${1:-current}
DIST_FLAG=""

# --distオプションの確認
if [[ "$*" == *"--dist"* ]]; then
    DIST_FLAG="--dist"
    echo "Building with distribution packages enabled"
fi

echo "Building for platform: $PLATFORM"

# Node.js とnpmの確認
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# ビルドスクリプトの実行
echo "🚀 Starting build process..."
node build-electron.js $PLATFORM $DIST_FLAG

echo ""
echo "🎉 Build completed successfully!"
echo "📁 Built files are available in the 'dist' directory"
echo ""

# ファイルサイズと場所の表示
if [ -d "dist" ]; then
    echo "📊 Build artifacts:"
    ls -lah "dist/"
fi
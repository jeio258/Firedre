#!/bin/bash
# 本地开发服务一键管理：清理残留 + 构建 + 启动
# 用法: bash scripts/dev.sh [port]（默认 8788）
PORT="${1:-8788}"
cd "$(dirname "$0")/.." || exit 1
echo "[dev] 清理残留服务..."
pkill -9 -f "wrangler" 2>/dev/null
pkill -9 -x workerd 2>/dev/null
sleep 2
echo "[dev] 构建..."
pnpm build || exit 1
echo "[dev] 启动 http://localhost:$PORT"
exec npx wrangler pages dev dist --port "$PORT"

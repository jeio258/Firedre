#!/bin/bash
# 安装 git 钩子到当前仓库（clone 后执行一次：bash scripts/hooks/install.sh）
cd "$(dirname "$0")/../.." || exit 1
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "[hooks] pre-commit 已安装（biome 检查（ts/js/svelte/astro））"

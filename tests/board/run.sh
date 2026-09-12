#!/usr/bin/env bash
# 看板頁面在真的 Chrome 裡跑一遍:點選、拖曳、縮排、走線。要用哪個 Chrome 可以用 CHROME_PATH 指定。
set -e
cd "$(dirname "$0")"
node run.mjs "$@"

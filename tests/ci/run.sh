#!/usr/bin/env bash
# ci/contract.mjs 的回歸:--lint-only 對兩個 plugin 的夾具各跑一次
set -e
cd "$(dirname "$0")"
node run.mjs "$@"

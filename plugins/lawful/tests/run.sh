#!/usr/bin/env bash
# golden 回歸 + --help。行為刻意改了才 --update。
set -e
cd "$(dirname "$0")"
node run.mjs "$@"

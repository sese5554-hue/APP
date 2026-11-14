#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo "iOS app installation requires macOS and Xcode."
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 22.12 or newer first."
  exit 1
fi
if [ ! -d node_modules ]; then npm ci; fi
npm run mobile:open:ios

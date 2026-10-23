#!/bin/bash
# Builds the Chrome Web Store upload zip: manifest + code + icons only.
set -e
cd "$(dirname "$0")/.."
V=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="store/video-scrubber-$V-webstore.zip"
rm -f "$OUT"
zip -q -X "$OUT" manifest.json content.js icons/icon16.png icons/icon48.png icons/icon128.png
unzip -l "$OUT"

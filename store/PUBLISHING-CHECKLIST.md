# Web Store publishing checklist

Everything the dashboard asks for is in this folder.

| Dashboard field | File |
|---|---|
| Upload package | `video-scrubber-<version>-webstore.zip` (rebuild with `./build-zip.sh`) |
| Store icon 128x128 | `../icons/icon128.png` |
| Screenshots 1280x800 | `screenshots/1-*.png`, `2-*.png`, `3-*.png` |
| Small promo tile 440x280 | `screenshots/promo-tile-440x280.png` |
| Summary, description, single purpose, permission justifications | `LISTING.md` |
| Privacy policy URL | `https://andoarmy.github.io/video-scrubber/privacy.html` (source: `../docs/privacy.html`) |

Regenerate screenshots: `cd src && (node serve.mjs &) && node shoot.mjs; pkill -f "node serve.mjs"`

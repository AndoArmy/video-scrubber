# Sheets Video Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a TikTok or Instagram link cell in Google Sheets opens a popup under the cell that plays the video with the Reels Scrubber controls on it.

**Architecture:** A new content script on `docs.google.com/spreadsheets` reads the clicked cell's URL from the formula bar, converts it to an embed URL, and shows an extension-owned iframe (`popup.html`) anchored under the cell. `popup.html` frames the TikTok/Instagram embed page; the existing scrubber content script runs inside that embed frame (`all_frames`) and drives its `<video>`. Extension-owned wrapper is used so Google's page CSP cannot block the embed iframe.

**Tech Stack:** Chrome Manifest V3, plain JS content scripts (no bundler), `node:test` for pure functions, manual verification in Chrome for everything touching Sheets/TikTok/Instagram.

**Spec:** `docs/superpowers/specs/2026-10-26-sheets-video-preview-design.md`

## Global Constraints

- Extension stays one extension: "Reels Scrubber", Manifest V3, `storage` permission only (add host matches, no new permissions unless a task proves it is needed).
- No bundler: scripts are classic scripts listed in the manifest; shared pure code exposes a global and also `module.exports` for node tests.
- Popup opens only on a click of a cell holding a supported link. Never on hover or keyboard cell movement.
- Scrubber keys (`A`, `D`, `1`-`9`, `0`, `S`, `K`, `M`, `H`) work only after the user clicks on the video in the popup; otherwise all keystrokes go to Sheets. Arrow keys are left to Sheets.
- `A` = seek back 5 seconds, `D` = seek forward 5 seconds, only inside the Sheets popup. Instagram and TikTok tabs keep today's keys, unchanged.
- No Google sign-in, no Sheets API, no network calls other than loading the one video's embed page.
- Speed and volume use the existing `chrome.storage.local` keys (`speed`, `soundPref`, `volumePref`); changes made in the popup write back to them.
- Work on branch `feat/sheets-preview` in `C:\video-scrubber`; do not push to `main`.
- Embed failure shows "can't preview, open link" in the popup, never a blank box. `Esc` closes the popup. Popup flips above the cell when there is no room below.

## Review Focus

- A clicked cell whose text is not a URL (a label, empty cell, number): popup must not open, and any open popup closes.
- TikTok short links (`vm.tiktok.com/...`, `tiktok.com/t/...`): cannot be converted to an embed id; show "can't preview, open link", never a wrong video.
- URLs with query strings, trailing slashes, a username prefix on Instagram (`/username/reel/CODE/`), `/reels/CODE`, `/p/CODE`, TikTok `/@user/video/ID` and `/photo/ID`: must resolve to the right embed.
- Clicking through rows quickly: a slow-loading earlier video must never replace the popup for the latest cell.
- Sheets scrolls or the window resizes while the popup is open: popup follows the cell or closes, never floats over the wrong row.
- Popup near the right edge or bottom of the screen: stays fully on screen.

---

### Task 1: Working copy, branch, and URL-to-embed converter

**Files:**
- Create: `C:\video-scrubber` (clone), `embed-url.js`, `test/embed-url.test.js`
- Copy in: the spec and this plan into `docs/superpowers/`

**Interfaces:**
- Produces: global `toEmbedUrl(text: string): { platform: 'tiktok' | 'instagram', embedUrl: string, sourceUrl: string } | null` (also `module.exports = { toEmbedUrl }`).

- [ ] **Step 1: Clone `https://github.com/AndoArmy/video-scrubber` to `C:\video-scrubber`, create branch `feat/sheets-preview`, copy `docs/superpowers/specs/` and `docs/superpowers/plans/` from `C:\Users\andre\AppData\Local\Temp\claude\C--Users-andre-OneDrive-Escritorio-second-brain\841e2621-fc9b-4075-bc56-1d8ff3a5e96f\scratchpad\vs\repo\` into it.**
- [ ] **Step 2: Write failing tests in `test/embed-url.test.js` (`node:test`, `assert`)**

```js
test('tiktok video', () => assert.deepEqual(toEmbedUrl('https://www.tiktok.com/@andrea.sells/video/7300000000000000001?is_from_webapp=1'),
  { platform: 'tiktok', embedUrl: 'https://www.tiktok.com/embed/v2/7300000000000000001', sourceUrl: 'https://www.tiktok.com/@andrea.sells/video/7300000000000000001' }));
test('tiktok photo post', ...);            // /@u/photo/ID -> embed/v2/ID
test('instagram reel', () => assert.equal(toEmbedUrl('https://www.instagram.com/reel/CxAbC123/').embedUrl, 'https://www.instagram.com/reel/CxAbC123/embed/'));
test('instagram reel with username prefix', ...);  // /user/reel/CODE/ and /reels/CODE
test('instagram p', ...);                           // /p/CODE
test('tiktok short links are unsupported', () => { assert.equal(toEmbedUrl('https://vm.tiktok.com/ZMabc/'), null); assert.equal(toEmbedUrl('https://www.tiktok.com/t/ZTabc/'), null); });
test('non urls', () => { for (const s of ['', '3 Reality situations', '107', 'https://example.com/a']) assert.equal(toEmbedUrl(s), null); });
test('surrounding whitespace and uppercase host', ...);
```

- [ ] **Step 3: Run `node --test test/` in `C:\video-scrubber`. Expected: FAIL (`toEmbedUrl` not defined).**
- [ ] **Step 4: Implement `toEmbedUrl` in `embed-url.js`.** Parse with `new URL` after trim; match on hostname and path regex; strip query and hash from `sourceUrl`.
- [ ] **Step 5: Run `node --test test/`. Expected: all PASS.**
- [ ] **Step 6: Commit** `feat: toEmbedUrl converts TikTok/Instagram links to embed URLs`

### Task 2: Spike, embed plays and the scrubber attaches (go/no-go gate)

**Files:**
- Create: `popup.html`, `popup.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: `toEmbedUrl` from Task 1.
- Produces: `popup.html?u=<encodeURIComponent(link)>`, an extension page that full-size frames `toEmbedUrl(link).embedUrl`; declared in `web_accessible_resources` for `https://docs.google.com/*`. Manifest gains a second `content_scripts` entry: `all_frames: true`, `matches` `*://www.tiktok.com/embed/*` and `*://www.instagram.com/*/embed/*` plus `*://www.instagram.com/*/embed`, `js: ["content.js"]`, so the scrubber runs inside embed frames (the existing entry stays).

- [ ] **Step 1: Add the manifest entries and `popup.html` / `popup.js` (read `u`, call `toEmbedUrl`, set one `<iframe>` src; if null, render the can't-preview text).**
- [ ] **Step 2: Load unpacked from `C:\video-scrubber`; open `chrome-extension://<id>/popup.html?u=<link>` in a tab for 10 real links from his sheet (at least 5 TikTok, 5 Instagram; he supplies or I pull them from the sheet he shares).**
- [ ] **Step 3: For each link record in `docs/superpowers/spike-results.md`: video plays (yes/no), scrubber bar appears on it (yes/no), seek and speed work (yes/no), sound behavior.**
- [ ] **Step 4: GATE. If most links play and the scrubber attaches, continue. If embeds fail for a large share, stop, commit the results file, and report to Andres before any fallback work (spec: do not build the fallback unasked).**
- [ ] **Step 5: Commit** `feat: popup page frames embed URLs, scrubber runs in embed frames (spike)`

### Task 3: Sheets content script opens the popup on cell click

**Files:**
- Create: `sheets.js`
- Modify: `manifest.json` (third `content_scripts` entry: `matches: ["*://docs.google.com/spreadsheets/*"]`, `js: ["embed-url.js", "sheets.js"]`)

**Interfaces:**
- Consumes: `toEmbedUrl`, `popup.html?u=`.
- Produces in `sheets.js`: `readSelectedCellText(): string` (formula bar content), `selectedCellRect(): DOMRect | null`, `openPopup(link: string, rect: DOMRect): void`, `closePopup(): void`.

- [ ] **Step 1: Inspect the live Sheets DOM (formula bar element, active-cell selection overlay) with Chrome tools on his sheet and note the selectors in a comment at the top of `sheets.js`.**
- [ ] **Step 2: Implement click handling: on `mouseup` in the grid, wait one animation frame for Sheets to update selection, read cell text, `toEmbedUrl`; if null `closePopup()`, else `openPopup()`.**
- [ ] **Step 3: `openPopup` creates (once) a shadow-root host holding an iframe to `chrome.runtime.getURL('popup.html') + '?u=...'`, sized for 9:16 video plus the scrubber bar, positioned under `rect`; keyboard cell movement never opens it.**
- [ ] **Step 4: Race guard: each open increments a token; an iframe load for an older token is discarded.**
- [ ] **Step 5: Manual verify on his sheet: click TikTok link cell, popup under cell plays video with scrubber; click Instagram link cell, popup swaps; click a label cell, popup closes; arrow-key moving between link cells opens nothing.**
- [ ] **Step 6: Commit** `feat: Sheets cell click opens video popup under the cell`

### Task 4: Placement and dismissal

**Files:**
- Modify: `sheets.js`

**Interfaces:**
- Produces: `placePopup(rect: DOMRect, size: {w: number, h: number}): {left: number, top: number}` (pure, exported via `module.exports` for node tests).

- [ ] **Step 1: Write failing tests in `test/place.test.js`: below the cell by default; flips above when `rect.bottom + h > innerHeight`; clamps `left` so `left + w <= viewportWidth`; never negative.**
- [ ] **Step 2: Run `node --test test/`. Expected: FAIL.**
- [ ] **Step 3: Implement `placePopup` and use it in `openPopup`.**
- [ ] **Step 4: Run `node --test test/`. Expected: PASS.**
- [ ] **Step 5: Add: `Esc` closes; clicking outside the popup on a non-link cell closes; scroll or resize while open repositions to the current selection rect, or closes if the cell is off screen.**
- [ ] **Step 6: Manual verify: link cell near the bottom of the screen (popup flips above), near the right edge (stays on screen), scroll the sheet with the popup open.**
- [ ] **Step 7: Commit** `feat: popup placement, flip, Esc and scroll handling`

### Task 5: Keyboard focus model and `A`/`D`

**Files:**
- Modify: `content.js` (the keydown handler near `content.js:512` and a one-line embed-frame check at the top)

**Interfaces:**
- Produces: `const IN_SHEETS_EMBED = window !== window.top && /\/embed/.test(location.pathname)` in `content.js`.

- [ ] **Step 1: In embed frames only (`IN_SHEETS_EMBED`), map `a`/`A` to seek `-SEEK_STEP` and `d`/`D` to `+SEEK_STEP`, and ignore `ArrowLeft`/`ArrowRight`. Outside embed frames the handler is unchanged.**
- [ ] **Step 2: Do not focus the iframe on open (no `.focus()` calls); keys reach the popup only after the user clicks the video.**
- [ ] **Step 3: Manual verify: open popup, type "ad" into the neighboring label cell, letters land in the cell; click the video, `A`/`D` seek 5 seconds, `S`/`K`/`M`/`1`-`9` work; click a cell, keys go back to Sheets; arrows move cells and do not seek. Regression: on a normal instagram.com/reel tab, arrows still seek and `A`/`D` do nothing.**
- [ ] **Step 4: Commit** `feat: A/D seek inside Sheets popup only, keys only after clicking the video`

### Task 6: Failure message, shared settings check, docs

**Files:**
- Modify: `popup.js`, `README.md`

- [ ] **Step 1: In `popup.js`, if the embed frame reports no playing video within 8 seconds (message from the embed content script via `postMessage` when a `<video>` starts playing), replace the frame with "Can't preview this one. Open link" (link opens `sourceUrl` in a new tab). Unsupported links (`toEmbedUrl` null) never reach the popup (Task 3).**
- [ ] **Step 2: Manual verify with a private or deleted post and a short link: the message shows, no blank box.**
- [ ] **Step 3: Manual verify shared settings: set speed 2x in the popup, open a TikTok tab, speed is 2x; change volume there, popup reflects it on next open.**
- [ ] **Step 4: Update `README.md`: Sheets usage, the A/D and click-the-video rule, limits (short links, embed-blocked posts). Bump `manifest.json` version to `1.5.0`.**
- [ ] **Step 5: Run `node --test test/` (all PASS) and do a final pass on his real sheet: 20 consecutive rows opened by click.**
- [ ] **Step 6: Commit** `feat: can't-preview fallback, docs, 1.5.0`

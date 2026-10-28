# Reels Scrubber

Chrome extension that adds a seek bar, speed buttons, keyboard shortcuts, and a frame strip to videos on Instagram, TikTok, and Facebook, and previews TikTok / Instagram links inside Google Sheets. It stays off on every other site. Built for skimming: see what a video is and what happens in it in a few seconds.

## Install

The Google Sheets preview is on `master` (1.6.0). The release zips (1.3.0 and older) do not have it, so install from git or from the zip of `master`.

**Option A, git (easiest to update):**

1. In a terminal, go to the folder you want to keep the extension in (for example `cd ~/Documents`), then run:
   `git clone https://github.com/AndoArmy/video-scrubber`
   This makes a `video-scrubber` folder inside the folder you were in. That folder is the extension.
2. Open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**, and pick the `video-scrubber` folder.
3. Reload any open Instagram / TikTok / Google Sheets tabs.

**Option B, zip:** on the [repo page](https://github.com/AndoArmy/video-scrubber) click **Code > Download ZIP**. Your browser saves it in its download folder (Downloads, by default). Unzip it and move the folder somewhere permanent (Documents, not Downloads): Chrome loads the extension from that folder every time, so deleting or moving it breaks the extension. Then do step 2 above.

Chrome may show a "developer mode extensions" notice on startup. That's expected for extensions not installed from the Chrome Web Store.

Remove any older Reels Scrubber / Video Scrubber copies in `chrome://extensions` before loading this one. Two copies both draw a bar and fight over speed and volume.

**Updating:** with git, run `git pull` inside the folder. With the zip, download it again and replace the folder's contents. Then hit the reload arrow on the extension card in `chrome://extensions` and reload the page. Chrome may ask you to approve new permissions.

## Use

The bar sits at the bottom of the video under your mouse (or the one mostly on screen). It dims when your mouse is elsewhere.

| Control | Does |
|---|---|
| Click or drag the bar | Jump anywhere |
| `←` / `→` | Back / forward 5 seconds |
| `1`–`9` | Jump to 10%–90% |
| `0` | Restart |
| `S` | Cycle speed (1x, 1.5x, 2x, 3x, 4x) |
| `K` | Play / pause |
| `M` | Sound on / off |
| Hover the speaker icon | Volume slider. Drag it, or scroll the mouse wheel over the speaker (5% per notch). |
| `H` | Hide / show the bar |
| **Preview** | Grabs 8 frames from across the video (1–3 seconds). Click a frame to jump there. |

Shortcuts are off while you type in a text box, and never fire with Cmd/Ctrl/Alt held.

## Google Sheets preview

Click a cell that holds a TikTok or Instagram link and the video plays in a popup under that cell. Once it is open, `↓` / `↑` move to the next link and the popup switches to that video on its own. Click another cell to switch videos; land on a cell without a link, click one, or press `Esc` to close it. A popup never opens from keyboard moves alone; it has to be opened with a click first. The links must be plain text URLs in the cells.

- **Instagram and TikTok** both play with the full scrubber (seek bar, speed, frame strip). For TikTok the extension reads the video's file address from TikTok's page (answering TikTok's bot-check puzzle itself) and plays the file directly; it goes from TikTok to your browser and nowhere else. If TikTok changes its page and that stops working, the popup falls back to TikTok's own player with its own controls and no scrubber. TikTok photo posts always use TikTok's own player.
- **Status line:** the small grey text at the bottom left of the popup shows how the load went (`first frame 1.4s`). If TikTok's own player took over, it says why, for example `own player failed (layout: …)`. Send that line when reporting a TikTok problem.
- Videos start muted and on their own; sound follows your saved volume once Chrome allows it.
- Keys only reach the popup after you click on the video, so typing in other cells is never intercepted. Then `A` / `D` seek back / forward 5 seconds (arrow keys stay with Sheets), plus `S` `K` `M` `H` `0`-`9` as usual. Click any cell to hand the keyboard back to Sheets.
- If a video can't be previewed (private post, TikTok short links like vm.tiktok.com, blocked embed), the popup says so and **Open link** under it opens the post. Links made with `=HYPERLINK()` show as a formula in the formula bar and are not previewed.

## Behavior notes

- **Speed** carries over to every next video and survives reloads.
- **Volume** level is remembered and applied to every next video, even when the site resets it. Dragging to 0 mutes; turning sound back on returns to your last level.
- **Sound** is on by default: when Instagram or TikTok starts a reel muted, the extension unmutes it. Mute with the bar's button, `M`, or the site's own mute button, and every next video stays muted until you turn sound back on. Chrome only lets a page play sound after you've clicked or pressed a key on it, so on a freshly opened tab the first video plays muted until your first click (except on sites Chrome already trusts with sound because you watch there a lot).
- **Grids:** on Explore, Discover, search results, or anywhere several videos show at once, the bar stays hidden until you click a video. Open posts and the reel player always get a bar.
- The bar is never wider than the video it sits on; on narrow videos the controls wrap onto a second row.
- On Instagram, `←` / `→` override Instagram's own "previous / next post" arrows while a video is active.
- The bar covers Instagram's small mute icon in the bottom corner. The bar's own mute button replaces it.
- **Permissions:** access to tiktok.com and TikTok's video servers, `cookies`, and `declarativeNetRequestWithHostAccess`. They exist for the Sheets popup's TikTok player: it asks TikTok for the page, answers its bot-check puzzle, and plays the video file with a tiktok.com referrer. Chrome shows them as extra permissions on update.
- **Nothing leaves your computer.** Videos are streamed from TikTok / Instagram to your browser and are never saved to disk. Only speed and sound choices are saved, in Chrome's local extension storage.

## Files

- `manifest.json` — Manifest V3: content scripts for Instagram, TikTok, Facebook (bar), Instagram embeds (inside the Sheets popup only), and Google Sheets; permissions `storage`, `cookies`, `declarativeNetRequestWithHostAccess`
- `content.js` — the scrubber: picks the active video, draws the bar in a shadow root (so site CSS can't break it), handles keys and the frame strip
- `sheets.js` — Google Sheets: reads the clicked cell, opens, moves and closes the popup
- `place.js` — where the popup goes under a cell, and what it does when the selection changes
- `embed-url.js` — turns a TikTok / Instagram link into the right preview address
- `popup.html`, `popup.js` — the popup page: frames the player, shows the status line, handles fallbacks and the Open link button
- `tiktok-player.html`, `tiktok-player.js` — plays a TikTok video in a plain video element so the scrubber can attach
- `tiktok-page.js` — reads the video file address out of TikTok's page data
- `tiktok-waf.js` — solves TikTok's bot-check puzzle
- `test/` — unit tests, run with `node --test` (Node 18+)
- `docs/superpowers/` — design spec, plan, and spike notes for the Sheets preview

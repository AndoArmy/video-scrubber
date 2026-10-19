# Video Scrubber

Chrome extension that adds a seek bar, speed buttons, keyboard shortcuts, and a frame strip to videos on Instagram, TikTok, and Facebook. It stays off on every other site. Built for skimming: see what a video is and what happens in it in a few seconds.

## Install

1. Download `video-scrubber-vX.Y.Z.zip` from the [latest release](https://github.com/AndoArmy/video-scrubber/releases/latest) and unzip it. Keep the folder somewhere permanent (not Downloads): Chrome loads the extension from it every time.
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and pick the unzipped `video-scrubber` folder
5. Reload any open Instagram / TikTok tabs

Chrome may show a "developer mode extensions" notice on startup. That's expected for extensions not installed from the Chrome Web Store.

**Updating:** download the new zip, replace the folder's contents, then hit the reload arrow on the extension card in `chrome://extensions` and reload the page.

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

## Behavior notes

- **Speed** carries over to every next video and survives reloads.
- **Volume** level is remembered and applied to every next video, even when the site resets it. Dragging to 0 mutes; turning sound back on returns to your last level.
- **Sound** is on by default: when Instagram or TikTok starts a reel muted, the extension unmutes it. Mute with the bar's button, `M`, or the site's own mute button, and every next video stays muted until you turn sound back on. Chrome only lets a page play sound after you've clicked or pressed a key on it, so on a freshly opened tab the first video plays muted until your first click (except on sites Chrome already trusts with sound because you watch there a lot).
- On Instagram, `←` / `→` override Instagram's own "previous / next post" arrows while a video is active.
- The bar covers Instagram's small mute icon in the bottom corner. The bar's own mute button replaces it.
- Nothing leaves your computer. Only speed and sound choices are saved, in Chrome's local extension storage.

## Files

- `manifest.json` — Manifest V3, one content script on Instagram, TikTok, and Facebook only (add a site by adding its pattern to `matches`), `storage` permission only
- `content.js` — everything: picks the active video, draws the bar in a shadow root (so site CSS can't break it), handles keys and the frame strip

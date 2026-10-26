# Sheets video preview, added to Reels Scrubber

Date: 2026-10-26. Repo: AndoArmy/video-scrubber (Reels Scrubber 1.4.1, Manifest V3, one `content.js`).

## Intent and the why

Andres is building an AI content-tagging tool and must label 20,000+ short videos by hand (which type of video each one is). His sheet is a Google Sheet with one video link per row (TikTok and Instagram) beside his label columns. Today each video means: click link, new tab, watch, close tab, repeat. That cost is the whole problem.

He wants to click a link cell and watch that video inside the sheet, in the spot his eyes already are, with his existing Reels Scrubber controls on it. He then types his label in the neighboring cells himself. Speed of the click-watch-label loop is the success measure.

## What exists

Reels Scrubber is a content script that runs only on instagram.com, tiktok.com and facebook.com. It finds the page's `<video>` and draws a seek bar, 1x/1.5x/2x/3x/4x speed, keyboard shortcuts, an 8-frame "Preview" strip, and remembers speed and volume in `chrome.storage.local`. It is drawn in a shadow root and picks the active video by pointer position and visibility. It does nothing on docs.google.com.

## Goals

- Click a cell containing a TikTok or Instagram link in Google Sheets: a popup opens directly under that cell and plays the actual video.
- The popup has the full Reels Scrubber on the video: seek bar, speed, frame strip, volume, with the speed and volume he already saved.
- One extension, one install, one settings store (Sheets support is added to Reels Scrubber, not a second extension).
- Opens on click of the cell only. Never on hover, never when moving between cells with the keyboard.
- Works at the pace of 20,000 videos: no new tab, no leaving the sheet, popup replaces itself when he clicks the next link cell.

## Non-goals

- Does not record or write his labels, and does not write into the sheet.
- No auto-advance, no "follow the selected cell" mode.
- No support for Facebook links in Sheets unless it comes free (not required).
- Not a Chrome Web Store release for now. He runs it unpacked, as with the current version.
- No downloading or re-hosting of videos.

## Anti-goals (a failure even if it technically works)

- Covering or breaking Sheets: the popup must never block typing in cells, selection, or scrolling.
- Taking over keys in the sheet while no popup is open.
- Sending his sheet contents or links anywhere other than the embed host that plays that single video.

## Decisions he made

- Trigger: click on the cell that holds the link. Popup anchored under that cell (rejected: docked side panel, floating window).
- Popup content: the playing video with the Reels Scrubber baked in, replacing the small link-preview card Sheets shows today.
- Keyboard inside the opened popup: `A` seeks back 5 seconds and `D` seeks forward 5 seconds. Arrow keys are left to Sheets so cell navigation is untouched. All other scrubber keys stay as they are (`1`-`9`, `0`, `S`, `K`, `M`, `H`).

- Keyboard focus (decided after builder check): scrubber keys (`A`, `D`, `1`-`9`, `0`, `S`, `K`, `M`, `H`) work only after he clicks on the video in the popup. Otherwise every keystroke goes to Sheets, so typing labels containing those letters is never intercepted. Clicking a cell hands the keyboard back to Sheets.
- Link format (confirmed from his screenshot): cells hold plain text URLs that Sheets shows as blue underlined links (tiktok.com and instagram.com), with his labels in the neighboring columns. Plain URLs must work; `=HYPERLINK()` is a bonus. No Google sign-in or Sheets API.

## My calls (he has not confirmed these)

- Build order: the first milestone is a throwaway spike that loads the embed for a sample of his real links (a mix of TikTok and Instagram) and checks that the scrubber can drive the video. Go/no-go gate before building the rest. Videos that cannot be embedded show a "can't preview, open link" message in the popup. If the embed route fails for a large share of his links, stop and come back to him before attempting the fallback.
- Sound: kept on by default as in the current extension; one iframe reused per click, not a pool. No prefetching of the next row.
- Speed and volume changed in the popup write back to the same shared settings as the Instagram/TikTok tabs.
- `A`/`D` apply only in the Sheets popup. Instagram and TikTok tabs are left exactly as they are today (reviewer flagged key collisions there).
- Supported context: the normal Sheets editor at `docs.google.com/spreadsheets/d/...` for sheets he can click in. View-only and odd zoom/frozen-row setups are best-effort.
- Native preview card: try to keep it from showing at the same time as our popup; if Google's DOM makes that impossible, our popup sits over it.

- Plays the video via TikTok's and Instagram's own embed pages inside an iframe in the popup, running the scrubber inside that iframe. Unverified: must be tested against his real links before anything else is built. If embeds fail for his content, the fallback to evaluate is playing a direct video stream fetched by the extension (more work, brittle).
- Link detection: Sheets draws its grid on a canvas, so read the selected cell's value from the formula bar after a click, supporting plain URLs and `=HYPERLINK()`. Cell position for anchoring comes from the selection rectangle on screen.
- Popup flips above the cell when there is no room below. `Esc` closes it. Clicking any cell that is not a supported link closes it.
- Working copy lives at `C:\video-scrubber`, cloned from the repo. Changes go on a branch, not straight to `main`.
- Manifest gets `*://docs.google.com/spreadsheets/*` and the embed frames, and `all_frames` handling for the embed pages. Store listing and privacy docs are out of scope until a Web Store release is wanted.

## Left to the builder

- Exact structure: whether the popup is a shadow-root host in the Sheets page or an extension-owned iframe, and how frames message each other.
- How to find the selected cell's rectangle and value robustly (Sheets changes its DOM).
- Autoplay and sound handling inside the embed, reusing the existing sound logic where it applies.
- Testing approach and how to handle videos that cannot be embedded (show a clear "can't preview, open link" message rather than a blank box).

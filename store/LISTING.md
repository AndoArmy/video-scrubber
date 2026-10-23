# Chrome Web Store listing — Video Scrubber

Copy each block into the matching field in the developer dashboard.

## Name
Video Scrubber

## Summary (132 characters max)
Seek bar, speed control, volume and a frame preview strip for videos on Instagram, TikTok, and Facebook.

## Category
Productivity

## Language
English

## Description
Skim videos in seconds instead of watching them end to end.

Video Scrubber adds a seek bar, speed buttons, keyboard shortcuts, and a frame strip to videos on Instagram, TikTok, and Facebook. It stays off on every other site.

WHAT YOU GET
- Seek bar: click or drag to jump anywhere in the video.
- Frame strip: press Preview to grab 8 frames from across the video, then click a frame to jump there.
- Speed control: 1x, 1.5x, 2x, 3x, 4x. Your speed carries over to every next video.
- Volume slider: hover the speaker icon to set the level, or scroll over it. Sound is on by default and your level is remembered.
- Keyboard shortcuts: arrow keys to skip 5 seconds, number keys to jump to 10%-90%, S for speed, K to play/pause, M to mute, H to hide the bar.

PRIVATE BY DESIGN
Nothing leaves your computer. Video Scrubber makes no network requests, has no accounts, and collects no data. Only your speed and sound choices are saved, in Chrome's local extension storage.

SHORTCUTS
Left / Right: back / forward 5 seconds
1-9: jump to 10%-90%
0: restart
S: cycle speed
K: play / pause
M: sound on / off
H: hide / show the bar

Shortcuts are off while you type in a text box and never fire with Cmd, Ctrl, or Alt held.

Not affiliated with or endorsed by Instagram, TikTok, Facebook, or Meta.

## Single purpose
Add a seek bar, speed control, volume control, and frame preview strip to videos on Instagram, TikTok, and Facebook.

## Permission justifications (Privacy tab)

**storage**
Saves the user's chosen playback speed, sound on/off, and volume level in chrome.storage.local so they carry over to the next video and survive page reloads. Nothing else is stored.

**Host permissions (instagram.com, tiktok.com, facebook.com) — content script matches**
The extension injects one content script on these three sites to find the video the user is watching and draw the seek bar over it. It reads the page's video elements only to control playback (seek, speed, volume) and to draw preview frames onto a local canvas. It does not read page text, forms, cookies, or account data, and it does not run on any other site.

**Remote code**
No. All code ships in the package. No eval, no external scripts.

## Data usage (Privacy tab)
Tick no data-collection categories. Tick all three certifications:
- I do not sell or transfer user data to third parties outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to the item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL
https://andoarmy.github.io/video-scrubber/privacy.html

## Visibility
Unlisted for the first release. Switch to Public after testing.

## Screenshots
Upload the files in `store/screenshots/` (1280x800).

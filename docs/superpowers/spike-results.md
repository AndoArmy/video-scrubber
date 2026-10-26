# Spike results (Task 2), 2026-10-26

Method: opened embed URLs as top-level tabs in Chrome (automated browser) with the installed Reels Scrubber. The framed-inside-popup.html path was NOT tested yet (extension not loaded unpacked from this branch).

| Link | URL tried | Result |
|---|---|---|
| Instagram /p/DWXODQYEbn6/ | instagram.com/p/DWXODQYEbn6/embed/ | Plays. Real `<video>` element. Scrubber bar attached (visible at bottom). |
| TikTok video 7621678970907544846 | tiktok.com/embed/v2/ID | Blank page: "overload-protect triggered" |
| TikTok video 7555964973843795255 | tiktok.com/embed/v2/ID | "429 Too Many Requests" |
| TikTok video 7555964973843795255 | tiktok.com/player/v1/ID | Plays with TikTok's own controls (play, volume, seek, settings), BUT no `<video>` element anywhere (no shadow roots, no iframes, 1 canvas). Scrubber cannot attach. |

Only 4 of the 37 supplied links were tried (3 TikTok, 1 Instagram). Not a full sample.

## Reading

- Instagram: go.
- TikTok (25 of his 37 links): embed/v2 is blocked or rate-limited here, and the working player/v1 draws to a canvas, so the scrubber cannot drive it. Gate NOT passed for TikTok.
- Per the spec: stop and ask Andres before attempting any fallback.

## Decision (Andres, 2026-10-26): option 1
Instagram = embed page + full scrubber. TikTok = TikTok player/v1 with its built-in controls (no scrubber, no A/D, no frame strip). toEmbedUrl maps TikTok to https://www.tiktok.com/player/v1/<id>.

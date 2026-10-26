const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTikTokVideo } = require('../tiktok-page.js');

const page = (scope) =>
  `<html><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: scope })}</script></body></html>`;
const detail = (item, statusCode = 0) => ({ 'webapp.video-detail': { statusCode, itemInfo: { itemStruct: item } } });

test('returns the playAddr of a normal video', () => {
  const html = page(detail({ video: { playAddr: 'https://v16.tiktok.com/video/a.mp4', duration: 10 } }));
  assert.deepEqual(parseTikTokVideo(html), { url: 'https://v16.tiktok.com/video/a.mp4' });
});

test('falls back to an h264 bitrate entry when playAddr is empty', () => {
  const html = page(
    detail({
      video: {
        playAddr: '',
        bitrateInfo: [
          { CodecType: 'h265_hvc1', PlayAddr: { UrlList: ['https://v16.tiktok.com/video/hevc.mp4'] } },
          { CodecType: 'h264', PlayAddr: { UrlList: ['https://v16.tiktok.com/video/h264.mp4'] } },
        ],
      },
    })
  );
  assert.deepEqual(parseTikTokVideo(html), { url: 'https://v16.tiktok.com/video/h264.mp4' });
});

test('photo posts have no video file', () => {
  const html = page(detail({ imagePost: { images: [{}] }, video: { playAddr: '' } }));
  assert.deepEqual(parseTikTokVideo(html), { error: 'photo' });
});

test('private / removed videos report unavailable', () => {
  assert.deepEqual(parseTikTokVideo(page(detail({}, 10216))), { error: 'unavailable' });
});

test('a page without the data blob (layout changed, bot check) reports layout', () => {
  assert.deepEqual(parseTikTokVideo('<html>Verify to continue</html>'), { error: 'layout' });
  assert.deepEqual(parseTikTokVideo(page({})), { error: 'layout' });
});

test('refuses non-TikTok-hosted file addresses', () => {
  const html = page(detail({ video: { playAddr: 'https://evil.example/a.mp4' } }));
  assert.deepEqual(parseTikTokVideo(html), { error: 'layout' });
});

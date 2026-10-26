const test = require('node:test');
const assert = require('node:assert/strict');
const { toEmbedUrl } = require('../embed-url.js');

test('tiktok video becomes embed v2 url and strips the query', () => {
  assert.deepEqual(
    toEmbedUrl('https://www.tiktok.com/@andrea.sells/video/7300000000000000001?is_from_webapp=1'),
    {
      platform: 'tiktok',
      embedUrl: 'https://www.tiktok.com/player/v1/7300000000000000001?autoplay=1',
      sourceUrl: 'https://www.tiktok.com/@andrea.sells/video/7300000000000000001',
    }
  );
});

test('tiktok photo post resolves to its embed', () => {
  assert.equal(
    toEmbedUrl('https://www.tiktok.com/@andrea.sells/photo/7300000000000000002').embedUrl,
    'https://www.tiktok.com/player/v1/7300000000000000002?autoplay=1'
  );
});

test('instagram reel resolves to the embed page', () => {
  assert.deepEqual(toEmbedUrl('https://www.instagram.com/reel/CxAbC123/'), {
    platform: 'instagram',
    embedUrl: 'https://www.instagram.com/reel/CxAbC123/embed/',
    sourceUrl: 'https://www.instagram.com/reel/CxAbC123/',
  });
});

test('instagram reel with username prefix and /reels/ both resolve', () => {
  assert.equal(
    toEmbedUrl('https://www.instagram.com/someuser/reel/CxAbC123/?igsh=abc').embedUrl,
    'https://www.instagram.com/reel/CxAbC123/embed/'
  );
  assert.equal(
    toEmbedUrl('https://www.instagram.com/reels/CxAbC123').embedUrl,
    'https://www.instagram.com/reel/CxAbC123/embed/'
  );
});

test('instagram /p/ post with a dash in the code resolves', () => {
  assert.equal(
    toEmbedUrl('https://www.instagram.com/p/DPZZy3-Ed6V/').embedUrl,
    'https://www.instagram.com/p/DPZZy3-Ed6V/embed/'
  );
});

test('tiktok short links are unsupported', () => {
  assert.equal(toEmbedUrl('https://vm.tiktok.com/ZMabc/'), null);
  assert.equal(toEmbedUrl('https://www.tiktok.com/t/ZTabc/'), null);
});

test('text that is not a supported link returns null', () => {
  for (const s of ['', '3 Reality situations', '107', 'https://example.com/a', 'https://www.tiktok.com/@user']) {
    assert.equal(toEmbedUrl(s), null, s);
  }
});

test('surrounding whitespace and uppercase host are tolerated', () => {
  assert.equal(
    toEmbedUrl('  HTTPS://WWW.TikTok.com/@u/video/123  ').embedUrl,
    'https://www.tiktok.com/player/v1/123?autoplay=1'
  );
});

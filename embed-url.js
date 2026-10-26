// Turns a pasted TikTok / Instagram link into the URL of that platform's embed page.
// Loaded as a classic content script (global toEmbedUrl) and required by node tests.
(() => {
  const TIKTOK_POST = /^\/@[^/]+\/(?:video|photo)\/(\d+)\/?$/;
  const INSTAGRAM_POST = /^\/(?:[^/]+\/)?(reel|reels|p)\/([\w-]+)\/?$/;

  function toEmbedUrl(text) {
    let url;
    try {
      url = new URL(String(text).trim());
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();

    if (host === 'www.tiktok.com' || host === 'tiktok.com') {
      const m = TIKTOK_POST.exec(url.pathname);
      if (!m) return null;
      return {
        platform: 'tiktok',
        embedUrl: `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1`,
        sourceUrl: `https://www.tiktok.com${url.pathname.replace(/\/$/, '')}`,
      };
    }

    if (host === 'www.instagram.com' || host === 'instagram.com') {
      const m = INSTAGRAM_POST.exec(url.pathname);
      if (!m) return null;
      const kind = m[1] === 'p' ? 'p' : 'reel';
      return {
        platform: 'instagram',
        embedUrl: `https://www.instagram.com/${kind}/${m[2]}/embed/`,
        sourceUrl: `https://www.instagram.com/${kind}/${m[2]}/`,
      };
    }
    return null;
  }

  // A TikTok / Instagram link we can't embed (short links, profiles): the cleaned URL, so the popup
  // can say "can't preview" with an Open link instead of staying silent. Anything else: null.
  const SOCIAL_HOST = /^(?:[\w-]+\.)*(?:tiktok|instagram)\.com$/;
  function isSocialLink(text) {
    let url;
    try {
      url = new URL(String(text).trim());
    } catch {
      return null;
    }
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !SOCIAL_HOST.test(url.hostname.toLowerCase())) return null;
    return url.href;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { toEmbedUrl, isSocialLink };
  else Object.assign(globalThis, { toEmbedUrl, isSocialLink });
})();

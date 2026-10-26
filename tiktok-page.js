// Reads the video file address out of a TikTok video page's embedded data.
// Loaded as a classic script (global parseTikTokVideo) and required by node tests.
(() => {
  const TIKTOK_FILE_HOST = /^(?:[\w-]+\.)*(?:tiktok|tiktokcdn|tiktokcdn-us|tiktokv)\.com$/;

  function ownHost(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && TIKTOK_FILE_HOST.test(u.hostname);
    } catch {
      return false;
    }
  }

  // → { url } | { error: 'photo' | 'unavailable' | 'layout' }
  function parseTikTokVideo(html) {
    const m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(String(html));
    if (!m) return { error: 'layout' };
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      return { error: 'layout' };
    }
    const detail = data && data.__DEFAULT_SCOPE__ && data.__DEFAULT_SCOPE__['webapp.video-detail'];
    if (!detail) return { error: 'layout' };
    if (detail.statusCode) return { error: 'unavailable' };
    const item = detail.itemInfo && detail.itemInfo.itemStruct;
    if (!item) return { error: 'layout' };
    if (item.imagePost) return { error: 'photo' };
    const video = item.video || {};
    // Chrome plays H.264 everywhere; HEVC entries are skipped.
    const h264 = (video.bitrateInfo || []).find((b) => /264|avc/i.test(b.CodecType || '') && b.PlayAddr && b.PlayAddr.UrlList);
    const url = video.playAddr || (h264 && h264.PlayAddr.UrlList[0]) || video.downloadAddr;
    return url && ownHost(url) ? { url } : { error: 'layout' };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { parseTikTokVideo };
  else Object.assign(globalThis, { parseTikTokVideo });
})();

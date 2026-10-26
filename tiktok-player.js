// Extension page that plays one TikTok video (?u=<video page url>) in a plain <video>, so the
// scrubber (content.js, loaded below) can attach to it. TikTok's own embed draws to a canvas, so we
// read the video file's address off TikTok's page ourselves, straight from TikTok to this browser, the way its web page does.
// If anything about that fails, popup.js is told and falls back to TikTok's own player.
(async () => {
  const REFERER_RULE_ID = 1;
  const page = new URLSearchParams(location.search).get('u') || '';

  const t0 = performance.now();
  const secs = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
  // Shown in the popup footer so a slow load says where the time went.
  function status(text) {
    window.parent.postMessage({ rsStatus: `${text} ${secs()}` }, '*');
  }

  function fallback(reason) {
    window.parent.postMessage({ rsFallback: reason, rsStatus: `own player failed (${reason}) ${secs()}` }, '*');
  }

  // The puzzle answer only needs to live for the one retry. It expires by itself, and is not removed by hand:
  // another Sheets tab may have just set the same cookie for its own retry.
  function setCookie({ name, value }) {
    return chrome.cookies.set({
      url: 'https://www.tiktok.com/',
      domain: '.tiktok.com',
      path: '/',
      name,
      value,
      secure: true,
      expirationDate: Date.now() / 1000 + 120,
    });
  }

  // Taken back once used: TikTok can answer a blank page while a used puzzle cookie is still around. Only
  // removed if it is still the one we set, because another Sheets tab may have replaced it for its own retry.
  async function removeIfOurs({ name, value }) {
    const now = await chrome.cookies.get({ url: 'https://www.tiktok.com/', name });
    if (now && now.value === value) await chrome.cookies.remove({ url: 'https://www.tiktok.com/', name });
  }
  const PUZZLE_COOKIES = ['_wafchallengeid', 'waforiginalreid'];

  // One page request with the puzzle answer attached as a Cookie header, by a rule that matches only this video's page.
  async function getPageWithCookieHeader(cookies) {
    const id = 1000 + Math.floor(Math.random() * 1e6);
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [
        {
          id,
          priority: 2,
          action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Cookie', operation: 'set', value: cookies.map((c) => `${c.name}=${c.value}`).join('; ') }] },
          condition: { initiatorDomains: [chrome.runtime.id], urlFilter: new URL(page).pathname, requestDomains: ['tiktok.com'], resourceTypes: ['xmlhttprequest'] },
        },
      ],
    });
    try {
      return await (await fetch(page, { credentials: 'include' })).text();
    } finally {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [id] });
    }
  }

  try {
    // TikTok's file servers refuse requests without a tiktok.com referrer; fetch can't set that itself.
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [REFERER_RULE_ID],
      addRules: [
        {
          id: REFERER_RULE_ID,
          priority: 1,
          action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Referer', operation: 'set', value: 'https://www.tiktok.com/' }] },
          condition: {
            initiatorDomains: [chrome.runtime.id],
            requestDomains: ['tiktok.com', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokv.com'],
            resourceTypes: ['xmlhttprequest', 'media'],
          },
        },
      ],
    });

    // Loading the page sets the cookies the file servers check.
    status('asking TikTok');
    const getPage = async () => (await fetch(page, { credentials: 'include' })).text();
    let html = await getPage();
    if (!html.trim()) {
      // A blank page: a leftover puzzle cookie. Clear it and ask again.
      await Promise.all(PUZZLE_COOKIES.map((name) => chrome.cookies.remove({ url: 'https://www.tiktok.com/', name })));
      html = await getPage();
    }
    let parsed = parseTikTokVideo(html);
    let solved = null;
    const notes = [];
    if (parsed.error === 'layout') {
      // TikTok's bot check answers with a puzzle page; answer it the way a real tab would and ask again.
      solved = solveWafChallenge(html);
      if (solved) {
        status('bot check');
        notes.push(`cookies ${(await Promise.all(solved.cookies.map((c) => setCookie(c)))).map((r) => (r ? 'set' : 'REJECTED')).join('/')}`);
        html = await getPage();
        await Promise.all(solved.cookies.map(removeIfOurs));
        parsed = parseTikTokVideo(html);
        if (parsed.error === 'layout' && /id="cs"/.test(html)) {
          // The cookie jar did not carry the answer (a browser setting, or another cookie in the way): send it as a header.
          notes.push('retry with header');
          html = await getPageWithCookieHeader(solved.cookies);
          parsed = parseTikTokVideo(html);
          notes.push(parsed.error === 'layout' ? 'header failed' : 'header worked');
        }
      }
    }
    if (parsed.error) return fallback(`${parsed.error}: ${describeTikTokPage(html)}; ${notes.join(', ') || 'no puzzle'}`);

    // The video element streams the file itself (starts at once, seeks with range requests).
    const video = document.getElementById('v');
    video.addEventListener('error', () => fallback('file'), { once: true });
    status('got file address');
    video.addEventListener('loadeddata', () => status('first frame'), { once: true });
    video.src = parsed.url;

    // The scrubber attaches to the first big <video> it finds, so it loads once the video has a source.
    const script = document.createElement('script');
    script.src = 'content.js';
    document.body.appendChild(script);
  } catch (err) {
    fallback(String(err && err.message || err));
  }
})();

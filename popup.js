// Extension page that frames the TikTok / Instagram embed for one link (?u=<link>).
(() => {
  const READY_TIMEOUT = 8000; // Instagram embeds report in when their video exists; silence means it can't be previewed
  const TIKTOK_TIMEOUT = 15000; // our player downloads the whole video file first
  const link = new URLSearchParams(location.search).get('u') || '';
  const parsed = toEmbedUrl(link);
  const social = parsed ? parsed.sourceUrl : isSocialLink(link); // validated TikTok / Instagram URL, safe to link to
  const frame = document.getElementById('frame');
  const msg = document.getElementById('msg');
  const open = document.getElementById('open');

  function cantPreview() {
    frame.style.display = 'none';
    msg.style.display = 'flex';
    msg.textContent = "Can't preview this one. Use Open link below.";
  }

  // Esc closes the popup even when focus is in this page (the Instagram embed forwards its own Esc).
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.parent.postMessage({ rsClose: true }, '*');
  });

  if (social) open.href = social;
  else open.remove();

  if (!parsed) {
    cantPreview();
    return;
  }

  // TikTok: our own player page first (plain <video>, so the scrubber works). If it reports a problem
  // or stays silent, TikTok's own player takes over; it has its own controls but no scrubber.
  // Instagram: its embed runs our content script directly; silence means it can't be previewed.
  let ready = false;
  let usedFallback = false;
  function useTikTokPlayer() {
    usedFallback = true;
    frame.src = parsed.embedUrl;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow || !e.data) return;
    if (e.data.rsReady) ready = true;
    else if (e.data.rsFallback && parsed.platform === 'tiktok' && !usedFallback) useTikTokPlayer();
  });

  if (parsed.platform === 'tiktok') {
    frame.src = `tiktok-player.html?u=${encodeURIComponent(parsed.sourceUrl)}`;
    setTimeout(() => {
      if (!ready && !usedFallback) useTikTokPlayer();
    }, TIKTOK_TIMEOUT);
  } else {
    frame.src = parsed.embedUrl;
    setTimeout(() => {
      if (!ready) cantPreview();
    }, READY_TIMEOUT);
  }
})();

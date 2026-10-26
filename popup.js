// Extension page that frames the TikTok / Instagram embed for one link (?u=<link>).
(() => {
  const READY_TIMEOUT = 8000; // Instagram embeds report in when their video exists; silence means it can't be previewed
  const link = new URLSearchParams(location.search).get('u') || '';
  const parsed = toEmbedUrl(link);
  const frame = document.getElementById('frame');
  const msg = document.getElementById('msg');
  const open = document.getElementById('open');

  function cantPreview() {
    frame.remove();
    msg.style.display = 'flex';
    msg.textContent = "Can't preview this one. Use Open link below.";
  }

  if (!parsed) {
    open.remove();
    cantPreview();
    return;
  }

  open.href = parsed.sourceUrl;
  frame.src = parsed.embedUrl;

  // Only the Instagram embed runs our content script, so only it can report in. TikTok's player
  // is left alone and the Open link is the way out if it fails to load.
  if (parsed.platform === 'instagram') {
    let ready = false;
    window.addEventListener('message', (e) => {
      if (e.data && e.data.rsReady) ready = true;
    });
    setTimeout(() => {
      if (!ready) cantPreview();
    }, READY_TIMEOUT);
  }
})();

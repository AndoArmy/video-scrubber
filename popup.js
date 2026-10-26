// Extension page that frames the TikTok / Instagram embed for one link (?u=<link>).
(() => {
  const READY_TIMEOUT = 8000; // Instagram embeds report in when their video exists; silence means it can't be previewed
  const link = new URLSearchParams(location.search).get('u') || '';
  const parsed = toEmbedUrl(link);
  const social = parsed ? parsed.sourceUrl : isSocialLink(link); // validated TikTok / Instagram URL, safe to link to
  const frame = document.getElementById('frame');
  const msg = document.getElementById('msg');
  const open = document.getElementById('open');

  function cantPreview() {
    frame.remove();
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

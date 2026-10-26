// Extension page that frames the TikTok / Instagram embed for one link (?u=<link>).
(() => {
  const link = new URLSearchParams(location.search).get('u') || '';
  const parsed = toEmbedUrl(link);
  const frame = document.getElementById('frame');
  const msg = document.getElementById('msg');

  if (!parsed) {
    frame.remove();
    msg.style.display = 'flex';
    msg.textContent = "Can't preview this link.";
    return;
  }
  frame.src = parsed.embedUrl;
})();

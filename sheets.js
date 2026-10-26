// Google Sheets: click a cell holding a TikTok / Instagram link and the video plays in a popup
// under that cell. Sheets paints its grid on a canvas, so we never see links in the page; we
// read the selected cell from the formula bar and its box from the active-cell border.
//
// Selectors (checked on the live editor, Oct 2026):
//   #t-formula-bar-input .cell-input   text of the selected cell
//   .active-cell-border                four strips that outline the selected cell
//   #waffle-grid-container             the grid; only clicks inside it can open the popup
//   .docs-linkbubble-bubble            Google's own link preview card (hidden while we are open)
(() => {
  if (window.__sheetsPreview) return;
  window.__sheetsPreview = true;

  const POPUP_SIZE = { w: 340, h: 620 };
  const SETTLE_MS = 80; // Sheets updates the formula bar a beat after the click

  let host = null;
  let frame = null;
  let hideBubbleStyle = null;
  let openLink = null; // sourceUrl of the video in the popup
  let pending = 0;

  // ---------- reading the sheet ----------

  function readSelectedCellText() {
    const el = document.querySelector('#t-formula-bar-input .cell-input') || document.getElementById('t-formula-bar-input');
    return el ? el.innerText.trim() : '';
  }

  function selectedCellRect() {
    const strips = document.querySelectorAll('.active-cell-border');
    if (!strips.length) return null;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const s of strips) {
      const r = s.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return left === Infinity ? null : { left, top, right, bottom };
  }

  // ---------- popup ----------

  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483646; display: none;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        iframe {
          display: block; border: 0; background: #111; border-radius: 10px;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
        }
      </style>
      <iframe allow="autoplay; fullscreen; encrypted-media"></iframe>`;
    frame = root.querySelector('iframe');
    frame.width = POPUP_SIZE.w;
    frame.height = POPUP_SIZE.h;
    document.documentElement.appendChild(host);
  }

  function hideGoogleBubble(on) {
    if (on && !hideBubbleStyle) {
      hideBubbleStyle = document.createElement('style');
      hideBubbleStyle.textContent = '.docs-linkbubble-bubble, .docs-multi-linkbubble-bubble { display: none !important; }';
      document.head.appendChild(hideBubbleStyle);
    } else if (!on && hideBubbleStyle) {
      hideBubbleStyle.remove();
      hideBubbleStyle = null;
    }
  }

  function place(rect) {
    const { left, top } = placePopup(rect, POPUP_SIZE);
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  function openPopup(parsed, rect) {
    ensureHost();
    hideGoogleBubble(true);
    if (openLink !== parsed.sourceUrl) {
      // One iframe, reused: setting src replaces whatever was loading, so a slow earlier video can't win.
      frame.src = `${chrome.runtime.getURL('popup.html')}?u=${encodeURIComponent(parsed.sourceUrl)}`;
      openLink = parsed.sourceUrl;
    }
    place(rect);
    host.style.display = 'block';
  }

  function closePopup() {
    pending++;
    if (!host) return;
    host.style.display = 'none';
    frame.src = 'about:blank';
    openLink = null;
    hideGoogleBubble(false);
  }

  // ---------- triggers ----------

  function onCellClick() {
    const mine = ++pending;
    setTimeout(() => {
      if (mine !== pending) return; // a newer click took over
      const parsed = toEmbedUrl(readSelectedCellText());
      const rect = selectedCellRect();
      if (parsed && rect) openPopup(parsed, rect);
      else closePopup();
    }, SETTLE_MS);
  }

  // Only a click in the grid opens or closes the popup. Keyboard moves between cells do nothing.
  window.addEventListener(
    'mouseup',
    (e) => {
      if (e.button !== 0 || e.composedPath().includes(host)) return;
      const grid = document.getElementById('waffle-grid-container');
      if (grid && grid.contains(e.target)) onCellClick();
    },
    true
  );

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && host && host.style.display !== 'none') closePopup();
    },
    true
  );

  // The Instagram embed forwards Esc here when the popup has focus.
  // The embed is nested a frame deeper than our iframe, so the sender can't be matched to it; closing is harmless anyway.
  window.addEventListener('message', (e) => {
    if (e.data && e.data.rsClose && host && host.style.display !== 'none') closePopup();
  });

  // Keep the popup on its cell while the sheet scrolls or the window resizes.
  function follow() {
    if (!host || host.style.display === 'none') return;
    const rect = selectedCellRect();
    const grid = document.getElementById('waffle-grid-container');
    const gridRect = grid && grid.getBoundingClientRect();
    if (!rect || (gridRect && (rect.bottom < gridRect.top || rect.top > gridRect.bottom))) closePopup();
    else place(rect);
  }
  window.addEventListener('scroll', follow, true);
  window.addEventListener('resize', follow);
})();

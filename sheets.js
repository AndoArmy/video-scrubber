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

  const POPUP_SIZE = { w: 360, h: 700 }; // Instagram embed header + 9:16 video + popup footer
  const SETTLE_MS = 80; // Sheets updates the formula bar a beat after the click
  const FOLLOW_MS = 150; // how often an open popup checks that its cell is still selected and on screen

  let host = null;
  let frame = null;
  let hideBubbleStyle = null;
  let openLink = null; // sourceUrl of the video in the popup
  let pending = 0;
  let followTimer = 0;

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
    // Built with DOM calls, not innerHTML: Google Docs pages enforce Trusted Types.
    const style = document.createElement('style');
    style.textContent =
      ':host { all: initial; } iframe { display: block; border: 0; background: #111; border-radius: 10px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45); }';
    frame = document.createElement('iframe');
    frame.allow = 'autoplay; fullscreen; encrypted-media';
    root.append(style, frame);
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

  // The link the popup should show for the selected cell: the embeddable link, or a TikTok /
  // Instagram link we can't embed (the popup then says so and offers Open link), or null.
  function linkOfSelectedCell() {
    const text = readSelectedCellText();
    const parsed = toEmbedUrl(text);
    return parsed ? parsed.sourceUrl : isSocialLink(text);
  }

  function place(rect) {
    const { left, top, w, h } = placePopup(rect, POPUP_SIZE);
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    frame.width = w;
    frame.height = h;
  }

  function openPopup(link, rect) {
    ensureHost();
    hideGoogleBubble(true);
    if (openLink !== link) {
      // One iframe, reused: setting src replaces whatever was loading, so a slow earlier video can't win.
      frame.src = `${chrome.runtime.getURL('popup.html')}?u=${encodeURIComponent(link)}`;
      openLink = link;
    }
    place(rect);
    host.style.display = 'block';
    if (!followTimer) followTimer = setInterval(follow, FOLLOW_MS);
  }

  function closePopup() {
    pending++;
    clearInterval(followTimer);
    followTimer = 0;
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
      const link = linkOfSelectedCell();
      const rect = selectedCellRect();
      if (link && rect) openPopup(link, rect);
      else closePopup();
    }, SETTLE_MS);
  }

  // Only a click in the grid opens the popup. Once it is open, follow() below carries it along as the
  // arrow keys move the selection from link to link.
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

  // Keep the popup on its cell while the sheet scrolls or the window resizes. If the selection has
  // moved to a different cell (keyboard), the popup is for a video that is no longer selected, so
  // it closes instead of sliding under the new row. Polled as well, because Sheets scrolls its
  // canvas without always firing a DOM scroll event.
  function follow() {
    if (!host || host.style.display === 'none') return;
    const rect = selectedCellRect();
    const grid = document.getElementById('waffle-grid-container');
    const gridRect = grid && grid.getBoundingClientRect();
    const offGrid =
      gridRect && rect && (rect.bottom < gridRect.top || rect.top > gridRect.bottom || rect.right < gridRect.left || rect.left > gridRect.right);
    const link = linkOfSelectedCell();
    const action = followAction({ hasCell: !!rect, offGrid, link, openLink });
    if (action === 'close') closePopup();
    else if (action === 'open') openPopup(link, rect);
    else place(rect);
  }
  window.addEventListener('scroll', follow, true);
  window.addEventListener('resize', follow);
})();

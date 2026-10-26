// Where the popup goes: under the clicked cell, above it when only the top has room, and
// shrunk into the roomier side when neither fits, so it never covers the row being labeled.
// Classic script (global placePopup) and node-testable.
(() => {
  const MARGIN = 8;
  const MIN_H = 320;
  const MIN_W = 260;

  function placePopup(rect, size, viewport = { w: innerWidth, h: innerHeight }) {
    const below = viewport.h - rect.bottom - MARGIN;
    const above = rect.top - MARGIN;
    let h = size.h;
    let onTop;
    if (size.h <= below) onTop = false;
    else if (size.h <= above) onTop = true;
    else {
      onTop = above > below;
      h = Math.max(Math.min(size.h, onTop ? above : below), MIN_H);
    }
    const w = h === size.h ? size.w : Math.max(MIN_W, Math.round((h * size.w) / size.h));
    const left = Math.max(0, Math.min(rect.left, viewport.w - w));
    const top = Math.max(0, onTop ? rect.top - h : rect.bottom);
    return { left, top, w, h };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { placePopup };
  else globalThis.placePopup = placePopup;
})();

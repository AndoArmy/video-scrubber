// Where the popup goes: under the clicked cell, above it when there is no room below,
// and always inside the window. Classic script (global placePopup) and node-testable.
(() => {
  function placePopup(rect, size, viewport = { w: innerWidth, h: innerHeight }) {
    const left = Math.max(0, Math.min(rect.left, viewport.w - size.w));
    const fitsBelow = rect.bottom + size.h <= viewport.h;
    const top = fitsBelow ? rect.bottom : Math.max(0, rect.top - size.h);
    return { left, top };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { placePopup };
  else globalThis.placePopup = placePopup;
})();

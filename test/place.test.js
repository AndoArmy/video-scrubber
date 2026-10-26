const test = require('node:test');
const assert = require('node:assert/strict');
const { placePopup } = require('../place.js');

const vp = { w: 1200, h: 900 };
const size = { w: 360, h: 700 };
const cell = (left, top, w = 100, h = 20) => ({ left, top, right: left + w, bottom: top + h });

test('opens directly under the cell at full size when it fits', () => {
  assert.deepEqual(placePopup(cell(100, 100), size, vp), { left: 100, top: 120, w: 360, h: 700 });
});

test('flips above the cell at full size when only the top has room', () => {
  assert.deepEqual(placePopup(cell(100, 750), size, vp), { left: 100, top: 50, w: 360, h: 700 });
});

test('clamps so the popup stays inside the right edge', () => {
  assert.equal(placePopup(cell(1100, 100), size, vp).left, 840);
});

test('shrinks (keeping 9:16-ish proportions) into the larger side instead of covering the cell', () => {
  // cell at y 300-320 in a 650px-tall window: 322px below, 292px above
  const r = placePopup(cell(100, 300), size, { w: 1200, h: 650 });
  assert.equal(r.top, 320);
  assert.ok(r.h <= 650 - 320 && r.h >= 320, JSON.stringify(r));
  assert.equal(r.w, Math.max(260, Math.round((r.h * 360) / 700))); // narrower with the height, never below 260
});

test('picks the roomier side when both are too small', () => {
  const r = placePopup(cell(100, 500), size, { w: 1200, h: 700 }); // 180 below, 492 above
  assert.ok(r.top + r.h <= 500, JSON.stringify(r));
});

test('never returns a negative position even in a tiny window', () => {
  const r = placePopup(cell(5, 100), size, { w: 200, h: 300 });
  assert.ok(r.left >= 0 && r.top >= 0, JSON.stringify(r));
});

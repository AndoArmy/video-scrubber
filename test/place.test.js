const test = require('node:test');
const assert = require('node:assert/strict');
const { placePopup } = require('../place.js');

const vp = { w: 1200, h: 900 };
const size = { w: 300, h: 500 };
const cell = (left, top, w = 100, h = 20) => ({ left, top, right: left + w, bottom: top + h });

test('opens directly under the cell, left edges aligned', () => {
  assert.deepEqual(placePopup(cell(100, 100), size, vp), { left: 100, top: 120 });
});

test('flips above the cell when there is no room below', () => {
  assert.deepEqual(placePopup(cell(100, 780), size, vp), { left: 100, top: 280 });
});

test('clamps so the popup stays inside the right edge', () => {
  assert.deepEqual(placePopup(cell(1000, 100), size, vp), { left: 900, top: 120 });
});

test('never returns a negative position even in a tiny window', () => {
  const r = placePopup(cell(5, 100), { w: 300, h: 500 }, { w: 200, h: 300 });
  assert.ok(r.left >= 0 && r.top >= 0, JSON.stringify(r));
});

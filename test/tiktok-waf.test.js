const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { sha256, solveWafChallenge } = require('../tiktok-waf.js');

const hex = (u8) => Buffer.from(u8).toString('hex');
const ref = (u8) => crypto.createHash('sha256').update(u8).digest('hex');

test('sha256 matches node crypto for empty, short, block-boundary and multi-block input', () => {
  for (const n of [0, 1, 3, 55, 56, 63, 64, 65, 119, 120, 200]) {
    const input = Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) & 255);
    assert.equal(hex(sha256(input)), ref(input), `length ${n}`);
  }
});

test('solves the real challenge page and returns the two cookies TikTok checks', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/waf-challenge.html'), 'utf8');
  const r = solveWafChallenge(html);
  assert.deepEqual(
    r.cookies.map((c) => c.name),
    ['_wafchallengeid', 'waforiginalreid']
  );
  assert.equal(r.cookies[1].value, 'https://www.tiktok.com/');
  // the first cookie carries the original challenge plus our answer d: sha256(a + d) must equal c
  const data = JSON.parse(Buffer.from(r.cookies[0].value, 'base64').toString());
  const a = Buffer.from(data.v.a, 'base64');
  const digest = crypto.createHash('sha256').update(Buffer.concat([a, Buffer.from(Buffer.from(data.d, 'base64').toString())])).digest('base64');
  assert.equal(digest, data.v.c);
});

test('returns null for a page that is not a challenge', () => {
  assert.equal(solveWafChallenge('<html>hello</html>'), null);
});

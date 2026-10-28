// TikTok guards its video pages with a small proof-of-work puzzle ("Please wait..."): find the number d
// where sha256(a + d) equals a given digest, then send the answer back as a cookie. A real tab does this
// in its own JS; this does the same so the extension can read the page without opening one.
// Loaded as a classic script (global solveWafChallenge) and required by node tests.
(() => {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const W = new Uint32Array(64);

  // Synchronous SHA-256 (crypto.subtle is async, and the puzzle needs up to a million hashes).
  function sha256(bytes) {
    const len = bytes.length;
    const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[len] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor((len * 8) / 0x100000000));
    view.setUint32(padded.length - 4, (len * 8) >>> 0);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15], b = W[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((x, i) => ov.setUint32(i * 4, x >>> 0));
    return out;
  }

  const MAX_TRIES = 1000000;
  const toBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const pad4 = (s) => s + '='.repeat((4 - (s.length % 4)) % 4);
  const attr = (html, id) => {
    const m = new RegExp(`<p id="${id}" class="([^"]*)"`).exec(html);
    return m ? m[1] : null;
  };

  // → { cookies: [{ name, value }] } to set on .tiktok.com before asking for the page again, or null
  function solveWafChallenge(html) {
    html = String(html);
    const cs = attr(html, 'cs');
    const wci = attr(html, 'wci');
    if (!cs || !wci) return null;
    let data;
    let base;
    let want;
    try {
      data = JSON.parse(atob(pad4(cs)));
      base = toBytes(data.v.a);
      want = toBytes(data.v.c);
    } catch {
      return null;
    }
    const msg = new Uint8Array(base.length + 8);
    msg.set(base);
    for (let n = 0; n <= MAX_TRIES; n++) {
      const digits = String(n);
      for (let i = 0; i < digits.length; i++) msg[base.length + i] = digits.charCodeAt(i);
      const got = sha256(msg.subarray(0, base.length + digits.length));
      if (got.every((x, i) => x === want[i])) {
        data.d = btoa(digits);
        const cookies = [{ name: wci, value: btoa(JSON.stringify(data)) }];
        const rci = attr(html, 'rci');
        const rs = attr(html, 'rs');
        if (rci && rs) cookies.push({ name: rci, value: rs });
        return { cookies };
      }
    }
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { sha256, solveWafChallenge };
  else Object.assign(globalThis, { solveWafChallenge });
})();

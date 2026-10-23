// Tiny static server with HTTP Range support (video seeking needs it).
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0].replace(/^\/+/, '') || 'demo.html');
  let st; try { st = statSync(f); } catch { res.writeHead(404); return res.end(); }
  const type = f.endsWith('.mp4') ? 'video/mp4' : 'text/html';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    const s = m[1] ? +m[1] : 0, e = m[2] ? +m[2] : st.size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${s}-${e}/${st.size}`, 'Content-Length': e - s + 1 });
    createReadStream(f, { start: s, end: e }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
    createReadStream(f).pipe(res);
  }
}).listen(8765);

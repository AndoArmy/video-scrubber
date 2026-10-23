// Renders Web Store screenshots: loads demo.html, injects the real content.js with a stubbed chrome.storage, drives it over CDP.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentJs = readFileSync(path.join(here, '../../content.js'), 'utf8');
const outDir = path.join(here, '../screenshots');
mkdirSync(outDir, { recursive: true });

const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const PORT = 9333;
const proc = spawn(BRAVE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
  '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required', '--user-data-dir=/tmp/vs-shoot-profile', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch {}
  await sleep(200);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.chrome = { storage: { local: { _d: {}, get(k, cb) { cb({}); }, set(o) {} } } };` });
await send('Page.navigate', { url: 'http://127.0.0.1:8765/demo.html' });
await sleep(1500);
await ev(contentJs);
await ev(`(async()=>{const v=document.getElementById('v'); v.muted=false; await v.play().catch(()=>v.play()); v.currentTime=4.2; })()`);
await sleep(800);

const rect = JSON.parse(await ev(`JSON.stringify(document.getElementById('v').getBoundingClientRect())`));
const move = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
const click = async (x, y) => { await move(x, y); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
const btnCenter = async (sel) => JSON.parse(await ev(`(()=>{const h=[...document.documentElement.children].find(e=>e.shadowRoot); const b=h.shadowRoot.querySelector(${JSON.stringify(sel)}); const r=b.getBoundingClientRect(); return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2});})()`));
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64')); console.log('wrote', name); };

// 1: bar over the video
await move(rect.x + rect.width / 2, rect.y + rect.height - 60);
await sleep(700);
await shot('1-seek-bar.png');

// 2: frame strip
const pv = await btnCenter('button.preview');
await click(pv.x, pv.y);
await sleep(5000);
await move(rect.x + rect.width / 2, rect.y + rect.height - 60);
await sleep(500);
await shot('2-frame-strip.png');

// 3: speed 2x + volume slider open
const sp = await btnCenter('button[data-speed="2"]');
await click(sp.x, sp.y);
await sleep(400);
const mu = await btnCenter('button.mute');
await move(mu.x, mu.y);
await sleep(600);
await shot('3-speed-and-volume.png');

ws.close(); proc.kill();

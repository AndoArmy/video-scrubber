import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const js = readFileSync(new URL('../../content.js', import.meta.url), 'utf8');
const proc = spawn('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', ['--headless=new','--disable-gpu','--remote-debugging-port=9334','--window-size=1280,800','--autoplay-policy=no-user-gesture-required','--user-data-dir=/tmp/vs-check-profile','about:blank'],{stdio:'ignore'});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let t; for(let i=0;i<50;i++){try{t=await(await fetch('http://127.0.0.1:9334/json')).json();if(t.length)break}catch{}await sleep(200)}
const ws=new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&p.has(d.id)){p.get(d.id)(d);p.delete(d.id)}};
const send=(method,params={})=>new Promise(res=>{const i=++id;p.set(i,res);ws.send(JSON.stringify({id:i,method,params}))});
const ev=async e=>(await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true})).result?.result?.value;
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.chrome={storage:{local:{get(k,cb){cb({})},set(){}}}};`});
const mv=(x,y)=>send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
const click=async(x,y)=>{await mv(x,y);await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1})};
const state=()=>ev(`(()=>{const h=[...document.documentElement.children].find(e=>e.shadowRoot);const r=h.getBoundingClientRect();const pn=h.shadowRoot.querySelector('.panel');return JSON.stringify({shown:h.style.display==='block',left:Math.round(r.left),width:Math.round(r.width),panelScrollW:pn.scrollWidth,panelClientW:pn.clientWidth,compact:pn.classList.contains('compact')})})()`);

// grid
await send('Page.navigate',{url:'http://127.0.0.1:8765/grid.html'});await sleep(1200);await ev(js);
await ev(`document.querySelectorAll('video').forEach(v=>v.play())`);await sleep(600);
await mv(150,200);await sleep(700);console.log('grid hover      ',await state());
await click(150,200);await sleep(700);console.log('grid after click',await state());
await mv(900,700);await sleep(700);console.log('grid pointer away (clicked stays)',await state());

// narrow
await send('Page.navigate',{url:'http://127.0.0.1:8765/narrow.html'});await sleep(1200);await ev(js);
await ev(`document.getElementById('v').play()`);await sleep(600);
await mv(640,300);await sleep(700);console.log('narrow 340px video',await state());
await ev(`window.__x=1`);ws.close();proc.kill();

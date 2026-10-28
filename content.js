// Reels Scrubber: seek bar, speed buttons, keyboard shortcuts, and a frame strip
// for whichever video is under the mouse (or most visible on screen).
(() => {
  if (window.__videoScrubber) return;
  window.__videoScrubber = true;

  const SPEEDS = [1, 1.5, 2, 3, 4];
  const FRAME_COUNT = 8;
  const SEEK_STEP = 5; // seconds per arrow key
  // Only when our own popup page (an extension page) is the direct parent, never on other sites' Instagram embeds.
  const IN_SHEETS_EMBED = window !== window.top && location.ancestorOrigins?.[0] === `chrome-extension://${chrome.runtime.id}`;
  // The embed content-script entry matches every Instagram embed on the web; only our own popup's one gets a bar.
  if (window !== window.top && !IN_SHEETS_EMBED) return;
  const MIN_VIDEO_SIZE = 120; // px; skips avatars, ad pixels, tiny previews
  const PICK_INTERVAL = 150; // ms between "which video is active" checks
  const GRID_MIN_VIDEOS = 3; // this many videos on screen at once = a grid (Explore, Discover, search); bar waits for a click
  const FOCUS_AREA = 0.2; // a video covering this share of the window (post popup, reel player) never counts as a grid tile
  const COMPACT_WIDTH = 460; // px; narrower videos get a tighter bar that wraps instead of spilling past the video

  let speed = 1;
  let soundPref = 'on'; // sound on by default; 'off' once the user mutes (our button, M, or the site's own button)
  let volumePref = 1; // 0.01–1, the level used whenever sound is on
  let unmuteBlocked = false; // Chrome refused an unmute; wait for the first click or key press
  let activeSince = 0;
  let lastGesture = 0;
  let gestureSound = null; // the active video's sound state at the moment of the last click / key press
  let gesturePaused = null; // ...and whether it was paused then
  let lastPlayToggle = 0;
  let hidden = false;
  let active = null;
  let pointer = { x: -1, y: -1 };
  let clicked = null; // the video the user last clicked; the only grid tile that gets a bar
  let dragging = false;
  let previewing = false;
  let lastPick = 0;
  const strips = new WeakMap(); // video -> { src, frames: canvas[] }

  // ---------- UI ----------

  const host = document.createElement('div');
  host.style.cssText =
    'all: initial; position: fixed; left: 0; top: 0; z-index: 2147483647; display: none;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        box-sizing: border-box; width: 100%; padding: 8px 10px 8px;
        background: rgba(12, 12, 14, 0.82); color: #fff;
        font: 12px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
        border-radius: 10px 10px 0 0; transition: opacity 0.15s;
        user-select: none; -webkit-user-select: none;
      }
      .panel.dim { opacity: 0.4; }
      .strip { display: flex; gap: 3px; margin-bottom: 8px; }
      .strip[hidden] { display: none; }
      .strip canvas {
        flex: 1 1 0; min-width: 0; height: 64px; object-fit: cover;
        border-radius: 4px; cursor: pointer; outline: 2px solid transparent;
        outline-offset: -2px; background: #222;
      }
      .strip canvas:hover { outline-color: rgba(255, 255, 255, 0.6); }
      .strip canvas.current { outline-color: #ffd400; }
      .track {
        position: relative; height: 18px; cursor: pointer; touch-action: none;
      }
      .rail, .buffered, .fill {
        position: absolute; left: 0; top: 7px; height: 4px; border-radius: 2px;
      }
      .rail { right: 0; background: rgba(255, 255, 255, 0.2); }
      .buffered { background: rgba(255, 255, 255, 0.35); width: 0; }
      .fill { background: #ffd400; width: 0; }
      .knob {
        position: absolute; top: 3px; width: 12px; height: 12px; margin-left: -6px;
        border-radius: 50%; background: #ffd400; left: 0;
      }
      .row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin-top: 4px; }
      .compact { padding: 6px 8px; }
      .compact .row { gap: 4px 5px; }
      .compact .time { min-width: 0; }
      .compact button { padding: 4px 5px; }
      .compact .speeds { gap: 1px; }
      .time { font-variant-numeric: tabular-nums; min-width: 82px; }
      .icon { display: flex; align-items: center; padding: 4px 6px; }
      .icon svg { width: 14px; height: 14px; fill: #fff; }
      .icon .alt, .icon.flip .main { display: none; }
      .icon.flip .alt { display: block; }
      .vol { position: relative; display: flex; align-items: center; }
      /* The slider floats over the bar. If it took up room in the row, opening it on a narrow bar
         wrapped the row, the bar grew and the speaker jumped out from under the pointer, which
         closed the slider again, and so on until the mouse moved. */
      .volume {
        position: absolute; left: 100%; top: 50%; transform: translateY(-50%);
        width: 70px; margin: 0; padding: 4px 8px; box-sizing: content-box;
        background: rgba(12, 12, 14, 0.95); border-radius: 6px;
        opacity: 0; accent-color: #ffd400; cursor: pointer;
        visibility: hidden; pointer-events: none; /* collapsed slider must not steal the speaker's clicks */
        transition: opacity 0.15s, visibility 0.15s;
      }
      .vol:hover .volume, .volume:focus {
        opacity: 1; visibility: visible; pointer-events: auto;
      }
      .speeds { display: flex; gap: 2px; margin-left: auto; }
      button {
        font: inherit; color: #fff; background: rgba(255, 255, 255, 0.12);
        border: 0; border-radius: 6px; padding: 4px 7px; cursor: pointer;
      }
      button:hover { background: rgba(255, 255, 255, 0.25); }
      button.on { background: #ffd400; color: #000; }
      button:disabled { opacity: 0.6; cursor: default; }
    </style>
    <div class="panel">
      <div class="strip" hidden></div>
      <div class="track">
        <div class="rail"></div><div class="buffered"></div><div class="fill"></div><div class="knob"></div>
      </div>
      <div class="row">
        <button class="icon play" title="Play / pause (K)">
          <svg class="main" viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12"/><rect x="9.5" y="2" width="3.5" height="12"/></svg>
          <svg class="alt" viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>
        </button>
        <div class="vol">
          <button class="icon mute" title="Sound on / off (M). Hover for volume; scroll over it to adjust. Carries over to the next videos.">
            <svg class="main" viewBox="0 0 16 16"><path d="M2 6h3l4-3.5v11L5 10H2z"/><path d="M11 5.2a4 4 0 010 5.6M12.8 3.4a6.5 6.5 0 010 9.2" stroke="#fff" stroke-width="1.4" fill="none"/></svg>
            <svg class="alt" viewBox="0 0 16 16"><path d="M2 6h3l4-3.5v11L5 10H2z"/><path d="M11 5.5l4 5m0-5l-4 5" stroke="#fff" stroke-width="1.4"/></svg>
          </button>
          <input class="volume" type="range" min="0" max="1" step="0.01" value="1" title="Volume">
        </div>
        <span class="time">0:00 / 0:00</span>
        <div class="speeds">
          ${SPEEDS.map((s) => `<button data-speed="${s}">${s}x</button>`).join('')}
        </div>
        <button class="preview" title="Grab ${FRAME_COUNT} frames from across the video">Preview</button>
      </div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (sel) => root.querySelector(sel);
  const panel = $('.panel');
  const strip = $('.strip');
  const track = $('.track');
  const bufferedEl = $('.buffered');
  const fillEl = $('.fill');
  const knobEl = $('.knob');
  const timeEl = $('.time');
  const previewBtn = $('.preview');
  const playBtn = $('.play');
  const muteBtn = $('.mute');
  const volWrap = $('.vol');
  const volSlider = $('.volume');
  const speedBtns = [...root.querySelectorAll('[data-speed]')];

  // Keep our clicks away from the site (Instagram closes posts on outside clicks, etc.).
  for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel']) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }

  // ---------- helpers ----------

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function duration(v) {
    if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
    if (v.seekable.length) return v.seekable.end(v.seekable.length - 1);
    return 0;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function visibleArea(r) {
    const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
    const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return w > 0 && h > 0 ? w * h : 0;
  }

  const inside = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  function seekTo(t) {
    const d = duration(active);
    if (!d) return;
    active.currentTime = clamp(t, 0, d - 0.05);
    render();
  }

  // ---------- picking the active video ----------

  function pickVideo() {
    const seen = [];
    for (const v of document.getElementsByTagName('video')) {
      const r = v.getBoundingClientRect();
      if (r.width < MIN_VIDEO_SIZE || r.height < MIN_VIDEO_SIZE) continue;
      // No opacityProperty: TikTok plays its real <video> at opacity 0 behind a poster/fade layer.
      if (v.checkVisibility && !v.checkVisibility({ visibilityProperty: true })) continue;
      const a = visibleArea(r);
      if (!a) continue;
      seen.push({ v, r, a });
    }
    if (clicked && !clicked.isConnected) clicked = null;
    // A grid of videos (Explore, Discover, search results): no bar until the user clicks one.
    // Big videos (an opened post, the reel player) are never grid tiles, so they always get a bar.
    const grid = seen.length >= GRID_MIN_VIDEOS;
    const eligible = grid ? seen.filter((c) => c.v === clicked || c.a >= FOCUS_AREA * innerWidth * innerHeight) : seen;
    let under = null;
    let underArea = 0;
    let best = null;
    let bestArea = 0;
    for (const { v, r, a } of eligible) {
      if (inside(r, pointer.x, pointer.y) && a > underArea) {
        under = v;
        underArea = a;
      }
      if (a > bestArea) {
        best = v;
        bestArea = a;
      }
    }
    if (under) return under;
    // Pointer is elsewhere: stick with the current video while it's still mostly on screen.
    if (active && active.isConnected && eligible.some((c) => c.v === active)) {
      const r = active.getBoundingClientRect();
      if (visibleArea(r) >= 0.3 * r.width * r.height) return active;
    }
    return best;
  }

  function setActive(v) {
    if (v === active) return;
    active = v;
    activeSince = performance.now();
    if (active && active.playbackRate !== speed) active.playbackRate = speed;
    if (active) applySound(active);
    showStrip();
    if (active && IN_SHEETS_EMBED) startInSheetsPopup(active);
  }

  // Inside the Sheets popup: tell popup.js a video exists, and start it muted (muted autoplay is
  // always allowed; the sound logic above unmutes once Chrome lets it) so no click is needed per video.
  let embedReadySent = false;
  function startInSheetsPopup(v) {
    if (!embedReadySent) {
      embedReadySent = true;
      window.parent.postMessage({ rsReady: true }, '*');
    }
    if (v.paused) {
      v.muted = true;
      v.play().catch(() => {});
    }
  }

  // ---------- speed ----------

  function setSpeed(s, persist = true) {
    speed = s;
    if (active) active.playbackRate = s;
    for (const b of speedBtns) b.classList.toggle('on', Number(b.dataset.speed) === s);
    if (persist) {
      try {
        chrome.storage.local.set({ speed: s });
      } catch {}
    }
  }

  function cycleSpeed() {
    setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
  }

  for (const b of speedBtns) b.addEventListener('click', () => setSpeed(Number(b.dataset.speed)));

  // ---------- play / sound ----------

  function togglePlay() {
    if (!active) return;
    if (active.paused) active.play().catch(() => {});
    else active.pause();
  }

  const soundOf = (v) => (v.muted || v.volume === 0 ? 'off' : 'on');
  // Sound state including the level, so a volume change counts as a change too.
  const soundKey = (v) => (soundOf(v) === 'off' ? 'off' : v.volume.toFixed(2));
  const wantedKey = () => (soundPref === 'off' ? 'off' : volumePref.toFixed(2));

  function saveSound() {
    try {
      chrome.storage.local.set({ soundPref, volumePref });
    } catch {}
  }

  // Chrome lets a page unmute its own video only after the user has clicked or pressed a key
  // there, or on sites they often watch with sound. Otherwise it pauses the video (or blocks its
  // autoplay), so: never unmute a paused video before that, undo an unmute Chrome refuses, and
  // retry on the first click / key press.
  function applySound(v) {
    if (previewing) return;
    if (soundPref === 'off') {
      v.muted = true;
      return;
    }
    if (Math.abs(v.volume - volumePref) > 0.005) v.volume = volumePref;
    if (!v.muted) return;
    const activated = navigator.userActivation?.hasBeenActive;
    if (!activated && (unmuteBlocked || v.paused)) return;
    v.muted = false;
    if (activated) return;
    const undo = () => {
      if (!v.paused || v.muted) return;
      unmuteBlocked = true;
      v.muted = true;
      v.play().catch(() => {});
    };
    undo();
    setTimeout(undo, 50);
  }

  // Called every frame for the active video. A sound change right after the user's click or key
  // press on a video they've been watching is their choice (the site's own mute button or volume
  // slider), so we adopt it. Any other mismatch is the site muting on its own, so we put the
  // user's choice back. Instagram mutes each new reel, and re-mutes a video every time it resumes
  // from pause, so a click that also played or paused the video never counts as a mute choice.
  function syncSound(v) {
    const now = performance.now();
    const state = soundKey(v);
    if (state === wantedKey()) return;
    const userChoice =
      !previewing &&
      now - lastGesture < 500 &&
      now - activeSince > 1000 &&
      now - lastPlayToggle > 300 &&
      gestureSound &&
      state !== gestureSound &&
      v.paused === gesturePaused;
    if (userChoice) {
      if (state === 'off') soundPref = 'off';
      else {
        soundPref = 'on';
        volumePref = v.volume;
      }
      saveSound();
      return;
    }
    applySound(v);
  }

  function toggleMute() {
    if (!active) return;
    soundPref = soundOf(active) === 'off' ? 'on' : 'off';
    applySound(active);
    saveSound();
  }

  // 0 from the slider means muted; the last real level is kept for when sound comes back on.
  function setVolume(x) {
    x = Math.round(clamp(x, 0, 1) * 100) / 100;
    if (x === 0) soundPref = 'off';
    else {
      soundPref = 'on';
      volumePref = x;
    }
    if (active) applySound(active);
    saveSound();
  }

  volSlider.addEventListener('input', () => setVolume(Number(volSlider.value)));
  // Hand the keyboard back to our shortcuts once the slider is let go.
  volSlider.addEventListener('change', () => volSlider.blur());
  volWrap.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const current = soundPref === 'off' ? 0 : volumePref;
      // A mouse-wheel notch moves 5%; trackpads move smoothly.
      setVolume(current + clamp(-e.deltaY * 0.001, -0.05, 0.05));
    },
    { passive: false }
  );

  for (const type of ['pointerdown', 'keydown']) {
    window.addEventListener(
      type,
      (e) => {
        if (type === 'pointerdown') {
          let hit = null;
          let hitArea = 0;
          for (const v of document.getElementsByTagName('video')) {
            const r = v.getBoundingClientRect();
            const a = visibleArea(r);
            if (a > hitArea && inside(r, e.clientX, e.clientY)) {
              hit = v;
              hitArea = a;
            }
          }
          if (hit) clicked = hit;
        }
        lastGesture = performance.now();
        gestureSound = active ? soundKey(active) : null;
        gesturePaused = active ? active.paused : null;
        if (unmuteBlocked) {
          unmuteBlocked = false;
          if (active) applySound(active);
        }
      },
      true
    );
  }

  playBtn.addEventListener('click', togglePlay);
  muteBtn.addEventListener('click', toggleMute);
  setSpeed(1, false);
  try {
    chrome.storage.local.get(['speed', 'soundPref', 'volumePref'], (r) => {
      if (SPEEDS.includes(r.speed)) setSpeed(r.speed, false);
      if (r.soundPref === 'on' || r.soundPref === 'off') soundPref = r.soundPref;
      if (r.volumePref > 0 && r.volumePref <= 1) volumePref = r.volumePref;
    });
  } catch {}

  // Every video that starts playing (next reel, next post) gets the chosen speed and sound.
  document.addEventListener(
    'play',
    (e) => {
      if (!(e.target instanceof HTMLVideoElement)) return;
      if (e.target === active) lastPlayToggle = performance.now();
      if (e.target.playbackRate !== speed) e.target.playbackRate = speed;
      if (!previewing) applySound(e.target);
    },
    true
  );

  document.addEventListener(
    'pause',
    (e) => {
      if (e.target === active) lastPlayToggle = performance.now();
    },
    true
  );

  // ---------- seek bar ----------

  function seekToPointer(e) {
    if (!active) return;
    const r = track.getBoundingClientRect();
    seekTo(clamp((e.clientX - r.left) / r.width, 0, 1) * duration(active));
  }

  track.addEventListener('pointerdown', (e) => {
    if (!active) return;
    dragging = true;
    track.setPointerCapture(e.pointerId);
    seekToPointer(e);
  });
  track.addEventListener('pointermove', (e) => {
    if (dragging) seekToPointer(e);
  });
  const endDrag = () => (dragging = false);
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // ---------- frame strip ----------

  function seekAndWait(v, t) {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        v.removeEventListener('seeked', done);
        resolve();
      };
      const timer = setTimeout(done, 4000);
      v.addEventListener('seeked', done);
      v.currentTime = t;
    });
  }

  async function buildStrip(v) {
    const d = duration(v);
    if (!d || previewing) return;
    previewing = true;
    previewBtn.disabled = true;
    previewBtn.textContent = 'Loading…';

    const wasPaused = v.paused;
    const startTime = v.currentTime;
    v.pause();
    const aspect = v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 9 / 16;
    const frames = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const t = (d * (i + 0.5)) / FRAME_COUNT;
      await seekAndWait(v, t);
      const c = document.createElement('canvas');
      c.height = 160;
      c.width = Math.round(160 * aspect);
      c.dataset.time = String(t);
      c.title = fmt(t);
      // Cross-origin videos taint the canvas, which still displays fine; we never read pixels back.
      try {
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      } catch {}
      c.addEventListener('click', () => {
        if (active === v) seekTo(t);
      });
      frames.push(c);
    }
    await seekAndWait(v, startTime);
    if (!wasPaused) v.play().catch(() => {});

    strips.set(v, { src: v.currentSrc, frames });
    previewing = false;
    previewBtn.disabled = false;
    previewBtn.textContent = 'Preview';
    if (v === active) showStrip();
  }

  function showStrip() {
    const saved = active && strips.get(active);
    // Sites like TikTok reuse one <video> for the next clip; old frames don't apply then.
    if (!saved || saved.src !== active.currentSrc) {
      strip.hidden = true;
      strip.replaceChildren();
      return;
    }
    strip.replaceChildren(...saved.frames);
    strip.hidden = false;
  }

  previewBtn.addEventListener('click', () => active && buildStrip(active));

  // ---------- keyboard ----------

  function isTyping(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.composedPath()[0])) return;
      const k = e.key;
      if (IN_SHEETS_EMBED && k === 'Escape') {
        window.top.postMessage({ rsClose: true }, '*'); // sheets.js closes the popup
        return;
      }
      // In the Sheets popup, A / D seek and the arrows stay with Sheets.
      const back = IN_SHEETS_EMBED ? k === 'a' || k === 'A' : k === 'ArrowLeft';
      const forward = IN_SHEETS_EMBED ? k === 'd' || k === 'D' : k === 'ArrowRight';
      if (back) seekTo(active.currentTime - SEEK_STEP);
      else if (forward) seekTo(active.currentTime + SEEK_STEP);
      else if (k === 's' || k === 'S') cycleSpeed();
      else if (k === 'k' || k === 'K') togglePlay();
      else if (k === 'm' || k === 'M') toggleMute();
      else if (k === 'h' || k === 'H') hidden = !hidden;
      else if (/^[0-9]$/.test(k)) seekTo((duration(active) * Number(k)) / 10);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );

  // ---------- loop ----------

  window.addEventListener(
    'pointermove',
    (e) => {
      pointer = { x: e.clientX, y: e.clientY };
    },
    { capture: true, passive: true }
  );

  function render() {
    if (!active) return;
    const d = duration(active);
    const t = active.currentTime;
    const ratio = d ? clamp(t / d, 0, 1) : 0;
    fillEl.style.width = `${ratio * 100}%`;
    knobEl.style.left = `${ratio * 100}%`;
    timeEl.textContent = `${fmt(t)} / ${fmt(d)}`;
    playBtn.classList.toggle('flip', active.paused);
    const off = soundOf(active) === 'off';
    muteBtn.classList.toggle('flip', off);
    if (root.activeElement !== volSlider) volSlider.value = off ? 0 : active.volume;
    volSlider.title = `Volume ${off ? 0 : Math.round(active.volume * 100)}%`;

    let bufEnd = 0;
    const b = active.buffered;
    for (let i = 0; i < b.length; i++) {
      if (b.start(i) <= t + 0.5 && b.end(i) > bufEnd) bufEnd = b.end(i);
    }
    bufferedEl.style.width = d ? `${clamp(bufEnd / d, 0, 1) * 100}%` : '0';

    if (!strip.hidden && d) {
      const idx = Math.min(FRAME_COUNT - 1, Math.floor(ratio * FRAME_COUNT));
      strip.querySelectorAll('canvas').forEach((c, i) => c.classList.toggle('current', i === idx));
    }
  }

  function place() {
    const r = active.getBoundingClientRect();
    const w = Math.min(Math.max(r.width, 240), innerWidth);
    panel.classList.toggle('compact', w < COMPACT_WIDTH);
    const left = clamp(r.left + (r.width - w) / 2, 0, innerWidth - w);
    const bottom = Math.min(r.bottom, innerHeight);
    host.style.left = `${left}px`;
    host.style.width = `${w}px`;
    host.style.top = `${bottom - panel.offsetHeight}px`;
    const hovering = inside(r, pointer.x, pointer.y) || inside(host.getBoundingClientRect(), pointer.x, pointer.y);
    panel.classList.toggle('dim', !hovering && !dragging);
  }

  function tick(now) {
    if (!dragging && !previewing && now - lastPick > PICK_INTERVAL) {
      lastPick = now;
      setActive(pickVideo());
    }
    // Single-page sites (Instagram) swap the page without reloading; if they ever drop our bar, put it back.
    if (!host.isConnected) document.documentElement.appendChild(host);
    if (active && active.isConnected && !hidden) {
      // Some players reset the rate on their own; keep ours.
      if (!previewing && active.playbackRate !== speed) active.playbackRate = speed;
      syncSound(active);
      if (strips.has(active) && strip.hidden !== (strips.get(active).src !== active.currentSrc)) showStrip();
      host.style.display = 'block';
      place();
      render();
    } else {
      host.style.display = 'none';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

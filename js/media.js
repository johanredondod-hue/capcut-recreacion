'use strict';
/* =========================================================
   media.js — importar archivos, reproducir video/audio,
   efectos de voz, miniaturas, formas de onda y biblioteca.
   ========================================================= */

/* ---------- Audio (WebAudio) ---------- */
let AC = null, recDest = null, masterGain = null, IR = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return AC; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    recDest = AC.createMediaStreamDestination();
    masterGain = AC.createGain(); masterGain.connect(AC.destination); masterGain.connect(recDest);
    S.media.forEach(m => (m.pool || []).forEach(routeEl));
  } catch (e) { AC = null; }
  return AC;
}
function routeEl(el) {
  if (!AC || el._src) return;
  try { el._src = AC.createMediaElementSource(el); el._gain = AC.createGain(); el._gain.connect(masterGain); el._nodes = []; el._fxKey = null; el._src.connect(el._gain); } catch (e) { }
}
const IRS = new WeakMap();
function impulse(ac) {
  if (IRS.has(ac)) return IRS.get(ac);
  const len = ac.sampleRate * 2.4, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (rnd(i * 1.3 + c) * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  IRS.set(ac, ir); return ir;
}
function distCurve(k) { const n = 512, cu = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; cu[i] = (3 + k) * x * 20 * Math.PI / 180 / (Math.PI + k * Math.abs(x)); } return cu; }
/* Construye la cadena de efectos de voz / limpieza de audio. Sirve tanto para la
   reproducción en vivo como para la mezcla sin conexión de la exportación rápida. */
function buildFxChain(ac, input, c, nodes = [], startAt = 0) {
  let node = input;
  const mk = n => { nodes.push(n); return n; };
  const add = n => { node.connect(n); node = mk(n); return n; };
  const biq = (type, f, q = .7, g = 0) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g; return b; };
  if (c.denoise) { add(biq('highpass', 90)); add(biq('lowpass', 9000)); const g = ac.createDynamicsCompressor(); g.threshold.value = -40; g.ratio.value = 2; add(g); }
  if (c.isolate) { add(biq('highpass', 180)); add(biq('lowpass', 4200)); add(biq('peaking', 2500, 1, 4)); }
  if (c.normalize) { const cp = ac.createDynamicsCompressor(); cp.threshold.value = -26; cp.ratio.value = 4; add(cp); const g = ac.createGain(); g.gain.value = 1.7; add(g); }
  const mix = () => mk(ac.createGain());
  switch (c.voice) {
    case 'echo': { const out = mix(), d = mk(ac.createDelay(1)), fb = mk(ac.createGain()), w = mk(ac.createGain()); d.delayTime.value = .28; fb.gain.value = .38; w.gain.value = .55; node.connect(out); node.connect(d); d.connect(fb); fb.connect(d); d.connect(w); w.connect(out); node = out; break; }
    case 'hall': { const out = mix(), cv = mk(ac.createConvolver()), w = mk(ac.createGain()); cv.buffer = impulse(ac); w.gain.value = .5; node.connect(out); node.connect(cv); cv.connect(w); w.connect(out); node = out; break; }
    case 'radio': { add(biq('bandpass', 1500, .9)); const ws = ac.createWaveShaper(); ws.curve = distCurve(25); add(ws); break; }
    case 'phone': { add(biq('highpass', 400)); add(biq('lowpass', 3000)); const ws = ac.createWaveShaper(); ws.curve = distCurve(10); add(ws); break; }
    case 'robot': { const rg = ac.createGain(); rg.gain.value = 0; const o = mk(ac.createOscillator()); o.frequency.value = 55; o.connect(rg.gain); o.start(startAt); add(rg); const g = ac.createGain(); g.gain.value = 1.8; add(g); break; }
    case 'deep': { add(biq('lowshelf', 220, .7, 9)); add(biq('lowpass', 3200)); break; }
    case 'megaphone': { add(biq('bandpass', 1800, 2)); const ws = ac.createWaveShaper(); ws.curve = distCurve(60); add(ws); const g = ac.createGain(); g.gain.value = .7; add(g); break; }
  }
  return node;
}
function applyAudioFx(el, c) {
  if (!el._src) return;
  const key = [c.voice, c.denoise, c.isolate, c.normalize].join('|');
  if (el._fxKey === key) return;
  el._fxKey = key;
  try { el._src.disconnect(); } catch (e) { }
  el._nodes.forEach(n => { try { n.disconnect(); } catch (e) { } try { n.stop && n.stop(); } catch (e) { } });
  el._nodes = [];
  buildFxChain(AC, el._src, c, el._nodes).connect(el._gain);
}
/* Audio decodificado (48 kHz) para la mezcla de la exportación rápida y la reversa */
async function decodedBuffer(m) {
  if (m._abuf) return m._abuf;
  try { m._abuf = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(await m.blob.arrayBuffer()); } catch (e) { m._abuf = null; }
  return m._abuf;
}
/* Usar solo el audio de un video que tengas en tu equipo */
async function audioFromVideoFiles(files, at = S.t) {
  const list = [...files].filter(f => /^(video|audio)\//.test(f.type));
  if (!list.length) return toast('Elige un archivo de video');
  for (const f of list) {
    const m = registerMedia({ name: f.name.replace(/\.[^.]+$/, '') + ' (audio)', type: 'audio', folder: 'extract' }, f);
    await m.readyP;
    if (m.hasAudio === false) { toast(`${f.name} no tiene audio`); continue; }
    addMediaClip(m, { start: at });
  }
  toast('Audio del video añadido a la línea de tiempo');
}

/* ---------- Elementos de reproducción (un "pool" por archivo) ----------
   Varios clips del mismo archivo pueden sonar a la vez (p. ej. en una
   transición entre dos partes del mismo video) sin pelear por un elemento. */
function makeEl(m) {
  const el = m.type === 'video' ? document.createElement('video') : new Audio();
  el.preload = 'auto'; el.playsInline = true; el.src = m.url; el._m = m;
  el.addEventListener('seeked', invalidate); el.addEventListener('loadeddata', invalidate);
  m.pool.push(el); routeEl(el);
  return el;
}
function syncMedia() {
  const T = total(), t = T > 0 && S.t >= T ? T - 1e-3 : S.t, look = S.playing ? .6 : 0;
  for (const m of S.media) if (m.pool) for (const el of m.pool) el._claim = null;
  const want = [];
  for (const c of S.clips) {
    if (!c.mediaId || c.kind === 'image') continue;
    const m = med(c.mediaId); if (!m || !m.ready || m.type === 'image') continue;
    const s = c.start, e = endOf(c);
    if (t >= s && t < e) want.push({ c, m, active: true });
    else if (S.playing && s > t && s - t < look) want.push({ c, m, active: false });
  }
  for (const w of want) if (w.c._el && w.c._el._m === w.m && !w.c._el._claim) { w.el = w.c._el; w.el._claim = w.c; }
  for (const w of want) if (!w.el) { w.el = w.m.pool.find(e => !e._claim) || makeEl(w.m); w.el._claim = w.c; w.c._el = w.el; }
  for (const { c, active, el } of want) {
    const lt = active ? t - c.start : 0, exp = srcTime(c, lt);
    if (active) {
      const tr = trackById(c.trackId);
      let vol = kv(c, 'volume', lt);
      if (c.fadeIn > 0) vol *= clamp(lt / c.fadeIn, 0, 1);
      if (c.fadeOut > 0) vol *= clamp((dur(c) - lt) / c.fadeOut, 0, 1);
      if (!tr || tr.mute || c.detached) vol = 0;
      if (S.exporting && S.exporting.noAudio) vol = 0;
      if (el._gain) { el._gain.gain.value = vol; el.volume = 1; } else el.volume = clamp(vol, 0, 1);
      if (AC) applyAudioFx(el, c);
      el.playbackRate = clamp(rateAt(c, lt), .0625, 16);
      el.preservesPitch = c.pitch !== false;
      if (S.playing) {
        if (el.paused) el.play().catch(() => { });
        if (Math.abs(el.currentTime - exp) > .25) el.currentTime = exp;
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - exp) > .5 / S.fps && !el.seeking) el.currentTime = exp;
      }
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - exp) > .05 && !el.seeking) el.currentTime = exp;
    }
  }
  for (const m of S.media) if (m.pool) for (const el of m.pool) if (!el._claim && !el.paused) el.pause();
}
function pauseAllMedia() { for (const m of S.media) (m.pool || []).forEach(el => { try { el.pause(); } catch (e) { } }); }

/* ---------- Registrar e importar ---------- */
function registerMedia(meta, blob, keepId) {
  const m = { id: keepId || uid(), folder: 'local', ...meta, blob, url: URL.createObjectURL(blob), ready: false, pool: [], saved: !!keepId };
  m.readyP = new Promise(r => (m._resolve = r));
  S.media.push(m); prepMedia(m);
  return m;
}
function setReady(m) { if (m.ready) return; m.ready = true; m._resolve(m); renderLibSoon(); renderTLSoon(); invalidate(); }
function makeThumb(src, w, h, tw = 192, th = 108) {
  const c = document.createElement('canvas'); c.width = tw; c.height = th; const x = c.getContext('2d');
  const k = Math.max(tw / w, th / h); x.drawImage(src, (tw - w * k) / 2, (th - h * k) / 2, w * k, h * k);
  return c.toDataURL('image/jpeg', .7);
}
function prepMedia(m) {
  if (m.type === 'image') {
    const img = new Image();
    img.onload = () => { m.img = img; m.w = img.naturalWidth; m.h = img.naturalHeight; m.duration = Infinity; if (!m.thumb) m.thumb = makeThumb(img, m.w, m.h); setReady(m); };
    img.onerror = () => toast('No se pudo leer ' + m.name);
    img.src = m.url;
  } else if (m.type === 'video') {
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true;
    v.addEventListener('error', () => toast('Formato de video no compatible: ' + m.name), { once: true });
    const once = ev => new Promise(r => v.addEventListener(ev, r, { once: true }));
    (async () => {
      const meta = once('loadedmetadata'); v.src = m.url; await meta;
      m.w = v.videoWidth; m.h = v.videoHeight; m.duration = await realDuration(v);
      if (!(m.duration > 0)) return toast('No se pudo leer la duración de ' + m.name);
      if (m.thumb && m.strip) { setReady(m); v.removeAttribute('src'); v.load(); return; }
      const sk = once('seeked'); v.currentTime = Math.min(.3, m.duration / 3); await sk;
      if (!m.thumb) m.thumb = makeThumb(v, m.w, m.h);
      setReady(m); buildStrip(m, v);
    })();
    if (!m.peaks) analyzeAudio(m);
  } else {
    const a = new Audio(); a.preload = 'metadata';
    a.addEventListener('loadedmetadata', async () => { m.duration = await realDuration(a); if (m.duration > 0) setReady(m); else toast('No se pudo leer la duración de ' + m.name); }, { once: true });
    a.addEventListener('error', () => toast('Formato de audio no compatible: ' + m.name), { once: true });
    a.src = m.url;
    if (!m.peaks) analyzeAudio(m);
  }
}
/* Los WebM grabados en el navegador no traen duración (Infinity): se fuerza a calcularla */
function realDuration(el) {
  return new Promise(res => {
    if (isFinite(el.duration) && el.duration > 0) return res(el.duration);
    let done = false;
    const finish = () => { if (done) return; done = true; el.removeEventListener('durationchange', on); const d = isFinite(el.duration) ? el.duration : 0; el.currentTime = 0; res(d); };
    const on = () => { if (isFinite(el.duration)) finish(); };
    el.addEventListener('durationchange', on); el.currentTime = 1e101; setTimeout(finish, 5000);
  });
}
/* Tira de fotogramas para la línea de tiempo (se genera una sola vez y se guarda) */
async function buildStrip(m, v) {
  if (m.strip) return;
  const N = clamp(Math.ceil(m.duration / 1.5), 4, 48), fh = 54, fw = Math.round(fh * clamp(m.w / m.h, .5, 2.4));
  const c = document.createElement('canvas'); c.width = fw * N; c.height = fh; const x = c.getContext('2d');
  for (let i = 0; i < N; i++) {
    await new Promise(r => { const done = () => { v.removeEventListener('seeked', done); r(); }; v.addEventListener('seeked', done); v.currentTime = (i + .5) * m.duration / N; setTimeout(done, 1500); });
    try { x.drawImage(v, i * fw, 0, fw, fh); } catch (e) { }
  }
  m.strip = c.toDataURL('image/jpeg', .6); m.stripN = N; m.stripFW = fw;
  v.removeAttribute('src'); v.load();
  renderTLSoon(); markDirty();
}
/* Forma de onda (picos) para audio y videos con sonido */
async function analyzeAudio(m) {
  try {
    if (!m.blob || m.blob.size > 300e6) { m.hasAudio = m.type === 'audio'; return; }
    const ab = await m.blob.arrayBuffer();
    const buf = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(ab);
    const rate = 60, n = Math.max(1, Math.ceil(buf.duration * rate)), step = buf.sampleRate / rate, peaks = new Float32Array(n);
    const chs = []; for (let c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    let max = 0;
    for (let i = 0; i < n; i++) {
      let p = 0; const a = Math.floor(i * step), b = Math.min(buf.length, Math.floor((i + 1) * step));
      for (let j = a; j < b; j += 4) for (const d of chs) { const v = Math.abs(d[j]); if (v > p) p = v; }
      peaks[i] = p; if (p > max) max = p;
    }
    m.hasAudio = max > .004;
    if (max > 0) for (let i = 0; i < n; i++) peaks[i] /= max;
    m.peaks = peaks; m.peakRate = rate; m.wave = waveImage(peaks, m.type === 'audio' ? '#7fe3c3' : '#8fd8ff');
  } catch (e) { m.hasAudio = m.type === 'audio'; }
  renderTLSoon(); markDirty();
}
function waveImage(peaks, color) {
  const w = clamp(peaks.length * 2, 200, 8000), h = 64, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = color;
  for (let i = 0; i < w; i++) { const p = peaks[Math.floor(i / w * peaks.length)] || 0, bh = Math.max(1, p * h * .92); x.fillRect(i, (h - bh) / 2, 1, bh); }
  return c.toDataURL('image/png');
}
function importFiles(files, opts = {}) {
  const list = [...files].filter(f => /^(video|audio|image)\//.test(f.type));
  if (!list.length) return toast('Formato no compatible');
  const added = list.map(f => registerMedia({ name: f.name, type: f.type.split('/')[0], folder: 'local' }, f));
  toast(`${added.length} archivo(s) importado(s)`);
  if (opts.addToTimeline) added.forEach(m => m.readyP.then(() => addMediaClip(m, opts)));
  renderLib();
  return added;
}

/* ---------- Biblioteca: fondos generados ---------- */
function genBgCanvas(kind, a, b, label) {
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d');
  const W = 1920, H = 1080;
  if (kind === 'color') { x.fillStyle = a; x.fillRect(0, 0, W, H); }
  else if (kind === 'grad') { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  else {
    x.fillStyle = '#16161a'; x.fillRect(0, 0, W, H);
    if (a === 'grid') { x.strokeStyle = 'rgba(0,200,215,.35)'; x.lineWidth = 2; for (let i = 0; i < W; i += 80) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j < H; j += 80) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); } }
    if (a === 'dots') { x.fillStyle = '#f5f0e6'; x.fillRect(0, 0, W, H); x.fillStyle = '#e0306b'; for (let i = 40; i < W; i += 80) for (let j = 40; j < H; j += 80) { x.beginPath(); x.arc(i, j, 10, 0, 7); x.fill(); } }
    if (a === 'stripes') { for (let i = -H; i < W; i += 120) { x.fillStyle = (i / 120) % 2 ? '#ffcf3f' : '#ff7a59'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 60, 0); x.lineTo(i + 60 + H, H); x.lineTo(i + H, H); x.fill(); } }
    if (a === 'bokeh') { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0b2e'); g.addColorStop(1, '#3a1a5a'); x.fillStyle = g; x.fillRect(0, 0, W, H); for (let i = 0; i < 60; i++) { x.fillStyle = `hsla(${(i * 47) % 360},90%,70%,${.08 + rnd(i) * .2})`; x.beginPath(); x.arc(rnd(i + 1) * W, rnd(i + 2) * H, 30 + rnd(i + 3) * 120, 0, 7); x.fill(); } }
    if (a === 'sunburst') { x.fillStyle = '#ffb020'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffcf3f'; for (let i = 0; i < 24; i += 2) { x.beginPath(); x.moveTo(W / 2, H / 2); x.arc(W / 2, H / 2, W, i * Math.PI / 12, (i + 1) * Math.PI / 12); x.fill(); } }
    if (a === 'paper') { x.fillStyle = '#efe6d2'; x.fillRect(0, 0, W, H); for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(90,70,40,${rnd(i) * .07})`; x.fillRect(rnd(i + .5) * W, rnd(i + .7) * H, 2, 2); } }
  }
  if (label) { x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '700 64px system-ui'; x.textBaseline = 'alphabetic'; x.fillText(label, 84, H - 84); }
  return c;
}
async function addLibraryBg(kind, a, b, name) {
  const libId = `bg:${kind}:${a}:${b || ''}`;
  let m = S.media.find(x => x.libId === libId);
  if (!m) m = registerMedia({ name, type: 'image', folder: 'library', libId }, await canvasBlob(genBgCanvas(kind, a, b), 'image/jpeg', .9));
  await m.readyP; addMediaClip(m, {});
}

/* ---------- Música y efectos de sonido sintetizados (sin conexión) ---------- */
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
/* Un filtro paso bajo compartido por frecuencia (menos nodos = síntesis más rápida) */
function lpBus(oc, out, f) {
  oc._lp ??= {}; if (oc._lp[f]) return oc._lp[f];
  const b = oc.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.connect(out); return (oc._lp[f] = b);
}
function synthNote(oc, out, f, t, d, type, vol, a = .01, lp) {
  const o = oc.createOscillator(), g = oc.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0005, t + d);
  o.connect(g); g.connect(lp ? lpBus(oc, out, lp) : out); o.start(t); o.stop(t + d + .05);
}
function drum(oc, out, kind, t, vol = 1) {
  if (kind === 'kick') { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .15); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g); g.connect(out); o.start(t); o.stop(t + .35); return; }
  const s = oc.createBufferSource(); s.buffer = oc._noise || (oc._noise = noiseBuffer(oc, .3)); const f = oc.createBiquadFilter(), g = oc.createGain();
  f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const d = kind === 'hat' ? .05 : .16; g.gain.setValueAtTime(vol * (kind === 'hat' ? .25 : .55), t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + d + .02);
}
const SONGS = {
  pop: { bpm: 120, prog: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], lead: 'square', pad: 'triangle', mel: [76, 79, 81, 79, 76, 74, 72, 74] },
  lofi: { bpm: 80, prog: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [69, 72, 76, 79]], lead: 'sine', pad: 'triangle', mel: [74, 72, 69, 72, 74, 77, 76, 72], swing: true, lp: 1800 },
  epic: { bpm: 90, prog: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], lead: 'sawtooth', pad: 'sawtooth', mel: [69, 72, 76, 74, 72, 71, 69, 67], lp: 1400, toms: true },
  tropical: { bpm: 104, prog: [[64, 67, 71], [60, 64, 67], [67, 71, 74], [62, 66, 69]], lead: 'square', pad: 'sine', mel: [76, 79, 83, 79, 81, 79, 76, 74], pluck: true },
  hiphop: { bpm: 88, prog: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], lead: 'triangle', pad: 'triangle', mel: [69, 67, 64, 67, 69, 72, 69, 67], swing: true, lp: 2200 },
  edm: { bpm: 128, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], lead: 'sawtooth', pad: 'sawtooth', mel: [81, 81, 79, 76, 81, 84, 83, 79], lp: 3800, four: true }
};
function synthMusic(id) {
  const meta = MUSIC.find(x => x.id === id), sg = SONGS[id], beat = 60 / sg.bpm, secs = meta.dur;
  return renderAudio(secs, oc => {
    const out = oc.createGain(); out.gain.value = .55; out.connect(oc.destination);
    const bars = Math.floor(secs / (beat * 4));
    for (let b = 0; b < bars; b++) {
      const t0 = b * beat * 4, ch = sg.prog[b % sg.prog.length];
      ch.forEach(n => synthNote(oc, out, NOTE(n), t0, beat * 4, sg.pad, .07, .2, sg.lp || 3000));
      for (let i = 0; i < 8; i++) synthNote(oc, out, NOTE(ch[0] - 24), t0 + i * beat / 2, beat / 2 * .9, 'triangle', .22, .01, 600);
      for (let i = 0; i < 8; i++) {
        const sw = sg.swing && i % 2 ? beat * .12 : 0, n = sg.mel[(i + b * 3) % sg.mel.length];
        if (rnd(b * 8 + i) > .25) synthNote(oc, out, NOTE(n), t0 + i * beat / 2 + sw, sg.pluck ? .18 : beat / 2 * .8, sg.lead, sg.lead === 'square' ? .045 : .08, .005, sg.lp || 5000);
      }
      for (let i = 0; i < 4; i++) {
        if (sg.four) { drum(oc, out, 'kick', t0 + i * beat, 1.1); if (i % 2) drum(oc, out, 'snare', t0 + i * beat, .9); }
        else if (sg.toms) { drum(oc, out, 'kick', t0 + i * beat, 1); if (i % 2) drum(oc, out, 'snare', t0 + i * beat, 1.2); }
        else { if (i % 2 === 0 || (id === 'tropical' && i === 3)) drum(oc, out, 'kick', t0 + i * beat, .9); if (i % 2) drum(oc, out, 'snare', t0 + i * beat, id === 'lofi' ? .6 : 1); }
        drum(oc, out, 'hat', t0 + i * beat + beat / 2 + (sg.swing ? beat * .12 : 0), .9); drum(oc, out, 'hat', t0 + i * beat, .6);
      }
    }
    if (id === 'lofi') { const s = oc.createBufferSource(); s.buffer = noiseBuffer(oc, secs); const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; const g = oc.createGain(); g.gain.value = .018; s.connect(f); f.connect(g); g.connect(oc.destination); s.start(0); }
  }, 32000);
}
function synthSfx(id) {
  const meta = SFX.find(x => x.id === id);
  return renderAudio(meta.dur, oc => {
    const out = oc.destination, nz = (d) => { const s = oc.createBufferSource(); s.buffer = noiseBuffer(oc, d); return s; };
    switch (id) {
      case 'whoosh': { const s = nz(.9), f = oc.createBiquadFilter(), g = oc.createGain(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(3500, .45); f.frequency.exponentialRampToValueAtTime(300, .9); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(.9, .4); g.gain.linearRampToValueAtTime(0, .9); s.connect(f); f.connect(g); g.connect(out); s.start(0); break; }
      case 'pop': { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(300, 0); o.frequency.exponentialRampToValueAtTime(1100, .06); g.gain.setValueAtTime(.8, 0); g.gain.exponentialRampToValueAtTime(.001, .2); o.connect(g); g.connect(out); o.start(0); o.stop(.25); break; }
      case 'click': { const s = nz(.02), g = oc.createGain(); g.gain.setValueAtTime(.9, 0); g.gain.exponentialRampToValueAtTime(.001, .02); s.connect(g); g.connect(out); s.start(0); break; }
      case 'ding': synthNote(oc, out, 1318, 0, 1.3, 'sine', .5); synthNote(oc, out, 2637, 0, .9, 'sine', .18); break;
      case 'boom': { const o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(90, 0); o.frequency.exponentialRampToValueAtTime(28, 1.2); g.gain.setValueAtTime(1, 0); g.gain.exponentialRampToValueAtTime(.001, 1.5); o.connect(g); g.connect(out); o.start(0); o.stop(1.6); const s = nz(1), f = oc.createBiquadFilter(), g2 = oc.createGain(); f.type = 'lowpass'; f.frequency.value = 400; g2.gain.setValueAtTime(.7, 0); g2.gain.exponentialRampToValueAtTime(.001, 1); s.connect(f); f.connect(g2); g2.connect(out); s.start(0); break; }
      case 'applause': for (let i = 0; i < 160; i++) { const t = rnd(i) * 2.2, s = nz(.03), f = oc.createBiquadFilter(), g = oc.createGain(); f.type = 'bandpass'; f.frequency.value = 1200 + rnd(i + 9) * 2000; g.gain.setValueAtTime(.35 * (1 - t / 2.5), t); g.gain.exponentialRampToValueAtTime(.001, t + .03); s.connect(f); f.connect(g); g.connect(out); s.start(t); } break;
      case 'shutter': [0, .12].forEach(t => { const s = nz(.05), f = oc.createBiquadFilter(), g = oc.createGain(); f.type = 'highpass'; f.frequency.value = 2000; g.gain.setValueAtTime(.8, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); s.connect(f); f.connect(g); g.connect(out); s.start(t); }); break;
      case 'riser': { const o = oc.createOscillator(), f = oc.createBiquadFilter(), g = oc.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(180, 0); o.frequency.exponentialRampToValueAtTime(1400, 2.1); f.type = 'lowpass'; f.frequency.setValueAtTime(400, 0); f.frequency.exponentialRampToValueAtTime(6000, 2.1); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(.35, 2); g.gain.linearRampToValueAtTime(0, 2.2); o.connect(f); f.connect(g); g.connect(out); o.start(0); o.stop(2.2); break; }
      case 'glitch': for (let i = 0; i < 14; i++) { const t = i * .04, o = oc.createOscillator(), g = oc.createGain(); o.type = 'square'; o.frequency.value = 80 + rnd(i) * 1800; g.gain.setValueAtTime(.18, t); g.gain.setValueAtTime(0, t + .03); o.connect(g); g.connect(out); o.start(t); o.stop(t + .035); } break;
      case 'notif': synthNote(oc, out, 1046, 0, .25, 'sine', .45); synthNote(oc, out, 1568, .12, .5, 'sine', .4); break;
      case 'drumroll': for (let i = 0; i < 44; i++) drum(oc, out, 'snare', i * .045, .25 + i / 44 * .8); drum(oc, out, 'kick', 2.05, 1.2); break;
      case 'laser': { const o = oc.createOscillator(), g = oc.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(2400, 0); o.frequency.exponentialRampToValueAtTime(120, .4); g.gain.setValueAtTime(.35, 0); g.gain.exponentialRampToValueAtTime(.001, .45); o.connect(g); g.connect(out); o.start(0); o.stop(.5); break; }
    }
  });
}
/* Devuelve (y crea una sola vez) el medio generado de la biblioteca */
async function libAudio(kind, id) {
  const libId = kind + ':' + id;
  let m = S.media.find(x => x.libId === libId);
  if (!m) {
    const meta = (kind === 'music' ? MUSIC : SFX).find(x => x.id === id);
    const blob = kind === 'music' ? await synthMusic(id) : await synthSfx(id);
    m = S.media.find(x => x.libId === libId) || registerMedia({ name: meta.name, type: 'audio', folder: kind, libId }, blob);
  }
  return m.readyP;
}
let previewAudio = null;
async function previewLib(kind, id, btn) {
  if (previewAudio && previewAudio._id === id) { previewAudio.pause(); previewAudio = null; btn && (btn.innerHTML = ic('play')); return; }
  if (previewAudio) previewAudio.pause();
  btn && (btn.innerHTML = '…');
  const m = await libAudio(kind, id);
  previewAudio = new Audio(m.url); previewAudio._id = id; previewAudio.play();
  $$('[data-preview]').forEach(b => b.innerHTML = ic('play')); btn && (btn.innerHTML = ic('pause'));
  previewAudio.onended = () => { btn && (btn.innerHTML = ic('play')); previewAudio = null; };
}

/* ---------- Grabar voz en off ---------- */
async function toggleRecord() {
  if (S.recording) return stopRecording();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { return toast('No se pudo acceder al micrófono'); }
  ensureAudio();
  const rec = new MediaRecorder(stream), chunks = [], start = S.t;
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    const n = S.media.filter(m => m.folder === 'record').length + 1;
    const m = registerMedia({ name: `Grabación ${n}`, type: 'audio', folder: 'record' }, blob);
    await m.readyP;
    if (!isFinite(m.duration)) m.duration = Math.max(.5, (performance.now() - S.recording.t0) / 1000);
    S.recording = null; updTools();
    addMediaClip(m, { start });
    toast('Grabación añadida a la línea de tiempo');
  };
  S.recording = { rec, t0: performance.now() };
  rec.start(); play(); updTools(); renderLib(); toast('Grabando… pulsa de nuevo para detener');
}
function stopRecording() { if (!S.recording) return; pause(); S.recording.rec.stop(); }

const renderLibSoon = debounce(() => renderLib(), 120);
const renderTLSoon = debounce(() => renderTL(), 120);

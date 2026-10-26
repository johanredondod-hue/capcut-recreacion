'use strict';
/* =========================================================
   ai.js — funciones "Pro" de IA, gratis y en tu equipo:
   - Voz a texto: subtítulos automáticos (Whisper, transformers.js)
   - Texto a voz: voces naturales en español (Piper / vits-web)
   - Quitar fondo (MediaPipe Selfie Segmenter)
   - Recortar un objeto con un clic y seguirlo (MediaPipe Interactive Segmenter)
   - Detección de ritmo (forma de onda)
   Los modelos se descargan la primera vez desde un CDN y quedan en caché.
   ========================================================= */

const MP_VER = '0.10.14';
let VISION = null;
async function getVision() {
  if (!VISION) VISION = (async () => {
    const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/wasm`);
    return { vision, files };
  })();
  return VISION;
}

/* ---------- Quitar fondo (personas) ---------- */
const SEG = { state: 'idle', seg: null, maskC: null };
function segStateText() {
  return {
    idle: 'Se descarga un modelo pequeño la primera vez. Funciona mejor con personas.',
    loading: 'Cargando modelo de IA…', ready: 'Modelo listo. Funciona mejor con personas.',
    error: 'No se pudo cargar el modelo (¿sin conexión?). Prueba el Croma.'
  }[SEG.state];
}
function updSeg() { const el = $('#rmbgState'); if (el) el.textContent = segStateText(); }
async function loadSegmenter() {
  if (SEG.state === 'ready' || SEG.state === 'loading') return;
  SEG.state = 'loading'; updSeg();
  try {
    const { vision, files } = await getVision();
    SEG.seg = await vision.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', delegate: 'GPU' },
      runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true
    });
    SEG.state = 'ready'; invalidate(); toast('Quitar fondo listo');
  } catch (e) { console.warn('Segmentador:', e); SEG.state = 'error'; toast('No se pudo cargar el modelo para quitar el fondo'); }
  updSeg();
}
function applySegMask(kc, kx, kw, kh) {
  if (SEG.state !== 'ready') { if (SEG.state === 'idle') loadSegmenter(); return; }
  try {
    const r = SEG.seg.segment(kc);
    const masks = r.confidenceMasks || [], mask = masks[masks.length > 1 ? 1 : 0];
    if (!mask) { r.close && r.close(); return; }
    const mw = mask.width, mh = mask.height, data = mask.getAsFloat32Array();
    if (!SEG.maskC) SEG.maskC = document.createElement('canvas');
    const mc = SEG.maskC; if (mc.width !== mw || mc.height !== mh) { mc.width = mw; mc.height = mh; }
    const mx = mc.getContext('2d'), id = mx.createImageData(mw, mh);
    for (let i = 0; i < data.length; i++) id.data[i * 4 + 3] = clamp((data[i] - .3) / .35, 0, 1) * 255;
    mx.putImageData(id, 0, 0);
    kx.globalCompositeOperation = 'destination-in'; kx.drawImage(mc, 0, 0, kw, kh); kx.globalCompositeOperation = 'source-over';
    r.close && r.close();
  } catch (e) { console.warn(e); SEG.state = 'error'; updSeg(); }
}

/* ---------- Recortar un objeto con un clic (zapato, taza, mascota…) ---------- */
const ISEG = { state: 'idle', seg: null, p: null };
function objStateText() {
  return { idle: 'La primera vez se descarga un modelo de IA (~6 MB).', loading: 'Cargando modelo de IA…', ready: '', error: 'No se pudo cargar el modelo (¿sin conexión?).' }[ISEG.state];
}
function updObjState(msg) { const el = $('#objState'); if (el) el.textContent = msg ?? objStateText(); }
function loadISeg() {
  if (ISEG.state === 'ready' || ISEG.state === 'loading') return ISEG.p;
  ISEG.state = 'loading'; updObjState();
  ISEG.p = (async () => {
    try {
      const { vision, files } = await getVision();
      ISEG.seg = await vision.InteractiveSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite', delegate: 'GPU' },
        outputCategoryMask: false, outputConfidenceMasks: true
      });
      ISEG.state = 'ready'; invalidate();
    } catch (e) { console.warn('Segmentador interactivo:', e); ISEG.state = 'error'; toast('No se pudo cargar la IA de objetos'); }
    updObjState();
  })();
  return ISEG.p;
}
/* Máscara del objeto que contiene el punto (x, y) normalizado */
function segmentAt(img, x, y) {
  try {
    const r = ISEG.seg.segment(img, { keypoint: { x: clamp(x, 0, 1), y: clamp(y, 0, 1) } });
    const mk = r.confidenceMasks && r.confidenceMasks[0];
    if (!mk) { r.close && r.close(); return null; }
    const out = { m: mk.getAsFloat32Array().slice(), w: mk.width, h: mk.height };
    r.close && r.close(); return out;
  } catch (e) { console.warn(e); return null; }
}
/* Centro, tamaño y un punto interior de la máscara */
function maskStats(d) {
  const { m, w, h } = d; let n = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x] > .5) { n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (n < w * h * .0015) return null;
  const cx = sx / n, cy = sy / n; let kx = cx, ky = cy;
  if (!(m[Math.round(cy) * w + Math.round(cx)] > .5)) {        // objeto cóncavo: busca el punto interior más cercano al centro
    let best = Infinity;
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) if (m[y * w + x] > .5) { const dd = (x - cx) ** 2 + (y - cy) ** 2; if (dd < best) { best = dd; kx = x; ky = y; } }
  }
  return { x: cx / w, y: cy / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h, kx: kx / w, ky: ky / h };
}
/* Elegir el objeto: el usuario hace clic sobre él en el reproductor */
async function pickObjectAt(c, px, py) {
  const p = canvasToSource(c, px, py); if (!p) return toast('Haz clic dentro del clip');
  commit();
  c.obj = { ...OBJ(), ...(c.obj || {}), pt: { x: p.x, y: p.y, t: c.kind === 'video' ? srcTime(c, localT(c)) : 0 }, track: null };
  afterChange(); toast('Objeto seleccionado. Actívale «Recortar» o «Contorno de luz», o pulsa «Seguir el objeto».', 4500);
  await loadISeg();
  if (ISEG.state === 'ready') {                       // mide el objeto para que los adornos tengan buen tamaño
    const ms = mediaSource(c); if (!ms) return;
    const cnv = document.createElement('canvas'), k = Math.min(1, 384 / Math.max(ms.m.w, ms.m.h)); cnv.width = Math.round(ms.m.w * k); cnv.height = Math.round(ms.m.h * k);
    cnv.getContext('2d').drawImage(ms.src, 0, 0, cnv.width, cnv.height);
    const d = segmentAt(cnv, p.x, p.y), st = d && maskStats(d);
    if (st) { c.obj.size = { w: st.w, h: st.h, x: st.x, y: st.y }; c.obj.pt.x = st.kx; c.obj.pt.y = st.ky; }
    invalidate(); renderProps();
  }
}
/* Seguimiento: recorre el video y guarda dónde está el objeto en cada momento */
async function trackObject(c) {
  if (!c || !c.obj) return toast('Primero selecciona un objeto');
  const m = med(c.mediaId);
  if (m.type !== 'video') { commit(); c.obj.track = [{ t: 0, x: c.obj.size?.x ?? c.obj.pt.x, y: c.obj.size?.y ?? c.obj.pt.y, w: c.obj.size?.w ?? .2, h: c.obj.size?.h ?? .2, kx: c.obj.pt.x, ky: c.obj.pt.y }]; afterChange(); return toast('Listo: en una imagen el objeto no se mueve'); }
  await loadISeg(); if (ISEG.state !== 'ready') return;
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = m.url;
  await new Promise(r => { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 4000); });
  const k = Math.min(1, 384 / Math.max(m.w, m.h)), cw = Math.round(m.w * k), ch = Math.round(m.h * k);
  const cnv = document.createElement('canvas'); cnv.width = cw; cnv.height = ch; const x = cnv.getContext('2d', { willReadFrequently: true });
  const seekTo = t => new Promise(r => { const f = () => { v.removeEventListener('seeked', f); r(); }; v.addEventListener('seeked', f); v.currentTime = t; setTimeout(f, 2500); });
  const step = 1 / 12, t0 = clamp(c.obj.pt.t ?? c.in, c.in, c.out), total = Math.ceil((c.out - c.in) / step) + 1;
  const pts = []; let done = 0; S._trackCancel = false;
  const run = async (from, to, dir) => {
    let cur = { kx: c.obj.pt.x, ky: c.obj.pt.y }, last = null;
    for (let t = from; dir > 0 ? t <= to + 1e-6 : t >= to - 1e-6; t += step * dir) {
      if (S._trackCancel) return;
      await seekTo(clamp(t, 0, m.duration - .01)); x.drawImage(v, 0, 0, cw, ch);
      const d = segmentAt(cnv, cur.kx, cur.ky), st = d && maskStats(d);
      if (st) { last = { t, ...st }; cur = st; } else if (last) last = { ...last, t };
      if (last) pts.push(last);
      done++; if (done % 3 === 0) updObjState(`Siguiendo el objeto… ${Math.min(99, Math.round(done / total * 100))}%`);
    }
  };
  updObjState('Siguiendo el objeto… 0%');
  await run(t0, c.out, 1); await run(t0 - step, c.in, -1);
  v.removeAttribute('src'); v.load();
  if (S._trackCancel) { updObjState('Seguimiento cancelado'); return; }
  if (!pts.length) { updObjState('No se pudo seguir el objeto. Prueba a elegir otro punto.'); return; }
  pts.sort((a, b) => a.t - b.t);
  const sm = pts.map((p, i) => {                       // suavizado para que no tiemble
    const win = pts.slice(Math.max(0, i - 2), i + 3), avg = k2 => win.reduce((s, q) => s + q[k2], 0) / win.length;
    return { t: +p.t.toFixed(3), x: avg('x'), y: avg('y'), w: avg('w'), h: avg('h'), kx: p.kx, ky: p.ky };
  });
  commit(); c.obj.track = sm; afterChange();
  updObjState(`Seguimiento listo: ${sm.length} posiciones.`); toast('Seguimiento listo. Ahora puedes añadir un aro de luz o hacer que un texto lo siga.', 4500);
}
/* Crea una forma (aro de luz, aura…) que sigue al objeto */
function addTrackedShape(c, shape = 'ring') {
  if (!c || !c.obj) return toast('Primero selecciona un objeto');
  const g = c._geo || { w: W * .5, h: H * .5 }, sz = c.obj.size || { w: .25, h: .25 }, k = KS();
  const ow = g.w * sz.w, oh = g.h * sz.h, meta = SHAPES.find(s => s.id === shape);
  const s = addText({}, {
    kind: 'sticker', shape, text: '', name: meta.name, color: meta.color, strokeW: 6, squash: shape === 'ring' ? .32 : .9,
    size: (shape === 'ring' ? ow * .62 : Math.max(ow, oh) * .62) / k, start: c.start, out: dur(c), anim: { in: 'fade', inD: .3, out: 'fade', outD: .3, loop: 'none' }
  });
  s.follow = { id: c.id, scale: true };
  s.y = shape === 'ring' ? (oh * .45) / (H / 2) * 100 : 0;
  afterChange(); toast(`${meta.name} añadido: sigue al objeto`);
}

/* ---------- Texto a voz (voces naturales que funcionan sin internet tras la descarga) ---------- */
let PIPER = null;
async function getPiper() { if (!PIPER) PIPER = import('https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm'); return PIPER; }
async function speak(text, voice, prog) {
  const tts = await getPiper();
  return tts.predict({ text, voiceId: voice }, p => { if (p && p.total) prog && prog(`Descargando voz… ${Math.round(p.loaded / p.total * 100)}%`); });
}
async function ttsToTimeline(text, o = {}) {
  const prog = t => { const el = o.progEl || $('#ttsProg'); if (el) el.textContent = t; };
  text = String(text || '').trim(); if (!text) return toast('Escribe un texto');
  const start = o.start ?? S.t, voice = o.voice || S.ttsVoice;
  prog('Generando voz… (la primera vez se descarga la voz, ~60 MB)');
  try {
    const blob = await speak(text, voice, prog);
    const m = registerMedia({ name: 'Voz: ' + text.slice(0, 28), type: 'audio', folder: 'tts' }, blob); await m.readyP;
    commit();
    const a = newMediaClip(m); a.start = start; S.clips.push(a); placeClip(a);
    if (o.textClip) o.textClip.out = Math.max(o.textClip.out, m.duration);
    if (o.addCaption) addCaptionClips([{ s: start, e: start + m.duration, text }], 'karaoke');
    afterChange(); prog(`Listo: ${fmtDur(m.duration)} de voz añadidos.`); toast('Voz añadida a la línea de tiempo');
    return a;
  } catch (e) { console.warn('TTS:', e); prog('No se pudo generar la voz. La primera vez necesitas internet.'); toast('No se pudo generar la voz'); }
}
async function readAllTexts() {
  const list = S.clips.filter(c => c.kind === 'text' && String(c.text).trim()).sort((a, b) => a.start - b.start);
  if (!list.length) return toast('No hay textos para leer');
  for (const [i, c] of list.entries()) { const el = $('#ttsProg'); if (el) el.textContent = `Leyendo ${i + 1}/${list.length}…`; await ttsToTimeline(c.text, { start: c.start, textClip: c }); }
}

/* ---------- Voz a texto: subtítulos automáticos ---------- */
const ASR = {};
async function getASR(model, prog) {
  if (ASR[model]) return ASR[model];
  const T = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
  T.env.allowLocalModels = false;
  ASR[model] = await T.pipeline('automatic-speech-recognition', model, {
    progress_callback: p => { if (p.status === 'progress' && /onnx/.test(p.file || '')) prog(`Descargando modelo… ${Math.round(p.progress || 0)}%`); }
  });
  return ASR[model];
}
async function decode16k(blob) {
  const buf = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(await blob.arrayBuffer());
  const oc = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * 16000)), 16000), s = oc.createBufferSource();
  s.buffer = buf; s.connect(oc.destination); s.start();
  return (await oc.startRendering()).getChannelData(0);
}
function captionStyle(style) {
  const base = { size: 42, bold: true, wrap: true, maxW: .86, y: 68 };
  switch (style) {
    case 'karaoke': return { ...base, karaoke: true, hl: '#ffd400', strokeOn: true, stroke: '#000000', strokeW: 6 };
    case 'box': return { ...base, karaoke: true, kStyle: 'box', hl: '#ffd400', strokeOn: true, stroke: '#000000', strokeW: 5 };
    case 'yellow': return { ...base, color: '#ffde00', strokeOn: true, stroke: '#000000', strokeW: 7 };
    default: return { ...base, bold: false, bgOn: true, bg: '#000000', bgA: .55 };
  }
}
/* Crea los clips de subtítulo (máx. 7 palabras por clip, con tiempos por palabra) */
function addCaptionClips(segs, style, noSplit) {
  const st = captionStyle(style), trk = newTrack('text');
  for (const sg of segs) {
    const words = sg.text.split(/\s+/).filter(Boolean); if (!words.length) continue;
    const per = (sg.e - sg.s) / words.length, chunks = [];
    if (noSplit) chunks.push(words); else for (let i = 0; i < words.length; i += 7) chunks.push(words.slice(i, i + 7));
    let idx = 0;
    for (const ch of chunks) {
      const s = sg.s + idx * per, len = Math.max(.3, ch.length * per);
      const c = { id: uid(), kind: 'text', in: 0, out: len, start: s, speed: 1, curve: null, name: 'Subtítulo', ...VIS(), ...TXT(), ...st, text: noSplit ? sg.text : ch.join(' '), words: noSplit ? null : ch.map((w, j) => ({ w, s: j * per, e: (j + 1) * per })) };
      c.trackId = trk.id; if (!isFree(trk.id, c.start, endOf(c), c.id)) placeClip(c, trk.id);
      S.clips.push(c); idx += ch.length;
    }
  }
}
async function autoCaptions() {
  const prog = t => { const el = $('#capProg'); if (el) el.textContent = t; };
  const lang = $('#capLang').value, style = $('#capStyle').value, src = $('#capSrc').value, sel = S.sel && clipById(S.sel);
  const model = $('#capModel') ? $('#capModel').value : S.asrModel, translate = $('#capTr') && $('#capTr').checked;
  S.asrModel = model;
  const audible = c => (c.kind === 'audio' || c.kind === 'video') && hasAudio(c) && !c.detached && c.volume > 0 && !(trackById(c.trackId) || {}).mute;
  const clips = src === 'sel' ? (sel && audible(sel) ? [sel] : []) : S.clips.filter(audible);
  if (!clips.length) return toast(src === 'sel' ? 'Selecciona un clip con voz' : 'No hay clips con audio');
  const btn = $('#capGo'); if (btn) btn.disabled = true;
  try {
    prog('Cargando modelo de voz…');
    const asr = await getASR(model, prog), segs = [], cache = new Map();
    for (const [i, c] of clips.entries()) {
      const m = med(c.mediaId); prog(`Transcribiendo ${i + 1}/${clips.length}: ${m.name}…`);
      let pcm = cache.get(m.id); if (!pcm) { pcm = await decode16k(m.blob); cache.set(m.id, pcm); }
      const part = pcm.subarray(Math.floor(c.in * 16000), Math.floor(Math.min(c.out, pcm.length / 16000) * 16000));
      if (part.length < 8000) continue;
      const out = await asr(part, { ...(lang ? { language: lang } : {}), task: translate ? 'translate' : 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
      for (const ch of out.chunks || []) {
        const txt = (ch.text || '').trim();
        if (!txt || /^[\[(♪*].*[\])♪*]$/.test(txt)) continue;      // ignora «[Música]», «(aplausos)», etc.
        const [s, e] = ch.timestamp, ss = c.in + s, ee = Math.min(c.out, c.in + (e ?? s + 2));
        segs.push({ s: tlTimeOf(c, ss), e: tlTimeOf(c, ee), text: txt });
      }
    }
    if (!segs.length) { prog('No se detectó voz.'); return; }
    commit(); addCaptionClips(segs, style); afterChange();
    prog(`Listo: ${segs.length} frases transcritas.`); toast('Subtítulos creados');
  } catch (e) {
    console.warn('Subtítulos:', e);
    prog('No se pudo generar. La primera vez necesitas internet para descargar el modelo.');
  } finally { if (btn) btn.disabled = false; }
}
function manualCaptions() {
  const lines = $('#capText').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return toast('Escribe al menos una línea');
  const d = +$('#capDur').value; commit();
  addCaptionClips(lines.map((l, i) => ({ s: S.t + i * d, e: S.t + (i + 1) * d, text: l })), 'plain', true);
  afterChange(); toast(`${lines.length} subtítulo(s) añadido(s)`);
}

/* ---------- Detección de ritmo ---------- */
function detectBeats(c) {
  const m = med(c.mediaId);
  if (!m || !m.peaks) return toast('Analizando el audio… inténtalo en unos segundos');
  const P = m.peaks, R = m.peakRate || 60, beats = []; let last = -1;
  for (let i = 8; i < P.length; i++) {
    let avg = 0; for (let j = i - 8; j < i; j++) avg += P[j]; avg /= 8;
    const t = i / R;
    if (P[i] > avg * 1.35 && P[i] > .3 && t - last > .28 && P[i] >= P[i - 1]) { if (t >= c.in && t <= c.out) beats.push(+t.toFixed(3)); last = t; }
  }
  commit(); c.beats = beats; afterChange();
  toast(beats.length ? `${beats.length} ritmos detectados` : 'No se encontraron golpes claros');
}

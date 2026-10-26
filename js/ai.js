'use strict';
/* =========================================================
   ai.js — funciones "Pro" de IA, gratis y en tu equipo:
   - Subtítulos automáticos (Whisper vía transformers.js)
   - Quitar fondo (MediaPipe Selfie Segmenter)
   - Detección de ritmo (análisis de la forma de onda)
   Los modelos se descargan la primera vez desde un CDN y luego
   el navegador los guarda en caché.
   ========================================================= */

/* ---------- Quitar fondo ---------- */
const SEG = { state: 'idle', seg: null, maskC: null };
const MP_VER = '0.10.14';
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
    const vision = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/vision_bundle.mjs`);
    const files = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/wasm`);
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

/* ---------- Subtítulos automáticos ---------- */
let ASR = null;
async function getASR(prog) {
  if (ASR) return ASR;
  const T = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');
  T.env.allowLocalModels = false;
  ASR = await T.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
    progress_callback: p => { if (p.status === 'progress' && /onnx/.test(p.file || '')) prog(`Descargando modelo… ${Math.round(p.progress || 0)}%`); }
  });
  return ASR;
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
  const audible = c => (c.kind === 'audio' || c.kind === 'video') && hasAudio(c) && !c.detached && c.volume > 0 && !(trackById(c.trackId) || {}).mute;
  const clips = src === 'sel' ? (sel && audible(sel) ? [sel] : []) : S.clips.filter(audible);
  if (!clips.length) return toast(src === 'sel' ? 'Selecciona un clip con voz' : 'No hay clips con audio');
  const btn = $('#capGo'); if (btn) btn.disabled = true;
  try {
    prog('Cargando modelo de voz…');
    const asr = await getASR(prog), segs = [], cache = new Map();
    for (const [i, c] of clips.entries()) {
      const m = med(c.mediaId); prog(`Transcribiendo ${i + 1}/${clips.length}: ${m.name}…`);
      let pcm = cache.get(m.id); if (!pcm) { pcm = await decode16k(m.blob); cache.set(m.id, pcm); }
      const part = pcm.subarray(Math.floor(c.in * 16000), Math.floor(Math.min(c.out, pcm.length / 16000) * 16000));
      if (part.length < 8000) continue;
      const out = await asr(part, { ...(lang ? { language: lang } : {}), task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
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

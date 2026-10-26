'use strict';
/* =========================================================
   state.js — estado del proyecto, pistas, clips y operaciones
   ---------------------------------------------------------
   S.tracks: lista de pistas de arriba hacia abajo.
     { id, kind:'video'|'text'|'fx'|'audio', main?, mute, hide, lock }
     Las pistas encima de la principal se dibujan de abajo hacia arriba.
   S.clips: todos los segmentos. Campos comunes:
     { id, kind, trackId, start, in, out, speed, curve }
   ========================================================= */

const S = {
  view: 'home', projectId: null, created: 0, name: 'Proyecto sin título',
  ratio: '16:9', fps: 30, bgMode: 'color', bg: '#000000', bgBlur: 24,
  media: [], tracks: [], clips: [], markers: [],
  t: 0, playing: false, zoom: 60, sel: null, selTrans: null,
  tab: 'media', sub: {}, ptab: 0, ptabName: null, psub: {},
  snap: true, magnet: true, exportScale: 1, exporting: null, clipboard: null, recording: null
};
const HIST = { undo: [], redo: [] };
const CLEAN = (k, v) => (k && k[0] === '_') ? undefined : v;

const snapshot = () => JSON.stringify({ tracks: S.tracks, clips: S.clips, markers: S.markers }, CLEAN);
function restore(s) { const o = JSON.parse(s); S.tracks = o.tracks; S.clips = o.clips; S.markers = o.markers || []; }
function commit() { HIST.undo.push(snapshot()); if (HIST.undo.length > 200) HIST.undo.shift(); HIST.redo = []; }
function pushBefore(before) { if (before !== snapshot()) { HIST.undo.push(before); if (HIST.undo.length > 200) HIST.undo.shift(); HIST.redo = []; } }
function undo() { if (!HIST.undo.length) return; HIST.redo.push(snapshot()); restore(HIST.undo.pop()); afterChange(); }
function redo() { if (!HIST.redo.length) return; HIST.undo.push(snapshot()); restore(HIST.redo.pop()); afterChange(); }
function markDirty() { invalidate(); if (typeof scheduleSave === 'function') scheduleSave(); }

/* ---------- Búsquedas ---------- */
const clipById = id => S.clips.find(c => c.id === id);
const med = id => S.media.find(m => m.id === id);
const trackById = id => S.tracks.find(t => t.id === id);
const mainTrack = () => S.tracks.find(t => t.main);
const KIND_TRACK = { video: 'video', image: 'video', text: 'text', sticker: 'text', effect: 'fx', filter: 'fx', adjust: 'fx', audio: 'audio' };
const kindOf = c => KIND_TRACK[c.kind];
const isVisual = c => c.kind === 'video' || c.kind === 'image';
const isTextLike = c => c.kind === 'text' || c.kind === 'sticker';
const isFxLike = c => c.kind === 'effect' || c.kind === 'filter' || c.kind === 'adjust';
const hasAudio = c => c.kind === 'audio' || (c.kind === 'video' && (med(c.mediaId) || {}).hasAudio !== false);
const mains = () => S.clips.filter(c => c.trackId === 'main');

/* ---------- Tiempo: duración, curvas de velocidad ---------- */
function curveSpeed(pts, u) {
  const n = pts.length - 1, x = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), e = (1 - Math.cos((x - i) * Math.PI)) / 2;
  return Math.max(.05, pts[i] * (1 - e) + pts[i + 1] * e);
}
function curveInfo(c) {
  const key = c.curve.join(',') + '|' + c.in + '|' + c.out;
  if (c._ck === key) return c._ci;
  const N = 64, srcLen = c.out - c.in, tab = [0];
  for (let k = 0; k < N; k++) tab.push(tab[k] + srcLen / N / curveSpeed(c.curve, (k + .5) / N));
  c._ck = key; c._ci = { T: tab[N], tab, N, srcLen };
  return c._ci;
}
function dur(c) { return c.curve ? curveInfo(c).T : (c.out - c.in) / (c.speed || 1); }
const endOf = c => c.start + dur(c);
const total = () => S.clips.reduce((m, c) => Math.max(m, endOf(c)), 0);
function srcTime(c, lt) {
  if (!c.curve) return c.in + lt * (c.speed || 1);
  const ci = curveInfo(c); lt = clamp(lt, 0, ci.T);
  let k = 0; while (k < ci.N - 1 && ci.tab[k + 1] < lt) k++;
  const f = (lt - ci.tab[k]) / Math.max(1e-6, ci.tab[k + 1] - ci.tab[k]);
  return c.in + (k + f) / ci.N * ci.srcLen;
}
function rateAt(c, lt) { return c.curve ? curveSpeed(c.curve, (srcTime(c, lt) - c.in) / (c.out - c.in)) : (c.speed || 1); }
/* De tiempo de la fuente a tiempo de la línea de tiempo (para subtítulos y ritmos) */
function tlTimeOf(c, src) {
  if (!c.curve) return c.start + (src - c.in) / (c.speed || 1);
  const ci = curveInfo(c), u = clamp((src - c.in) / ci.srcLen, 0, 1) * ci.N, k = Math.min(ci.N - 1, Math.floor(u));
  return c.start + lerp(ci.tab[k], ci.tab[k + 1], u - k);
}

/* ---------- Propiedades y fotogramas clave ---------- */
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setP(o, p, v) { const ks = p.split('.'), l = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[l] = v; }
function kv(c, prop, lt) {
  const a = c.kf && c.kf[prop];
  if (!a || !a.length) { const v = c[prop]; return v == null ? (prop === 'scale' || prop === 'opacity' || prop === 'volume' ? 1 : 0) : v; }
  if (lt <= a[0].t) return a[0].v;
  for (let i = 0; i < a.length - 1; i++) if (lt < a[i + 1].t) return lerp(a[i].v, a[i + 1].v, smooth((lt - a[i].t) / (a[i + 1].t - a[i].t)));
  return a[a.length - 1].v;
}
const localT = c => clamp(S.t - c.start, 0, dur(c));
const kfAt = (c, prop, lt) => { const a = c.kf && c.kf[prop]; return a ? a.findIndex(k => Math.abs(k.t - lt) < .5 / S.fps) : -1; };
function setKF(c, prop, lt, v) {
  c.kf ??= {}; const a = c.kf[prop] ??= [];
  const i = kfAt(c, prop, lt);
  if (i >= 0) a[i].v = v; else { a.push({ t: lt, v }); a.sort((x, y) => x.t - y.t); }
}
function toggleKF(c, prop) {
  const lt = localT(c), i = kfAt(c, prop, lt);
  if (i >= 0) { const v = kv(c, prop, lt); c.kf[prop].splice(i, 1); if (!c.kf[prop].length) { delete c.kf[prop]; c[prop] = v; } }
  else setKF(c, prop, lt, kv(c, prop, lt));
}
/* Cambia una propiedad respetando los fotogramas clave (como CapCut) */
function setProp(c, p, v) {
  if (KF_PROPS.includes(p) && c.kf && c.kf[p] && c.kf[p].length) setKF(c, p, localT(c), v);
  else setP(c, p, v);
}
function kfTimes(c) { const s = new Set(); if (c.kf) for (const k in c.kf) c.kf[k].forEach(x => s.add(+x.t.toFixed(3))); return [...s].sort((a, b) => a - b); }

/* ---------- Plantillas de clip ---------- */
const VIS = () => ({
  x: 0, y: 0, scale: 1, rot: 0, opacity: 1, flipH: false, flipV: false, blend: 'source-over',
  filter: 'none', filterK: 1, adj: { b: 0, c: 0, s: 0, temp: 0, hue: 0, blur: 0, vig: 0 },
  crop: { l: 0, t: 0, r: 0, b: 0 }, mask: { type: 'none', size: .8, round: 0, angle: 0, invert: false },
  chroma: { on: false, color: '#00ff00', k: .35, soft: .1 }, rmbg: false,
  anim: { in: 'none', inD: .5, out: 'none', outD: .5, loop: 'none', loopD: 1 }, kf: {}, trans: null
});
const AUD = () => ({ volume: 1, fadeIn: 0, fadeOut: 0, voice: 'none', denoise: false, isolate: false, normalize: false, pitch: true, beats: null });
const TXT = () => ({
  text: 'Texto predeterminado', font: 'system-ui', size: 56, color: '#ffffff', bold: false, italic: false, underline: false,
  align: 'center', ls: 0, lh: 1.2, strokeOn: false, stroke: '#000000', strokeW: 6, bgOn: false, bg: '#000000', bgA: .6, bgR: .2,
  shadowOn: false, shadow: '#000000', glowOn: false, glow: '#00e5ff', karaoke: false, hl: '#ffd400', words: null, wrap: false, maxW: .85
});

/* ---------- Pistas ---------- */
function newTrack(kind) {
  const t = { id: uid(), kind, mute: false, hide: false, lock: false };
  if (kind === 'audio') S.tracks.push(t); else S.tracks.unshift(t);
  return t;
}
function isFree(tid, s, e, except) { return !S.clips.some(c => c.trackId === tid && c.id !== except && c.start < e - 1e-3 && endOf(c) > s + 1e-3); }
/* Coloca un clip en una pista libre del tipo correcto o crea una nueva (como CapCut) */
function placeClip(c, prefId) {
  const k = kindOf(c), s = c.start, e = endOf(c), pref = trackById(prefId);
  if (pref && !pref.main && pref.kind === k && isFree(pref.id, s, e, c.id)) { c.trackId = pref.id; return; }
  const list = S.tracks.filter(t => !t.main && t.kind === k);
  if (k !== 'audio') list.reverse();                // las pistas superiores más cercanas a la principal primero
  for (const t of list) if (isFree(t.id, s, e, c.id)) { c.trackId = t.id; return; }
  c.trackId = newTrack(k).id;
}
function cleanupTracks() { S.tracks = S.tracks.filter(t => t.main || S.clips.some(c => c.trackId === t.id)); }

/* La pista principal es magnética: los clips se pegan y las transiciones se solapan */
function layout() {
  let t = 0, prev = null;
  for (const c of S.clips) {
    if (c.trackId !== 'main') continue;
    let td = 0;
    if (S.magnet) {
      if (c.trans && prev) td = Math.max(0, Math.min(c.trans.d, dur(prev) / 2, dur(c) / 2));
      c.start = Math.max(0, t - td);
    } else if (c.trans && prev && Math.abs(c.start - (endOf(prev) - c.trans.d)) < .02) td = c.trans.d;
    c._td = td; t = c.start + dur(c); prev = c;
  }
}
function sortMainByStart() {
  const m = mains().sort((a, b) => a.start - b.start), rest = S.clips.filter(c => c.trackId !== 'main');
  S.clips = [...m, ...rest];
}

/* ---------- Crear clips ---------- */
function newMediaClip(m) {
  const c = { id: uid(), kind: m.type, mediaId: m.id, name: m.name, in: 0, out: m.type === 'image' ? 5 : m.duration, start: 0, speed: 1, curve: null };
  if (m.type !== 'audio') Object.assign(c, VIS());
  if (m.type !== 'image') Object.assign(c, AUD());
  return c;
}
function insertMain(c, index) {
  const ms = mains(); c.trackId = 'main';
  if (index != null && index < ms.length) S.clips.splice(S.clips.indexOf(ms[index]), 0, c);
  else { const last = ms[ms.length - 1]; S.clips.splice(last ? S.clips.indexOf(last) + 1 : 0, 0, c); }
}
function addMediaClip(m, o = {}) {
  if (!m) return;
  if (!m.ready) return toast('El archivo aún se está preparando…');
  commit();
  const c = newMediaClip(m);
  if (m.type === 'audio' || o.overlay || (o.trackId && o.trackId !== 'main')) {
    c.start = Math.max(0, o.start ?? S.t); S.clips.push(c); placeClip(c, o.trackId);
  } else {
    if (!S.magnet) c.start = o.start ?? mains().reduce((x, k) => Math.max(x, endOf(k)), 0);
    insertMain(c, o.index);
    if (!S.magnet) sortMainByStart();
  }
  S.sel = c.id; S.selTrans = null; S.ptab = 0;
  afterChange();
  return c;
}
function addText(style = {}, extra = {}) {
  commit();
  const c = { id: uid(), kind: 'text', in: 0, out: 3, start: S.t, speed: 1, curve: null, name: 'Texto', ...VIS(), ...TXT(), ...style, ...extra };
  if (extra.anim) c.anim = { ...VIS().anim, ...extra.anim };
  S.clips.push(c); placeClip(c, extra.trackId);
  S.sel = c.id; S.selTrans = null; S.ptab = 0; afterChange();
  return c;
}
function addSticker(e) { return addText({}, { kind: 'sticker', text: e, size: 150, name: 'Sticker', anim: { in: 'bounce', inD: .4 } }); }
/* Efectos, filtros y ajustes como segmentos (afectan a todo lo que hay debajo) */
function addFx(kind, fxId, adj) {
  commit();
  const sel = S.sel && clipById(S.sel);
  const span = sel && isVisual(sel) ? [sel.start, dur(sel)] : [S.t, 3];
  const name = kind === 'effect' ? EFFECT_MAP[fxId].name : kind === 'filter' ? FILTER_MAP[fxId].name : 'Ajuste';
  const c = { id: uid(), kind, fxId, name, in: 0, out: span[1], start: span[0], speed: 1, curve: null, k: 1, adj: { b: 0, c: 0, s: 0, temp: 0, hue: 0, blur: 0, vig: 0, ...(adj || {}) } };
  S.clips.push(c); placeClip(c);
  S.sel = c.id; S.selTrans = null; S.ptab = 0; afterChange();
  return c;
}
/* Transición: se guarda en el clip que entra (B) */
function transTarget() {
  if (S.selTrans) return clipById(S.selTrans);
  const s = S.sel && clipById(S.sel), ms = mains();
  if (s && s.trackId === 'main' && ms.indexOf(s) > 0) return s;
  let best = null, bd = Infinity;
  for (let i = 1; i < ms.length; i++) { const d = Math.abs(ms[i].start - S.t); if (d < bd) { bd = d; best = ms[i]; } }
  return best;
}
function setTransition(B, type, d) {
  if (!B) return toast('Necesitas al menos dos clips en la pista principal');
  commit();
  B.trans = type === 'none' ? null : { type, d: d ?? (B.trans ? B.trans.d : .5) };
  S.selTrans = B.trans ? B.id : null; S.sel = null;
  afterChange();
}
function transToAll(type, d) {
  commit(); mains().forEach((c, i) => { if (i > 0) c.trans = type === 'none' ? null : { type, d }; }); afterChange();
  toast('Transición aplicada a todos los clips');
}

/* ---------- Edición ---------- */
function clipAtPlayhead(prefSel = true) {
  const s = prefSel && S.sel && clipById(S.sel);
  if (s && S.t > s.start + .02 && S.t < endOf(s) - .02) return s;
  return mains().find(c => S.t > c.start + .02 && S.t < endOf(c) - .02);
}
function splitKF(a, b, lt) {
  if (!a.kf) return; const ka = {}, kb = {};
  for (const p in a.kf) {
    const v = kv(a, p, lt), arrA = a.kf[p].filter(k => k.t <= lt), arrB = a.kf[p].filter(k => k.t >= lt).map(k => ({ t: k.t - lt, v: k.v }));
    if (!arrA.length || arrA[arrA.length - 1].t < lt - .001) arrA.push({ t: lt, v });
    if (!arrB.length || arrB[0].t > .001) arrB.unshift({ t: 0, v });
    ka[p] = arrA; kb[p] = arrB;
  }
  a.kf = ka; b.kf = kb;
}
function split() {
  const c = clipAtPlayhead(); if (!c) return toast('Coloca el cabezal sobre un clip para dividirlo');
  if (trackById(c.trackId)?.lock) return toast('La pista está bloqueada');
  commit();
  const lt = S.t - c.start, b = JSON.parse(JSON.stringify(c, CLEAN)); b.id = uid();
  if (c.in === 0 && (isTextLike(c) || isFxLike(c))) { c.out = lt; b.out = b.out - lt; }
  else { const cut = srcTime(c, lt); c.out = cut; b.in = cut; }
  b.start = S.t; b.trans = null; b.words = null;
  if (b.anim) { b.anim.in = 'none'; c.anim.out = 'none'; }
  if ('fadeOut' in c) { c.fadeOut = 0; b.fadeIn = 0; }
  if (c.words) { const ws = c.words; c.words = null; b.words = null; void ws; }
  splitKF(c, b, lt);
  S.clips.splice(S.clips.indexOf(c) + 1, 0, b);
  S.sel = b.id; afterChange();
}
/* Q / W: recortar hasta el cabezal */
function trimToPlayhead(side) {
  const c = clipAtPlayhead(); if (!c) return toast('Coloca el cabezal sobre un clip');
  commit();
  const lt = S.t - c.start;
  if (side === 'left') {
    if (c.in === 0 && (isTextLike(c) || isFxLike(c))) { c.out -= lt; } else c.in = srcTime(c, lt);
    if (c.trackId !== 'main' || !S.magnet) c.start = S.t;
  } else {
    if (c.in === 0 && (isTextLike(c) || isFxLike(c))) c.out = lt; else c.out = srcTime(c, lt);
  }
  afterChange();
}
function del(id = S.sel) {
  if (S.selTrans && !id) { const c = clipById(S.selTrans); if (c) { commit(); c.trans = null; S.selTrans = null; afterChange(); } return; }
  const c = clipById(id); if (!c) return toast('Selecciona un clip');
  if (trackById(c.trackId)?.lock) return toast('La pista está bloqueada');
  commit(); S.clips.splice(S.clips.indexOf(c), 1); S.sel = null; afterChange();
}
function duplicate() {
  const c = S.sel && clipById(S.sel); if (!c) return toast('Selecciona un clip');
  commit(); const b = JSON.parse(JSON.stringify(c, CLEAN)); b.id = uid(); b.trans = null;
  if (c.trackId === 'main') { S.clips.splice(S.clips.indexOf(c) + 1, 0, b); if (!S.magnet) { b.start = endOf(c); } }
  else { b.start = endOf(c); S.clips.push(b); placeClip(b, c.trackId); }
  S.sel = b.id; afterChange();
}
function copySel() { const c = S.sel && clipById(S.sel); if (!c) return; S.clipboard = JSON.stringify(c, CLEAN); toast('Copiado'); }
function cutSel() { copySel(); del(); }
function paste() {
  if (!S.clipboard) return; commit();
  const b = JSON.parse(S.clipboard); b.id = uid(); b.trans = null; b.start = S.t;
  if (b.trackId === 'main') { const ms = mains(); const idx = ms.findIndex(c => S.t < c.start + dur(c) / 2); insertMain(b, idx < 0 ? null : idx); if (!S.magnet) sortMainByStart(); }
  else { S.clips.push(b); placeClip(b, b.trackId); }
  S.sel = b.id; afterChange();
}
function extractAudio(c = S.sel && clipById(S.sel)) {
  if (!c || c.kind !== 'video') return toast('Selecciona un clip de video');
  const m = med(c.mediaId); if (m.hasAudio === false) return toast('Este video no tiene audio');
  let am = S.media.find(x => x.srcOf === m.id);
  if (!am) am = registerMedia({ name: m.name.replace(/\.[^.]+$/, '') + ' (audio)', type: 'audio', folder: 'extract', srcOf: m.id }, m.blob);
  const go = () => {
    commit();
    const a = { id: uid(), kind: 'audio', mediaId: am.id, name: am.name, in: c.in, out: c.out, start: c.start, speed: c.speed, curve: c.curve ? [...c.curve] : null, ...AUD(), volume: c.volume };
    S.clips.push(a); placeClip(a); c.volume = 0; c.detached = true;
    S.sel = a.id; afterChange(); toast('Audio separado en una pista nueva');
  };
  am.ready ? go() : am.readyP.then(go);
}
function addMarker() {
  commit();
  const i = S.markers.findIndex(m => Math.abs(m - S.t) < .5 / S.fps);
  if (i >= 0) S.markers.splice(i, 1); else S.markers.push(+S.t.toFixed(3));
  S.markers.sort((a, b) => a - b); afterChange();
}
async function freezeFrame() {
  const c = clipAtPlayhead(false) || (S.sel && clipById(S.sel));
  if (!c || c.kind !== 'video' || !c._el || c._el.readyState < 2) return toast('Coloca el cabezal sobre un video');
  const m = med(c.mediaId), cnv = document.createElement('canvas'); cnv.width = m.w; cnv.height = m.h;
  cnv.getContext('2d').drawImage(c._el, 0, 0, m.w, m.h);
  const fm = registerMedia({ name: 'Fotograma congelado.jpg', type: 'image', folder: 'local' }, await canvasBlob(cnv, 'image/jpeg', .92));
  await fm.readyP;
  if (c.trackId === 'main') {
    if (S.t > c.start + .05 && S.t < endOf(c) - .05) split();
    commit();
    const f = newMediaClip(fm); f.out = 3; Object.assign(f, { x: c.x, y: c.y, scale: c.scale, rot: c.rot, filter: c.filter, adj: { ...c.adj }, crop: { ...c.crop } });
    const ms = mains(), idx = ms.findIndex(x => Math.abs(x.start - S.t) < .03);
    insertMain(f, idx < 0 ? null : idx); S.sel = f.id; afterChange();
  } else addMediaClip(fm, { start: S.t, trackId: c.trackId });
  toast('Fotograma congelado (3 s)');
}
function replaceMedia(c, m) {
  if (!c || !m) return; commit();
  c.mediaId = m.id; c.name = m.name; c.kind = m.type;
  const len = c.out - c.in;
  if (m.type === 'image') { c.in = 0; c.out = len; } else { c.in = 0; c.out = Math.min(len, m.duration); }
  if (m.type === 'video') Object.assign(c, { ...AUD(), ...c, volume: c.volume ?? 1 });
  afterChange(); toast('Clip reemplazado');
}

/* Tras cualquier cambio de estructura */
function afterChange() {
  if (S.sel && !clipById(S.sel)) S.sel = null;
  if (S.selTrans) { const b = clipById(S.selTrans); if (!b || !b.trans) S.selTrans = null; }
  cleanupTracks(); layout();
  S.t = Math.min(S.t, total());
  renderTL(); renderProps(); updTools(); renderMbar(); markDirty();
}

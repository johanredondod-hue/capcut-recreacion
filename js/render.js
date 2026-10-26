'use strict';
/* =========================================================
   render.js — compositor del lienzo
   Orden: fondo → pista principal (con transiciones) → pistas
   superiores de abajo hacia arriba (video, efectos, texto).
   Solo se redibuja cuando algo cambia (invalidate) o al reproducir.
   ========================================================= */

const cv = $('#cv'), ctx = cv.getContext('2d');
const mkCanvas = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
const [buf, bctx] = mkCanvas(), [tmp, tctx] = mkCanvas(), [layerC, lctx] = mkCanvas(), [maskC, mctx] = mkCanvas(), [pixC, pxctx] = mkCanvas();
let W = 1280, H = 720, needDraw = true, drawSerial = 0, DRAWN = [];
const invalidate = () => { needDraw = true; };

function setCanvasSize() {
  const [w, h] = RATIOS[S.ratio] || RATIOS['16:9'];
  W = Math.round(w * S.exportScale / 2) * 2; H = Math.round(h * S.exportScale / 2) * 2;      // pares (necesario para H.264)
  for (const c of [cv, buf, tmp, layerC, maskC]) { c.width = W; c.height = H; }
  const lbl = $('#resLbl'); if (lbl) lbl.textContent = `${S.ratio} · ${S.fps} fps`;
  fitCanvas(); invalidate();
}
function fitCanvas() {
  const st = $('#stage'); if (!st.clientWidth) return;
  const p = isMobile() ? 12 : 28, k = Math.max(.05, Math.min((st.clientWidth - p) / W, (st.clientHeight - p) / H));
  cv.style.width = Math.round(W * k) + 'px'; cv.style.height = Math.round(H * k) + 'px';
}
const KS = () => Math.min(W, H) / 720;            // escala de tamaños según la resolución

/* Patrones precalculados (más rápido que dibujar puntos cada fotograma) */
const NOISE = (() => { const [c, x] = mkCanvas(); c.width = c.height = 256; const id = x.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; })();
const SCAN = (() => { const [c, x] = mkCanvas(); c.width = 4; c.height = 4; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 4, 2); return c; })();

/* ---------- Filtros CSS, ajustes y ruedas de color ---------- */
const IDENT = { brightness: 1, contrast: 1, saturate: 1, grayscale: 0, sepia: 0, invert: 0, 'hue-rotate': 0, blur: 0, opacity: 1 };
function lerpCss(css, k) {
  if (!css || k >= .999) return css || '';
  return css.replace(/([a-z-]+)\(([-\d.]+)(deg|px)?\)/g, (m, f, v, u) => `${f}(${lerp(IDENT[f] ?? 0, +v, k).toFixed(3)}${u || ''})`);
}
function adjCss(a) {
  if (!a) return ''; const p = [];
  if (a.b) p.push(`brightness(${1 + a.b / 100})`);
  if (a.c) p.push(`contrast(${1 + a.c / 100})`);
  if (a.s) p.push(`saturate(${Math.max(0, 1 + a.s / 100)})`);
  if (a.temp > 0) p.push(`sepia(${a.temp / 100 * .4}) saturate(${1 + a.temp / 100 * .25})`);
  if (a.temp < 0) p.push(`hue-rotate(${-a.temp * .18}deg) saturate(${1 + a.temp / 100 * .15}) brightness(${1 - a.temp / 100 * .04})`);
  if (a.hue) p.push(`hue-rotate(${a.hue}deg)`);
  if (a.blur > .1) p.push(`blur(${a.blur * W / 1280}px)`);
  return p.join(' ');
}
/* Ruedas de color (sombras, medios, luces) y curva de tonos con un filtro SVG */
const CC_SVG = (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('width', '0'); s.setAttribute('height', '0'); s.style.position = 'absolute'; s.setAttribute('aria-hidden', 'true'); document.body.appendChild(s); return s; })();
const ccActive = cc => cc && (cc.sh || cc.md || cc.hl || cc.lift !== '#808080' || cc.gamma !== '#808080' || cc.gain !== '#808080');
const hexRGB = h => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
function ccFilter(c) {
  const cc = c.cc; if (!ccActive(cc)) return '';
  const id = 'cc-' + c.id, key = JSON.stringify(cc);
  if (c._ccKey !== key || !document.getElementById(id)) {
    const L = hexRGB(cc.lift), G = hexRGB(cc.gamma), Hh = hexRGB(cc.gain), tables = [[], [], []];
    for (let i = 0; i <= 16; i++) {
      const x = i / 16, ws = (1 - x) * (1 - x), wm = 4 * x * (1 - x), wh = x * x;
      const base = x + .25 * ((cc.sh || 0) * ws + (cc.md || 0) * wm + (cc.hl || 0) * wh) / 100;
      for (let ch = 0; ch < 3; ch++) tables[ch].push(clamp(base + (L[ch] - .5) * .5 * ws + (G[ch] - .5) * .5 * wm + (Hh[ch] - .5) * .5 * wh, 0, 1).toFixed(3));
    }
    let f = document.getElementById(id);
    if (!f) { f = document.createElementNS('http://www.w3.org/2000/svg', 'filter'); f.id = id; f.setAttribute('color-interpolation-filters', 'sRGB'); CC_SVG.appendChild(f); }
    f.innerHTML = `<feComponentTransfer><feFuncR type="table" tableValues="${tables[0].join(' ')}"/><feFuncG type="table" tableValues="${tables[1].join(' ')}"/><feFuncB type="table" tableValues="${tables[2].join(' ')}"/></feComponentTransfer>`;
    c._ccKey = key;
  }
  return `url(#${id})`;
}
function clipCss(c, lt, extraBlur = 0, extraF = '') {
  const parts = [], f = FILTER_MAP[c.filter];
  if (f && f.css) parts.push(lerpCss(f.css, kv(c, 'filterK', lt)));
  if (c.adj) { const a = adjCss({ ...c.adj, b: kv(c, 'adj.b', lt), s: kv(c, 'adj.s', lt), blur: kv(c, 'adj.blur', lt) }); if (a) parts.push(a); }
  const cc = ccFilter(c); if (cc) parts.push(cc);
  if (extraBlur > .1) parts.push(`blur(${extraBlur * W / 1280}px)`);
  if (extraF) parts.push(extraF);
  return parts.join(' ') || 'none';
}
const fontStack = f => f === 'system-ui' ? 'system-ui, "Segoe UI", sans-serif' : `"${f}", system-ui, sans-serif`;

/* ---------- Animaciones de entrada / salida / bucle ---------- */
function animState(c, lt) {
  const d = dur(c), an = c.anim || {}, r = { a: 1, s: 1, dx: 0, dy: 0, rot: 0, blur: 0, chars: 1 };
  const apply = (type, p, dir) => {
    if (!type || type === 'none' || p >= 1) return;
    const e = easeOut(p), q = 1 - e;
    switch (type) {
      case 'fade': r.a *= p; break;
      case 'zoomIn': r.s *= .5 + .5 * e; r.a *= p; break;
      case 'zoomOut': r.s *= 1.5 - .5 * e; r.a *= p; break;
      case 'slideL': r.dx += (dir > 0 ? q : -q) * .6; r.a *= Math.min(1, p * 2); break;
      case 'slideR': r.dx += (dir > 0 ? -q : q) * .6; r.a *= Math.min(1, p * 2); break;
      case 'slideU': r.dy += (dir > 0 ? q : -q) * .5; r.a *= Math.min(1, p * 2); break;
      case 'slideD': r.dy += (dir > 0 ? -q : q) * .5; r.a *= Math.min(1, p * 2); break;
      case 'spin': r.rot += (dir > 0 ? -q : q) * 180; r.s *= .3 + .7 * e; r.a *= p; break;
      case 'bounce': r.s *= easeBack(p); r.a *= Math.min(1, p * 3); break;
      case 'blur': r.blur += q * 26; r.a *= p; break;
      case 'type': r.chars = p; break;
    }
  };
  if (an.in && an.in !== 'none') apply(an.in, clamp(lt / (an.inD || .5), 0, 1), 1);
  if (an.out && an.out !== 'none') apply(an.out, clamp((d - lt) / (an.outD || .5), 0, 1), -1);
  if (an.loop && an.loop !== 'none') {
    const L = an.loopD || 1, lp = (lt % L) / L, w = Math.sin(lp * Math.PI * 2);
    switch (an.loop) {
      case 'pulse': r.s *= 1 + .06 * w; break;
      case 'shake': r.dx += Math.sin(lt * 47) * .007; r.dy += Math.cos(lt * 39) * .007; break;
      case 'float': r.dy += w * .025; break;
      case 'swing': r.rot += w * 8; break;
      case 'flicker': r.a *= Math.sin(lt * 25) > -.4 ? 1 : .3; break;
      case 'rotate': r.rot += lp * 360; break;
    }
  }
  return r;
}

/* ---------- Máscaras ---------- */
function maskPath(mk, w, h, g = ctx) {
  const s = mk.size ?? .8, r = Math.min(w, h) / 2 * s;
  g.beginPath();
  if (mk.invert) g.rect(-w * 3, -h * 3, w * 6, h * 6);
  g.save(); g.rotate((mk.angle || 0) * Math.PI / 180);
  switch (mk.type) {
    case 'line': g.rect(-w * 3, -h * 3, w * 6, h * 3 + (s - .5) * h * 2); break;
    case 'mirror': g.rect(-w * 3, -h * s / 2, w * 6, h * s); break;
    case 'circle': g.moveTo(r, 0); g.arc(0, 0, r, 0, Math.PI * 2); break;
    case 'rect': { const rw = w * s, rh = h * s, rr = Math.min(rw, rh) / 2 * (mk.round || 0); g.moveTo(-rw / 2 + rr, -rh / 2); if (g.roundRect) g.roundRect(-rw / 2, -rh / 2, rw, rh, rr); else g.rect(-rw / 2, -rh / 2, rw, rh); break; }
    case 'heart': heartPath(g, r); break;
    case 'star': for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); break;
  }
  g.restore();
}
function heartPath(g, r, cx = 0, cy = 0) {
  for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); i ? g.lineTo(cx + x * r / 17, cy + y * r / 17) : g.moveTo(cx + x * r / 17, cy + y * r / 17); }
  g.closePath();
}

/* ---------- Objeto seleccionado con IA: punto, seguimiento y máscara ---------- */
function objPoint(c, src) {
  const o = c.obj; if (!o) return null;
  const tr = o.track, sz = o.size;
  if (!tr || !tr.length) return { x: sz ? sz.x : o.pt.x, y: sz ? sz.y : o.pt.y, w: sz ? sz.w : 0, h: sz ? sz.h : 0, kx: o.pt.x, ky: o.pt.y };
  if (src <= tr[0].t) return tr[0];
  for (let i = 0; i < tr.length - 1; i++) if (src < tr[i + 1].t) {
    const a = tr[i], b = tr[i + 1], p = (src - a.t) / Math.max(1e-6, b.t - a.t), near = p < .5 ? a : b;
    return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p), kx: near.kx, ky: near.ky };
  }
  return tr[tr.length - 1];
}
/* Punto de la fuente (0..1) → coordenadas del lienzo según cómo se dibujó el clip */
function geoPoint(g, c, p) {
  const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 };
  let u = (p.x - cr.l) / Math.max(.01, 1 - cr.l - cr.r), v = (p.y - cr.t) / Math.max(.01, 1 - cr.t - cr.b);
  if (c.flipH) u = 1 - u; if (c.flipV) v = 1 - v;
  const lx = (u - .5) * g.w, ly = (v - .5) * g.h, a = g.ang * Math.PI / 180;
  return { x: g.cx + lx * Math.cos(a) - ly * Math.sin(a), y: g.cy + lx * Math.sin(a) + ly * Math.cos(a) };
}
/* Un texto, sticker o imagen que sigue al objeto de otro clip */
function followAnchor(k, t) {
  if (!k.follow) return null;
  const T = clipById(k.follow.id); if (!T || !T._geo || !T.obj || t < T.start || t >= endOf(T)) return null;
  const p = objPoint(T, srcTime(T, t - T.start)), q = geoPoint(T._geo, T, p);
  let s = 1; const t0 = T.obj.track && T.obj.track[0];
  if (k.follow.scale && t0 && t0.w > 0 && p.w > 0) s = clamp(p.w / t0.w, .2, 5);
  return { x: q.x, y: q.y, s };
}
const OBJM = new Map();
function objectMask(c, kc, kw, kh, src) {
  if (ISEG.state !== 'ready') { if (ISEG.state === 'idle') loadISeg(); return null; }
  const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 }, p = objPoint(c, src);
  const kx = ((p.kx ?? p.x) - cr.l) / Math.max(.01, 1 - cr.l - cr.r), ky = ((p.ky ?? p.y) - cr.t) / Math.max(.01, 1 - cr.t - cr.b);
  if (kx < 0 || kx > 1 || ky < 0 || ky > 1) return null;
  const key = `${src.toFixed(3)}|${kw}x${kh}|${kx.toFixed(3)},${ky.toFixed(3)}`;
  let mc = OBJM.get(c.id);
  if (mc && mc._key === key) return mc;
  const data = segmentAt(kc, kx, ky); if (!data) return mc || null;
  if (!mc) { mc = document.createElement('canvas'); OBJM.set(c.id, mc); }
  if (mc.width !== data.w || mc.height !== data.h) { mc.width = data.w; mc.height = data.h; }
  const mx = mc.getContext('2d'), id = mx.createImageData(data.w, data.h);
  for (let i = 0; i < data.m.length; i++) id.data[i * 4 + 3] = clamp((data.m[i] - .35) / .3, 0, 1) * 255;
  mx.putImageData(id, 0, 0); mc._key = key;
  return mc;
}
/* Halo de luz alrededor del objeto (máscara desenfocada, coloreada y sin el interior) */
const [haloC, hctx] = mkCanvas();
function haloOf(mask, color, size, kw, kh) {
  const pad = Math.ceil(size * 2.2) + 2;
  haloC.width = kw + pad * 2; haloC.height = kh + pad * 2;
  hctx.clearRect(0, 0, haloC.width, haloC.height);
  hctx.filter = `blur(${size}px)`; hctx.drawImage(mask, pad, pad, kw, kh); hctx.drawImage(mask, pad, pad, kw, kh); hctx.filter = 'none';
  hctx.globalCompositeOperation = 'source-in'; hctx.fillStyle = color; hctx.fillRect(0, 0, haloC.width, haloC.height);
  hctx.globalCompositeOperation = 'destination-out'; hctx.drawImage(mask, pad, pad, kw, kh);
  hctx.globalCompositeOperation = 'source-over';
  return { c: haloC, pad };
}

/* ---------- Croma, quitar fondo y recorte de objeto (a resolución reducida) ---------- */
const KEYC = new Map();
function needsKey(c) { return (c.chroma && c.chroma.on) || c.rmbg || (c.obj && (c.obj.cut || c.obj.glow)); }
function keyed(c, src, sx, sy, sw, sh, srcT) {
  const maxD = S.exporting ? 900 : 640, k = Math.min(1, maxD / Math.max(sw, sh));
  const kw = Math.max(2, Math.round(sw * k)), kh = Math.max(2, Math.round(sh * k));
  let kc = KEYC.get(c.id); if (!kc) { kc = document.createElement('canvas'); KEYC.set(c.id, kc); }
  if (kc.width !== kw || kc.height !== kh) { kc.width = kw; kc.height = kh; }
  const kx = kc.getContext('2d', { willReadFrequently: true });
  kx.globalCompositeOperation = 'source-over'; kx.clearRect(0, 0, kw, kh); kx.drawImage(src, sx, sy, sw, sh, 0, 0, kw, kh);
  const om = c.obj && (c.obj.cut || c.obj.glow) ? objectMask(c, kc, kw, kh, srcT) : null;
  if (c.chroma && c.chroma.on) {
    const id = kx.getImageData(0, 0, kw, kh), d = id.data, n = parseInt(c.chroma.color.slice(1), 16), kr = n >> 16 & 255, kg = n >> 8 & 255, kb = n & 255;
    const thr = c.chroma.k * .6, soft = Math.max(.01, c.chroma.soft * .5), gDom = kg >= kr && kg >= kb;
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb, dist = Math.sqrt(dr * dr + dg * dg + db * db) / 441.7;
      if (dist < thr) d[i + 3] = 0;
      else { if (dist < thr + soft) d[i + 3] *= (dist - thr) / soft; if (gDom && d[i + 1] > Math.max(d[i], d[i + 2])) d[i + 1] = (d[i + 1] + Math.max(d[i], d[i + 2])) / 2; }
    }
    kx.putImageData(id, 0, 0);
  }
  if (c.rmbg) applySegMask(kc, kx, kw, kh);
  if (om && c.obj.cut) { kx.globalCompositeOperation = c.obj.invert ? 'destination-out' : 'destination-in'; kx.drawImage(om, 0, 0, kw, kh); kx.globalCompositeOperation = 'source-over'; }
  kc._om = om; kc._kw = kw; kc._kh = kh;
  return kc;
}

/* ---------- Geometría de un clip visual en este instante ---------- */
function mediaSource(c) {
  const m = med(c.mediaId); if (!m || !m.w) return null;
  if (m.type === 'video') { const el = c._el; if (!el || el._claim !== c || el.readyState < 2) return null; return { m, src: el }; }
  return m.img ? { m, src: m.img } : null;
}
function visGeom(c, t, mod = {}) {
  const ms = mediaSource(c); if (!ms) return null;
  const { m, src } = ms, lt = t - c.start, A = animState(c, lt);
  const x = kv(c, 'x', lt), y = kv(c, 'y', lt), sc = kv(c, 'scale', lt), rot = kv(c, 'rot', lt), op = kv(c, 'opacity', lt);
  const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 };
  const sx = cr.l * m.w, sy = cr.t * m.h, sw = Math.max(1, m.w * (1 - cr.l - cr.r)), sh = Math.max(1, m.h * (1 - cr.t - cr.b));
  const fol = followAnchor(c, t), fit = Math.min(W / sw, H / sh), kk = sc * A.s * (mod.s ?? 1) * (fol ? fol.s : 1);
  const w = sw * fit * kk * (mod.sx ?? 1), h = sh * fit * kk;
  let cx = (fol ? fol.x : W / 2) + x / 100 * W / 2 + (A.dx + (mod.dx || 0)) * W, cy = (fol ? fol.y : H / 2) + y / 100 * H / 2 + (A.dy + (mod.dy || 0)) * H;
  const ang = rot + A.rot + (mod.rot || 0), srcT = m.type === 'video' ? srcTime(c, lt) : 0;
  if (c.obj && c.obj.reframe) {                     // reencuadre automático: el objeto queda en el centro
    const q = geoPoint({ cx: 0, cy: 0, w, h, ang }, c, objPoint(c, srcT));
    cx = W / 2 - q.x + (A.dx + (mod.dx || 0)) * W; cy = H / 2 - q.y + (A.dy + (mod.dy || 0)) * H;
  }
  return { m, src, lt, A, op, cr, sx, sy, sw, sh, fit, kk, w, h, cx, cy, ang, srcT };
}

/* ---------- Dibujar un clip visual ---------- */
function drawVisual(c, t, mod = {}) {
  const G = visGeom(c, t, mod); if (!G) return;
  const { m, src, A, op, cr, sx, sy, sw, sh, w, h, cx, cy, ang, lt } = G;
  c._geo = { cx, cy, w, h, ang }; c._bb = { cx, cy, w, h, rot: ang, f: drawSerial }; DRAWN.push(c);
  if (S.cropMode === c.id && !S.exporting && !S._noSel) return drawCropMode(c, G);
  let img = src, isx = sx, isy = sy, isw = sw, ish = sh, kc = null;
  if (needsKey(c)) { kc = keyed(c, src, sx, sy, sw, sh, G.srcT); if (!(c.obj && c.obj.glow && !c.obj.cut && !c.chroma.on && !c.rmbg)) { img = kc; isx = 0; isy = 0; isw = kc.width; ish = kc.height; } }
  const feather = c.mask && c.mask.type !== 'none' && (c.mask.feather || 0) > 0;
  const g = feather ? lctx : ctx;
  if (feather) { lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1; lctx.filter = 'none'; lctx.clearRect(0, 0, W, H); }
  g.save();
  if (!feather && mod.clip) { g.beginPath(); mod.clip(g); g.clip(); }
  g.globalAlpha = clamp(op * A.a * (mod.a ?? 1), 0, 1);
  if (!feather && c.blend && c.blend !== 'source-over' && c.trackId !== 'main') g.globalCompositeOperation = c.blend;
  g.translate(cx, cy); g.rotate(ang * Math.PI / 180); g.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
  if (!feather && c.mask && c.mask.type !== 'none') { maskPath(c.mask, w, h, g); g.clip(c.mask.invert ? 'evenodd' : 'nonzero'); }
  g.filter = clipCss(c, lt, A.blur + (mod.blur || 0), mod.f || '');
  g.drawImage(img, isx, isy, isw, ish, -w / 2, -h / 2, w, h);
  g.filter = 'none';
  if (kc && kc._om && c.obj.glow) {                  // contorno de luz alrededor del objeto
    const gs = Math.max(2, (c.obj.glowSize || 14) * kc._kw / 640), hl = haloOf(kc._om, c.obj.glowColor || '#ffd400', gs, kc._kw, kc._kh), sk = w / kc._kw, pp = hl.pad * sk;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(hl.c, -w / 2 - pp, -h / 2 - pp, w + pp * 2, h + pp * 2); g.drawImage(hl.c, -w / 2 - pp, -h / 2 - pp, w + pp * 2, h + pp * 2);
  }
  if (c.adj && c.adj.vig > 0) {
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(0, 0, Math.min(w, h) * .25, 0, 0, Math.max(w, h) * .7);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${c.adj.vig / 100 * .85})`); g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
  }
  g.restore();
  if (feather) {                                     // máscara con borde difuminado
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, W, H); mctx.save();
    mctx.filter = `blur(${c.mask.feather * KS()}px)`; mctx.translate(cx, cy); mctx.rotate(ang * Math.PI / 180); mctx.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
    maskPath(c.mask, w, h, mctx); mctx.fillStyle = '#fff'; mctx.fill(c.mask.invert ? 'evenodd' : 'nonzero'); mctx.restore();
    lctx.globalCompositeOperation = 'destination-in'; lctx.drawImage(maskC, 0, 0); lctx.globalCompositeOperation = 'source-over';
    ctx.save(); if (mod.clip) { ctx.beginPath(); mod.clip(ctx); ctx.clip(); }
    if (c.blend && c.blend !== 'source-over' && c.trackId !== 'main') ctx.globalCompositeOperation = c.blend;
    ctx.drawImage(layerC, 0, 0); ctx.restore();
  }
}
/* Modo recorte: se ve el fotograma completo atenuado y el área recortada con controles */
function drawCropMode(c, G) {
  const { m, src, sx, sy, sw, sh, w, h, cx, cy, ang, cr } = G, fw = w / Math.max(.01, 1 - cr.l - cr.r), fh = h / Math.max(.01, 1 - cr.t - cr.b), k = KS();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang * Math.PI / 180); ctx.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
  ctx.globalAlpha = .3; ctx.drawImage(src, 0, 0, m.w, m.h, -w / 2 - cr.l * fw, -h / 2 - cr.t * fh, fw, fh);
  ctx.globalAlpha = 1; ctx.drawImage(src, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1 * k;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + w * i / 3, -h / 2); ctx.lineTo(-w / 2 + w * i / 3, h / 2); ctx.moveTo(-w / 2, -h / 2 + h * i / 3); ctx.lineTo(w / 2, -h / 2 + h * i / 3); ctx.stroke(); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * k; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#fff'; const hs = 8 * k;
  for (const [px, py] of [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]]) ctx.fillRect(px * w / 2 - hs / 2, py * h / 2 - hs / 2, hs, hs);
  ctx.restore();
  c._crop = { cx, cy, ang, w, h, fw, fh, l: cr.l, t: cr.t, r: cr.r, b: cr.b, flipH: c.flipH, flipV: c.flipV, mw: m.w, mh: m.h };
}
function drawBlurBg(c, t) {
  const ms = mediaSource(c); if (!ms) return;
  const { m, src } = ms, k = Math.max(W / m.w, H / m.h) * 1.15;
  ctx.save(); ctx.filter = `blur(${S.bgBlur * W / 1280}px) brightness(.85)`;
  ctx.drawImage(src, (W - m.w * k) / 2, (H - m.h * k) / 2, m.w * k, m.h * k); ctx.restore();
}

/* ---------- Formas animadas (aro de luz, aura, flecha…) ---------- */
function drawShape(c, lt, size, k) {
  const col = c.color || '#ffd400', th = Math.max(1, (c.strokeW || 6) * k * .7), sq = clamp(c.squash ?? .35, .1, 1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (c.shape) {
    case 'ring': {
      const rx = size, ry = size * sq;
      ctx.shadowColor = col; ctx.shadowBlur = size * .35; ctx.strokeStyle = col; ctx.lineWidth = th * 1.6;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = th * .6;
      ctx.setLineDash([rx * .5, rx * .9]); ctx.lineDashOffset = -lt * rx * 2.2;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      return { w: rx * 2 + th * 4, h: ry * 2 + th * 4 };
    }
    case 'halo': {
      const p = .85 + .15 * Math.sin(lt * 4), rx = size * p, ry = size * Math.max(sq, .6) * p, gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, hexA(col, .0)); gr.addColorStop(.55, hexA(col, .25)); gr.addColorStop(.8, hexA(col, .7)); gr.addColorStop(1, hexA(col, 0));
      ctx.save(); ctx.scale(1, ry / rx); ctx.fillStyle = gr; ctx.globalCompositeOperation = 'lighter'; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return { w: rx * 2, h: ry * 2 };
    }
    case 'pulse': {
      ctx.strokeStyle = col; ctx.lineWidth = th;
      for (let i = 0; i < 3; i++) { const ph = (lt * .8 + i / 3) % 1; ctx.globalAlpha *= 1; ctx.save(); ctx.globalAlpha = clamp((1 - ph) * ctx.globalAlpha, 0, 1); ctx.beginPath(); ctx.ellipse(0, 0, size * ph, size * Math.max(sq, .6) * ph, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      return { w: size * 2, h: size * 2 * Math.max(sq, .6) };
    }
    case 'spark': {
      const s = size * (.75 + .25 * Math.sin(lt * 6)); ctx.rotate(lt * .8); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = size * .4;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * .18 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      return { w: size * 2, h: size * 2 };
    }
    case 'arrow': {
      const dy = Math.sin(lt * 6) * size * .15; ctx.translate(0, dy); ctx.fillStyle = col; ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = size * .1;
      ctx.beginPath(); ctx.moveTo(-size * .22, -size); ctx.lineTo(size * .22, -size); ctx.lineTo(size * .22, -size * .1); ctx.lineTo(size * .55, -size * .1); ctx.lineTo(0, size * .7); ctx.lineTo(-size * .55, -size * .1); ctx.lineTo(-size * .22, -size * .1); ctx.closePath(); ctx.fill();
      return { w: size * 1.2, h: size * 1.9 };
    }
    case 'frame': {
      const fw = size * 2, fh = size * 2 * Math.max(sq * 1.6, .4);
      ctx.strokeStyle = col; ctx.lineWidth = th * 1.4; ctx.shadowColor = col; ctx.shadowBlur = size * .25; ctx.setLineDash([size * .3, size * .12]); ctx.lineDashOffset = -lt * size;
      roundRectPath(-fw / 2, -fh / 2, fw, fh, size * .15); ctx.stroke(); ctx.setLineDash([]);
      return { w: fw + th * 3, h: fh + th * 3 };
    }
    case 'underline': {
      const p = easeOut(lt / .6), L = size * 2; ctx.strokeStyle = col; ctx.lineWidth = th * 2.2; ctx.globalAlpha *= .9;
      ctx.beginPath(); for (let i = 0; i <= 30 * p; i++) { const x = -L / 2 + L * i / 30, y = Math.sin(i / 30 * Math.PI * 2) * size * .05; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      return { w: L + th * 4, h: size * .4 };
    }
    case 'check': {
      const p = clamp(lt / .5, 0, 1), q = clamp((lt - .35) / .4, 0, 1); ctx.strokeStyle = col; ctx.lineWidth = th * 1.6;
      ctx.beginPath(); ctx.arc(0, 0, size * .8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
      if (q > 0) { ctx.beginPath(); ctx.moveTo(-size * .35, 0); const mx = lerp(-size * .35, -size * .08, Math.min(1, q * 2)), my = lerp(0, size * .3, Math.min(1, q * 2)); ctx.lineTo(mx, my); if (q > .5) ctx.lineTo(lerp(-size * .08, size * .4, (q - .5) * 2), lerp(size * .3, -size * .3, (q - .5) * 2)); ctx.stroke(); }
      return { w: size * 1.8, h: size * 1.8 };
    }
  }
  return { w: size, h: size };
}

/* ---------- Texto y stickers ---------- */
function roundRectPath(x, y, w, h, r, g = ctx) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else g.rect(x, y, w, h); }
function layoutText(c) {
  const paras = String(c.text ?? '').split('\n'), space = ctx.measureText(' ').width;
  const maxW = c.wrap ? (c.maxW || .85) * W : Infinity, lines = [], words = [];
  let chars = 0, idx = 0;
  for (const p of paras) {
    const ws = p.split(/ +/); let line = { words: [], width: 0 };
    for (const w of ws) {
      const width = ctx.measureText(w).width, add = line.words.length ? space + width : width;
      if (line.words.length && line.width + add > maxW) { lines.push(line); line = { words: [], width: 0 }; }
      const wd = { w, width, idx: idx++ }; line.words.push(wd); words.push(wd);
      line.width += line.words.length > 1 ? space + width : width; chars += w.length + 1;
    }
    lines.push(line);
  }
  return { lines, words, space, bw: Math.max(1, ...lines.map(l => l.width)), chars };
}
function activeWord(c, lt, n) {
  if (c.words && c.words.length === n) { for (let i = n - 1; i >= 0; i--) if (lt >= c.words[i].s) return i; return -1; }
  return Math.min(n - 1, Math.floor(lt / dur(c) * n));
}
function textFill(c, top, bottom) {
  if (!c.gradOn) return c.color;
  const g = ctx.createLinearGradient(0, top, 0, bottom); g.addColorStop(0, c.color); g.addColorStop(1, c.grad2 || '#ff2a8a'); return g;
}
function paintGlyph(c, str, x, y, size, k, sc, fill) {
  if (c.strokeOn) { ctx.lineWidth = (c.strokeW || 6) * k * sc; ctx.strokeStyle = c.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  if (c.glowOn) { ctx.shadowColor = c.glow; ctx.shadowBlur = size * .45; }
  else if (c.shadowOn) { ctx.shadowColor = hexA(c.shadow, .8); ctx.shadowBlur = size * .12; ctx.shadowOffsetX = ctx.shadowOffsetY = size * .06; }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
}
/* Texto curvo: cada letra sobre un arco */
function drawArcText(c, txt, size, k, sc) {
  const total = Math.max(1, ctx.measureText(txt).width), span = clamp(Math.abs(c.arc), 1, 100) / 100 * Math.PI * 1.2, R = total / span, dir = c.arc > 0 ? 1 : -1;
  const fill = textFill(c, -size, size);
  let acc = -total / 2;
  ctx.textAlign = 'center';
  for (const ch of txt) {
    const cw = ctx.measureText(ch).width, th = (acc + cw / 2) / R;
    ctx.save(); ctx.translate(R * Math.sin(th), dir * (R - R * Math.cos(th))); ctx.rotate(dir * th);
    paintGlyph(c, ch, 0, 0, size, k, sc, fill); ctx.restore(); acc += cw;
  }
  ctx.textAlign = 'left';
  return { w: 2 * R * Math.sin(Math.min(span / 2, Math.PI / 2)) + size, h: R * (1 - Math.cos(Math.min(span / 2, Math.PI))) + size * 1.4 };
}
function drawText(c, t) {
  const lt = t - c.start, A = animState(c, lt), k = KS(), fol = followAnchor(c, t);
  const sc = kv(c, 'scale', lt) * A.s * (fol ? fol.s : 1), size = c.size * k * sc;
  if (size < .5) return;
  const x = kv(c, 'x', lt), y = kv(c, 'y', lt), rot = kv(c, 'rot', lt) + A.rot, op = kv(c, 'opacity', lt) * A.a;
  const cx = (fol ? fol.x : W / 2) + x / 100 * W / 2 + A.dx * W, cy = (fol ? fol.y : H / 2) + y / 100 * H / 2 + A.dy * H;
  ctx.save();
  ctx.globalAlpha = clamp(op, 0, 1);
  if (A.blur > .1) ctx.filter = `blur(${A.blur * k}px)`;
  ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180); ctx.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
  let bbw, bbh;
  if (c.shape) { const r = drawShape(c, lt, size, k); bbw = r.w; bbh = r.h; }
  else {
    ctx.font = `${c.italic ? 'italic ' : ''}${c.bold ? 800 : 500} ${size}px ${fontStack(c.font)}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = ((c.ls || 0) * k * sc) + 'px';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    if (c.arc && !c.wrap && !String(c.text).includes('\n')) {
      let txt = String(c.text ?? ''); if (A.chars < 1) txt = txt.slice(0, Math.floor(txt.length * A.chars));
      const r = drawArcText(c, txt, size, k, sc); bbw = r.w; bbh = r.h;
    } else {
      const L = layoutText(c), lh = size * (c.lh || 1.2), bh = lh * L.lines.length, bw = L.bw, padX = size * .35, padY = size * .18;
      if (c.bgOn) { ctx.fillStyle = hexA(c.bg, c.bgA ?? .6); roundRectPath(-bw / 2 - padX, -bh / 2 - padY, bw + padX * 2, bh + padY * 2, size * (c.bgR ?? .2)); ctx.fill(); }
      const active = c.karaoke ? activeWord(c, lt, L.words.length) : -1, fill = textFill(c, -bh / 2, bh / 2);
      let budget = A.chars < 1 ? Math.floor(L.chars * A.chars) : Infinity;
      L.lines.forEach((ln, li) => {
        let px = c.align === 'left' ? -bw / 2 : c.align === 'right' ? bw / 2 - ln.width : -ln.width / 2;
        const py = -bh / 2 + lh * (li + .5);
        for (const wd of ln.words) {
          if (budget <= 0) break;
          const str = budget < wd.w.length ? wd.w.slice(0, budget) : wd.w; budget -= wd.w.length + 1;
          const on = wd.idx === active; let f = on ? c.hl : fill;
          if (on && c.kStyle === 'box') { ctx.save(); ctx.fillStyle = hexA(c.hl, .9); roundRectPath(px - size * .08, py - size * .58, wd.width + size * .16, size * 1.16, size * .15); ctx.fill(); ctx.restore(); f = '#111111'; }
          paintGlyph(c, str, px, py, size, k, sc, f);
          if (c.underline) { ctx.fillStyle = c.color; ctx.fillRect(px, py + size * .45, wd.width + L.space, Math.max(1, size * .06)); }
          px += wd.width + L.space;
        }
      });
      bbw = bw + padX * 2; bbh = bh + padY * 2;
    }
  }
  ctx.restore();
  c._bb = { cx, cy, w: bbw, h: bbh, rot, f: drawSerial }; DRAWN.push(c);
}

/* ---------- Efectos, filtros y ajustes sobre todo lo de abajo ---------- */
function snapBuf() { bctx.globalCompositeOperation = 'source-over'; bctx.filter = 'none'; bctx.globalAlpha = 1; bctx.clearRect(0, 0, W, H); bctx.drawImage(cv, 0, 0); }
function vignette(a) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function overlay(col, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function channel(col) { tctx.globalCompositeOperation = 'source-over'; tctx.clearRect(0, 0, W, H); tctx.drawImage(buf, 0, 0); tctx.globalCompositeOperation = 'multiply'; tctx.fillStyle = col; tctx.fillRect(0, 0, W, H); tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(buf, 0, 0); return tmp; }
function rgbSplit(off) {
  snapBuf(); ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(channel('#ff0000'), -off, 0); ctx.drawImage(channel('#00ff00'), 0, 0); ctx.drawImage(channel('#0000ff'), off, 0); ctx.restore();
}
function glitchSlices(seed, amt) {
  snapBuf();
  for (let i = 0; i < 7; i++) { const y = rnd(seed + i) * H, h = rnd(seed + i + .3) * H * .08 + 2, dx = (rnd(seed + i + .6) - .5) * W * .1 * amt; ctx.drawImage(buf, 0, y, W, h, dx, y, W, h); }
}
function pixelate(block) {
  if (block < 1.5) return;
  snapBuf(); const pw = Math.max(1, Math.round(W / block)), ph = Math.max(1, Math.round(H / block));
  pixC.width = pw; pixC.height = ph; pxctx.imageSmoothingEnabled = true; pxctx.drawImage(buf, 0, 0, pw, ph);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(pixC, 0, 0, W, H); ctx.restore();
}
function zoomBurst(amt) {
  if (amt <= .01) return; snapBuf(); ctx.save();
  for (let i = 1; i <= 6; i++) { const s = 1 + i * .035 * amt; ctx.globalAlpha = .2; ctx.drawImage(buf, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s); }
  ctx.restore();
}
function fxEffect(id, lt, k, d) {
  const ks = W / 1280;
  switch (id) {
    case 'blur': snapBuf(); ctx.filter = `blur(${10 * k * ks}px)`; ctx.drawImage(buf, 0, 0); break;
    case 'bw': snapBuf(); ctx.filter = `grayscale(${k})`; ctx.drawImage(buf, 0, 0); break;
    case 'vignette': vignette(.8 * k); break;
    case 'cine': { const p = easeOut(lt / .5) * easeOut((d - lt) / .5), bar = Math.max(H * .1, (H - W / 2.39) / 2) * p * k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); break; }
    case 'zoom': { snapBuf(); const s = 1 + .08 * k * Math.abs(Math.sin(lt * Math.PI * 2)); ctx.drawImage(buf, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s); break; }
    case 'shake': { snapBuf(); const a = W * .012 * k, s = 1.05; ctx.drawImage(buf, (W - W * s) / 2 + Math.sin(lt * 53) * a, (H - H * s) / 2 + Math.cos(lt * 41) * a, W * s, H * s); break; }
    case 'mirror': snapBuf(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(buf, 0, 0, W / 2, H, 0, 0, W / 2, H); break;
    case 'split4': snapBuf(); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.drawImage(buf, i * W / 2, j * H / 2, W / 2, H / 2); break;
    case 'kaleido': {
      snapBuf(); const sw = W / 2, sh = H / 2, sx = W / 4, sy = H / 4;
      ctx.drawImage(buf, sx, sy, sw / 2, sh / 2, 0, 0, sw, sh);
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(buf, sx, sy, sw / 2, sh / 2, 0, 0, sw, sh); ctx.restore();
      ctx.save(); ctx.translate(0, H); ctx.scale(1, -1); ctx.drawImage(buf, sx, sy, sw / 2, sh / 2, 0, 0, sw, sh); ctx.restore();
      ctx.save(); ctx.translate(W, H); ctx.scale(-1, -1); ctx.drawImage(buf, sx, sy, sw / 2, sh / 2, 0, 0, sw, sh); ctx.restore();
      break;
    }
    case 'pixel': pixelate(Math.max(4, 22 * k * ks)); break;
    case 'duotone': snapBuf(); ctx.filter = 'grayscale(1) contrast(1.15)'; ctx.drawImage(buf, 0, 0); ctx.filter = 'none'; { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff2f8e'); g.addColorStop(1, '#2a1cff'); ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = k; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); } break;
    case 'zoomburst': zoomBurst(k * (.6 + .4 * Math.abs(Math.sin(lt * 3)))); break;
    case 'ghost': snapBuf(); for (let i = 1; i <= 3; i++) { ctx.globalAlpha = .28 * k; ctx.drawImage(buf, Math.sin(lt * 2.2) * i * 14 * ks, Math.cos(lt * 1.7) * i * 6 * ks); } break;
    case 'flash': overlay('#ffffff', Math.max(0, 1 - ((lt % 1.2) / 1.2) * 4) * .85 * k); break;
    case 'lens': { ctx.globalCompositeOperation = 'screen'; const x = W * (.2 + .6 * (.5 + .5 * Math.sin(lt * .8))), g = ctx.createRadialGradient(x, H * .35, 0, x, H * .35, W * .6); g.addColorStop(0, `rgba(255,150,60,${.65 * k})`); g.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); break; }
    case 'bokeh': {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 22; i++) { const px = (rnd(i) * W + Math.sin(lt * .4 + i) * 30 * ks), py = (rnd(i + .4) * H + Math.cos(lt * .3 + i) * 20 * ks), r = (30 + rnd(i + .8) * 70) * ks, hue = (rnd(i + .2) * 80 + 20) | 0; const g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `hsla(${hue},90%,70%,${.45 * k})`); g.addColorStop(.7, `hsla(${hue},90%,60%,${.2 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2); }
      break;
    }
    case 'sparkle': {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) { const px = rnd(i) * W, py = rnd(i + .5) * H, tw = Math.max(0, Math.sin(lt * 4 + i * 1.7)), r = (3 + rnd(i + .2) * 7) * tw * ks; if (r < .5) continue; ctx.globalAlpha = tw * k; ctx.beginPath(); ctx.moveTo(px, py - r * 3); ctx.lineTo(px + r * .5, py); ctx.lineTo(px, py + r * 3); ctx.lineTo(px - r * .5, py); ctx.closePath(); ctx.moveTo(px - r * 3, py); ctx.lineTo(px, py + r * .5); ctx.lineTo(px + r * 3, py); ctx.lineTo(px, py - r * .5); ctx.closePath(); ctx.fill(); }
      break;
    }
    case 'confetti': {
      const cols = ['#ff4d4f', '#ffd400', '#22c55e', '#06b6d4', '#a855f7', '#ffffff'];
      for (let i = 0; i < 80; i++) { const px = rnd(i) * W + Math.sin(lt * 2 + i) * 20, py = ((rnd(i + .3) * H + lt * H * (.25 + rnd(i + .7) * .35)) % (H + 40)) - 20, s = (6 + rnd(i + .9) * 8) * ks; ctx.save(); ctx.globalAlpha = k; ctx.translate(px, py); ctx.rotate(lt * 3 + i); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-s / 2, -s / 4, s, s / 2); ctx.restore(); }
      break;
    }
    case 'rain': {
      overlay('#0a1020', .15 * k); ctx.strokeStyle = `rgba(200,220,255,${.55 * k})`; ctx.lineWidth = 1.5 * ks; ctx.beginPath();
      for (let i = 0; i < 140; i++) { const sp = .8 + rnd(i + .1) * .6, px = rnd(i) * (W + 60) - 30, py = ((rnd(i + .3) * H + lt * H * 1.6 * sp) % (H + 60)) - 30; ctx.moveTo(px, py); ctx.lineTo(px - 6 * ks, py + 26 * ks * sp); }
      ctx.stroke(); break;
    }
    case 'snow': {
      ctx.fillStyle = `rgba(255,255,255,${.9 * k})`;
      for (let i = 0; i < 100; i++) { const px = rnd(i) * W + Math.sin(lt + i) * 18 * ks, py = ((rnd(i + .4) * H + lt * H * .12 * (.5 + rnd(i + .8))) % (H + 20)) - 10, r = (1.5 + rnd(i + .6) * 3) * ks; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'hearts': {
      for (let i = 0; i < 18; i++) { const sp = .6 + rnd(i) * .6, px = rnd(i + .1) * W + Math.sin(lt * 2 + i) * 25 * ks, py = H + 40 - ((lt * H * .18 * sp + rnd(i + .2) * (H + 80)) % (H + 80)), r = (14 + rnd(i + .5) * 18) * ks; ctx.save(); ctx.globalAlpha = .85 * k; ctx.fillStyle = i % 3 ? '#ff4d7d' : '#ff9ab8'; heartPath(ctx, r, px, py); ctx.fill(); ctx.restore(); }
      break;
    }
    case 'rainbow': snapBuf(); ctx.globalAlpha = k; ctx.filter = `hue-rotate(${(lt * 180) % 360}deg) saturate(1.3)`; ctx.drawImage(buf, 0, 0); break;
    case 'strobe': if (Math.floor(lt * 8) % 2) overlay('#000', .65 * k); break;
    case 'grain': { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .55 * k; ctx.fillStyle = ctx.createPattern(NOISE, 'repeat'); ctx.translate(-rnd(Math.floor(lt * 24)) * 256, -rnd(Math.floor(lt * 24) + .5) * 256); ctx.fillRect(0, 0, W + 256, H + 256); break; }
    case 'scan': ctx.globalAlpha = k; ctx.fillStyle = ctx.createPattern(SCAN, 'repeat'); ctx.fillRect(0, 0, W, H); break;
    case 'vhs': {
      rgbSplit(4 * k * ks);
      ctx.globalAlpha = .7 * k; ctx.fillStyle = ctx.createPattern(SCAN, 'repeat'); ctx.fillRect(0, 0, W, H);
      const by = ((lt * .35) % 1.2 - .1) * H; snapBuf(); ctx.globalAlpha = 1; ctx.drawImage(buf, 0, by, W, H * .05, 10 * k, by, W, H * .05);
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .35 * k; ctx.fillStyle = ctx.createPattern(NOISE, 'repeat'); ctx.translate(-rnd(Math.floor(lt * 24)) * 256, 0); ctx.fillRect(0, 0, W + 256, H);
      break;
    }
    case 'film': {
      snapBuf(); ctx.filter = 'sepia(.6) contrast(1.1) brightness(.95)'; ctx.globalAlpha = k; ctx.drawImage(buf, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1;
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .5 * k; ctx.fillStyle = ctx.createPattern(NOISE, 'repeat'); ctx.translate(-rnd(Math.floor(lt * 18)) * 256, -rnd(Math.floor(lt * 18) + .2) * 256); ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
      vignette(.6 * k); const f = Math.floor(lt * 18); ctx.fillStyle = `rgba(30,20,10,${.5 * k})`; for (let i = 0; i < 2; i++) if (rnd(f + i) > .4) ctx.fillRect(rnd(f + i + .1) * W, 0, 1.5, H);
      break;
    }
    case 'glitch': { const f = Math.floor(lt * 12); if (rnd(f) > .35) { rgbSplit((4 + rnd(f + .1) * 10) * k * ks); glitchSlices(f, k); } break; }
    case 'rgb': rgbSplit((6 + Math.sin(lt * 3) * 3) * k * ks); break;
  }
}
function applyFx(c, t) {
  const lt = t - c.start, k = c.k ?? 1;
  ctx.save();
  if (c.kind === 'filter') { const f = FILTER_MAP[c.fxId]; if (f && f.css) { snapBuf(); ctx.filter = lerpCss(f.css, k); ctx.drawImage(buf, 0, 0); } }
  else if (c.kind === 'adjust') { const css = adjCss(c.adj); if (css) { snapBuf(); ctx.filter = css; ctx.globalAlpha = k; ctx.drawImage(buf, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; } if (c.adj.vig > 0) vignette(c.adj.vig / 100 * .85 * k); }
  else fxEffect(c.fxId, lt, k, dur(c));
  ctx.restore();
}

/* ---------- Transiciones entre clips principales ---------- */
function drawTransition(A, B, p, t, type) {
  const e = smooth(p), R = Math.hypot(W, H) / 2;
  switch (type) {
    case 'black': case 'white': { const col = type === 'black' ? '#000' : '#fff'; if (p < .5) { drawVisual(A, t); overlay(col, p * 2); } else { drawVisual(B, t); overlay(col, (1 - p) * 2); } break; }
    case 'wipeL': drawVisual(A, t); drawVisual(B, t, { clip: x => x.rect(W * (1 - e), 0, W * e + 1, H) }); break;
    case 'wipeR': drawVisual(A, t); drawVisual(B, t, { clip: x => x.rect(0, 0, W * e, H) }); break;
    case 'wipeU': drawVisual(A, t); drawVisual(B, t, { clip: x => x.rect(0, H * (1 - e), W, H * e + 1) }); break;
    case 'wipeD': drawVisual(A, t); drawVisual(B, t, { clip: x => x.rect(0, 0, W, H * e) }); break;
    case 'pushL': drawVisual(A, t, { dx: -e }); drawVisual(B, t, { dx: 1 - e }); break;
    case 'pushR': drawVisual(A, t, { dx: e }); drawVisual(B, t, { dx: -(1 - e) }); break;
    case 'pushU': drawVisual(A, t, { dy: -e }); drawVisual(B, t, { dy: 1 - e }); break;
    case 'slide': drawVisual(A, t); drawVisual(B, t, { dx: 1 - e }); break;
    case 'zoomIn': drawVisual(B, t, { s: .7 + .3 * e }); drawVisual(A, t, { s: 1 + e * .8, a: 1 - e }); break;
    case 'zoomOut': drawVisual(A, t, { s: 1 - .4 * e }); drawVisual(B, t, { s: 1.8 - .8 * e, a: e }); break;
    case 'spin': drawVisual(B, t); drawVisual(A, t, { rot: e * 360, s: 1 - e, a: 1 - e * .4 }); break;
    case 'shrink': drawVisual(B, t); drawVisual(A, t, { s: 1 - e }); break;
    case 'blur': if (p < .5) drawVisual(A, t, { blur: p * 2 * 30 }); else drawVisual(B, t, { blur: (1 - p) * 2 * 30 }); break;
    case 'circle': drawVisual(A, t); drawVisual(B, t, { clip: x => x.arc(W / 2, H / 2, e * R + .5, 0, Math.PI * 2) }); break;
    case 'heart': drawVisual(A, t); drawVisual(B, t, { clip: x => heartPath(x, e * R * 1.6 + .5, W / 2, H / 2) }); break;
    case 'clock': drawVisual(A, t); drawVisual(B, t, { clip: x => { x.moveTo(W / 2, H / 2); x.arc(W / 2, H / 2, R * 1.2, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2 + .001); x.closePath(); } }); break;
    case 'blinds': drawVisual(A, t); drawVisual(B, t, { clip: x => { const n = 10, sw = W / n; for (let i = 0; i < n; i++) x.rect(i * sw, 0, sw * e + .5, H); } }); break;
    case 'diag': drawVisual(A, t); drawVisual(B, t, { clip: x => { const d = (W + H) * e; x.moveTo(0, 0); x.lineTo(d, 0); x.lineTo(0, d); x.closePath(); } }); break;
    case 'doors': drawVisual(B, t); drawVisual(A, t, { dx: -e * .5, clip: x => x.rect(-e * W / 2, 0, W / 2, H) }); drawVisual(A, t, { dx: e * .5, clip: x => x.rect(W / 2 + e * W / 2, 0, W / 2, H) }); break;
    case 'splitV': drawVisual(B, t); drawVisual(A, t, { dy: -e * .5, clip: x => x.rect(0, -e * H / 2, W, H / 2) }); drawVisual(A, t, { dy: e * .5, clip: x => x.rect(0, H / 2 + e * H / 2, W, H / 2) }); break;
    case 'bounceIn': drawVisual(A, t, { s: 1 - e * .1 }); drawVisual(B, t, { dy: -(1 - easeBack(p)) }); break;
    case 'cube': drawVisual(A, t, { sx: Math.max(.001, 1 - e), dx: -e / 2, f: `brightness(${1 - e * .5})` }); drawVisual(B, t, { sx: Math.max(.001, e), dx: (1 - e) / 2, f: `brightness(${.5 + e * .5})` }); break;
    case 'pixelate': if (p < .5) { drawVisual(A, t); pixelate(1 + p * 2 * 40 * W / 1280); } else { drawVisual(B, t); pixelate(1 + (1 - p) * 2 * 40 * W / 1280); } break;
    case 'zoomblur': if (p < .5) { drawVisual(A, t, { s: 1 + p * .6 }); zoomBurst(p * 2.4); } else { drawVisual(B, t, { s: 1 + (1 - p) * .6 }); zoomBurst((1 - p) * 2.4); } break;
    case 'glitch': { const f = Math.floor(t * 24), amt = Math.sin(p * Math.PI); if (p < .5) drawVisual(A, t, { dx: (rnd(f) - .5) * .06 * amt }); else drawVisual(B, t, { dx: (rnd(f) - .5) * .06 * amt }); ctx.save(); rgbSplit(12 * amt * W / 1280); glitchSlices(f, amt); ctx.restore(); break; }
    default: drawVisual(A, t); drawVisual(B, t, { a: e });
  }
}

/* ---------- Fotograma completo ---------- */
function draw() {
  drawSerial++; DRAWN = [];
  const T = total(); let t = S.t; if (T > 0 && t >= T) t = T - 1e-3;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = S.bgMode === 'color' ? S.bg : '#000'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const at = c => t >= c.start && t < endOf(c);
  const mt = mainTrack(), act = mains().filter(at).sort((a, b) => a.start - b.start);
  if (S.bgMode === 'blur' && act[0]) drawBlurBg(act[act.length - 1], t);
  if (mt && !mt.hide && act.length) {
    if (act.length >= 2) { const B = act[act.length - 1], A = act[act.length - 2]; if (B.trans && B._td > 0) drawTransition(A, B, clamp((t - B.start) / B._td, 0, 1), t, B.trans.type); else drawVisual(B, t); }
    else drawVisual(act[0], t);
  }
  const mi = S.tracks.findIndex(tr => tr.main);
  for (let i = mi - 1; i >= 0; i--) {
    const tr = S.tracks[i]; if (tr.hide) continue;
    for (const c of S.clips) {
      if (c.trackId !== tr.id || !at(c)) continue;
      if (tr.kind === 'video') drawVisual(c, t); else if (tr.kind === 'text') drawText(c, t); else if (tr.kind === 'fx') applyFx(c, t);
    }
  }
  if (!S.exporting && !S._noSel) drawSelection(t);
  $('#emptyMsg').hidden = S.clips.length > 0;
}
function selBox(c, k, main) {
  const b = c._bb;
  ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(b.rot * Math.PI / 180);
  ctx.strokeStyle = main ? '#ffffff' : 'rgba(0,200,215,.9)'; ctx.lineWidth = 1.5 * k; ctx.setLineDash([6 * k, 5 * k]); ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.setLineDash([]);
  if (main) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.4)';
    for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(px * b.w / 2, py * b.h / 2, 6 * k, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, b.h / 2); ctx.lineTo(0, b.h / 2 + 26 * k); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, b.h / 2 + 32 * k, 7 * k, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function drawSelection(t) {
  const k = KS();
  for (const id of S.msel) { const c = clipById(id); if (c && c.id !== S.sel && c._bb && c._bb.f === drawSerial) selBox(c, k, false); }
  const s = S.sel && clipById(S.sel); if (!s || !s._bb || s._bb.f !== drawSerial || S.cropMode === s.id) return;
  selBox(s, k, true);
  if (s.obj && s._geo && isVisual(s)) {               // punto del objeto seguido
    const p = geoPoint(s._geo, s, objPoint(s, srcTime(s, t - s.start)));
    ctx.save(); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(p.x, p.y, 10 * k, 0, 7); ctx.moveTo(p.x - 16 * k, p.y); ctx.lineTo(p.x + 16 * k, p.y); ctx.moveTo(p.x, p.y - 16 * k); ctx.lineTo(p.x, p.y + 16 * k); ctx.stroke(); ctx.restore();
  }
}
/* ¿Qué hay bajo el puntero? Primero los controles del seleccionado */
function hitTest(px, py) {
  const k = KS(), local = (c) => { const b = c._bb, a = -b.rot * Math.PI / 180, dx = px - b.cx, dy = py - b.cy; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; };
  const s = S.sel && clipById(S.sel);
  if (s && s._bb && s._bb.f === drawSerial) {
    const [lx, ly] = local(s), b = s._bb, r = 14 * k;
    if (Math.hypot(lx, ly - (b.h / 2 + 32 * k)) < r) return { c: s, h: 'rot' };
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (Math.hypot(lx - sx * b.w / 2, ly - sy * b.h / 2) < r) return { c: s, h: 'scale' };
  }
  for (let i = DRAWN.length - 1; i >= 0; i--) {
    const c = DRAWN[i], tr = trackById(c.trackId); if (tr && tr.lock) continue;
    const [lx, ly] = local(c); if (Math.abs(lx) <= c._bb.w / 2 && Math.abs(ly) <= c._bb.h / 2) return { c, h: null };
  }
  return null;
}
/* Coordenadas del lienzo → punto normalizado de la fuente de un clip (para elegir un objeto) */
function canvasToSource(c, px, py) {
  const g = c._geo; if (!g) return null;
  const a = -g.ang * Math.PI / 180, dx = px - g.cx, dy = py - g.cy;
  let u = (dx * Math.cos(a) - dy * Math.sin(a)) / g.w + .5, v = (dx * Math.sin(a) + dy * Math.cos(a)) / g.h + .5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  if (c.flipH) u = 1 - u; if (c.flipV) v = 1 - v;
  const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 };
  return { x: cr.l + u * (1 - cr.l - cr.r), y: cr.t + v * (1 - cr.t - cr.b) };
}

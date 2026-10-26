'use strict';
/* =========================================================
   render.js — compositor del lienzo
   Orden: fondo → pista principal (con transiciones) → pistas
   superiores de abajo hacia arriba (video, efectos, texto).
   Solo se redibuja cuando algo cambia (invalidate) o al reproducir.
   ========================================================= */

const cv = $('#cv'), ctx = cv.getContext('2d');
const buf = document.createElement('canvas'), bctx = buf.getContext('2d');
const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
let W = 1280, H = 720, needDraw = true, drawSerial = 0, DRAWN = [];
const invalidate = () => { needDraw = true; };

function setCanvasSize() {
  const [w, h] = RATIOS[S.ratio] || RATIOS['16:9'];
  W = cv.width = buf.width = tmp.width = Math.round(w * S.exportScale);
  H = cv.height = buf.height = tmp.height = Math.round(h * S.exportScale);
  const lbl = $('#resLbl'); if (lbl) lbl.textContent = `${S.ratio} · ${S.fps} fps`;
  fitCanvas(); invalidate();
}
function fitCanvas() {
  const st = $('#stage'); if (!st.clientWidth) return;
  const p = isMobile() ? 12 : 28, k = Math.max(.05, Math.min((st.clientWidth - p) / W, (st.clientHeight - p) / H));
  cv.style.width = Math.round(W * k) + 'px'; cv.style.height = Math.round(H * k) + 'px';
}

/* Patrones precalculados (más rápido que dibujar puntos cada fotograma) */
const NOISE = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), id = x.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; })();
const SCAN = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 4, 2); return c; })();

/* ---------- Filtros CSS ---------- */
const IDENT = { brightness: 1, contrast: 1, saturate: 1, grayscale: 0, sepia: 0, invert: 0, 'hue-rotate': 0, blur: 0, opacity: 1 };
function lerpCss(css, k) {
  if (!css || k >= .999) return css || '';
  return css.replace(/([a-z-]+)\(([-\d.]+)(deg|px)?\)/g, (m, f, v, u) => `${f}(${lerp(IDENT[f] ?? 0, +v, k).toFixed(3)}${u || ''})`);
}
function adjCss(a) {
  if (!a) return ''; const p = [];
  if (a.b) p.push(`brightness(${1 + a.b / 100})`);
  if (a.c) p.push(`contrast(${1 + a.c / 100})`);
  if (a.s) p.push(`saturate(${1 + a.s / 100})`);
  if (a.temp > 0) p.push(`sepia(${a.temp / 100 * .4}) saturate(${1 + a.temp / 100 * .25})`);
  if (a.temp < 0) p.push(`hue-rotate(${-a.temp * .18}deg) saturate(${1 + a.temp / 100 * .15}) brightness(${1 - a.temp / 100 * .04})`);
  if (a.hue) p.push(`hue-rotate(${a.hue}deg)`);
  if (a.blur) p.push(`blur(${a.blur * W / 1280}px)`);
  return p.join(' ');
}
function clipCss(c, extraBlur = 0) {
  const parts = [], f = FILTER_MAP[c.filter];
  if (f && f.css) parts.push(lerpCss(f.css, c.filterK ?? 1));
  const a = adjCss(c.adj); if (a) parts.push(a);
  if (extraBlur > .1) parts.push(`blur(${extraBlur * W / 1280}px)`);
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
function maskPath(mk, w, h) {
  const s = mk.size ?? .8, r = Math.min(w, h) / 2 * s;
  ctx.beginPath();
  if (mk.invert) ctx.rect(-w * 3, -h * 3, w * 6, h * 6);
  ctx.save(); ctx.rotate((mk.angle || 0) * Math.PI / 180);
  switch (mk.type) {
    case 'line': ctx.rect(-w * 3, -h * 3, w * 6, h * 3 + (s - .5) * h * 2); break;
    case 'mirror': ctx.rect(-w * 3, -h * s / 2, w * 6, h * s); break;
    case 'circle': ctx.moveTo(r, 0); ctx.arc(0, 0, r, 0, Math.PI * 2); break;
    case 'rect': { const rw = w * s, rh = h * s, rr = Math.min(rw, rh) / 2 * (mk.round || 0); ctx.moveTo(-rw / 2 + rr, -rh / 2); if (ctx.roundRect) ctx.roundRect(-rw / 2, -rh / 2, rw, rh, rr); else ctx.rect(-rw / 2, -rh / 2, rw, rh); break; }
    case 'heart': for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); i ? ctx.lineTo(x * r / 17, y * r / 17) : ctx.moveTo(x * r / 17, y * r / 17); } ctx.closePath(); break;
    case 'star': for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); break;
  }
  ctx.restore();
}

/* ---------- Croma y quitar fondo (a resolución reducida para ir rápido) ---------- */
const KEYC = new Map();
function keyed(c, src, sx, sy, sw, sh) {
  const maxD = S.exporting ? 1280 : 640, k = Math.min(1, maxD / Math.max(sw, sh));
  const kw = Math.max(2, Math.round(sw * k)), kh = Math.max(2, Math.round(sh * k));
  let kc = KEYC.get(c.id); if (!kc) { kc = document.createElement('canvas'); KEYC.set(c.id, kc); }
  if (kc.width !== kw || kc.height !== kh) { kc.width = kw; kc.height = kh; }
  const kx = kc.getContext('2d', { willReadFrequently: true });
  kx.globalCompositeOperation = 'source-over'; kx.clearRect(0, 0, kw, kh); kx.drawImage(src, sx, sy, sw, sh, 0, 0, kw, kh);
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
  return kc;
}

/* ---------- Dibujar un clip visual ---------- */
function mediaSource(c) {
  const m = med(c.mediaId); if (!m || !m.w) return null;
  if (m.type === 'video') { const el = c._el; if (!el || el._claim !== c || el.readyState < 2) return null; return { m, src: el }; }
  return m.img ? { m, src: m.img } : null;
}
function drawVisual(c, t, mod = {}) {
  const ms = mediaSource(c); if (!ms) return;
  const { m, src } = ms, lt = t - c.start, A = animState(c, lt);
  const x = kv(c, 'x', lt), y = kv(c, 'y', lt), sc = kv(c, 'scale', lt), rot = kv(c, 'rot', lt), op = kv(c, 'opacity', lt);
  const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 };
  const sx = cr.l * m.w, sy = cr.t * m.h, sw = Math.max(1, m.w * (1 - cr.l - cr.r)), sh = Math.max(1, m.h * (1 - cr.t - cr.b));
  const fit = Math.min(W / sw, H / sh), k = sc * A.s * (mod.s ?? 1), w = sw * fit * k, h = sh * fit * k;
  const cx = W / 2 + x / 100 * W / 2 + (A.dx + (mod.dx || 0)) * W, cy = H / 2 + y / 100 * H / 2 + (A.dy + (mod.dy || 0)) * H;
  const ang = rot + A.rot + (mod.rot || 0);
  let img = src, isx = sx, isy = sy, isw = sw, ish = sh;
  if ((c.chroma && c.chroma.on) || c.rmbg) { const kc = keyed(c, src, sx, sy, sw, sh); img = kc; isx = 0; isy = 0; isw = kc.width; ish = kc.height; }
  ctx.save();
  if (mod.clip) { ctx.beginPath(); mod.clip(ctx); ctx.clip(); }
  ctx.globalAlpha = clamp(op * A.a * (mod.a ?? 1), 0, 1);
  if (c.blend && c.blend !== 'source-over' && c.trackId !== 'main') ctx.globalCompositeOperation = c.blend;
  ctx.filter = clipCss(c, A.blur + (mod.blur || 0));
  ctx.translate(cx, cy); ctx.rotate(ang * Math.PI / 180); ctx.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
  if (c.mask && c.mask.type !== 'none') { maskPath(c.mask, w, h); ctx.clip(c.mask.invert ? 'evenodd' : 'nonzero'); }
  ctx.drawImage(img, isx, isy, isw, ish, -w / 2, -h / 2, w, h);
  if (c.adj && c.adj.vig > 0) {
    ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(0, 0, Math.min(w, h) * .25, 0, 0, Math.max(w, h) * .7);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${c.adj.vig / 100 * .85})`); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
  c._bb = { cx, cy, w, h, rot: ang, f: drawSerial }; DRAWN.push(c);
}
function drawBlurBg(c, t) {
  const ms = mediaSource(c); if (!ms) return;
  const { m, src } = ms, k = Math.max(W / m.w, H / m.h) * 1.15;
  ctx.save(); ctx.filter = `blur(${S.bgBlur * W / 1280}px) brightness(.85)`;
  ctx.drawImage(src, (W - m.w * k) / 2, (H - m.h * k) / 2, m.w * k, m.h * k); ctx.restore();
}

/* ---------- Texto y stickers ---------- */
function roundRectPath(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else ctx.rect(x, y, w, h); }
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
function drawText(c, t) {
  const lt = t - c.start, A = animState(c, lt), k = Math.min(W, H) / 720;
  const sc = kv(c, 'scale', lt) * A.s, size = c.size * k * sc;
  if (size < .5) return;
  const x = kv(c, 'x', lt), y = kv(c, 'y', lt), rot = kv(c, 'rot', lt) + A.rot, op = kv(c, 'opacity', lt) * A.a;
  const cx = W / 2 + x / 100 * W / 2 + A.dx * W, cy = H / 2 + y / 100 * H / 2 + A.dy * H;
  ctx.save();
  ctx.globalAlpha = clamp(op, 0, 1);
  if (A.blur > .1) ctx.filter = `blur(${A.blur * k}px)`;
  ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180); ctx.scale(c.flipH ? -1 : 1, c.flipV ? -1 : 1);
  ctx.font = `${c.italic ? 'italic ' : ''}${c.bold ? 800 : 500} ${size}px ${fontStack(c.font)}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = ((c.ls || 0) * k * sc) + 'px';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const L = layoutText(c), lh = size * (c.lh || 1.2), bh = lh * L.lines.length, bw = L.bw, padX = size * .35, padY = size * .18;
  if (c.bgOn) { ctx.fillStyle = hexA(c.bg, c.bgA ?? .6); roundRectPath(-bw / 2 - padX, -bh / 2 - padY, bw + padX * 2, bh + padY * 2, size * (c.bgR ?? .2)); ctx.fill(); }
  const active = c.karaoke ? activeWord(c, lt, L.words.length) : -1;
  let budget = A.chars < 1 ? Math.floor(L.chars * A.chars) : Infinity;
  L.lines.forEach((ln, li) => {
    let px = c.align === 'left' ? -bw / 2 : c.align === 'right' ? bw / 2 - ln.width : -ln.width / 2;
    const py = -bh / 2 + lh * (li + .5);
    for (const wd of ln.words) {
      if (budget <= 0) break;
      const str = budget < wd.w.length ? wd.w.slice(0, budget) : wd.w; budget -= wd.w.length + 1;
      const on = wd.idx === active;
      if (c.strokeOn) { ctx.lineWidth = (c.strokeW || 6) * k * sc; ctx.strokeStyle = c.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, px, py); }
      if (c.glowOn) { ctx.shadowColor = c.glow; ctx.shadowBlur = size * .45; }
      else if (c.shadowOn) { ctx.shadowColor = hexA(c.shadow, .8); ctx.shadowBlur = size * .12; ctx.shadowOffsetX = ctx.shadowOffsetY = size * .06; }
      ctx.fillStyle = on ? c.hl : c.color;
      if (on && c.kStyle === 'box') { ctx.save(); ctx.shadowColor = 'transparent'; ctx.fillStyle = hexA(c.hl, .9); roundRectPath(px - size * .08, py - size * .58, wd.width + size * .16, size * 1.16, size * .15); ctx.fill(); ctx.restore(); ctx.fillStyle = '#111111'; }
      ctx.fillText(str, px, py);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      if (c.underline) { ctx.fillStyle = c.color; ctx.fillRect(px, py + size * .45, wd.width + L.space, Math.max(1, size * .06)); }
      px += wd.width + L.space;
    }
  });
  ctx.restore();
  c._bb = { cx, cy, w: bw + padX * 2, h: bh + padY * 2, rot, f: drawSerial }; DRAWN.push(c);
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
function fxEffect(id, lt, k, d) {
  switch (id) {
    case 'blur': snapBuf(); ctx.filter = `blur(${10 * k * W / 1280}px)`; ctx.drawImage(buf, 0, 0); break;
    case 'bw': snapBuf(); ctx.filter = `grayscale(${k})`; ctx.drawImage(buf, 0, 0); break;
    case 'vignette': vignette(.8 * k); break;
    case 'cine': { const p = easeOut(lt / .5) * easeOut((d - lt) / .5), bar = Math.max(H * .1, (H - W / 2.39) / 2) * p * k; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar); break; }
    case 'zoom': { snapBuf(); const s = 1 + .08 * k * Math.abs(Math.sin(lt * Math.PI * 2)); ctx.drawImage(buf, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s); break; }
    case 'shake': { snapBuf(); const a = W * .012 * k, s = 1.05; ctx.drawImage(buf, (W - W * s) / 2 + Math.sin(lt * 53) * a, (H - H * s) / 2 + Math.cos(lt * 41) * a, W * s, H * s); break; }
    case 'mirror': snapBuf(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(buf, 0, 0, W / 2, H, 0, 0, W / 2, H); break;
    case 'split4': snapBuf(); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.drawImage(buf, i * W / 2, j * H / 2, W / 2, H / 2); break;
    case 'flash': overlay('#ffffff', Math.max(0, 1 - ((lt % 1.2) / 1.2) * 4) * .85 * k); break;
    case 'lens': { ctx.globalCompositeOperation = 'screen'; const x = W * (.2 + .6 * (.5 + .5 * Math.sin(lt * .8))), g = ctx.createRadialGradient(x, H * .35, 0, x, H * .35, W * .6); g.addColorStop(0, `rgba(255,150,60,${.65 * k})`); g.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); break; }
    case 'sparkle': {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) { const px = rnd(i) * W, py = rnd(i + .5) * H, tw = Math.max(0, Math.sin(lt * 4 + i * 1.7)), r = (3 + rnd(i + .2) * 7) * tw * W / 1280; if (r < .5) continue; ctx.globalAlpha = tw * k; ctx.beginPath(); ctx.moveTo(px, py - r * 3); ctx.lineTo(px + r * .5, py); ctx.lineTo(px, py + r * 3); ctx.lineTo(px - r * .5, py); ctx.closePath(); ctx.moveTo(px - r * 3, py); ctx.lineTo(px, py + r * .5); ctx.lineTo(px + r * 3, py); ctx.lineTo(px, py - r * .5); ctx.closePath(); ctx.fill(); }
      break;
    }
    case 'confetti': {
      const cols = ['#ff4d4f', '#ffd400', '#22c55e', '#06b6d4', '#a855f7', '#ffffff'];
      for (let i = 0; i < 80; i++) { const px = rnd(i) * W + Math.sin(lt * 2 + i) * 20, py = ((rnd(i + .3) * H + lt * H * (.25 + rnd(i + .7) * .35)) % (H + 40)) - 20, s = (6 + rnd(i + .9) * 8) * W / 1280; ctx.save(); ctx.globalAlpha = k; ctx.translate(px, py); ctx.rotate(lt * 3 + i); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-s / 2, -s / 4, s, s / 2); ctx.restore(); }
      break;
    }
    case 'rainbow': snapBuf(); ctx.globalAlpha = k; ctx.filter = `hue-rotate(${(lt * 180) % 360}deg) saturate(1.3)`; ctx.drawImage(buf, 0, 0); break;
    case 'strobe': if (Math.floor(lt * 8) % 2) overlay('#000', .65 * k); break;
    case 'grain': { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .55 * k; ctx.fillStyle = ctx.createPattern(NOISE, 'repeat'); ctx.translate(-rnd(Math.floor(lt * 24)) * 256, -rnd(Math.floor(lt * 24) + .5) * 256); ctx.fillRect(0, 0, W + 256, H + 256); break; }
    case 'scan': ctx.globalAlpha = k; ctx.fillStyle = ctx.createPattern(SCAN, 'repeat'); ctx.fillRect(0, 0, W, H); break;
    case 'vhs': {
      rgbSplit(4 * k * W / 1280);
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
    case 'glitch': { const f = Math.floor(lt * 12); if (rnd(f) > .35) { rgbSplit((4 + rnd(f + .1) * 10) * k * W / 1280); glitchSlices(f, k); } break; }
    case 'rgb': rgbSplit((6 + Math.sin(lt * 3) * 3) * k * W / 1280); break;
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
  const e = smooth(p);
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
    case 'circle': drawVisual(A, t); drawVisual(B, t, { clip: x => x.arc(W / 2, H / 2, e * Math.hypot(W, H) / 2 + .5, 0, Math.PI * 2) }); break;
    case 'blinds': drawVisual(A, t); drawVisual(B, t, { clip: x => { const n = 10, sw = W / n; for (let i = 0; i < n; i++) x.rect(i * sw, 0, sw * e + .5, H); } }); break;
    case 'diag': drawVisual(A, t); drawVisual(B, t, { clip: x => { const d = (W + H) * e; x.moveTo(0, 0); x.lineTo(d, 0); x.lineTo(0, d); x.closePath(); } }); break;
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
  if (!S.exporting && !S._noSel) drawSelection();
  $('#emptyMsg').hidden = S.clips.length > 0;
}
function drawSelection() {
  const s = S.sel && clipById(S.sel); if (!s || !s._bb || s._bb.f !== drawSerial) return;
  const b = s._bb, k = Math.min(W, H) / 720;
  ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(b.rot * Math.PI / 180);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * k; ctx.setLineDash([6 * k, 5 * k]); ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.setLineDash([]);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.4)';
  for (const [px, py] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(px * b.w / 2, py * b.h / 2, 6 * k, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, b.h / 2); ctx.lineTo(0, b.h / 2 + 26 * k); ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, b.h / 2 + 32 * k, 7 * k, 0, 7); ctx.fill();
  ctx.restore();
}
/* ¿Qué hay bajo el puntero? Primero los controles del seleccionado */
function hitTest(px, py) {
  const k = Math.min(W, H) / 720, local = (c) => { const b = c._bb, a = -b.rot * Math.PI / 180, dx = px - b.cx, dy = py - b.cy; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; };
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

'use strict';
/* =========================================================
   app.js — reproducción, interacción con el lienzo, teclado,
   menús y arranque.
   ========================================================= */

/* ---------- Reproducción ---------- */
function play() { if (!S.clips.length) return; ensureAudio(); if (S.t >= total() - .01) S.t = 0; S.playing = true; updPlayBtn(); }
function pause() { S.playing = false; updPlayBtn(); invalidate(); }
function toggle() { S.playing ? pause() : play(); }
function seek(t) { S.t = clamp(t, 0, total()); invalidate(); }
function updPlayBtn() { const b = $('#btnPlay'); if (b) b.innerHTML = ic(S.playing ? 'pause' : 'play'); }

let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
  if (S.view === 'editor' && !(S.exporting && S.exporting.fast)) {
    if (S.playing) {
      S.t += dt;
      const T = total();
      if (S.t >= T && !S.recording) { S.t = T; if (S.exporting) finishExport(); else pause(); }
      followPlayhead();
    }
    syncMedia();
    if (S.playing || needDraw) { draw(); needDraw = false; }
    updTime();
    if (S.exporting && !S.exporting.fast) updExportProgress();
  }
  requestAnimationFrame(loop);
}

/* ---------- Mover, escalar y girar en el reproductor ---------- */
function syncTransformInputs(c) {
  const lt = localT(c);
  for (const p of ['x', 'y', 'scale', 'rot']) {
    const inp = $(`#props input[data-p="${p}"]`); if (!inp) continue;
    const k = +inp.dataset.k || 1, v = +(kv(c, p, lt) * k).toFixed(1); inp.value = v;
    const l = $(`#props [data-v="${p}"]`); if (l) l.textContent = v + (inp.dataset.u || '');
  }
}
function canvasPoint(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
/* ---------- Elegir un objeto con IA: el siguiente clic en el reproductor ---------- */
function startPickObject(c = S.sel && clipById(S.sel)) {
  if (!c || !isVisual(c)) return toast('Selecciona un video o una imagen');
  if (S.sel !== c.id) selectClip(c.id);
  S._pickObj = c.id; S.cropMode = null; cv.classList.add('pick'); loadISeg();
  if (isMobile()) closeSheets();
  toast('Toca o haz clic sobre el objeto en el reproductor', 4000);
}
/* ---------- Recorte en pantalla (asas en las esquinas y bordes) ---------- */
function setCropMode(on) {
  const c = S.sel && clipById(S.sel);
  S.cropMode = on && c && isVisual(c) ? c.id : null;
  cv.classList.toggle('pick', false); renderProps(); invalidate();
  if (S.cropMode) toast('Arrastra las esquinas o los bordes. Pulsa «Listo» o Enter al terminar.');
}
function applyCropRatio(c, r) {
  S.cropRatio = r; const m = med(c.mediaId); if (!m || r === 'free') return;
  commit();
  if (r === 'orig') { c.crop = { l: 0, t: 0, r: 0, b: 0 }; afterChange(); return; }
  const [a, b] = r.split(':').map(Number), want = a / b, src = m.w / m.h;
  let cw = 1, ch = 1; if (want > src) ch = src / want; else cw = want / src;
  c.crop = { l: (1 - cw) / 2, r: (1 - cw) / 2, t: (1 - ch) / 2, b: (1 - ch) / 2 }; afterChange();
}
function cropPointer(e, c) {
  const g = c._crop; if (!g) return false;
  const [px, py] = canvasPoint(e), toUV = (qx, qy) => {
    const a = -g.ang * Math.PI / 180, dx = qx - g.cx, dy = qy - g.cy;
    let lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (g.flipH) lx = -lx; if (g.flipV) ly = -ly;
    return [(lx + g.w / 2) / g.fw + g.l, (ly + g.h / 2) / g.fh + g.t];
  };
  const [u0, v0] = toUV(px, py), tolU = 16 * KS() / g.fw, tolV = 16 * KS() / g.fh, o = { ...c.crop };
  const R = 1 - o.r, B = 1 - o.b;
  const near = { l: Math.abs(u0 - o.l) < tolU, r: Math.abs(u0 - R) < tolU, t: Math.abs(v0 - o.t) < tolV, b: Math.abs(v0 - B) < tolV };
  const inside = u0 > o.l && u0 < R && v0 > o.t && v0 < B, anyEdge = near.l || near.r || near.t || near.b;
  if (!anyEdge && !inside) { setCropMode(false); return true; }
  const before = snapshot(), lock = S.cropRatio !== 'free', MIN = .05;
  cv.setPointerCapture(e.pointerId); e.preventDefault();
  const mv = ev => {
    const [qx, qy] = canvasPoint(ev), [u, v] = toUV(qx, qy), du = u - u0, dv = v - v0, n = { ...o };
    if (!anyEdge || lock && !anyEdge) {            // mover la ventana de recorte
      const w = R - o.l, h = B - o.t, l = clamp(o.l + du, 0, 1 - w), t = clamp(o.t + dv, 0, 1 - h);
      Object.assign(n, { l, r: 1 - l - w, t, b: 1 - t - h });
    } else if (lock) {                             // escalar manteniendo la proporción
      const cxu = (o.l + R) / 2, cyv = (o.t + B) / 2, s = clamp(Math.max(Math.abs(u - cxu) / ((R - o.l) / 2), Math.abs(v - cyv) / ((B - o.t) / 2)), .1, 10);
      let hw = (R - o.l) / 2 * s, hh = (B - o.t) / 2 * s; const fit = Math.min(1, cxu / hw, (1 - cxu) / hw, cyv / hh, (1 - cyv) / hh); hw *= fit; hh *= fit;
      Object.assign(n, { l: cxu - hw, r: 1 - cxu - hw, t: cyv - hh, b: 1 - cyv - hh });
    } else {
      if (near.l) n.l = clamp(o.l + du, 0, R - MIN); if (near.r) n.r = clamp(o.r - du, 0, 1 - o.l - MIN);
      if (near.t) n.t = clamp(o.t + dv, 0, B - MIN); if (near.b) n.b = clamp(o.b - dv, 0, 1 - o.t - MIN);
    }
    c.crop = n; invalidate();
  };
  const up = () => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); pushBefore(before); afterChange(); };
  cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  return true;
}
function initCanvas() {
  cv.addEventListener('pointerdown', e => {
    hideMenus();
    const [px, py] = canvasPoint(e);
    if (S._pickObj) {                                 // elegir un objeto con IA
      const c = clipById(S._pickObj); S._pickObj = null; cv.classList.remove('pick');
      if (c) pickObjectAt(c, px, py); return;
    }
    if (S.cropMode) { const c = clipById(S.cropMode); if (c && cropPointer(e, c)) return; }
    if (S._pick) {                                      // cuentagotas del croma
      const c = clipById(S._pick); S._pick = null; cv.classList.remove('pick');
      S._noSel = true; const ch = c.chroma.on; c.chroma.on = false; draw(); const d = ctx.getImageData(px | 0, py | 0, 1, 1).data; c.chroma.on = ch; S._noSel = false;
      commit(); c.chroma.color = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''); afterChange(); return;
    }
    const hit = hitTest(px, py);
    if (!hit) { if (S.sel || S.msel.length) selectClip(null); return; }
    if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleSel(hit.c.id); return; }
    const c = hit.c; if (S.sel !== c.id || S.msel.length) selectClip(c.id);
    const lt = localT(c), before = snapshot(), b = { ...c._bb };
    const ox = kv(c, 'x', lt), oy = kv(c, 'y', lt), os = kv(c, 'scale', lt), orot = kv(c, 'rot', lt);
    const a0 = Math.atan2(py - b.cy, px - b.cx), d0 = Math.max(1, Math.hypot(px - b.cx, py - b.cy));
    cv.setPointerCapture(e.pointerId); e.preventDefault();
    const mv = ev => {
      const [qx, qy] = canvasPoint(ev);
      if (hit.h === 'scale') setProp(c, 'scale', +clamp(os * Math.hypot(qx - b.cx, qy - b.cy) / d0, .05, 4).toFixed(3));
      else if (hit.h === 'rot') { let a = orot + (Math.atan2(qy - b.cy, qx - b.cx) - a0) * 180 / Math.PI; a = ((a + 180) % 360 + 360) % 360 - 180; if (S.snap && Math.abs(a) < 3) a = 0; setProp(c, 'rot', +a.toFixed(1)); }
      else {
        let nx = ox + (qx - px) / (W / 2) * 100, ny = oy + (qy - py) / (H / 2) * 100;
        if (S.snap) { if (Math.abs(nx) < 1.5) nx = 0; if (Math.abs(ny) < 1.5) ny = 0; }
        setProp(c, 'x', +nx.toFixed(1)); setProp(c, 'y', +ny.toFixed(1));
      }
      invalidate(); syncTransformInputs(c);
    };
    const up = () => {
      cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
      pushBefore(before); updTools(); markDirty(); if (c.kf && Object.keys(c.kf).length) renderTL();
    };
    cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  });
  cv.addEventListener('wheel', e => {
    const c = S.sel && clipById(S.sel); if (!c || !(isVisual(c) || isTextLike(c))) return;
    e.preventDefault(); setProp(c, 'scale', clamp(kv(c, 'scale', localT(c)) * (e.deltaY < 0 ? 1.05 : .95), .05, 4)); invalidate(); syncTransformInputs(c); markDirty();
  }, { passive: false });
  // Pellizcar para escalar (móvil)
  let pz = null;
  cv.addEventListener('touchstart', e => { const c = S.sel && clipById(S.sel); if (e.touches.length === 2 && c) { pz = { c, d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), s: kv(c, 'scale', localT(c)), before: snapshot() }; } }, { passive: true });
  cv.addEventListener('touchmove', e => { if (pz && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); setProp(pz.c, 'scale', clamp(pz.s * d / pz.d, .05, 4)); invalidate(); } }, { passive: true });
  cv.addEventListener('touchend', () => { if (pz) { pushBefore(pz.before); markDirty(); pz = null; } }, { passive: true });
}

/* ---------- Menú principal, atajos y planes ---------- */
function openMainMenu() {
  const r = $('#menuBtn').getBoundingClientRect();
  showMenu($('#menuPop'), r.left, r.bottom + 4, [
    ['Nuevo proyecto', '', () => { saveProject(); newProject(); }],
    ['Volver a Inicio', '', () => showHome()],
    ['Guardar', 'Ctrl+S', () => saveProject(true)],
    ['Importar medios…', '', () => $('#fileIn').click()], '-',
    ['Deshacer', 'Ctrl+Z', undo, !HIST.undo.length], ['Rehacer', 'Ctrl+Y', redo, !HIST.redo.length], '-',
    ['Exportar…', 'Ctrl+E', openExport],
    ['Exportar fotograma (PNG)', '', () => exportFrame()],
    ['Exportar subtítulos (.srt)', '', () => exportSRT()],
    ['Importar subtítulos (.srt)…', '', () => $('#srtIn').click()], '-',
    ['Atajos de teclado', '', () => { $('#keysModal').hidden = false; }],
    ['Planes y Pro', '', openPlans],
    ['Acerca de', '', () => toast('Recreación de CapCut con fines educativos · proyecto universitario', 4000)]
  ]);
}
function openPlans() {
  hideMenus();
  const cell = v => `<li class="${v ? '' : 'no'}">${ic(v ? 'check' : 'close')}`;
  const plan = (name, sub, col, cur) => `<div class="plan${cur ? ' cur' : ''}"><h3>${name}${cur ? ' <span class="pro">Activo</span>' : ''}</h3><div class="pp">${sub}</div><ul>${PLAN_ROWS.map(r => `${cell(r[col])}<span>${r[0]}</span></li>`).join('')}</ul></div>`;
  $('#plansBody').innerHTML = `<h2>Planes <button class="icon-btn" data-close>${ic('close')}</button></h2>
    <div class="plans">${plan('Gratis', 'CapCut original, plan sin pago', 1, false)}${plan('Pro', 'CapCut original, suscripción', 2, false)}${plan('Recreación', 'Este proyecto: todo incluido', 3, true)}</div>
    <div class="note gold" style="margin-top:14px"><b>¿Por qué?</b> Las reseñas de la comunidad (Trustpilot, blogs de análisis) repiten tres quejas: funciones que pasaron a ser de pago, suscripciones difíciles de cancelar y créditos de IA que se gastan sin resultado. Aquí no hay pagos, cuentas ni créditos.</div>`;
  $('#plansModal').hidden = false;
}
function toggleFull() { const st = $('#stage'); if (document.fullscreenElement) document.exitFullscreen(); else st.requestFullscreen && st.requestFullscreen(); }

/* ---------- Eventos generales ---------- */
function bindApp() {
  initHome(); initCanvas();
  $('#btnPlay').onclick = toggle;
  $('#btnFull').onclick = toggleFull;
  $('#btnShot').onclick = () => exportFrame();
  $('#btnExport').onclick = openExport; $('#mRes').onclick = openExport;
  $('#btnKeys').onclick = () => { $('#keysModal').hidden = false; };
  $('#menuBtn').onclick = e => { e.stopPropagation(); $('#menuPop').hidden ? openMainMenu() : hideMenus(); };
  $('#mBack').onclick = () => showHome();
  $('#mUndo').onclick = undo; $('#mRedo').onclick = redo;
  $$('[data-open-plans]').forEach(b => b.onclick = openPlans);
  $('#projName').addEventListener('input', e => { S.name = e.target.value; markDirty(); });
  $('#ratioSel').onchange = e => { S.ratio = e.target.value; setCanvasSize(); renderProps(); renderTL(); markDirty(); };
  $$('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close]')) { if (m.id === 'exportModal') cancelExport(); else m.hidden = true; }
  }));
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu-pop,.ctx,#menuBtn,[data-pmenu]')) hideMenus(); });
  window.addEventListener('pointerdown', () => ensureAudio(), { once: true });
  // Archivos
  $('#fileIn').onchange = e => { if (S.view !== 'editor') newProject(); importFiles(e.target.files); e.target.value = ''; };
  $('#srtIn').onchange = e => { if (e.target.files[0]) importSRT(e.target.files[0]); e.target.value = ''; };
  $('#avIn').onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) audioFromVideoFiles(f); };
  $('#replaceIn').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const m = registerMedia({ name: f.name, type: f.type.split('/')[0], folder: 'local' }, f); await m.readyP;
    replaceMedia(clipById(S._replace), m); renderLib();
  };
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); if (S.view === 'editor' && e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });
  // Redimensionar la línea de tiempo
  $('#resizer').addEventListener('pointerdown', e => {
    const y0 = e.clientY, h0 = $('#timeline').getBoundingClientRect().height;
    const mv = ev => document.documentElement.style.setProperty('--tlh', clamp(h0 - (ev.clientY - y0), 170, innerHeight * .7) + 'px');
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); fitCanvas(); renderTL(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  new ResizeObserver(() => requestAnimationFrame(() => { fitCanvas(); invalidate(); })).observe($('#stage'));
  new ResizeObserver(debounce(() => renderTL(), 60)).observe(tl.scroll);
  document.addEventListener('fullscreenchange', () => setTimeout(fitCanvas, 50));
  MQ_MOBILE.addEventListener('change', () => { closeSheets(); renderTL(); fitCanvas(); renderMbar(); followPlayhead(); });
  window.addEventListener('beforeunload', () => { if (S.view === 'editor') saveProject(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.view === 'editor') saveProject(); });
  // Teclado (atajos como en CapCut)
  window.addEventListener('keydown', e => {
    if (S.view !== 'editor') return;
    if (e.target.closest('input,textarea,select,[contenteditable]')) { if (e.key === 'Escape') e.target.blur(); return; }
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { e.preventDefault(); toggle(); return; }
    if (mod) {
      const acts = { z: () => e.shiftKey ? redo() : undo(), y: redo, b: split, c: copySel, x: cutSel, v: paste, d: duplicate, a: selectAll, s: () => saveProject(true), e: openExport, '=': () => setZoom(S.zoom * 1.3), '+': () => setZoom(S.zoom * 1.3), '-': () => setZoom(S.zoom / 1.3) };
      if (acts[k]) { e.preventDefault(); acts[k](); }
      return;
    }
    const step = e.shiftKey ? 1 : 1 / S.fps;
    switch (k) {
      case 'delete': case 'backspace': e.preventDefault(); del(); break;
      case 'q': trimToPlayhead('left'); break;
      case 'w': trimToPlayhead('right'); break;
      case 'm': addMarker(); break;
      case 'f': toggleFull(); break;
      case 'z': if (e.shiftKey) fitZoom(); break;
      case 'arrowleft': e.preventDefault(); pause(); seek(S.t - step); followPlayhead(); break;
      case 'arrowright': e.preventDefault(); pause(); seek(S.t + step); followPlayhead(); break;
      case 'home': seek(0); followPlayhead(); break;
      case 'end': seek(total()); followPlayhead(); break;
      case 'enter': if (S.cropMode) setCropMode(false); break;
      case 'escape':
        hideMenus(); closeSheets();
        if (S.cropMode) { setCropMode(false); break; }
        if (S._pickObj) { S._pickObj = null; cv.classList.remove('pick'); break; }
        if (S.sel || S.selTrans || S.msel.length) selectClip(null); break;
    }
  });
}

/* ---------- Arranque ---------- */
async function init() {
  fillIcons();
  $('#keysList').innerHTML = SHORTCUTS.map(([a, b]) => `<span>${a}</span><span><kbd>${b}</kbd></span>`).join('');
  $('#ratioSel').innerHTML = Object.keys(RATIOS).map(r => `<option value="${r}">${r}</option>`).join('');
  S.tracks = [mainTrackObj()];
  initTimeline(); initPanels(); bindApp(); updPlayBtn();
  try { await IDB.open(); } catch (e) { IDB.ok = false; }
  const list = await listProjects(), firstRun = !list.length && IDB.ok;
  if (firstRun) S._building = true;
  await showHome();
  requestAnimationFrame(loop);
  if (firstRun) createDemoProject().then(() => { if (S.view === 'home') renderHome(); });
  if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
}
init();

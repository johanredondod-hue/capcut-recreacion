'use strict';
/* =========================================================
   timeline.js — línea de tiempo con varias pistas
   - Escritorio: cabezal móvil, regla, cabeceras de pista.
   - Móvil: cabezal fijo en el centro y la línea se desplaza (como la app).
   ========================================================= */

const tl = {
  scroll: $('#tlScroll'), inner: $('#tlInner'), rows: $('#tlRows'), heads: $('#tlHeadsInner'),
  ruler: $('#ruler'), rulerWrap: $('#rulerWrap'), knob: $('#phKnob'), ph: $('#playhead'), snap: $('#snapline')
};
const TRACK_H = { text: 30, fx: 30, video: 56, audio: 46, main: 68 };
const TRACK_ICON = { text: 'text', fx: 'effects', video: 'overlay', audio: 'audio' };
const TRACK_NAME = { text: 'Texto', fx: 'Efectos', video: 'Superposición', audio: 'Audio' };
let PADL = 0;
const trackH = tr => tr.main ? TRACK_H.main : TRACK_H[tr.kind];

/* ---------- Dibujo ---------- */
function renderTL() {
  if (S.view !== 'editor') return;
  const mob = isMobile(), vw = tl.scroll.clientWidth || 600, vh = tl.scroll.clientHeight || 200;
  PADL = mob ? vw / 2 : 0;
  const T = total(), contentW = Math.max(mob ? 1 : vw, (T + (mob ? 0 : 30)) * S.zoom);
  tl.inner.style.width = (PADL * 2 + contentW) + 'px';
  tl.rows.style.paddingLeft = PADL + 'px';
  const sum = S.tracks.reduce((a, tr) => a + trackH(tr), 0), spare = Math.max(0, vh - sum - 2);
  const topSp = Math.max(mob ? 8 : 22, spare / 2), botSp = Math.max(mob ? 8 : 22, spare / 2);
  const rows = document.createDocumentFragment(), heads = document.createDocumentFragment();
  rows.appendChild(spacer('up', topSp)); heads.appendChild(headSpacer(topSp));
  for (const tr of S.tracks) { rows.appendChild(trackRow(tr)); heads.appendChild(trackHead(tr)); }
  rows.appendChild(spacer('down', botSp)); heads.appendChild(headSpacer(botSp));
  tl.rows.replaceChildren(rows); tl.heads.replaceChildren(heads);
  tl.heads.style.transform = `translateY(${-tl.scroll.scrollTop}px)`;
  _lastT = -1; updTime(); renderRuler();
}
function spacer(dir, h) { const d = document.createElement('div'); d.className = 'trow spacer'; d.dataset.spacer = dir; d.style.height = h + 'px'; return d; }
function headSpacer(h) { const d = document.createElement('div'); d.className = 'head spacer'; d.style.height = h + 'px'; return d; }
function trackHead(tr) {
  const d = document.createElement('div'); d.className = 'head'; d.style.height = trackH(tr) + 'px'; d.dataset.tid = tr.id;
  const b = (act, on, icOn, icOff, title) => `<button class="icon-btn${on ? ' off' : ''}" data-tact="${act}" title="${title}">${ic(on ? icOff : icOn)}</button>`;
  if (tr.main) {
    const first = mains()[0], th = first && med(first.mediaId)?.thumb;
    d.innerHTML = `<button class="cover" data-tact="cover" title="Portada: usa el fotograma actual" style="${th ? `background-image:url(${th})` : ''}">Portada</button>`
      + b('lock', tr.lock, 'unlock', 'lock', 'Bloquear pista') + b('hide', tr.hide, 'eye', 'eyeoff', 'Ocultar pista') + b('mute', tr.mute, 'vol', 'mute', 'Silenciar clip');
  } else {
    d.innerHTML = `<span class="hk" title="${TRACK_NAME[tr.kind]}">${ic(TRACK_ICON[tr.kind])}</span><span style="flex:1"></span>`
      + b('lock', tr.lock, 'unlock', 'lock', 'Bloquear pista')
      + (tr.kind === 'audio' ? b('mute', tr.mute, 'vol', 'mute', 'Silenciar pista') : b('hide', tr.hide, 'eye', 'eyeoff', 'Ocultar pista'));
  }
  return d;
}
function trackRow(tr) {
  const row = document.createElement('div');
  row.className = 'trow' + (tr.main ? ' main' : ''); row.dataset.track = tr.id; row.style.height = trackH(tr) + 'px';
  const list = S.clips.filter(c => c.trackId === tr.id);
  if (!list.length && tr.main) row.innerHTML = `<div class="track-empty">${ic('upload')} ${isMobile() ? 'Toca + para añadir videos o fotos' : 'Arrastra videos o imágenes aquí'}</div>`;
  if (tr.main) {                                            // botón «+» al final de la pista principal (como en CapCut)
    const end = list.reduce((x, c) => Math.max(x, endOf(c)), 0);
    row.insertAdjacentHTML('beforeend', `<button class="add-end" data-addmedia title="Añadir medios" style="left:${list.length ? end * S.zoom + 12 : (isMobile() ? 12 : 300)}px">${ic('plus')}</button>`);
  }
  for (const c of list) row.appendChild(clipEl(c, tr));
  if (tr.main && S.magnet) {
    const ms = list; let h = '';
    for (let i = 1; i < ms.length; i++) {
      const B = ms[i], x = (B.start + (B._td || 0) / 2) * S.zoom;
      if (B._td > 0) h += `<div class="trans-span" style="left:${B.start * S.zoom}px;width:${B._td * S.zoom}px"></div>`;
      h += `<div class="junction${B.trans ? ' has' : ''}${S.selTrans === B.id ? ' sel' : ''}" data-junction="${B.id}" style="left:${x}px" title="${B.trans ? TRANS_MAP[B.trans.type]?.name : 'Añadir transición'}">${ic(B.trans ? 'transitions' : 'plus')}</div>`;
    }
    row.insertAdjacentHTML('beforeend', h);
  }
  return row;
}
function clipEl(c, tr) {
  const el = document.createElement('div'), w = Math.max(4, dur(c) * S.zoom), sel = isSelected(c.id), th = trackH(tr) - 6;
  el.className = `clip k-${c.kind}${sel ? ' sel' : ''}${tr.lock ? ' locked' : ''}${tr.hide ? ' hidden-track' : ''}`;
  el.dataset.id = c.id; el.style.left = c.start * S.zoom + 'px'; el.style.width = w + 'px';
  const m = c.mediaId && med(c.mediaId); let h = '';
  const avg = (c.out - c.in) / Math.max(1e-6, dur(c));
  if (isVisual(c) && m) {
    const tw = Math.max(12, Math.round(th * clamp((m.w || 16) / (m.h || 9), .5, 2.4))), n = Math.min(400, Math.ceil(w / tw));
    if (c.kind === 'video' && m.strip) {
      el.style.setProperty('--strip', `url(${m.strip})`);
      h += '<div class="strip">';
      for (let i = 0; i < n; i++) { const src = srcTime(c, (i + .5) * tw / S.zoom), idx = clamp(Math.floor(src / m.duration * m.stripN), 0, m.stripN - 1); h += `<i style="width:${tw}px;background-image:var(--strip);background-size:${m.stripN * tw}px 100%;background-position:${-idx * tw}px 0"></i>`; }
      h += '</div>';
    } else if (m.thumb) {
      el.style.setProperty('--th', `url(${m.thumb})`);
      h += '<div class="strip">' + `<i style="width:${tw}px;background-image:var(--th);background-size:cover;background-position:center"></i>`.repeat(n) + '</div>';
    }
    if (c.kind === 'video' && m.wave && m.hasAudio && !c.detached) h += waveHTML(el, c, m, false, avg);
  }
  if (c.kind === 'audio' && m && m.wave) h += waveHTML(el, c, m, true, avg);
  let label;
  switch (c.kind) {
    case 'text': label = `${ic('text')}${esc(String(c.text).replace(/\n/g, ' '))}`; break;
    case 'sticker': label = c.shape ? `${ic('effects')}${esc(c.name)}` : `${esc(c.text)} <em>Sticker</em>`; break;
    case 'effect': label = `${ic('effects')}${esc(c.name)}`; break;
    case 'filter': label = `${ic('filters')}${esc(c.name)}`; break;
    case 'adjust': label = `${ic('adjust')}${esc(c.name)}`; break;
    case 'audio': label = `${ic('audio')}${esc(c.name)}`; break;
    default: label = `${c.detached || c.volume === 0 ? ic('mute') : ''}${esc(c.name)} <em>${fmtDur(dur(c))}</em>`;
  }
  h += `<div class="clabel${isTextLike(c) || isFxLike(c) ? ' mid' : ''}">${label}</div>`;
  const badge = [c.reversed ? 'Reversa' : '', c.obj && c.obj.track ? 'Seguimiento' : '', c.follow ? 'Sigue' : '', c.curve ? 'Curva' : (c.speed && c.speed !== 1 ? `${+c.speed.toFixed(2)}x` : '')].filter(Boolean).join(' · ');
  if (badge) h += `<span class="spd">${badge}</span>`;
  if (c.id === S.sel) for (const t of kfTimes(c)) h += `<i class="kfd" style="left:${t * S.zoom}px"></i>`;
  if (c.beats) for (const b of c.beats) { const x = (tlTimeOf(c, b) - c.start) * S.zoom; if (x >= 0 && x <= w) h += `<i class="beat" style="left:${x}px"></i>`; }
  h += '<div class="h l" data-h="l"></div><div class="h r" data-h="r"></div>';
  el.innerHTML = h;
  return el;
}
function waveHTML(el, c, m, full, avg) {
  el.style.setProperty('--wave', `url(${m.wave})`);
  const fw = m.duration / avg * S.zoom, off = c.in / avg * S.zoom;
  return `<div class="cwave${full ? ' full' : ''}" style="background-image:var(--wave);background-size:${fw}px 100%;background-position:${-off}px 0"></div>`;
}

/* Regla dibujada en un canvas: solo lo visible */
function renderRuler() {
  const cnv = tl.ruler, wr = tl.rulerWrap, dpr = Math.min(2, devicePixelRatio || 1), w = wr.clientWidth, h = wr.clientHeight;
  if (!w) return;
  if (cnv.width !== Math.round(w * dpr) || cnv.height !== Math.round(h * dpr)) { cnv.width = Math.round(w * dpr); cnv.height = Math.round(h * dpr); }
  const x = cnv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const sl = tl.scroll.scrollLeft, z = S.zoom, t0 = (sl - PADL) / z, t1 = t0 + w / z;
  const steps = [1 / S.fps * 5, .5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600], step = steps.find(s => s * z >= 64) || 1200, minor = step / 5;
  x.font = '10px system-ui'; x.textBaseline = 'top';
  for (let i = Math.max(0, Math.floor(t0 / minor)); i * minor <= t1 + minor; i++) {
    const t = i * minor, px = Math.round(PADL + t * z - sl) + .5, major = i % 5 === 0;
    x.fillStyle = major ? '#5a5a62' : '#3a3a40'; x.fillRect(px, h - (major ? 9 : 4), 1, major ? 9 : 4);
    if (major) { x.fillStyle = '#7d7d86'; const whole = Math.abs(t - Math.round(t)) < 1e-4; x.fillText(whole ? fmtShort(Math.round(t)) : `${Math.round((t % 1) * S.fps)}f`, px + 4, 4); }
  }
  x.fillStyle = '#ffd400';
  for (const mk of S.markers) { const px = PADL + mk * z - sl; if (px < -8 || px > w + 8) continue; x.beginPath(); x.moveTo(px - 5, 2); x.lineTo(px + 5, 2); x.lineTo(px + 5, 9); x.lineTo(px, 13); x.lineTo(px - 5, 9); x.fill(); }
  tl.knob.style.transform = `translateX(${PADL + S.t * z - sl}px)`;
}
let _lastT = -1, _lastTot = -1;
function updTime() {
  const T = total();
  if (S.t !== _lastT) {
    $('#tCur').textContent = fmt(S.t, S.fps);
    tl.ph.style.transform = `translateX(${PADL + S.t * S.zoom}px)`;
    tl.knob.style.transform = `translateX(${PADL + S.t * S.zoom - tl.scroll.scrollLeft}px)`;
    _lastT = S.t;
    if (isMobile()) followPlayhead();
    if (!S.playing) refreshPropValues();
  }
  if (T !== _lastTot) { $('#tTot').textContent = fmt(T, S.fps); _lastTot = T; }
}
function followPlayhead() {
  const x = PADL + S.t * S.zoom, l = tl.scroll.scrollLeft, w = tl.scroll.clientWidth;
  if (isMobile()) { if (Math.abs(l - S.t * S.zoom) > .5) tl.scroll.scrollLeft = S.t * S.zoom; }
  else if (x > l + w - 60 || x < l) tl.scroll.scrollLeft = Math.max(0, x - 60);
}
function setZoom(z, anchorT = S.t) {
  const sx = PADL + anchorT * S.zoom - tl.scroll.scrollLeft;
  S.zoom = clamp(z, 4, 400);
  const zr = $('#zoomRange'); if (zr) zr.value = Math.log(S.zoom);
  renderTL();
  tl.scroll.scrollLeft = isMobile() ? S.t * S.zoom : PADL + anchorT * S.zoom - sx;
  renderRuler();
}
function fitZoom() { const T = total(); if (!T) return; setZoom((tl.scroll.clientWidth - (isMobile() ? 40 : 60)) / T, 0); tl.scroll.scrollLeft = isMobile() ? S.t * S.zoom : 0; }

/* ---------- Selección ---------- */
function selectClip(id, soft) {
  if (S.cropMode && S.cropMode !== id) S.cropMode = null;
  S.sel = id; S.selTrans = null; S.msel = [];
  if (S.ptabName == null) S.ptab = 0;
  if (soft) $$('.clip', tl.rows).forEach(e => e.classList.toggle('sel', e.dataset.id === id));
  else renderTL();
  renderProps(); renderMbar(); updTools(); invalidate();
  if (['effects', 'transitions', 'filters'].includes(S.tab)) renderLib();
}
/* Selección múltiple: añade o quita un clip */
function toggleSel(id) {
  let ids = selIds();
  ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  S.msel = ids.length > 1 ? ids : []; S.sel = ids[ids.length - 1] || null; S.selTrans = null; S.cropMode = null;
  renderTL(); renderProps(); renderMbar(); updTools(); invalidate();
}
/* Arrastrar en una zona vacía dibuja un recuadro de selección; un clic mueve el cabezal */
function startMarquee(e) {
  const x0 = e.clientX, y0 = e.clientY, additive = e.shiftKey || e.ctrlKey || e.metaKey, base = additive ? selIds() : [];
  let box = null, ids = base;
  const mv = ev => {
    if (!box && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!box) { box = document.createElement('div'); box.className = 'marquee'; tl.inner.appendChild(box); }
    const r = tl.inner.getBoundingClientRect(), L = Math.min(x0, ev.clientX), R = Math.max(x0, ev.clientX), T = Math.min(y0, ev.clientY), B = Math.max(y0, ev.clientY);
    Object.assign(box.style, { left: (L - r.left) + 'px', top: (T - r.top) + 'px', width: (R - L) + 'px', height: (B - T) + 'px' });
    ids = [...base];
    for (const el of $$('.clip', tl.rows)) { const b = el.getBoundingClientRect(); if (b.right > L && b.left < R && b.bottom > T && b.top < B && !ids.includes(el.dataset.id)) ids.push(el.dataset.id); }
    $$('.clip', tl.rows).forEach(el => el.classList.toggle('sel', ids.includes(el.dataset.id)));
  };
  const up = ev => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    if (!box) { if (!additive && (S.sel || S.msel.length || S.selTrans)) selectClip(null); pause(); seek(xToTime(ev.clientX)); return; }
    box.remove();
    S.msel = ids.length > 1 ? ids : []; S.sel = ids[ids.length - 1] || null; S.selTrans = null;
    renderTL(); renderProps(); renderMbar(); updTools(); invalidate();
    if (ids.length > 1) toast(`${ids.length} clips seleccionados`);
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
/* Mover varios clips juntos */
function startGroupDrag(e, primary) {
  const list = S.msel.map(clipById).filter(k => k && !trackById(k.trackId)?.lock && !(k.trackId === 'main' && S.magnet));
  if (!list.length) { toast('Los clips de la pista principal magnética se reordenan de uno en uno'); return; }
  e.preventDefault();
  const x0 = e.clientX, orig = new Map(list.map(k => [k.id, k.start])), before = snapshot(), ids = new Set(list.map(k => k.id));
  const cands = [0, S.t, ...S.markers]; S.clips.forEach(o => { if (!ids.has(o.id)) cands.push(o.start, endOf(o)); });
  const minStart = Math.min(...orig.values()), ref = orig.get(primary.id) ?? minStart, refDur = orig.has(primary.id) ? dur(primary) : 0;
  let moved = false, dd = 0;
  const mv = ev => {
    const px = ev.clientX - x0; if (!moved && Math.abs(px) < 4) return; moved = true;
    const d = Math.max(px / S.zoom, -minStart); dd = snapTime(ref + d, refDur, cands) - ref;
    for (const el of $$('.clip', tl.rows)) if (ids.has(el.dataset.id)) { el.classList.add('dragging'); el.style.transform = `translateX(${dd * S.zoom}px)`; }
  };
  const up = () => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); tl.snap.style.display = 'none';
    if (!moved) { renderTL(); return; }
    for (const k of list) { k.start = Math.max(0, orig.get(k.id) + dd); if (k.trackId !== 'main' && !isFree(k.trackId, k.start, endOf(k), k.id)) placeClip(k, k.trackId); }
    if (!S.magnet) sortMainByStart();
    pushBefore(before); afterChange();
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
function selectTrans(id) {
  S.selTrans = id; S.sel = null; renderTL(); renderProps(); renderMbar(); updTools(); invalidate();
  if (isMobile()) openSheet('props');
}

/* ---------- Ajuste magnético ---------- */
function snapCands(c) {
  const a = [0, S.t, ...S.markers];
  for (const o of S.clips) {
    if (o.id === c.id) continue; a.push(o.start, endOf(o));
    if (o.beats) for (const b of o.beats) a.push(tlTimeOf(o, b));
  }
  return a;
}
function showSnap(p) { tl.snap.style.left = (PADL + p * S.zoom) + 'px'; tl.snap.style.display = 'block'; }
function snapTime(start, d, cands) {
  tl.snap.style.display = 'none'; if (!S.snap) return start;
  const th = 8 / S.zoom;
  for (const p of cands) {
    if (Math.abs(p - start) < th) { showSnap(p); return p; }
    if (d && Math.abs(p - (start + d)) < th) { showSnap(p); return p - d; }
  }
  return start;
}

/* ---------- Interacción ---------- */
const xToTime = clientX => (clientX - tl.rows.getBoundingClientRect().left - PADL) / S.zoom;
function rowAt(y) {
  for (const r of tl.rows.children) { const b = r.getBoundingClientRect(); if (y >= b.top && y < b.bottom) return r.dataset.spacer ? { type: r.dataset.spacer, el: r } : { type: 'track', tr: trackById(r.dataset.track), el: r }; }
  const first = tl.rows.firstElementChild, lastR = tl.rows.lastElementChild;
  if (first && y < first.getBoundingClientRect().top) return { type: 'up', el: first };
  if (lastR && y >= lastR.getBoundingClientRect().bottom) return { type: 'down', el: lastR };
  return null;
}
function hlRow(y, k) {
  $$('.trow.over', tl.rows).forEach(r => r.classList.remove('over'));
  const r = rowAt(y); if (!r || !r.el) return;
  const ok = r.type === 'track' ? (r.tr.main ? k === 'video' : r.tr.kind === k) : (r.type === 'up' ? k !== 'audio' : k === 'audio');
  if (ok) r.el.classList.add('over');
}
function startScrub(e, getT) {
  pause(); seek(getT(e.clientX)); if (isMobile()) followPlayhead();
  const mv = ev => { seek(getT(ev.clientX)); if (isMobile()) followPlayhead(); };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
const rulerTime = cx => (cx - tl.rulerWrap.getBoundingClientRect().left + tl.scroll.scrollLeft - PADL) / S.zoom;

function startClipDrag(e, el) {
  const c = clipById(el.dataset.id); if (!c) return;
  const tr = trackById(c.trackId), handle = e.target.dataset.h, touch = e.pointerType !== 'mouse', wasSel = S.sel === c.id;
  if ((!touch && (e.shiftKey || e.ctrlKey || e.metaKey)) || (touch && S.multiMode)) { toggleSel(c.id); return; }
  if (!handle && S.msel.length > 1 && S.msel.includes(c.id)) { startGroupDrag(e, c); return; }
  if (!wasSel || S.msel.length) selectClip(c.id, true);
  if (tr && tr.lock) return;
  if (touch && !wasSel && !handle) { renderTL(); return; }          // táctil: primero se toca para seleccionar
  e.preventDefault();
  const mode = handle || 'move', x0 = e.clientX, y0 = e.clientY, o = JSON.parse(JSON.stringify(c, CLEAN)), before = snapshot();
  const m = c.mediaId && med(c.mediaId), cands = snapCands(c), avg = (o.out - o.in) / Math.max(1e-6, dur(o)), mainMag = c.trackId === 'main' && S.magnet;
  const freeLen = isTextLike(c) || isFxLike(c) || c.kind === 'image';
  let moved = false, newStart = o.start;
  const mv = ev => {
    const px = ev.clientX - x0, py = ev.clientY - y0;
    if (!moved && Math.hypot(px, py) < 4) return;
    moved = true; const d = px / S.zoom;
    if (mode === 'move') {
      newStart = mainMag ? Math.max(0, o.start + d) : snapTime(Math.max(0, o.start + d), dur(o), cands);
      el.classList.add('dragging'); el.style.transform = `translate(${mainMag ? px : (newStart - o.start) * S.zoom}px,${py}px)`;
      hlRow(ev.clientY, kindOf(c)); return;
    }
    if (mode === 'l') {
      if (freeLen) {
        if (mainMag) c.out = Math.max(.1, o.out - d);
        else { const ns = snapTime(clamp(o.start + d, 0, o.start + (o.out - o.in) - .1), 0, cands), dd = ns - o.start; c.start = ns; c.out = o.out - dd; }
      } else {
        const ns = mainMag ? o.start + d : snapTime(o.start + d, 0, cands);
        const dd = clamp((ns - o.start) * avg, -o.in, o.out - o.in - .1); c.in = o.in + dd; if (!mainMag) c.start = o.start + dd / avg;
      }
    } else {
      const maxOut = (m && c.kind !== 'image' && isFinite(m.duration)) ? m.duration : Infinity;
      const endT = snapTime(o.start + dur(o) + d, 0, cands);
      c.out = clamp(o.in + (endT - o.start) * avg, c.in + .1, maxOut);
    }
    layout(); renderTL();
  };
  const up = ev => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    tl.snap.style.display = 'none'; $$('.trow.over', tl.rows).forEach(r => r.classList.remove('over'));
    if (!moved) { renderTL(); return; }
    if (mode === 'move') finishMove(c, ev, newStart);
    layout(); pushBefore(before); afterChange();
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
function finishMove(c, ev, ns) {
  const row = rowAt(ev.clientY), k = kindOf(c);
  let dest = c.trackId;
  if (row && row.type === 'track') { if (row.tr.main ? k === 'video' : row.tr.kind === k) dest = row.tr.id; }
  else if (row && row.type === 'up' && k !== 'audio') dest = '__new';
  else if (row && row.type === 'down' && k === 'audio') dest = '__new';
  if (dest === 'main') {
    S.clips.splice(S.clips.indexOf(c), 1); c.trackId = 'main';
    if (S.magnet) { const center = ns + dur(c) / 2, others = mains(); const idx = others.findIndex(x => center < x.start + dur(x) / 2); insertMain(c, idx < 0 ? null : idx); }
    else { c.start = ns; insertMain(c, null); sortMainByStart(); if (!isFree('main', c.start, endOf(c), c.id)) { S.clips.splice(S.clips.indexOf(c), 1); c.trackId = null; S.clips.push(c); placeClip(c); toast('No hay espacio: se movió a una pista nueva'); } }
    return;
  }
  c.start = ns;
  if (c.trackId === 'main') c.trans = null;           // sale de la pista principal
  if (dest === '__new') { c.trackId = newTrack(k).id; return; }
  c.trackId = dest;
  if (!isFree(dest, c.start, endOf(c), c.id)) placeClip(c, dest);
}
function toOverlay(c) { commit(); const s = c.start; c.trackId = null; c.start = s; c.trans = null; placeClip(c); afterChange(); }
function toMain(c) {
  commit(); const center = c.start + dur(c) / 2; S.clips.splice(S.clips.indexOf(c), 1);
  const ms = mains(), idx = ms.findIndex(x => center < x.start + dur(x) / 2); insertMain(c, idx < 0 ? null : idx); afterChange();
}
function resetClip(c) {
  commit();
  if (isVisual(c) || isTextLike(c)) { const v = VIS(); Object.assign(c, { x: 0, y: 0, scale: 1, rot: 0, opacity: 1, flipH: false, flipV: false, blend: v.blend, filter: 'none', filterK: 1, adj: v.adj, crop: v.crop, mask: v.mask, chroma: v.chroma, rmbg: false, anim: v.anim, kf: {} }); }
  if ('volume' in c) Object.assign(c, { volume: 1, fadeIn: 0, fadeOut: 0, voice: 'none', denoise: false, isolate: false, normalize: false });
  c.speed = 1; c.curve = null; afterChange();
}

/* ---------- Menú contextual (clic derecho) ---------- */
function showMenu(box, x, y, items) {
  box.innerHTML = items.filter(Boolean).map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}"${it[3] ? ' disabled' : ''}><span>${it[0]}</span><kbd>${it[1] || ''}</kbd></button>`).join('');
  const list = items.filter(Boolean);
  box.hidden = false;
  const r = box.getBoundingClientRect();
  box.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; box.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  box.onclick = ev => { const b = ev.target.closest('button[data-i]'); if (!b) return; box.hidden = true; list[+b.dataset.i][2](); };
}
function hideMenus() { $('#ctxMenu').hidden = true; $('#menuPop').hidden = true; }
function clipMenu(c, x, y) {
  const vis = isVisual(c), items = [
    ['Copiar', 'Ctrl+C', copySel], ['Cortar', 'Ctrl+X', cutSel], ['Pegar', 'Ctrl+V', paste, !S.clipboard], ['Duplicar', 'Ctrl+D', duplicate], '-',
    ['Dividir', 'Ctrl+B', split], ['Eliminar', 'Supr', () => del()], '-',
    vis ? ['Reemplazar clip…', '', () => { S._replace = c.id; $('#replaceIn').click(); }] : null,
    c.kind === 'video' ? ['Separar audio', '', () => extractAudio(c)] : null,
    c.kind === 'video' ? ['Congelar fotograma', '', freezeFrame] : null,
    c.kind === 'video' ? ['Reproducir en reversa', '', () => reverseClip(c)] : null,
    vis ? ['Recortar en pantalla', '', () => { selectClip(c.id); setCropMode(true); openPropsTab('Video', 'crop'); }] : null,
    vis ? ['Seleccionar objeto (IA)…', '', () => startPickObject(c)] : null,
    vis ? (c.trackId === 'main' ? ['Mover a superposición', '', () => toOverlay(c)] : ['Mover a pista principal', '', () => toMain(c)]) : null,
    hasAudio(c) ? ['Detectar ritmo', '', () => detectBeats(c)] : null,
    ['Restablecer', '', () => resetClip(c)], '-',
    ['Seleccionar todo', 'Ctrl+A', selectAll]
  ];
  showMenu($('#ctxMenu'), x, y, items);
}

/* ---------- Barra de herramientas ---------- */
const TL_TOOLS = [
  ['tSelect', 'cursor', 'Seleccionar', () => { }, true],
  ['tUndo', 'undo', 'Deshacer (Ctrl+Z)', () => undo()], ['tRedo', 'redo', 'Rehacer (Ctrl+Y)', () => redo()], '|',
  ['tSplit', 'split', 'Dividir (Ctrl+B)', () => split()],
  ['tTrimL', 'chevL', 'Eliminar a la izquierda (Q)', () => trimToPlayhead('left')],
  ['tTrimR', 'chevR', 'Eliminar a la derecha (W)', () => trimToPlayhead('right')],
  ['tDel', 'trash', 'Eliminar (Supr)', () => del()], '|',
  ['tFreeze', 'freeze', 'Congelar fotograma', () => freezeFrame()],
  ['tMirror', 'mirror', 'Espejo', () => quickVis(c => { c.flipH = !c.flipH; })],
  ['tRotate', 'rotate', 'Girar 90°', () => quickVis(c => { c.rot = ((c.rot || 0) + 90) % 360; if (c.rot > 180) c.rot -= 360; })],
  ['tCrop', 'crop', 'Recortar en pantalla', () => { setCropMode(!S.cropMode); if (S.cropMode) openPropsTab('Video', 'crop'); }],
  ['tReverse', 'reverse', 'Reproducir en reversa', () => reverseClip()],
  ['tObj', 'target', 'Seleccionar objeto (IA)', () => startPickObject()],
  ['tDetach', 'detach', 'Separar audio', () => extractAudio()],
  ['tMarker', 'marker', 'Añadir marcador (M)', () => addMarker()], '|', 'grow',
  ['tRec', 'mic', 'Grabar voz en off', () => toggleRecord()],
  ['tMagnet', 'link', 'Imán de la pista principal', () => { commit(); S.magnet = !S.magnet; if (!S.magnet) sortMainByStart(); afterChange(); toast(S.magnet ? 'Pista principal magnética' : 'Pista principal libre'); }],
  ['tSnap', 'magnet', 'Ajuste automático', () => { S.snap = !S.snap; updTools(); toast(S.snap ? 'Ajuste activado' : 'Ajuste desactivado'); }], '|',
  ['tZoomOut', 'zout', 'Alejar (Ctrl+−)', () => setZoom(S.zoom / 1.3)], 'zoom',
  ['tZoomIn', 'zin', 'Acercar (Ctrl+=)', () => setZoom(S.zoom * 1.3)],
  ['tFit', 'fit', 'Ajustar a la ventana (Shift+Z)', () => fitZoom()]
];
function buildToolbar() {
  const bar = $('#tlTools');
  bar.innerHTML = TL_TOOLS.map(t => t === '|' ? '<span class="sep"></span>' : t === 'grow' ? '<span class="grow"></span>' : t === 'zoom'
    ? `<input type="range" id="zoomRange" min="${Math.log(4)}" max="${Math.log(400)}" step="0.01" value="${Math.log(S.zoom)}" aria-label="Zoom">`
    : `<button class="icon-btn${t[4] ? ' on' : ''}" id="${t[0]}" title="${t[2]}">${ic(t[1])}</button>`).join('');
  TL_TOOLS.forEach(t => { if (Array.isArray(t)) $('#' + t[0]).onclick = t[3]; });
  $('#zoomRange').oninput = e => setZoom(Math.exp(+e.target.value));
}
function quickVis(fn) { const c = S.sel && clipById(S.sel); if (!c || !(isVisual(c) || isTextLike(c))) return toast('Selecciona un clip visual'); commit(); fn(c); afterChange(); }
function updTools() {
  const set = (id, dis) => { const b = $('#' + id); if (b) b.disabled = dis; };
  const c = S.sel && clipById(S.sel), vis = c && (isVisual(c) || isTextLike(c));
  set('tUndo', !HIST.undo.length); set('tRedo', !HIST.redo.length); set('mUndo', !HIST.undo.length); set('mRedo', !HIST.redo.length);
  set('tDel', !c && !S.selTrans); set('tMirror', !vis); set('tRotate', !vis); set('tCrop', !(c && isVisual(c)));
  set('tFreeze', !mains().some(x => x.kind === 'video')); set('tDetach', !(c && c.kind === 'video'));
  set('tReverse', !(c && c.kind === 'video')); set('tObj', !(c && isVisual(c)));
  $('#tCrop')?.classList.toggle('on', !!S.cropMode);
  $('#tMagnet')?.classList.toggle('on', S.magnet); $('#tSnap')?.classList.toggle('on', S.snap);
  $('#tRec')?.classList.toggle('rec', !!S.recording);
}

/* ---------- Eventos ---------- */
function initTimeline() {
  buildToolbar();
  tl.scroll.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    hideMenus();
    if (e.target.closest('[data-addmedia]')) { e.preventDefault(); openImport(); return; }
    const j = e.target.closest('[data-junction]'); if (j) { selectTrans(j.dataset.junction); return; }
    const cl = e.target.closest('.clip'); if (cl) { startClipDrag(e, cl); return; }
    if (e.pointerType === 'mouse') { startMarquee(e); }
    else { const x0 = e.clientX, y0 = e.clientY; tl.scroll.addEventListener('pointerup', ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6 && (S.sel || S.selTrans)) selectClip(null); }, { once: true }); }
  });
  tl.scroll.addEventListener('contextmenu', e => {
    const cl = e.target.closest('.clip'); if (!cl) return;
    e.preventDefault(); const c = clipById(cl.dataset.id); if (S.sel !== c.id) selectClip(c.id); clipMenu(c, e.clientX, e.clientY);
  });
  tl.scroll.addEventListener('dblclick', e => { const cl = e.target.closest('.clip'); if (cl && isMobile() === false) openPropsTab(null); });
  tl.rulerWrap.addEventListener('pointerdown', e => startScrub(e, rulerTime));
  tl.scroll.addEventListener('scroll', () => {
    tl.heads.style.transform = `translateY(${-tl.scroll.scrollTop}px)`;
    if (isMobile() && !S.playing && !S.exporting) {
      const t = clamp(tl.scroll.scrollLeft / S.zoom, 0, total());
      if (Math.abs(t - S.t) * S.zoom > .5) { S.t = t; invalidate(); }
    }
    renderRuler();
  }, { passive: true });
  tl.scroll.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(S.zoom * (e.deltaY < 0 ? 1.15 : .87), clamp(xToTime(e.clientX), 0, total() + 30)); }
    else if (e.shiftKey && !e.deltaX) { e.preventDefault(); tl.scroll.scrollLeft += e.deltaY; }
  }, { passive: false });
  // Pellizcar para hacer zoom (móvil)
  let pinch = null;
  tl.scroll.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: Math.abs(e.touches[0].clientX - e.touches[1].clientX), z: S.zoom }; }, { passive: true });
  tl.scroll.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { const d = Math.abs(e.touches[0].clientX - e.touches[1].clientX); if (pinch.d > 10) setZoom(pinch.z * d / pinch.d); } }, { passive: true });
  tl.scroll.addEventListener('touchend', () => { pinch = null; }, { passive: true });
  // Cabeceras de pista
  tl.heads.addEventListener('click', e => {
    const b = e.target.closest('[data-tact]'); if (!b) return;
    const tr = trackById(b.closest('.head').dataset.tid), a = b.dataset.tact;
    if (a === 'cover') { S.cover = projectThumb(); toast('Portada actualizada con el fotograma actual'); markDirty(); return; }
    commit(); tr[a] = !tr[a]; afterChange();
  });
  // Soltar medios desde el panel o desde el sistema
  tl.scroll.addEventListener('dragover', e => { e.preventDefault(); hlRow(e.clientY, S._dragKind || 'video'); });
  tl.scroll.addEventListener('dragleave', () => $$('.trow.over', tl.rows).forEach(r => r.classList.remove('over')));
  tl.scroll.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation(); $$('.trow.over', tl.rows).forEach(r => r.classList.remove('over'));
    const t = Math.max(0, xToTime(e.clientX)), row = rowAt(e.clientY);
    const toAudio = row && ((row.type === 'track' && row.tr.kind === 'audio') || row.type === 'down');
    if (e.dataTransfer.files.length) return toAudio ? audioFromVideoFiles(e.dataTransfer.files, t) : importFiles(e.dataTransfer.files, { addToTimeline: true, start: t });
    const m = med(e.dataTransfer.getData('text/mid')); if (!m) return;
    if (m.type === 'audio') return addMediaClip(m, { start: t, trackId: row && row.tr && row.tr.kind === 'audio' ? row.tr.id : null });
    if (row && ((row.type === 'track' && !row.tr.main) || row.type === 'up')) return addMediaClip(m, { start: t, overlay: true, trackId: row.tr && row.tr.kind === 'video' ? row.tr.id : null });
    const ms = mains(), idx = ms.findIndex(c => t < c.start + dur(c) / 2);
    addMediaClip(m, { index: idx < 0 ? null : idx, start: t });
  });
}

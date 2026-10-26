'use strict';
/* =========================================================
   projects.js — pantalla de inicio, proyectos, autoguardado
   y plantillas.
   ========================================================= */

/* ---------- Plantillas ---------- */
const TEMPLATES = [
  { id: 'intro', name: 'Intro de canal', title: 'MI CANAL', ratio: '16:9', bg: 'linear-gradient(135deg,#00c8d7,#4b2bd6)', desc: 'Ken Burns, título y música' },
  { id: 'travel', name: 'Reel de viaje', title: 'VERANO 2026', ratio: '9:16', bg: 'linear-gradient(135deg,#ff7a59,#ffcf3f)', desc: '4 escenas · tropical', pro: true },
  { id: 'promo', name: 'Promoción', title: '-50% HOY', ratio: '1:1', bg: 'linear-gradient(135deg,#e0306b,#311b6b)', desc: 'Oferta con texto rebotando' },
  { id: 'bday', name: 'Cumpleaños', title: '¡FELIZ CUMPLE!', ratio: '9:16', bg: 'linear-gradient(135deg,#f857a6,#ff5858)', desc: 'Confeti y destellos', pro: true }
];
async function sceneMedia(kind, a, b) {
  const libId = `bg:${kind}:${a}:${b || ''}`;
  let m = S.media.find(x => x.libId === libId);
  if (!m) m = registerMedia({ name: kind === 'pattern' ? 'Fondo.jpg' : 'Escena.jpg', type: 'image', folder: 'library', libId }, await canvasBlob(genBgCanvas(kind, a, b), 'image/jpeg', .9));
  return m.readyP;
}
const scene = i => sceneMedia('grad', LIB_GRADS[i][0], LIB_GRADS[i][1]);
function coverScale(m) { const [w, h] = RATIOS[S.ratio]; return Math.max(w / m.w, h / m.h) / Math.min(w / m.w, h / m.h); }
function tplMain(ms, len, trans) {
  ms.forEach((m, i) => {
    const k = newMediaClip(m), s = coverScale(m); k.out = len; k.trackId = 'main'; k.scale = s;
    k.kf = { scale: [{ t: 0, v: s }, { t: len, v: s * 1.12 }] };                 // Ken Burns con fotogramas clave
    if (i > 0 && trans[i - 1]) k.trans = { type: trans[i - 1], d: .5 };
    S.clips.push(k);
  });
  layout();
}
function tplText(text, start, len, style, anim) {
  const c = { id: uid(), kind: 'text', in: 0, out: len, start, speed: 1, curve: null, name: style.kind === 'sticker' ? 'Sticker' : 'Texto', ...VIS(), ...TXT(), ...style, text };
  c.anim = { ...VIS().anim, ...anim }; S.clips.push(c); placeClip(c); return c;
}
function tplFx(kind, fxId, start, len) {
  const c = { id: uid(), kind, fxId, name: (kind === 'effect' ? EFFECT_MAP[fxId] : FILTER_MAP[fxId]).name, in: 0, out: len, start, speed: 1, curve: null, k: 1, adj: { b: 0, c: 0, s: 0, temp: 0, hue: 0, blur: 0, vig: 0 } };
  S.clips.push(c); placeClip(c); return c;
}
function tplAudio(m, len, extra) {
  const c = { id: uid(), kind: 'audio', mediaId: m.id, name: m.name, in: 0, out: Math.min(len, m.duration), start: 0, speed: 1, curve: null, ...AUD(), ...extra };
  S.clips.push(c); placeClip(c); return c;
}
const TPL_BUILD = {
  async intro() {
    const ms = await Promise.all([scene(0), scene(3), scene(6)]), mus = await libAudio('music', 'pop');
    tplMain(ms, 3.2, ['mix', 'pushL']);
    tplText('MI CANAL', .3, 2.6, { font: 'Impact', size: 120, strokeOn: true, stroke: '#000000', strokeW: 8 }, { in: 'zoomOut', inD: .6, out: 'fade' });
    tplText('Suscríbete para más', 3.3, 2.6, { bold: true, size: 50, bgOn: true, bg: '#ff0033', bgA: 1, y: 45 }, { in: 'bounce', out: 'zoomIn', loop: 'pulse' });
    tplText('🔔', 3.5, 2.4, { kind: 'sticker', size: 120, x: 0, y: -10 }, { in: 'bounce', loop: 'swing' });
    tplFx('effect', 'sparkle', 0, 3);
    tplAudio(mus, total(), { fadeOut: 1.2, volume: .7 });
  },
  async travel() {
    const ms = await Promise.all([scene(1), scene(7), scene(6), scene(5)]), mus = await libAudio('music', 'tropical');
    tplMain(ms, 2.6, ['slide', 'zoomIn', 'circle']);
    tplText('VERANO 2026', .2, 3, { font: 'Impact', size: 110, strokeOn: true, stroke: '#000000', strokeW: 6, y: -45 }, { in: 'slideU', out: 'fade', loop: 'float' });
    tplText('🌴', 0, total(), { kind: 'sticker', size: 170, x: -55, y: 62 }, { in: 'bounce', loop: 'swing', loopD: 2 });
    tplText('☀️', 0, total(), { kind: 'sticker', size: 140, x: 55, y: -78 }, { loop: 'rotate', loopD: 8 });
    tplFx('filter', 'warm', 0, total());
    tplAudio(mus, total(), { fadeOut: 1, volume: .75 });
  },
  async promo() {
    const ms = [await scene(3), await sceneMedia('pattern', 'sunburst')], mus = await libAudio('music', 'epic');
    tplMain(ms, 3, ['spin']);
    tplText('-50% HOY', .2, 5.4, { font: 'Impact', size: 130, color: '#ffde00', strokeOn: true, stroke: '#000000', strokeW: 9 }, { in: 'bounce', out: 'zoomIn', loop: 'pulse' });
    tplText('Solo por tiempo limitado', .8, 4.8, { bold: true, size: 40, bgOn: true, bg: '#000000', bgA: .7, y: 55 }, { in: 'slideU', out: 'fade' });
    tplText('🔥', .5, 5, { kind: 'sticker', size: 130, x: 60, y: -60 }, { in: 'bounce', loop: 'shake' });
    tplFx('effect', 'zoom', 0, total());
    tplAudio(mus, total(), { fadeOut: 1, volume: .7 });
  },
  async bday() {
    const ms = await Promise.all([scene(5), scene(3), scene(1)]), mus = await libAudio('music', 'pop');
    tplMain(ms, 2.8, ['white', 'blur']);
    tplText('¡FELIZ CUMPLE!', .2, total() - .4, { bold: true, size: 92, color: '#ffffff', glowOn: true, glow: '#ff2fb9', y: -20 }, { in: 'bounce', out: 'fade', loop: 'float' });
    tplText('🎂', .6, total() - 1, { kind: 'sticker', size: 160, y: 50 }, { in: 'zoomIn', loop: 'pulse' });
    tplText('🎉', 1, total() - 1.4, { kind: 'sticker', size: 120, x: 60, y: -70 }, { in: 'spin', loop: 'swing' });
    tplFx('effect', 'confetti', 0, total());
    tplAudio(mus, total(), { fadeOut: 1, volume: .7 });
  }
};
async function applyTemplate(id, fresh) {
  const tp = TEMPLATES.find(t => t.id === id); if (!tp) return;
  if (S.view !== 'editor' && !S._building) newProject(tp.name);
  if (!fresh) commit();
  toast('Preparando plantilla…');
  S.ratio = tp.ratio; setCanvasSize(); $('#ratioSel').value = S.ratio;
  S.tracks = [mainTrackObj()]; S.clips = []; S.markers = []; S.t = 0; S.sel = null; S.selTrans = null;
  await TPL_BUILD[id]();
  afterChange(); fitZoom();
  if (!fresh) toast(`Plantilla «${tp.name}» lista. Cambia las escenas con clic derecho → Reemplazar clip.`, 4000);
}

/* ---------- Proyectos ---------- */
const mainTrackObj = () => ({ id: 'main', kind: 'video', main: true, mute: false, hide: false, lock: false });
function resetEditorState() {
  S.playing = false; pauseAllMedia();
  for (const m of S.media) { (m.pool || []).forEach(el => { el.removeAttribute('src'); el.load(); }); URL.revokeObjectURL(m.url); }
  Object.assign(S, { media: [], tracks: [mainTrackObj()], clips: [], markers: [], t: 0, sel: null, selTrans: null, msel: [], multiMode: false, cropMode: null, cropRatio: 'free', cover: null, magnet: true, bgMode: 'color', bg: '#000000', bgBlur: 24, ratio: '16:9', fps: 30, zoom: 60, ptab: 0, psub: {} });
  S._pickObj = null; S._pick = null;
  HIST.undo = []; HIST.redo = []; KEYC.clear(); OBJM.clear();
}
function newProject(name) {
  resetEditorState();
  S.projectId = uid(); S.created = Date.now();
  S.name = name || `Proyecto ${new Date().toLocaleDateString()}`;
  showEditor(); saveProject();
}
function showEditor() {
  S.view = 'editor'; $('#home').hidden = true; $('#editor').hidden = false;
  $('#projName').value = S.name; $('#ratioSel').value = S.ratio;
  setCanvasSize(); layout(); renderResTabs(); renderLib(); renderProps(); renderMbar(); updTools(); updPlayBtn();
  requestAnimationFrame(() => { fitCanvas(); renderTL(); fitZoom(); invalidate(); });
}
async function showHome() {
  if (S.view === 'editor') { await saveProject(); resetEditorState(); }
  S.view = 'home'; $('#editor').hidden = true; $('#home').hidden = false;
  closeSheets(); hideMenus(); renderHome();
}
async function listProjects() { try { return (await IDB.all('projects')).sort((a, b) => b.updated - a.updated); } catch (e) { return []; } }
async function openProject(id) {
  const rec = await IDB.get('projects', id); if (!rec) return toast('No se encontró el proyecto');
  resetEditorState();
  Object.assign(S, { projectId: rec.id, created: rec.created, name: rec.name, ratio: rec.ratio, fps: rec.fps || 30, bgMode: rec.bgMode || 'color', bg: rec.bg || '#000000', bgBlur: rec.bgBlur || 24, cover: rec.cover || null, magnet: rec.magnet ?? true });
  S.tracks = rec.tracks && rec.tracks.length ? rec.tracks : [mainTrackObj()]; S.clips = rec.clips || []; S.markers = rec.markers || [];
  for (const mm of rec.media || []) {
    const b = await IDB.get('blobs', mm.id); if (!b) continue;
    const { id: mid, ...meta } = mm; registerMedia(meta, b.blob, mid);
  }
  showEditor();
}
let saving = false, saveAgain = false;
async function saveProject(manual, force) {
  if (!S.projectId || (S.view !== 'editor' && !force) || !IDB.ok) return;
  if (saving) { saveAgain = true; return; }
  saving = true; setSaveState('Guardando…');
  try {
    for (const m of S.media) if (!m.saved && m.blob) { await IDB.put('blobs', { id: m.id, blob: m.blob }); m.saved = true; }
    await IDB.put('projects', {
      id: S.projectId, name: S.name, created: S.created || Date.now(), updated: Date.now(), ratio: S.ratio, fps: S.fps,
      bgMode: S.bgMode, bg: S.bg, bgBlur: S.bgBlur, magnet: S.magnet, cover: S.cover || null,
      tracks: JSON.parse(JSON.stringify(S.tracks)), clips: JSON.parse(JSON.stringify(S.clips, CLEAN)), markers: [...S.markers],
      media: S.media.map(m => ({ id: m.id, name: m.name, type: m.type, folder: m.folder, libId: m.libId, srcOf: m.srcOf, duration: m.duration, w: m.w, h: m.h, thumb: m.thumb, strip: m.strip, stripN: m.stripN, stripFW: m.stripFW, peaks: m.peaks, peakRate: m.peakRate, wave: m.wave, hasAudio: m.hasAudio })),
      thumb: S.cover || projectThumb(), duration: total()
    });
    setSaveState('Guardado ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    if (manual) toast('Proyecto guardado en este equipo');
  } catch (e) { console.warn('Guardar:', e); setSaveState('No se pudo guardar'); }
  saving = false;
  if (saveAgain) { saveAgain = false; scheduleSave(); }
}
const scheduleSave = debounce(() => { if (!S.exporting) saveProject(); }, 1500);
function setSaveState(t) { const e = $('#saveState'); if (e) e.textContent = t; }
function projectThumb(w = 320) {
  const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * H / W);
  S._noSel = true; draw(); S._noSel = false; invalidate();
  c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .7);
}
async function deleteProject(id) {
  const rec = await IDB.get('projects', id); if (!rec) return;
  for (const m of rec.media || []) await IDB.del('blobs', m.id);
  await IDB.del('projects', id); renderHome(); toast('Proyecto eliminado');
}
async function duplicateProject(id) {
  const rec = await IDB.get('projects', id); if (!rec) return;
  const map = {}, copy = JSON.parse(JSON.stringify({ ...rec, media: [] }));
  copy.media = [];
  for (const m of rec.media || []) {
    const b = await IDB.get('blobs', m.id); if (!b) continue;
    const nid = uid(); map[m.id] = nid; await IDB.put('blobs', { id: nid, blob: b.blob }); copy.media.push({ ...m, id: nid });
  }
  copy.media.forEach(m => { if (m.srcOf && map[m.srcOf]) m.srcOf = map[m.srcOf]; });
  copy.clips.forEach(c => { if (c.mediaId) c.mediaId = map[c.mediaId] || c.mediaId; });
  Object.assign(copy, { id: uid(), name: rec.name + ' (copia)', created: Date.now(), updated: Date.now(), thumb: rec.thumb });
  await IDB.put('projects', copy); renderHome(); toast('Proyecto duplicado');
}
/* El proyecto de ejemplo se crea en segundo plano mientras se muestra Inicio */
async function createDemoProject() {
  S._building = true;
  try {
    resetEditorState(); S.projectId = uid(); S.created = Date.now(); S.name = 'Proyecto de ejemplo';
    await applyTemplate('intro', true);
    await saveProject(false, true);
  } catch (e) { console.warn('Demo:', e); }
  finally { resetEditorState(); S.projectId = null; S._building = false; }
}

/* ---------- Pantalla de inicio ---------- */
let homeTab = 'home';
const tplCard = t => `<button class="tpl" data-tpl="${t.id}"><div class="tth${t.ratio === '16:9' ? ' wide' : ''}" style="background:${t.bg}">${t.title}</div><div class="tinfo">${t.name} ${t.pro ? '<span class="pro">Pro</span>' : ''}<small>${t.ratio} · ${t.desc}</small></div></button>`;
const projCard = p => `<div class="proj" data-open="${p.id}"><div class="pth" style="${p.thumb ? `background-image:url(${p.thumb})` : ''}"><span class="pdur">${fmtShort(p.duration || 0)}</span></div>
  <button class="icon-btn pmore" data-pmenu="${p.id}" title="Opciones">${ic('more')}</button>
  <div class="pname">${esc(p.name)}</div><div class="pmeta">${new Date(p.updated).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} · ${p.ratio}</div></div>`;
async function renderHome() {
  const main = $('#homeMain');
  $$('#homeNav button').forEach(b => b.classList.toggle('on', b.dataset.hnav === homeTab));
  if (homeTab === 'templates') { main.innerHTML = `<h1>Plantillas</h1><p class="hint" style="margin-bottom:16px">Elige una plantilla y cambia las escenas por tus videos.</p><div class="tpl-grid">${TEMPLATES.map(tplCard).join('')}</div>`; return; }
  const list = await listProjects();
  const quick = [['captions', 'Subtítulos automáticos', 'Gratis y en tu equipo', 'captions'], ['bgremove', 'Quitar fondo', 'Sin pantalla verde', 'rmbg'], ['template', 'Plantillas', 'Listas para usar', 'templates'], ['mic', 'Grabar voz', 'Narración en off', 'record'], ['upload', 'Importar', 'Videos, fotos y audio', 'import'], ['effects', 'Efectos', '20 efectos · 20 transiciones', 'effects']];
  main.innerHTML = `<h1>Inicio</h1>
    <div class="hero"><button class="create-card" id="hCreate"><span class="plus">${ic('plus')}</span><b>Crear proyecto</b><span>Empieza desde cero o importa tus videos</span></button>
    <div class="quick">${quick.map(([i, n, s, a]) => `<button data-quick="${a}">${ic(i)}<span>${n}</span><small>${s}</small></button>`).join('')}</div></div>
    <div class="pro-banner">${ic('crown')}<span><b>Todas las funciones Pro desbloqueadas.</b> Exporta sin marca de agua hasta 4K, sin créditos ni suscripciones. Tus proyectos se guardan solo en este equipo.</span></div>
    <h2>Proyectos <span class="muted" style="font-weight:400;font-size:13px">${list.length}</span></h2>
    ${S._building ? '<div class="empty-home">Preparando el proyecto de ejemplo…</div>' : list.length ? `<div class="proj-grid">${list.map(projCard).join('')}</div>` : `<div class="empty-home">Aún no tienes proyectos. ${IDB.ok ? '' : 'Este navegador no permite guardar (¿modo privado?).'}</div>`}`;
}
function initHome() {
  $('#homeNav').addEventListener('click', e => { const b = e.target.closest('[data-hnav]'); if (!b) return; homeTab = b.dataset.hnav; renderHome(); });
  $('#homeMain').addEventListener('click', async e => {
    const t = e.target.closest('#hCreate,[data-quick],[data-open],[data-pmenu],[data-tpl]'); if (!t) return;
    if (S._building) return toast('Un momento: preparando el proyecto de ejemplo…');
    if (t.id === 'hCreate') return newProject();
    if (t.dataset.tpl) { newProject(TEMPLATES.find(x => x.id === t.dataset.tpl).name); return applyTemplate(t.dataset.tpl, true); }
    if (t.dataset.quick) {
      const q = t.dataset.quick;
      if (q === 'templates') { homeTab = 'templates'; return renderHome(); }
      newProject();
      const go = { captions: ['captions', 'auto'], rmbg: ['media', 'local'], record: ['audio', 'record'], import: ['media', 'local'], effects: ['effects', 'all'] }[q];
      S.tab = go[0]; S.sub[go[0]] = go[1]; renderResTabs(); renderLib();
      if (q === 'import') $('#fileIn').click();
      if (q === 'rmbg') toast('Importa un video con una persona, selecciónalo y activa «Quitar fondo» en Detalles', 5000);
      if (isMobile()) openSheet('res');
      return;
    }
    if (t.dataset.pmenu) {
      e.stopPropagation(); const id = t.dataset.pmenu, r = t.getBoundingClientRect();
      showMenu($('#menuPop'), r.left, r.bottom + 4, [
        ['Abrir', '', () => openProject(id)],
        ['Renombrar', '', async () => { const rec = await IDB.get('projects', id); const n = prompt('Nuevo nombre', rec.name); if (n) { rec.name = n; await IDB.put('projects', rec); renderHome(); } }],
        ['Duplicar', '', () => duplicateProject(id)], '-',
        ['Eliminar', '', () => { if (confirm('¿Eliminar este proyecto? No se puede deshacer.')) deleteProject(id); }]
      ]);
      return;
    }
    if (t.dataset.open) openProject(t.dataset.open);
  });
}

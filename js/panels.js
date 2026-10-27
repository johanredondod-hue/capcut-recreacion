'use strict';
/* =========================================================
   panels.js — panel de recursos (izquierda), panel de detalles
   (derecha) y barra inferior de la versión móvil.
   ========================================================= */

/* ============ PANEL DE RECURSOS ============ */
function renderResTabs() {
  $('#resTabs').innerHTML = RES_TABS.map(([id, n, i]) => `<button data-tab="${id}" class="${S.tab === id ? 'on' : ''}">${ic(i)}<span>${n}</span></button>`).join('');
}
function curSub() { const subs = RES_SUBS[S.tab]; const s = S.sub[S.tab]; return subs.some(x => x[0] === s) ? s : subs[0][0]; }
function renderLib() {
  if (S.view !== 'editor') return;
  const subs = RES_SUBS[S.tab], sub = curSub(), nav = $('#resSub');
  nav.innerHTML = subs.map(([id, n]) => `<button data-sub="${id}" class="${id === sub ? 'on' : ''}">${n}</button>`).join('');
  nav.hidden = subs.length < 2; $('.res-body').classList.toggle('nosub', subs.length < 2);
  const sc = $('#resContent').scrollTop;
  $('#resContent').innerHTML = LIB[S.tab](sub);
  $('#resContent').scrollTop = sc;
}
const importBox = (accept, text) => `<label class="dropzone" data-import="${accept}">${ic('upload')}<strong>Importar</strong><span>${text}</span></label>`;
const proB = p => p ? '<span class="pro">Pro</span>' : '';
const voiceOpts = () => TTS_VOICES.map(([v, n]) => `<option value="${v}"${v === S.ttsVoice ? ' selected' : ''}>${n}</option>`).join('');
function mediaCard(m) {
  const used = S.clips.some(c => c.mediaId === m.id), d = m.type === 'image' ? '' : fmtDur(m.duration);
  return `<div class="card${m.failed ? ' failed' : m.ready ? '' : ' loading'}" draggable="true" data-mid="${m.id}" title="${esc(m.name)}">
    <div class="th" style="${m.thumb ? `background-image:url(${m.thumb})` : ''}">${m.type === 'audio' ? ic('audio') : ''}</div>
    ${d ? `<span class="badge">${d}</span>` : ''}${used ? '<span class="used">Añadido</span>' : ''}
    <button class="add" data-add="${m.id}" title="Añadir a la línea de tiempo">${ic('plus')}</button>
    <div class="nm">${esc(m.name)}</div></div>`;
}
function audioRow(m) {
  return `<div class="lrow" draggable="true" data-mid="${m.id}"><div class="lic">${ic('audio')}</div><div class="ltx"><b>${esc(m.name)}</b><small>${fmtDur(m.duration)}</small></div>
    <button class="icon-btn" data-add="${m.id}" title="Añadir">${ic('plus')}</button></div>`;
}
function libRow(kind, it) {
  return `<div class="lrow"><button class="icon-btn" data-preview="${kind}:${it.id}" title="Escuchar">${ic('play')}</button>
    <div class="ltx"><b>${it.name}</b><small>${kind === 'music' ? `${it.mood} · ${it.bpm} BPM · ` : ''}${fmtDur(it.dur)}</small></div>
    <button class="icon-btn" data-libadd="${kind}:${it.id}" title="Añadir">${ic('plus')}</button></div>`;
}
const ttsBox = () => `<h3>Texto a voz</h3><p class="hint">Escribe lo que quieres que se diga. Se crea un audio con voz natural en la posición del cabezal.</p>
  <textarea class="field" id="ttsText" style="margin:10px 0;min-height:110px" placeholder="Hola, bienvenidos a mi canal…"></textarea>
  <div class="row2"><label>Voz</label><select class="field" id="ttsVoice">${voiceOpts()}</select></div>
  <label class="row2" style="cursor:pointer"><span class="muted">Añadir subtítulo</span><span style="display:flex;justify-content:flex-end"><span class="switch"><input type="checkbox" id="ttsCap" checked><span></span></span></span></label>
  <button class="btn primary block" id="ttsGo">${ic('vol')}Generar voz</button>
  <button class="btn block" id="ttsAll" style="margin-top:8px">Leer en voz alta todos los textos</button>
  <p class="hint" id="ttsProg" style="margin-top:8px"></p>
  <div class="note gold"><b>Gratis y en tu equipo.</b> La primera vez se descarga la voz elegida (~60 MB, alrededor de 1 minuto). Después funciona sin internet.</div>`;
const sampleThumb = () => (S.media.find(m => m.thumb && m.type !== 'audio') || {}).thumb;
const targetNote = (txt) => `<p class="hint" style="margin-bottom:10px">${txt}</p>`;
const LIB = {
  media(sub) {
    if (sub === 'library') {
      return `<h3>Biblioteca</h3><div class="sub">Colores</div><div class="grid g4">${LIB_COLORS.map(c => `<div class="tile" data-lib="color:${c}"><div class="pv" style="background:${c}"></div></div>`).join('')}</div>
        <div class="sub">Degradados</div><div class="grid g3">${LIB_GRADS.map(g => `<div class="tile" data-lib="grad:${g[0]}:${g[1]}"><div class="pv" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></div></div>`).join('')}</div>
        <div class="sub">Fondos</div><div class="grid g3">${LIB_PATTERNS.map(([id, n]) => `<div class="tile" data-lib="pat:${id}"><div class="pv" style="background:${patPreview(id)}"></div><span class="nm">${n}</span></div>`).join('')}</div>
        <div class="note">Los fondos se generan en tu equipo: no necesitan internet ni tienen derechos de autor.</div>`;
    }
    const list = S.media.filter(m => m.type !== 'audio' && m.folder !== 'library');
    return `<h3>Medios locales <span class="muted" style="font-weight:400">${list.length}</span></h3>${importBox('video/*,image/*', 'Videos e imágenes · arrastra o haz clic')}
      <div style="height:12px"></div>${list.length ? `<div class="grid">${list.map(mediaCard).join('')}</div>` : '<p class="hint">Aún no hay medios. También puedes arrastrarlos directamente a la línea de tiempo.</p>'}`;
  },
  audio(sub) {
    if (sub === 'music') return `<h3>Música</h3><div class="list">${MUSIC.map(m => libRow('music', m)).join('')}</div><div class="note">Pistas generadas en tu equipo, libres de derechos. <b>Mejora:</b> en CapCut muchas canciones están bloqueadas por región o derechos.</div>`;
    if (sub === 'sfx') return `<h3>Efectos de sonido</h3><div class="list">${SFX.map(m => libRow('sfx', m)).join('')}</div>`;
    if (sub === 'tts') return ttsBox();
    if (sub === 'record') return `<h3>Grabar voz en off</h3><button class="rec-big${S.recording ? ' on' : ''}" data-rec>${ic(S.recording ? 'stop' : 'mic')}</button>
      <p class="hint" style="text-align:center">${S.recording ? 'Grabando… pulsa para detener' : 'La grabación empieza en el cabezal y el video se reproduce mientras hablas.'}</p>`;
    const list = S.media.filter(m => m.type === 'audio' && (sub === 'extracted' ? m.folder === 'extract' : ['local', 'record', 'tts'].includes(m.folder)));
    if (sub === 'extracted') return `<h3>Audio de un video</h3><p class="hint" style="margin-bottom:10px">Usa solo el sonido de un video que tengas: música, una entrevista, un audio viral…</p>
      <button class="btn primary block" id="avFromVideo">${ic('film')}Elegir video de mi equipo</button>
      <p class="hint" style="margin:8px 0 14px">También puedes arrastrar un video sobre la pista de audio, o hacer clic derecho en un clip → «Separar audio».</p>
      ${list.length ? `<div class="list">${list.map(audioRow).join('')}</div>` : ''}`;
    return `<h3>Mis audios</h3>${importBox('audio/*', 'MP3, WAV, OGG, M4A…')}<div style="height:12px"></div>${list.length ? `<div class="list">${list.map(audioRow).join('')}</div>` : '<p class="hint">Sin audio importado.</p>'}`;
  },
  text(sub) {
    if (sub === 'tts') return ttsBox();
    if (sub === 'templates') return `<h3>Plantillas de texto</h3><div class="grid">${TEXT_TEMPLATES.map((t, i) => `<div class="tpreset" data-ttpl="${i}" style="height:90px;background:${t.bg};${presetCss(t.s)}" title="${t.name}">${esc(t.text)}${proB(t.pro)}</div>`).join('')}</div>
      <div class="note">Cada plantilla incluye animación de entrada, salida y bucle.</div>`;
    return `<h3>Añadir texto</h3><button class="btn primary block" data-text>${ic('plus')}Texto predeterminado</button>
      <div class="sub">Estilos</div><div class="grid">${TEXT_STYLES.map((p, i) => `<div class="tpreset" data-tstyle="${i}" style="${presetCss(p.s)}">${p.name}${proB(p.pro)}</div>`).join('')}</div>`;
  },
  stickers(sub) {
    if (sub === 'shapes') return `<h3>Formas animadas</h3><p class="hint" style="margin-bottom:10px">Se pueden pegar a un objeto que se mueve: selecciona el video → Objeto (IA) → Seguir.</p>
      <div class="grid g3">${SHAPES.map(s => `<div class="tile" data-shape="${s.id}"><div class="pv" style="background:#16161a">${shapePreview(s)}</div><span class="nm">${s.name}</span></div>`).join('')}</div>`;
    return `<h3>Stickers · ${sub}</h3><div class="grid g4">${STICKER_CATS[sub].split(' ').map(e => `<div class="emoji" data-sticker="${e}">${e}</div>`).join('')}</div>`;
  },
  effects(sub) {
    const list = EFFECTS.filter(e => sub === 'all' || e.cat === sub), s = S.sel && clipById(S.sel);
    return `<h3>Efectos de video</h3>${targetNote(s && isVisual(s) ? `Se añadirá sobre <b>${esc(s.name)}</b>.` : 'Se añade en el cabezal y afecta a todo lo que hay debajo.')}
      <div class="grid g3">${list.map(e => `<div class="tile" data-effect="${e.id}"><div class="pv" style="background:${e.bg}"></div>${proB(e.pro)}<span class="nm">${e.name}</span></div>`).join('')}</div>`;
  },
  transitions(sub) {
    const B = transTarget(), cur = B && B.trans ? B.trans.type : 'none';
    const list = TRANSITIONS.filter(t => sub === 'all' || t.cat === sub);
    return `<h3>Transiciones</h3>${targetNote(B ? `Entre el clip anterior y <b>${esc(B.name)}</b>. También puedes pulsar el botón entre dos clips.` : 'Añade al menos dos clips a la pista principal.')}
      <div class="grid g3"><div class="tile${cur === 'none' ? ' on' : ''}" data-trans="none"><div class="pv" style="background:#26262b">${ic('close')}</div><span class="nm">Ninguna</span></div>
      ${list.map(t => `<div class="tile${cur === t.id ? ' on' : ''}" data-trans="${t.id}"><div class="pv" style="background:${transPreview(t.id)}">${ic('transitions')}</div>${proB(t.pro)}<span class="nm">${t.name}</span></div>`).join('')}</div>
      ${B && B.trans ? `<button class="btn block" style="margin-top:12px" data-transall>Aplicar «${TRANS_MAP[B.trans.type].name}» a todos</button>` : ''}`;
  },
  captions(sub) {
    if (sub === 'manual') return `<h3>Subtítulos manuales</h3><p class="hint">Una línea por subtítulo. Se colocan desde el cabezal, uno tras otro.</p>
      <textarea class="field" id="capText" style="margin:10px 0;min-height:150px" placeholder="Hola a todos&#10;Bienvenidos a mi video&#10;¡Empecemos!"></textarea>
      <div class="row2"><label>Duración</label><select class="field" id="capDur"><option value="1.5">1,5 s</option><option value="2" selected>2 s</option><option value="3">3 s</option></select></div>
      <button class="btn primary block" id="capManual">${ic('captions')}Añadir subtítulos</button>`;
    if (sub === 'srt') return `<h3>Archivos SRT</h3><p class="hint">Importa subtítulos de otro programa o exporta los tuyos para YouTube.</p>
      <div class="btnrow" style="margin-top:12px"><button class="btn" id="srtImport">${ic('upload')}Importar .srt</button><button class="btn" id="srtExport">${ic('download')}Exportar .srt</button></div>`;
    return `<h3>Voz a texto <span class="pro">Pro</span></h3>
      <p class="hint">Reconoce la voz de tus clips y crea los subtítulos sincronizados. Funciona en tu equipo con el modelo Whisper.</p>
      <div style="height:10px"></div>
      <div class="row2"><label>Idioma</label><select class="field" id="capLang"><option value="spanish">Español</option><option value="english">Inglés</option><option value="portuguese">Portugués</option><option value="french">Francés</option><option value="">Detectar</option></select></div>
      <div class="row2"><label>Precisión</label><select class="field" id="capModel">${ASR_MODELS.map(([v, n]) => `<option value="${v}"${v === S.asrModel ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="row2"><label>Estilo</label><select class="field" id="capStyle"><option value="karaoke">Resaltado dinámico</option><option value="box">Palabra en caja</option><option value="plain">Simple</option><option value="yellow">Amarillo</option></select></div>
      <div class="row2"><label>Origen</label><select class="field" id="capSrc"><option value="all">Todo el audio</option><option value="sel">Clip seleccionado</option></select></div>
      <label class="row2" style="cursor:pointer"><span class="muted">Traducir al inglés</span><span style="display:flex;justify-content:flex-end"><span class="switch"><input type="checkbox" id="capTr"><span></span></span></span></label>
      <button class="btn primary block" id="capGo">${ic('wand')}Generar subtítulos</button>
      <div id="capProg" class="hint" style="margin-top:10px"></div>
      <div class="note gold"><b>Mejora pedida por la comunidad:</b> en CapCut los subtítulos automáticos pasaron a ser de pago. Aquí son gratis y no envían tu audio a ningún servidor.</div>
      <div class="sub">Al revés: texto a voz</div><button class="btn block" data-goto="audio:tts">${ic('vol')}Convertir texto en voz</button>`;
  },
  filters(sub) {
    const list = FILTERS.filter(f => f.id !== 'none' && (sub === 'all' || f.cat === sub)), th = sampleThumb(), s = S.sel && clipById(S.sel);
    return `<h3>Filtros</h3>${targetNote(s && isVisual(s) ? `Se añadirá sobre <b>${esc(s.name)}</b>. Para un solo clip usa Detalles → Ajuste.` : 'Se añade como segmento en el cabezal.')}
      <div class="grid g3">${list.map(f => `<div class="tile" data-filter="${f.id}"><div class="pv" style="${th ? `background-image:url(${th});` : 'background:linear-gradient(135deg,#00c8d7,#4b2bd6);'}filter:${f.css}"></div>${proB(f.pro)}<span class="nm">${f.name}</span></div>`).join('')}</div>`;
  },
  adjust() {
    return `<h3>Ajuste</h3><button class="btn primary block" data-adjp="0">${ic('plus')}Añadir ajuste personalizado</button>
      <div class="sub">Preajustes</div><div class="grid g3">${ADJ_PRESETS.slice(1).map((p, i) => `<div class="tile" data-adjp="${i + 1}"><div class="pv" style="${sampleThumb() ? `background-image:url(${sampleThumb()});` : 'background:#345;'}filter:${adjCss(p.adj) || 'none'}"></div><span class="nm">${p.name}</span></div>`).join('')}</div>
      <div class="note">Una capa de ajuste modifica todo lo que está debajo durante su duración. Para curvas y ruedas de color de un clip: Detalles → Ajuste.</div>`;
  },
  templates() {
    return `<h3>Plantillas</h3><div class="grid">${TEMPLATES.map(t => `<div class="tpl" data-tpl="${t.id}"><div class="tth ${t.ratio === '16:9' ? 'wide' : ''}" style="background:${t.bg}">${t.title}</div><div class="tinfo">${t.name} ${proB(t.pro)}<small>${t.ratio} · ${t.desc}</small></div></div>`).join('')}</div>
      <div class="note">Las plantillas reemplazan la línea de tiempo actual (puedes deshacer con Ctrl+Z). Luego cambia las escenas con clic derecho → Reemplazar clip.</div>`;
  }
};
function presetCss(s) {
  const p = { font: 'system-ui', color: '#ffffff', bold: false, ...s };
  let css = `font-family:${fontStack(p.font).replace(/"/g, "'")};color:${p.color};font-weight:${p.bold ? 800 : 500};${p.italic ? 'font-style:italic;' : ''}`;
  if (p.gradOn) css += `background-image:linear-gradient(${p.color},${p.grad2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;`;
  if (p.strokeOn) css += `-webkit-text-stroke:1.4px ${p.stroke};paint-order:stroke fill;`;
  if (p.glowOn) css += `text-shadow:0 0 8px ${p.glow},0 0 16px ${p.glow};`;
  else if (p.shadowOn) css += `text-shadow:2px 2px 4px ${p.shadow};`;
  if (p.bgOn && !p.gradOn) css += `background:${hexA(p.bg, p.bgA ?? .6)};`;
  return css;
}
function shapePreview(s) {
  const c = s.color, svg = {
    ring: `<ellipse cx="50" cy="50" rx="38" ry="13" fill="none" stroke="${c}" stroke-width="5" style="filter:drop-shadow(0 0 6px ${c})"/>`,
    halo: `<ellipse cx="50" cy="50" rx="36" ry="30" fill="none" stroke="${c}" stroke-width="10" opacity=".55" style="filter:blur(3px)"/>`,
    pulse: `<circle cx="50" cy="50" r="14" fill="none" stroke="${c}" stroke-width="3"/><circle cx="50" cy="50" r="26" fill="none" stroke="${c}" stroke-width="3" opacity=".6"/><circle cx="50" cy="50" r="38" fill="none" stroke="${c}" stroke-width="3" opacity=".3"/>`,
    spark: `<path d="M50 12 L56 44 L88 50 L56 56 L50 88 L44 56 L12 50 L44 44Z" fill="${c}" style="filter:drop-shadow(0 0 6px ${c})"/>`,
    arrow: `<path d="M42 14h16v34h18L50 84 24 48h18z" fill="${c}"/>`,
    frame: `<rect x="14" y="26" width="72" height="48" rx="6" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="14 6" style="filter:drop-shadow(0 0 5px ${c})"/>`,
    underline: `<path d="M14 56 Q32 46 50 56 T86 56" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`,
    check: `<circle cx="50" cy="50" r="32" fill="none" stroke="${c}" stroke-width="6"/><path d="M36 50l10 10 18-20" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`
  }[s.id];
  return `<svg viewBox="0 0 100 100" style="width:80%;height:80%">${svg}</svg>`;
}
function patPreview(id) {
  return { grid: 'repeating-linear-gradient(0deg,rgba(0,200,215,.4) 0 1px,transparent 1px 10px),repeating-linear-gradient(90deg,rgba(0,200,215,.4) 0 1px,#16161a 1px 10px)', dots: 'radial-gradient(#e0306b 30%,transparent 32%) 0 0/12px 12px,#f5f0e6', stripes: 'repeating-linear-gradient(45deg,#ffcf3f 0 8px,#ff7a59 8px 16px)', bokeh: 'radial-gradient(circle at 30% 30%,rgba(255,120,200,.5) 0 18%,transparent 19%),radial-gradient(circle at 70% 65%,rgba(120,200,255,.5) 0 22%,transparent 23%),linear-gradient(#1a0b2e,#3a1a5a)', sunburst: 'repeating-conic-gradient(#ffb020 0 15deg,#ffcf3f 15deg 30deg)', paper: '#efe6d2' }[id];
}
function transPreview(id) {
  const a = '#1e6b78', b = '#6b3b8a';
  if (id.startsWith('wipe') || id === 'slide' || id.startsWith('push')) return `linear-gradient(${{ wipeL: 270, wipeR: 90, wipeU: 0, wipeD: 180, pushL: 270, pushR: 90, pushU: 0, slide: 270 }[id]}deg,${a} 50%,${b} 50%)`;
  if (id === 'circle' || id === 'heart') return `radial-gradient(circle,${b} 35%,${a} 36%)`;
  if (id === 'clock') return `conic-gradient(${b} 0 60%,${a} 60%)`;
  if (id === 'doors') return `linear-gradient(90deg,${a} 0 30%,${b} 30% 70%,${a} 70%)`;
  if (id === 'splitV') return `linear-gradient(${a} 0 30%,${b} 30% 70%,${a} 70%)`;
  if (id === 'blinds') return `repeating-linear-gradient(90deg,${a} 0 6px,${b} 6px 12px)`;
  if (id === 'pixelate') return `conic-gradient(${a} 0 25%,${b} 0 50%,${a} 0 75%,${b} 0) 0 0/16px 16px`;
  if (id === 'diag') return `linear-gradient(135deg,${b} 50%,${a} 50%)`;
  if (id === 'black') return `linear-gradient(90deg,${a},#000,${b})`;
  if (id === 'white') return `linear-gradient(90deg,${a},#fff,${b})`;
  return `linear-gradient(90deg,${a},${b})`;
}

/* ============ PANEL DE DETALLES ============ */
let editing = false;
const kfBtn = (c, p) => `<button class="kf${kfAt(c, p, localT(c)) >= 0 ? ' on' : ''}" data-kf="${p}" title="Añadir/quitar fotograma clave">${ic('diamond')}</button>`;
function sl(c, label, p, min, max, step, k = 1, unit = '', kf = false) {
  const raw = KF_PROPS.includes(p) ? kv(c, p, localT(c)) : (getP(c, p) ?? 0), disp = +(raw * k).toFixed(2);
  return `<div class="row${kf ? '' : ' nokf'}"><label title="${label}">${label}</label><input type="range" data-p="${p}" data-k="${k}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${disp}"><span class="val" data-v="${p}">${disp}${unit}</span>${kf ? kfBtn(c, p) : ''}</div>`;
}
const opt = (list, cur) => list.map(([v, n]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${n}</option>`).join('');
const selR = (c, label, p, list) => `<div class="row2"><label>${label}</label><select class="field" data-p="${p}">${opt(list, getP(c, p))}</select></div>`;
const colR = (c, label, p) => `<div class="row2"><label>${label}</label><input type="color" data-p="${p}" value="${getP(c, p)}"></div>`;
const swR = (c, label, p) => `<label class="row2" style="cursor:pointer"><span class="muted">${label}</span><span style="display:flex;justify-content:flex-end"><span class="switch"><input type="checkbox" data-p="${p}"${getP(c, p) ? ' checked' : ''}><span></span></span></span></label>`;
const chipsR = (c, p, list, num) => `<div class="chips">${list.map(([v, n]) => `<button class="chip${String(getP(c, p)) === String(v) ? ' on' : ''}" data-set="${p}" data-val="${v}"${num ? ' data-num' : ''}>${n}</button>`).join('')}</div>`;
const secR = (title, body, id = '', right = '') => `<div class="sec" data-sec="${id}"><h4><span class="hl">${title}</span>${right}</h4>${body}</div>`;
const durR = c => `<div class="row2"><label>Duración</label><input type="number" class="field" data-p="__dur" min="0.1" step="0.1" value="${dur(c).toFixed(2)}"></div>`;
const reset = k => `<button class="link" data-reset="${k}">Restablecer</button>`;
/* Clips que tienen un objeto elegido (para que otros los sigan) */
const trackables = c => S.clips.filter(k => k.id !== c.id && k.obj && isVisual(k));
function followRows(c) {
  const list = trackables(c);
  if (!list.length) return '<p class="hint">Para que siga a un objeto en movimiento: selecciona el video → Objeto (IA) → elige el objeto → «Seguir el objeto».</p>';
  return `<div class="row2"><label>Seguir objeto</label><select class="field" data-p="__follow"><option value="">No seguir</option>${list.map(k => `<option value="${k.id}"${c.follow && c.follow.id === k.id ? ' selected' : ''}>${esc(k.name)}${k.obj.track ? '' : ' (sin seguimiento)'}</option>`).join('')}</select></div>`
    + (c.follow ? swR(c, 'Cambiar tamaño con el objeto', 'follow.scale') + '<p class="hint">Con el seguimiento activo, Posición X/Y es la distancia al objeto.</p>' : '');
}
const transformSec = c => secR('Transformar', sl(c, 'Escala', 'scale', 5, 400, 1, 100, '%', true) + sl(c, 'Posición X', 'x', -150, 150, 1, 1, '', true) + sl(c, 'Posición Y', 'y', -150, 150, 1, 1, '', true) + sl(c, 'Rotación', 'rot', -180, 180, 1, 1, '°', true) + sl(c, 'Opacidad', 'opacity', 0, 100, 1, 100, '%', true)
  + `<div class="row2"><label>Interpolación</label><div style="display:flex;gap:6px;align-items:center"><select class="field" data-p="kfEase">${opt(KF_EASE, c.kfEase || 'smooth')}</select><button class="icon-btn" data-act="kfPrev" title="Fotograma clave anterior">${ic('chevL')}</button><button class="icon-btn" data-act="kfNext" title="Fotograma clave siguiente">${ic('chevR')}</button></div></div>`
  + followRows(c), 'basic', reset('basic'));

function propTabs(c) {
  if (S.msel.length > 1) return ['Selección'];
  if (!c) return ['Proyecto'];
  return { video: ['Video', 'Audio', 'Velocidad', 'Animación', 'Ajuste'], image: ['Imagen', 'Animación', 'Ajuste'], audio: ['Audio', 'Velocidad'], text: ['Texto', 'Animación'], sticker: ['Sticker', 'Animación'], effect: ['Efecto'], filter: ['Filtro'], adjust: ['Ajustes'] }[c.kind];
}
function objectSec(c) {
  const o = c.obj;
  let h = `<p class="hint" style="margin-bottom:8px">Haz clic en el botón y luego sobre el objeto en el reproductor (un zapato, una taza, una persona…).</p>
    <button class="btn block${S._pickObj === c.id ? ' primary' : ''}" data-act="pickObj">${ic('target')}${o ? 'Elegir otro objeto' : 'Seleccionar objeto'}</button>`;
  if (o) {
    h += `<div style="height:10px"></div>` + swR(c, 'Recortar objeto (quitar el resto)', 'obj.cut') + (o.cut ? swR(c, 'Invertir (quitar el objeto)', 'obj.invert') : '')
      + swR(c, 'Contorno de luz', 'obj.glow') + (o.glow ? colR(c, 'Color', 'obj.glowColor') + sl(c, 'Grosor', 'obj.glowSize', 2, 40, 1) : '')
      + (c.kind === 'video' ? `<div class="btnrow" style="margin:6px 0 8px"><button class="btn sm${o.track ? '' : ' primary'}" data-act="trackObj">${ic('target')}${o.track ? 'Volver a seguir' : 'Seguir el objeto'}</button>${o.track ? '<button class="btn sm" data-act="cancelTrack">Cancelar</button>' : ''}</div>` : '')
      + (o.track || c.kind === 'image' ? swR(c, 'Reencuadre automático (centrar el objeto)', 'obj.reframe') : '')
      + `<div class="sub">Adornos que lo siguen</div><div class="btnrow"><button class="btn sm" data-act="addRing">Aro de luz</button><button class="btn sm" data-act="addHalo">Aura</button><button class="btn sm" data-act="addFollowText">Texto</button></div>`
      + `<div style="height:8px"></div><button class="link" data-act="clearObj">Quitar objeto</button>`;
  }
  return secR(`Objeto (IA) ${proB(1)}`, h + `<p class="hint" id="objState" style="margin-top:6px">${o && o.track ? `Seguimiento: ${o.track.length} posiciones.` : objStateText()}</p>`, 'obj');
}
const PANELS = {
  Selección() {
    const list = selIds().map(clipById).filter(Boolean), vis = list.filter(c => isVisual(c) || isTextLike(c)), aud = list.filter(c => 'volume' in c), mainsSel = list.filter(c => c.trackId === 'main');
    const counts = {}; list.forEach(c => { counts[c.kind] = (counts[c.kind] || 0) + 1; });
    const names = { video: 'videos', image: 'imágenes', audio: 'audios', text: 'textos', sticker: 'stickers', effect: 'efectos', filter: 'filtros', adjust: 'ajustes' };
    return secR(`${list.length} clips seleccionados`, `<p class="hint" style="margin-bottom:10px">${Object.entries(counts).map(([k, n]) => `${n} ${names[k]}`).join(' · ')}</p>
        <div class="btnrow"><button class="btn sm" data-mact="dup">${ic('copy')}Duplicar</button><button class="btn sm" data-mact="copy">Copiar</button><button class="btn sm" data-mact="toPlayhead">Mover al cabezal</button><button class="btn sm danger" data-mact="del">${ic('trash')}Eliminar</button></div>`)
      + (vis.length ? secR('Aplicar a todos', `<div class="row2"><label>Filtro</label><select class="field" data-mp="filter"><option value="">—</option>${opt(FILTERS.map(f => [f.id, f.name]), '')}</select></div>
        <div class="row2"><label>Entrada</label><select class="field" data-mp="anim.in"><option value="">—</option>${opt(ANIM_IN, '')}</select></div>
        <div class="row2"><label>Salida</label><select class="field" data-mp="anim.out"><option value="">—</option>${opt(ANIM_OUT, '')}</select></div>
        <div class="row nokf"><label>Opacidad</label><input type="range" data-mp="opacity" data-k="100" min="0" max="100" value="100"><span class="val">100%</span></div>`) : '')
      + (aud.length ? secR('Audio de todos', `<div class="row nokf"><label>Volumen</label><input type="range" data-mp="volume" data-k="100" min="0" max="200" value="100"><span class="val">100%</span></div>
        <div class="row nokf"><label>Fundidos</label><input type="range" data-mp="fade" min="0" max="5" step=".1" value="0"><span class="val">0s</span></div>`) : '')
      + (mainsSel.length > 1 ? secR('Transición entre ellos', `<div class="row2"><label>Tipo</label><select class="field" data-mp="trans"><option value="">—</option><option value="none">Ninguna</option>${opt(TRANSITIONS.map(t => [t.id, t.name]), '')}</select></div>`) : '')
      + '<p class="hint">Arrastra cualquiera de los clips seleccionados para moverlos juntos. Ctrl/Shift + clic para añadir o quitar clips.</p>';
  },
  Proyecto() {
    const T = total();
    return secR('Proyecto', `<div class="row2"><label>Nombre</label><input class="field" data-pset="name" value="${esc(S.name)}"></div>
        <div class="row2"><label>Proporción</label><select class="field" data-pset="ratio">${opt(Object.keys(RATIOS).map(r => [r, RATIO_NAMES[r]]), S.ratio)}</select></div>
        <div class="row2"><label>Fotogramas</label><select class="field" data-pset="fps">${opt([24, 25, 30, 50, 60].map(f => [f, f + ' fps']), S.fps)}</select></div>`, 'ratio')
      + secR('Fondo del lienzo', `<div class="chips" style="margin-bottom:10px">${[['color', 'Color'], ['blur', 'Desenfoque']].map(([v, n]) => `<button class="chip${S.bgMode === v ? ' on' : ''}" data-pset-chip="bgMode" data-val="${v}">${n}</button>`).join('')}</div>
        ${S.bgMode === 'color' ? `<div class="row2"><label>Color</label><input type="color" data-pset="bg" value="${S.bg}"></div>` : `<div class="row nokf"><label>Desenfoque</label><input type="range" data-pset="bgBlur" min="4" max="60" value="${S.bgBlur}"><span class="val">${S.bgBlur}</span></div>`}`, 'canvas')
      + secR('Resumen', `<div class="kv">Duración <b>${fmt(T, S.fps)}</b></div><div class="kv">Clips <b>${S.clips.length}</b></div><div class="kv">Pistas <b>${S.tracks.length}</b></div><div class="kv">Archivos <b>${S.media.length}</b></div>`)
      + secR('Guardado', `<p class="hint">Todo se guarda automáticamente en este equipo, incluidos los archivos importados. Si el navegador se cierra, el proyecto sigue en Inicio.</p><button class="btn block" style="margin-top:10px" data-act="save">${ic('save')}Guardar ahora</button>`)
      + `<div class="note gold"><b>Pro desbloqueado.</b> Exportación rápida sin marca de agua hasta 4K/60 fps, voz a texto, texto a voz, recorte de objetos con seguimiento, quitar fondo, reducción de ruido y todos los efectos.</div>`;
  },
  Video(c) {
    const m = med(c.mediaId) || {}, cropping = S.cropMode === c.id;
    return transformSec(c)
      + secR('Mezcla', (c.trackId === 'main' ? '<p class="hint" style="margin-bottom:8px">Los modos de fusión se aplican a clips de superposición.</p>' : selR(c, 'Modo', 'blend', BLENDS))
        + `<div class="btnrow"><button class="btn sm" data-act="flipH">${ic('mirror')}Espejo</button><button class="btn sm" data-act="flipV">Voltear</button><button class="btn sm" data-act="rot90">${ic('rotate')}90°</button><button class="btn sm" data-act="fill">Rellenar</button><button class="btn sm" data-act="fit">Ajustar</button></div>`, 'blend')
      + secR('Recortar', `<button class="btn block${cropping ? ' primary' : ''}" data-act="${cropping ? 'cropDone' : 'cropOn'}" style="margin-bottom:10px">${ic('crop')}${cropping ? 'Listo' : 'Recortar en pantalla'}</button>
        <div class="chips" style="margin-bottom:10px">${CROP_RATIOS.map(([v, n]) => `<button class="chip${S.cropRatio === v ? ' on' : ''}" data-act="cropRatio" data-val="${v}">${n}</button>`).join('')}</div>`
        + sl(c, 'Izquierda', 'crop.l', 0, 90, 1, 100, '%') + sl(c, 'Derecha', 'crop.r', 0, 90, 1, 100, '%') + sl(c, 'Arriba', 'crop.t', 0, 90, 1, 100, '%') + sl(c, 'Abajo', 'crop.b', 0, 90, 1, 100, '%'), 'crop', reset('crop'))
      + objectSec(c)
      + secR('Máscara', `<div class="chips" style="margin-bottom:10px">${MASKS.map(([v, n]) => `<button class="chip${c.mask.type === v ? ' on' : ''}" data-set="mask.type" data-val="${v}">${n}</button>`).join('')}</div>`
        + (c.mask.type !== 'none' ? sl(c, 'Tamaño', 'mask.size', 5, 200, 1, 100, '%') + sl(c, 'Difuminar', 'mask.feather', 0, 80, 1) + sl(c, 'Rotación', 'mask.angle', -180, 180, 1, 1, '°') + (c.mask.type === 'rect' ? sl(c, 'Redondeo', 'mask.round', 0, 100, 1, 100, '%') : '') + swR(c, 'Invertir', 'mask.invert') : ''), 'mask')
      + secR('Croma', swR(c, 'Activar croma', 'chroma.on') + (c.chroma.on ? `<div class="row2"><label>Color</label><div style="display:flex;gap:6px"><input type="color" data-p="chroma.color" value="${c.chroma.color}"><button class="btn sm" data-act="pick" title="Elegir color en el reproductor">${ic('chroma')}</button></div></div>`
        + sl(c, 'Intensidad', 'chroma.k', 0, 100, 1, 100) + sl(c, 'Suavizado', 'chroma.soft', 0, 100, 1, 100) : ''), 'chroma')
      + secR(`Quitar fondo ${proB(1)}`, swR(c, 'Quitar fondo automático (personas)', 'rmbg') + `<p class="hint" id="rmbgState">${segStateText()}</p>`, 'rmbg')
      + (c.kind === 'video' ? secR('Reversa', `<button class="btn block" data-act="reverse">${ic('reverse')}${c.reversed ? 'Volver a la dirección normal' : 'Reproducir en reversa'}</button><p class="hint" style="margin-top:6px">Crea una copia al revés del clip (hasta 90 s).</p>`) : '')
      + (m.w ? `<p class="hint">Original: ${m.w}×${m.h}${m.duration && isFinite(m.duration) ? ' · ' + fmtDur(m.duration) : ''}</p>` : '');
  },
  Imagen(c) { return PANELS.Video(c) + secR('Tiempo', durR(c)); },
  Audio(c) {
    return secR('Básico', sl(c, 'Volumen', 'volume', 0, 200, 1, 100, '%', true) + sl(c, 'Fundido entrada', 'fadeIn', 0, 10, .1, 1, 's') + sl(c, 'Fundido salida', 'fadeOut', 0, 10, .1, 1, 's')
      + (c.kind === 'video' ? `<button class="btn block" data-act="detach">${ic('detach')}Separar audio</button>` : ''))
      + secR(`Mejorar voz ${proB(1)}`, swR(c, 'Reducción de ruido', 'denoise') + swR(c, 'Aislar voz', 'isolate') + swR(c, 'Normalizar volumen', 'normalize'))
      + secR('Cambiador de voz', chipsR(c, 'voice', VOICE_FX))
      + secR('Voz a texto', `<button class="btn block" data-act="captionThis">${ic('captions')}Crear subtítulos de este clip</button>`)
      + secR('Ritmo', `<p class="hint" style="margin-bottom:8px">${c.beats ? `${c.beats.length} ritmos detectados (puntos amarillos). Los clips se ajustan a ellos.` : 'Marca los golpes de la música para cortar al ritmo.'}</p><div class="btnrow"><button class="btn sm" data-act="beats">${ic('beat')}Detectar ritmo</button>${c.beats ? '<button class="btn sm" data-act="clearbeats">Quitar</button>' : ''}</div>`)
      + (c.kind === 'audio' ? secR('Tiempo', durR(c)) : '');
  },
  Velocidad(c) {
    const mode = S.psub.speed || (c.curve ? 'curve' : 'std');
    let h = `<div class="seg">${[['std', 'Estándar'], ['curve', 'Curva']].map(([v, n]) => `<button data-psub="speed" data-val="${v}" class="${mode === v ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (mode === 'std') {
      h += secR('Velocidad estándar', (c.curve ? '<p class="hint" style="margin-bottom:8px">Este clip usa una curva. Al cambiar la velocidad se quitará.</p>' : '')
        + sl(c, 'Velocidad', 'speed', .1, 10, .05, 1, 'x') + chipsR(c, 'speed', [[.5, '0.5x'], [1, '1x'], [1.5, '1.5x'], [2, '2x'], [3, '3x'], [5, '5x']], true)
        + `<div style="height:10px"></div>${swR(c, 'Mantener tono de voz', 'pitch')}<p class="hint">Duración: <b>${fmtDur(dur(c))}</b></p>`);
    } else {
      h += secR(`Curva de velocidad ${proB(1)}`, `<div class="grid g3">${CURVES.map(cu => `<div class="tile${c.curve && c.curve.join() === cu.pts.join() ? ' on' : ''}" data-curve="${cu.id}"><div class="pv" style="aspect-ratio:2">${miniCurve(cu.pts)}</div>${proB(cu.pro)}<span class="nm">${cu.name}</span></div>`).join('')}
        <div class="tile${c.curve && !CURVES.some(cu => cu.pts.join() === c.curve.join()) ? ' on' : ''}" data-curve="custom"><div class="pv" style="aspect-ratio:2">${ic('adjust')}</div><span class="nm">Personalizado</span></div></div>`)
        + (c.curve ? secR('Editar curva', `<svg class="curve-ed" id="curveEd" viewBox="0 0 240 120" preserveAspectRatio="none"></svg><p class="hint" style="margin-top:6px">Arrastra los puntos: arriba = más rápido. Duración: <b id="curveDur">${fmtDur(dur(c))}</b></p><button class="btn sm" data-act="nocurve" style="margin-top:8px">Quitar curva</button>`) : '');
    }
    return h;
  },
  Animación(c) {
    const g = S.psub.anim || 'in', list = g === 'in' ? ANIM_IN.filter(a => a[0] !== 'type' || isTextLike(c)) : g === 'out' ? ANIM_OUT : ANIM_LOOP;
    const dk = g === 'in' ? 'inD' : g === 'out' ? 'outD' : 'loopD';
    return `<div class="seg">${[['in', 'Entrada'], ['out', 'Salida'], ['loop', 'Bucle']].map(([v, n]) => `<button data-psub="anim" data-val="${v}" class="${g === v ? 'on' : ''}">${n}</button>`).join('')}</div>`
      + `<div class="grid g3">${list.map(([v, n]) => `<div class="tile${c.anim[g] === v ? ' on' : ''}" data-anim="${g}" data-val="${v}"><div class="pv" style="aspect-ratio:1.6;font-size:13px">${v === 'none' ? ic('close') : ic('effects')}</div><span class="nm">${n}</span></div>`).join('')}</div>`
      + (c.anim[g] !== 'none' ? `<div style="height:12px"></div>${sl(c, 'Duración', 'anim.' + dk, .1, g === 'loop' ? 4 : Math.max(.2, Math.min(5, dur(c))), .05, 1, 's')}` : '')
      + `<div class="note">Para animaciones a medida usa los <b>fotogramas clave</b> ◆ en Escala, Posición, Rotación, Opacidad, Brillo, Saturación y Desenfoque.</div>`;
  },
  Ajuste(c) {
    const cc = c.cc || VIS().cc;
    return secR('Filtro', selR(c, 'Filtro', 'filter', FILTERS.map(f => [f.id, f.name])) + (c.filter !== 'none' ? sl(c, 'Intensidad', 'filterK', 0, 100, 1, 100, '%', true) : ''))
      + secR('Color', sl(c, 'Brillo', 'adj.b', -100, 100, 1, 1, '', true) + sl(c, 'Contraste', 'adj.c', -100, 100, 1) + sl(c, 'Saturación', 'adj.s', -100, 100, 1, 1, '', true) + sl(c, 'Temperatura', 'adj.temp', -100, 100, 1)
        + sl(c, 'Tono', 'adj.hue', -180, 180, 1, 1, '°') + sl(c, 'Desenfoque', 'adj.blur', 0, 30, 1, 1, '', true) + sl(c, 'Viñeta', 'adj.vig', 0, 100, 1), 'adj', reset('adj'))
      + secR('Curvas', sl(c, 'Sombras', 'cc.sh', -100, 100, 1) + sl(c, 'Medios', 'cc.md', -100, 100, 1) + sl(c, 'Luces', 'cc.hl', -100, 100, 1), 'curves', reset('cc'))
      + secR('Ruedas de color', `<p class="hint" style="margin-bottom:8px">Tiñe las sombras, los tonos medios y las luces. Gris = sin cambio.</p>`
        + `<div class="row2"><label>Sombras</label><input type="color" data-p="cc.lift" value="${cc.lift}"></div><div class="row2"><label>Medios</label><input type="color" data-p="cc.gamma" value="${cc.gamma}"></div><div class="row2"><label>Luces</label><input type="color" data-p="cc.gain" value="${cc.gain}"></div>`, 'wheels');
  },
  Texto(c) {
    return secR('Contenido', `<textarea class="field" data-p="text" rows="3">${esc(c.text)}</textarea>`)
      + secR('Texto a voz', `<div class="row2"><label>Voz</label><select class="field" id="ttsVoiceP">${voiceOpts()}</select></div><button class="btn block" data-act="ttsThis">${ic('vol')}Leer este texto en voz alta</button><p class="hint" id="ttsProg" style="margin-top:6px"></p>`)
      + secR('Fuente', selR(c, 'Fuente', 'font', FONTS) + sl(c, 'Tamaño', 'size', 8, 300, 1)
        + `<div class="row2"><label>Estilo</label><div class="chips">${[['bold', '<b>B</b>'], ['italic', '<i>I</i>'], ['underline', '<u>U</u>']].map(([k, n]) => `<button class="chip${c[k] ? ' on' : ''}" data-flag="${k}">${n}</button>`).join('')}</div></div>`
        + colR(c, 'Color', 'color') + swR(c, 'Degradado', 'gradOn') + (c.gradOn ? colR(c, 'Color 2', 'grad2') : '')
        + `<div class="row2"><label>Alinear</label>${chipsR(c, 'align', [['left', 'Izq.'], ['center', 'Centro'], ['right', 'Der.']])}</div>`
        + sl(c, 'Curvar', 'arc', -100, 100, 1) + sl(c, 'Espaciado', 'ls', -5, 40, 1) + sl(c, 'Interlineado', 'lh', .8, 2.5, .05))
      + secR('Contorno', swR(c, 'Activar', 'strokeOn') + (c.strokeOn ? colR(c, 'Color', 'stroke') + sl(c, 'Grosor', 'strokeW', 1, 30, 1) : ''))
      + secR('Fondo', swR(c, 'Activar', 'bgOn') + (c.bgOn ? colR(c, 'Color', 'bg') + sl(c, 'Opacidad', 'bgA', 0, 100, 1, 100, '%') + sl(c, 'Redondeo', 'bgR', 0, 100, 1, 100, '%') : ''))
      + secR('Sombra y brillo', swR(c, 'Sombra', 'shadowOn') + (c.shadowOn ? colR(c, 'Color sombra', 'shadow') : '') + swR(c, 'Brillo neón', 'glowOn') + (c.glowOn ? colR(c, 'Color brillo', 'glow') : ''))
      + secR('Resaltado dinámico', swR(c, 'Resaltar palabra hablada', 'karaoke') + (c.karaoke ? colR(c, 'Color', 'hl') + `<div class="row2"><label>Tipo</label>${chipsR(c, 'kStyle', [['color', 'Color'], ['box', 'Caja']])}</div>` : '') + swR(c, 'Ajustar al ancho', 'wrap'))
      + transformSec(c) + secR('Tiempo', durR(c));
  },
  Sticker(c) {
    const head = c.shape
      ? colR(c, 'Color', 'color') + sl(c, 'Tamaño', 'size', 10, 600, 1) + sl(c, 'Grosor', 'strokeW', 1, 30, 1) + (['ring', 'halo', 'pulse', 'frame'].includes(c.shape) ? sl(c, 'Forma', 'squash', 10, 100, 1, 100, '%') : '')
      : `<div style="font-size:42px;text-align:center;margin-bottom:8px">${esc(c.text)}</div>` + sl(c, 'Tamaño', 'size', 20, 600, 1);
    return secR(c.shape ? (SHAPES.find(s => s.id === c.shape) || {}).name || 'Forma' : 'Sticker', head) + transformSec(c) + secR('Tiempo', durR(c));
  },
  Efecto(c) { return secR('Efecto', selR(c, 'Tipo', 'fxId', EFFECTS.map(e => [e.id, e.name])) + sl(c, 'Intensidad', 'k', 0, 100, 1, 100, '%') + durR(c)) + '<div class="note">Afecta a todas las pistas que están debajo durante su duración.</div>'; },
  Filtro(c) { return secR('Filtro', selR(c, 'Tipo', 'fxId', FILTERS.filter(f => f.id !== 'none').map(f => [f.id, f.name])) + sl(c, 'Intensidad', 'k', 0, 100, 1, 100, '%') + durR(c)); },
  Ajustes(c) { return secR('Capa de ajuste', sl(c, 'Brillo', 'adj.b', -100, 100, 1) + sl(c, 'Contraste', 'adj.c', -100, 100, 1) + sl(c, 'Saturación', 'adj.s', -100, 100, 1) + sl(c, 'Temperatura', 'adj.temp', -100, 100, 1) + sl(c, 'Tono', 'adj.hue', -180, 180, 1, 1, '°') + sl(c, 'Desenfoque', 'adj.blur', 0, 30, 1) + sl(c, 'Viñeta', 'adj.vig', 0, 100, 1) + sl(c, 'Intensidad', 'k', 0, 100, 1, 100, '%') + durR(c), 'adj', reset('adj')); }
};
function transPanel(B) {
  const cur = B.trans ? B.trans.type : 'none';
  return secR('Transición', `<div class="grid g3">${TRANSITIONS.map(t => `<div class="tile${cur === t.id ? ' on' : ''}" data-trans="${t.id}"><div class="pv" style="background:${transPreview(t.id)};aspect-ratio:1.6">${ic('transitions')}</div>${proB(t.pro)}<span class="nm">${t.name}</span></div>`).join('')}</div>`)
    + secR('Duración', `<div class="row nokf"><label>Duración</label><input type="range" data-tdur min="0.1" max="2" step="0.05" value="${B.trans ? B.trans.d : .5}"><span class="val" id="tdurV">${(B.trans ? B.trans.d : .5).toFixed(2)}s</span></div>`)
    + `<div class="btnrow"><button class="btn sm" data-transall>Aplicar a todos</button><button class="btn sm danger" data-trans="none">Quitar</button></div>`;
}
function miniCurve(pts) {
  let d = ''; for (let i = 0; i <= 40; i++) { const s = curveSpeed(pts, i / 40), y = 30 - Math.log10(s) * 26; d += (i ? 'L' : 'M') + (4 + i * 2.3).toFixed(1) + ' ' + clamp(y, 2, 58).toFixed(1); }
  return `<svg viewBox="0 0 100 60" style="width:90%;height:80%"><line x1="0" y1="30" x2="100" y2="30" stroke="#444" stroke-dasharray="3 3"/><path d="${d}" fill="none" stroke="#00c8d7" stroke-width="2.5"/></svg>`;
}
const ALIAS = { Video: { image: 'Imagen' }, Ajustar: { video: 'Ajuste', image: 'Ajuste' } };
function renderProps() {
  if (S.view !== 'editor') return;
  const P = $('#props'), grip = '<div class="sheet-grip m-only"></div>';
  if (S.selTrans) { const B = clipById(S.selTrans); if (B) { P.innerHTML = `${grip}<div class="ptabs"><button class="on">Transición</button></div><div class="pbody">${transPanel(B)}</div>`; return; } }
  const c = S.sel && clipById(S.sel), tabs = propTabs(c);
  if (S.ptabName) { const nm = (c && ALIAS[S.ptabName] && ALIAS[S.ptabName][c.kind]) || S.ptabName, i = tabs.indexOf(nm); if (i >= 0) S.ptab = i; S.ptabName = null; }
  S.ptab = Math.min(S.ptab, tabs.length - 1);
  const tab = tabs[S.ptab], sc = $('.pbody', P) ? $('.pbody', P).scrollTop : 0;
  P.innerHTML = `${grip}<div class="ptabs">${tabs.map((t, i) => `<button data-ptab="${i}" class="${i === S.ptab ? 'on' : ''}">${t}</button>`).join('')}</div><div class="pbody">${PANELS[tab](c)}</div>`;
  $('.pbody', P).scrollTop = sc;
  if (tab === 'Velocidad' && c.curve && $('#curveEd')) drawCurveEditor(c);
  fillIcons(P);
}
function openPropsTab(name, sec) {
  if (name) S.ptabName = name;
  renderProps();
  if (sec) requestAnimationFrame(() => { const el = $(`#props [data-sec="${sec}"]`); if (el) el.scrollIntoView({ block: 'start' }); });
  if (isMobile()) openSheet('props');
}
/* Al mover el cabezal, actualiza los valores animados por fotogramas clave */
function refreshPropValues() {
  const c = S.sel && clipById(S.sel); if (!c || !c.kf || !Object.keys(c.kf).length) return;
  const lt = localT(c);
  for (const p of KF_PROPS) {
    const inp = $(`#props input[data-p="${p}"]`); if (!inp) continue;
    const k = +inp.dataset.k || 1, v = +(kv(c, p, lt) * k).toFixed(2); inp.value = v;
    const l = $(`#props [data-v="${p}"]`); if (l) l.textContent = v + (inp.dataset.u || '');
    const b = $(`#props [data-kf="${p}"]`); if (b) b.classList.toggle('on', kfAt(c, p, lt) >= 0);
  }
}
/* Editor de curva de velocidad */
function drawCurveEditor(c) {
  const svg = $('#curveEd'), Y = s => 60 - Math.log10(s) * 55, X = i => 20 + i * 50;
  let d = ''; for (let i = 0; i <= 100; i++) { const s = curveSpeed(c.curve, i / 100); d += (i ? 'L' : 'M') + (20 + i * 2).toFixed(1) + ' ' + Y(s).toFixed(1); }
  svg.innerHTML = `<line x1="0" y1="60" x2="240" y2="60" stroke="#444" stroke-dasharray="4 4"/><text x="4" y="12" fill="#666" font-size="9">10x</text><text x="4" y="116" fill="#666" font-size="9">0.1x</text>
    <path d="${d}" fill="none" stroke="#00c8d7" stroke-width="2"/>${c.curve.map((s, i) => `<circle cx="${X(i)}" cy="${Y(s)}" r="6" fill="#fff" data-cp="${i}"/>`).join('')}`;
  svg.onpointerdown = e => {
    const cp = e.target.dataset.cp; if (cp == null) return;
    e.preventDefault(); svg.setPointerCapture(e.pointerId); commit();
    const r = svg.getBoundingClientRect();
    const mv = ev => {
      const y = clamp((ev.clientY - r.top) / r.height * 120, 5, 115); c.curve[+cp] = +clamp(Math.pow(10, (60 - y) / 55), .1, 10).toFixed(2);
      layout(); drawCurveEditor(c); const cd = $('#curveDur'); if (cd) cd.textContent = fmtDur(dur(c)); renderTLSoon(); markDirty();
    };
    const up = () => { svg.removeEventListener('pointermove', mv); svg.removeEventListener('pointerup', up); afterChange(); };
    svg.addEventListener('pointermove', mv); svg.addEventListener('pointerup', up);
  };
}
function onPropInput(e) {
  const t = e.target;
  if (t.id === 'ttsVoiceP') { S.ttsVoice = t.value; return; }
  if (t.dataset.pset) {
    const k = t.dataset.pset; let v = t.type === 'range' ? +t.value : t.value; if (k === 'fps') v = +v;
    S[k] = v;
    if (k === 'name') $('#projName').value = v;
    if (k === 'ratio' || k === 'fps') { setCanvasSize(); $('#ratioSel').value = S.ratio; renderTL(); }
    if (t.nextElementSibling && t.nextElementSibling.classList.contains('val')) t.nextElementSibling.textContent = v;
    invalidate(); markDirty(); return;
  }
  if (t.hasAttribute('data-tdur')) {
    const B = clipById(S.selTrans); if (!B || !B.trans) return;
    if (!editing) { commit(); editing = true; }
    B.trans.d = +t.value; $('#tdurV').textContent = (+t.value).toFixed(2) + 's'; layout(); renderTLSoon(); markDirty(); return;
  }
  if (t.dataset.mp) return onMultiInput(t);
  const p = t.dataset.p; if (!p) return;
  const c = clipById(S.sel); if (!c) return;
  if (!editing) { HIST.undo.push(snapshot()); HIST.redo = []; editing = true; updTools(); }
  let v = t.type === 'checkbox' ? t.checked : (t.type === 'range' || t.type === 'number') ? parseFloat(t.value) / (+t.dataset.k || 1) : t.value;
  if (p === '__dur') {
    if (!(v > 0)) return;
    const m = c.mediaId && med(c.mediaId), avg = (c.out - c.in) / dur(c); let out = c.in + v * avg;
    if (m && c.kind !== 'image' && isFinite(m.duration)) out = Math.min(out, m.duration);
    c.out = out; layout(); renderTLSoon(); markDirty(); return;
  }
  if (p === '__follow') { c.follow = v ? { id: v, scale: c.follow ? c.follow.scale : true } : null; if (v) { c.x = 0; c.y = 0; } invalidate(); markDirty(); return; }
  if (p === 'speed') c.curve = null;
  if (p.startsWith('cc.')) c.cc = { ...VIS().cc, ...(c.cc || {}) };
  setProp(c, p, v);
  if (p === 'text') c.words = null;
  if (p === 'fxId') c.name = (c.kind === 'effect' ? EFFECT_MAP[v] : FILTER_MAP[v]).name;
  const lbl = $(`#props [data-v="${p}"]`); if (lbl) lbl.textContent = t.value + (t.dataset.u || '');
  if (['speed', 'text', 'fxId', 'size'].includes(p) || (KF_PROPS.includes(p) && c.kf && c.kf[p])) { layout(); renderTLSoon(); }
  if (p === 'rmbg' && v) loadSegmenter();
  if ((p === 'obj.cut' || p === 'obj.glow') && v) loadISeg();
  markDirty();
}
/* Cambios aplicados a varios clips a la vez */
function onMultiInput(t) {
  const p = t.dataset.mp, list = selIds().map(clipById).filter(Boolean);
  if (!editing) { HIST.undo.push(snapshot()); HIST.redo = []; editing = true; }
  const raw = t.type === 'range' ? parseFloat(t.value) / (+t.dataset.k || 1) : t.value;
  if (t.type === 'range' && t.nextElementSibling) t.nextElementSibling.textContent = t.value + (p === 'fade' ? 's' : '%');
  if (raw === '') return;
  for (const c of list) {
    if (p === 'filter' && (isVisual(c))) c.filter = raw;
    if ((p === 'anim.in' || p === 'anim.out') && c.anim) setP(c, p, raw);
    if (p === 'opacity' && (isVisual(c) || isTextLike(c))) c.opacity = raw;
    if (p === 'volume' && 'volume' in c) c.volume = raw;
    if (p === 'fade' && 'fadeIn' in c) { c.fadeIn = raw; c.fadeOut = raw; }
  }
  if (p === 'trans') { const ms = mains().filter(c => list.includes(c)); ms.forEach((c, i) => { if (i > 0 || mains().indexOf(c) > 0) c.trans = raw === 'none' ? null : { type: raw, d: .5 }; }); layout(); renderTL(); }
  invalidate(); markDirty();
}
function onPropClick(e) {
  const b = e.target.closest('[data-ptab],[data-kf],[data-set],[data-flag],[data-reset],[data-psub],[data-anim],[data-curve],[data-act],[data-trans],[data-transall],[data-pset-chip],[data-mact]');
  if (!b) return;
  if (b.dataset.ptab) { S.ptab = +b.dataset.ptab; renderProps(); return; }
  if (b.dataset.psub) { S.psub[b.dataset.psub] = b.dataset.val; renderProps(); return; }
  if (b.dataset.psetChip) { S[b.dataset.psetChip] = b.dataset.val; renderProps(); invalidate(); markDirty(); return; }
  if (b.dataset.trans) { setTransition(clipById(S.selTrans) || transTarget(), b.dataset.trans); if (S.tab === 'transitions') renderLib(); return; }
  if (b.hasAttribute('data-transall')) { const B = clipById(S.selTrans) || transTarget(); if (B && B.trans) transToAll(B.trans.type, B.trans.d); return; }
  if (b.dataset.mact) {
    const a = b.dataset.mact;
    if (a === 'del') return del(); if (a === 'dup') return duplicate(); if (a === 'copy') return copySel(); if (a === 'toPlayhead') return moveSelectionTo(S.t);
    return;
  }
  const c = clipById(S.sel); if (!c) { if (b.dataset.act === 'save') saveProject(true); return; }
  const a = b.dataset.act;
  switch (a) {
    case 'save': return saveProject(true);
    case 'detach': return extractAudio(c);
    case 'beats': return detectBeats(c);
    case 'reverse': return reverseClip(c);
    case 'pick': cv.classList.add('pick'); S._pick = c.id; toast('Haz clic en el color que quieres eliminar'); return;
    case 'pickObj': return startPickObject(c);
    case 'trackObj': return trackObject(c);
    case 'cancelTrack': S._trackCancel = true; return;
    case 'addRing': return addTrackedShape(c, 'ring');
    case 'addHalo': return addTrackedShape(c, 'halo');
    case 'addFollowText': { const t = addText({ bold: true, size: 48, strokeOn: true, stroke: '#000000', strokeW: 5 }, { text: 'Texto', start: c.start, out: dur(c) }); t.follow = { id: c.id, scale: false }; t.y = -25; afterChange(); toast('Texto añadido: sigue al objeto'); return; }
    case 'cropOn': setCropMode(true); return;
    case 'cropDone': setCropMode(false); return;
    case 'cropRatio': applyCropRatio(c, b.dataset.val); renderProps(); return;
    case 'kfPrev': return jumpKF(-1);
    case 'kfNext': return jumpKF(1);
    case 'ttsThis': return ttsToTimeline(c.text, { start: c.start, textClip: c });
    case 'captionThis': { S.tab = 'captions'; S.sub.captions = 'auto'; renderResTabs(); renderLib(); const s = $('#capSrc'); if (s) s.value = 'sel'; if (isMobile()) openSheet('res'); return autoCaptions(); }
  }
  commit();
  if (b.dataset.kf) toggleKF(c, b.dataset.kf);
  if (b.dataset.set) { let v = b.dataset.val; if (b.hasAttribute('data-num')) v = +v; if (b.dataset.set === 'speed') c.curve = null; setP(c, b.dataset.set, v); }
  if (b.dataset.flag) c[b.dataset.flag] = !c[b.dataset.flag];
  if (b.dataset.anim) { c.anim[b.dataset.anim] = b.dataset.val; }
  if (b.dataset.curve) { const cu = CURVES.find(x => x.id === b.dataset.curve); c.curve = cu ? [...cu.pts] : (c.curve || [1, 1, 1, 1, 1]); }
  if (b.dataset.reset === 'basic') { Object.assign(c, { x: 0, y: 0, scale: 1, rot: 0, opacity: 1 }); if (c.kf) ['x', 'y', 'scale', 'rot', 'opacity'].forEach(k => delete c.kf[k]); }
  if (b.dataset.reset === 'crop') c.crop = { l: 0, t: 0, r: 0, b: 0 };
  if (b.dataset.reset === 'adj') c.adj = { b: 0, c: 0, s: 0, temp: 0, hue: 0, blur: 0, vig: 0 };
  if (b.dataset.reset === 'cc') c.cc = VIS().cc;
  if (a === 'flipH') c.flipH = !c.flipH;
  if (a === 'flipV') c.flipV = !c.flipV;
  if (a === 'rot90') { c.rot = ((c.rot || 0) + 90) % 360; if (c.rot > 180) c.rot -= 360; }
  if (a === 'fill' || a === 'fit') { const m = med(c.mediaId); if (m && m.w) { const [w, h] = RATIOS[S.ratio], cr = c.crop, sw = m.w * (1 - cr.l - cr.r), sh = m.h * (1 - cr.t - cr.b); c.scale = a === 'fit' ? 1 : Math.max(w / sw, h / sh) / Math.min(w / sw, h / sh); c.x = 0; c.y = 0; } }
  if (a === 'clearObj') { c.obj = null; S.clips.forEach(k => { if (k.follow && k.follow.id === c.id) k.follow = null; }); }
  if (a === 'clearbeats') c.beats = null;
  if (a === 'nocurve') { c.curve = null; S.psub.speed = 'std'; }
  afterChange();
}

/* ============ MÓVIL: barra inferior y hojas ============ */
const MBAR_MAIN = [['import', 'Importar', 'plus'], ['edit', 'Editar', 'cut'], ['t:audio', 'Audio', 'audio'], ['t:text', 'Texto', 'text'], ['t:stickers', 'Stickers', 'sticker'], ['t:media', 'Superposición', 'overlay'], ['t:effects', 'Efectos', 'effects'], ['t:transitions', 'Transiciones', 'transitions'], ['t:captions', 'Subtítulos', 'captions'], ['tts', 'Texto a voz', 'vol'], ['t:filters', 'Filtros', 'filters'], ['t:adjust', 'Ajuste', 'adjust'], ['multi', 'Selección múltiple', 'copy'], ['proj:ratio', 'Formato', 'ratio'], ['proj:canvas', 'Lienzo', 'canvas'], ['t:templates', 'Plantillas', 'template'], ['rec', 'Grabar', 'mic']];
function renderMbar() {
  const bar = $('#mbar'); if (!bar) return;
  const c = S.sel && clipById(S.sel); let items;
  if (S.selTrans) items = [['back', '', 'chevL'], ['open', 'Transición', 'transitions'], ['delt', 'Quitar', 'trash', 'danger']];
  else if (S.msel.length > 1 || S.multiMode) items = [['back', '', 'chevL'], ['info', `${selIds().length} seleccionados`, 'copy'], ['dup', 'Duplicar', 'copy'], ['toPlayhead', 'Al cabezal', 'chevR'], ['open', 'Opciones', 'adjust'], ['del', 'Eliminar', 'trash', 'danger']];
  else if (!c) items = MBAR_MAIN;
  else {
    items = [['back', '', 'chevL'], ['split', 'Dividir', 'split']];
    if (c.kind === 'video') items.push(['p:Velocidad', 'Velocidad', 'speed'], ['p:Audio', 'Volumen', 'vol']);
    if (c.kind === 'audio') items.push(['p:Audio', 'Volumen', 'vol'], ['p:Velocidad', 'Velocidad', 'speed']);
    if (isVisual(c)) items.push(['crop', 'Recortar', 'crop'], ['pickObj', 'Objeto IA', 'target'], ['p:Animación', 'Animación', 'effects'], ['p:Ajuste', 'Ajustar', 'adjust'], ['p:Video#mask', 'Máscara', 'mask'], ['p:Video#chroma', 'Croma', 'chroma'], ['p:Video#rmbg', 'Quitar fondo', 'bgremove']);
    if (c.kind === 'video') items.push(['reverse', 'Reversa', 'reverse'], ['detach', 'Separar audio', 'detach'], ['freeze', 'Congelar', 'freeze']);
    if (isTextLike(c)) items.push(['p:' + (c.kind === 'text' ? 'Texto' : 'Sticker'), 'Editar', 'text'], ['p:Animación', 'Animación', 'effects']);
    if (c.kind === 'text') items.push(['ttsThis', 'Leer en voz', 'vol']);
    if (isFxLike(c)) items.push(['p:', 'Ajustes', 'adjust']);
    if (isVisual(c)) items.push(c.trackId === 'main' ? ['ov', 'A superposición', 'overlay'] : ['tomain', 'A principal', 'film']);
    items.push(['multi', 'Selección múltiple', 'copy'], ['dup', 'Duplicar', 'copy'], ['del', 'Eliminar', 'trash', 'danger']);
  }
  bar.innerHTML = items.map(([a, n, i, cls]) => `<button data-m="${a}" class="${a === 'back' ? 'back ' : ''}${cls || ''}">${ic(i)}${n ? `<span>${n}</span>` : ''}</button>`).join('');
}
function onMbar(a) {
  const c = S.sel && clipById(S.sel);
  if (a === 'back') { S.multiMode = false; return selectClip(null); }
  if (a === 'edit') { const m = clipAtPlayhead(false) || mains()[0]; if (m) selectClip(m.id); else { S.tab = 'media'; renderResTabs(); renderLib(); openSheet('res'); } return; }
  if (a.startsWith('t:')) { S.tab = a.slice(2); renderResTabs(); renderLib(); openSheet('res'); return; }
  if (a.startsWith('proj:')) { selectClip(null); openPropsTab('Proyecto', a.slice(5)); return; }
  if (a.startsWith('p:')) { const [tab, sec] = a.slice(2).split('#'); openPropsTab(tab || null, sec); return; }
  switch (a) {
    case 'import': return openImport();
    case 'split': return split();
    case 'dup': return duplicate();
    case 'del': S.multiMode = false; return del();
    case 'delt': return setTransition(clipById(S.selTrans), 'none');
    case 'open': return openSheet('props');
    case 'detach': return extractAudio(c);
    case 'freeze': return freezeFrame();
    case 'reverse': return reverseClip(c);
    case 'crop': setCropMode(!S.cropMode); return;
    case 'pickObj': return startPickObject(c);
    case 'ttsThis': return ttsToTimeline(c.text, { start: c.start, textClip: c });
    case 'tts': S.tab = 'audio'; S.sub.audio = 'tts'; renderResTabs(); renderLib(); openSheet('res'); return;
    case 'multi': S.multiMode = true; renderMbar(); toast('Toca los clips para añadirlos o quitarlos de la selección'); return;
    case 'toPlayhead': return moveSelectionTo(S.t);
    case 'ov': return toOverlay(c);
    case 'tomain': return toMain(c);
    case 'rec': return toggleRecord();
  }
}
function openSheet(which) {
  if (!isMobile()) return;
  closeSheets();
  (which === 'res' ? $('#resPanel') : $('#props')).classList.add('open');
  $('#sheetBackdrop').classList.add('show');
}
function closeSheets() { $$('.sheet.open').forEach(s => s.classList.remove('open')); $('#sheetBackdrop').classList.remove('show'); }

/* ============ EVENTOS ============ */
function initPanels() {
  $('#resTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; renderResTabs(); renderLib(); });
  $('#resSub').addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (!b) return; S.sub[S.tab] = b.dataset.sub; renderLib(); });
  const rc = $('#resContent');
  rc.addEventListener('change', e => { if (e.target.id === 'ttsVoice') S.ttsVoice = e.target.value; if (e.target.id === 'capModel') S.asrModel = e.target.value; });
  rc.addEventListener('click', async e => {
    const t = e.target.closest('[data-import],[data-add],[data-lib],[data-preview],[data-libadd],[data-rec],[data-text],[data-tstyle],[data-ttpl],[data-sticker],[data-shape],[data-effect],[data-trans],[data-transall],[data-filter],[data-adjp],[data-tpl],[data-goto],#capGo,#capManual,#srtImport,#srtExport,#ttsGo,#ttsAll,#avFromVideo');
    if (!t) return;
    const done = () => { if (isMobile()) closeSheets(); };
    const d = t.dataset;
    if (d.import) { e.preventDefault(); openImport({ toTimeline: isMobile() || !S.clips.length }); return; }
    if (d.add) { addMediaClip(med(d.add), {}); done(); return; }
    if (d.lib) { const [k, a, b] = d.lib.split(':'); const names = { color: 'Color', grad: 'Degradado', pat: (LIB_PATTERNS.find(p => p[0] === a) || [])[1] }; await addLibraryBg(k === 'pat' ? 'pattern' : k, a, b, names[k] || 'Fondo'); done(); return; }
    if (d.preview) { const [k, id] = d.preview.split(':'); previewLib(k, id, t); return; }
    if (d.libadd) { const [k, id] = d.libadd.split(':'); t.innerHTML = '…'; const m = await libAudio(k, id); t.innerHTML = ic('plus'); addMediaClip(m, { start: S.t }); done(); return; }
    if (d.goto) { const [tab, sub] = d.goto.split(':'); S.tab = tab; S.sub[tab] = sub; renderResTabs(); renderLib(); return; }
    if (t.hasAttribute('data-rec')) { toggleRecord(); return; }
    if (t.hasAttribute('data-text') && !d.tstyle && !d.ttpl) { addText(); done(); return; }
    if (d.tstyle) { addText({ ...TEXT_STYLES[+d.tstyle].s }); done(); return; }
    if (d.ttpl) { const tp = TEXT_TEMPLATES[+d.ttpl]; addText({ ...tp.s }, { text: tp.text, anim: tp.anim }); done(); return; }
    if (d.sticker) { addSticker(d.sticker); done(); return; }
    if (d.shape) { const s = SHAPES.find(x => x.id === d.shape); addText({}, { kind: 'sticker', shape: s.id, text: '', name: s.name, color: s.color, size: 120, strokeW: 6, squash: s.id === 'ring' ? .32 : .9, anim: { in: 'fade', inD: .3 } }); done(); return; }
    if (d.effect) { addFx('effect', d.effect); done(); return; }
    if (d.filter) { addFx('filter', d.filter); done(); return; }
    if (d.adjp) { const p = ADJ_PRESETS[+d.adjp]; const c = addFx('adjust', null, p.adj); if (+d.adjp) { c.name = p.name; renderTL(); } done(); return; }
    if (d.trans) { setTransition(transTarget(), d.trans); renderLib(); return; }
    if (t.hasAttribute('data-transall')) { const B = transTarget(); if (B && B.trans) transToAll(B.trans.type, B.trans.d); return; }
    if (d.tpl) { applyTemplate(d.tpl); done(); return; }
    if (t.id === 'capGo') return autoCaptions();
    if (t.id === 'capManual') return manualCaptions();
    if (t.id === 'srtImport') return $('#srtIn').click();
    if (t.id === 'srtExport') return exportSRT();
    if (t.id === 'ttsGo') { S.ttsVoice = $('#ttsVoice').value; return ttsToTimeline($('#ttsText').value, { addCaption: $('#ttsCap').checked }); }
    if (t.id === 'ttsAll') { S.ttsVoice = $('#ttsVoice').value; return readAllTexts(); }
    if (t.id === 'avFromVideo') return $('#avIn').click();
  });
  rc.addEventListener('dragstart', e => { const c = e.target.closest('[data-mid]'); if (!c) return; e.dataTransfer.setData('text/mid', c.dataset.mid); const m = med(c.dataset.mid); S._dragKind = m && m.type === 'audio' ? 'audio' : 'video'; });
  rc.addEventListener('dragover', e => { const d = e.target.closest('.dropzone'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  rc.addEventListener('dragleave', e => { const d = e.target.closest('.dropzone'); if (d) d.classList.remove('over'); });
  rc.addEventListener('drop', e => { if (e.dataTransfer.files.length) { e.preventDefault(); e.stopPropagation(); importFiles(e.dataTransfer.files); } });
  const P = $('#props');
  P.addEventListener('input', onPropInput);
  P.addEventListener('change', e => {
    editing = false;
    const p = e.target.dataset.p;
    if (e.target.dataset.mp) { afterChange(); return; }
    if (p && (e.target.type === 'checkbox' || e.target.tagName === 'SELECT' || ['speed', 'size', '__dur'].includes(p))) { afterChange(); return; }
    if (e.target.dataset.pset === 'ratio') renderProps();
    if (e.target.hasAttribute('data-tdur')) afterChange();
    updTools(); renderTLSoon();
  });
  P.addEventListener('click', onPropClick);
  $('#mbar').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) onMbar(b.dataset.m); });
  $('#sheetBackdrop').addEventListener('click', closeSheets);
  // Deslizar hacia abajo la hoja para cerrarla
  $$('.sheet').forEach(sh => {
    let y0 = null;
    sh.addEventListener('touchstart', e => { if (e.target.closest('.sheet-grip,.res-tabs,.ptabs')) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', e => { if (y0 != null && e.touches[0].clientY - y0 > 60) { closeSheets(); y0 = null; } }, { passive: true });
    sh.addEventListener('touchend', () => { y0 = null; }, { passive: true });
  });
}

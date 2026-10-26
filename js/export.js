'use strict';
/* =========================================================
   export.js — exportar video, audio, fotograma y subtítulos.
   - Rápido: WebCodecs + mp4-muxer. Dibuja fotograma a fotograma y
     codifica en H.264/AAC, sin esperar al tiempo real.
   - Compatibilidad: graba el lienzo en tiempo real (MediaRecorder).
   Sin marca de agua.
   ========================================================= */

const BITRATES = { low: .5, rec: 1, high: 2 };
const fastSupported = () => !!(window.VideoEncoder && window.AudioEncoder && window.VideoFrame);
function videoFormats() {
  if (!window.MediaRecorder) return [];
  return [
    ['mp4', 'MP4 (H.264)', ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']],
    ['webm', 'WebM (VP9)', ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']]
  ].map(([id, n, l]) => [id, n, l.find(t => MediaRecorder.isTypeSupported(t))]).filter(x => x[2]);
}
function openExport() {
  if (!total()) return toast('La línea de tiempo está vacía');
  pause(); hideMenus();
  const fm = videoFormats(), fast = fastSupported(), res = [[480, '480p'], [720, '720p'], [1080, '1080p'], [1440, '2K'], [2160, '4K']];
  $('#exportBody').innerHTML = `<h2>Exportar <button class="icon-btn" data-close>${ic('close')}</button></h2>
  <div class="exp-grid">
    <div><div class="exp-cover"><img src="${projectThumb(480)}" alt="Portada"></div>
      <p class="hint" style="margin-top:8px">${fmt(total(), S.fps)} · ${S.ratio}</p>
      <div class="note gold"><b>Sin marca de agua.</b> 2K, 4K y 60 fps incluidos (en CapCut son Pro).</div></div>
    <div>
      <div class="row2"><label>Título</label><input class="field" id="exName" value="${esc(S.name)}"></div>
      <div class="exp-sec${fm.length || fast ? '' : ' off'}"><label class="hd"><input type="checkbox" id="exVideo"${fm.length || fast ? ' checked' : ' disabled'}> Video</label>
        <div class="row2"><label>Modo</label><select class="field" id="exMode">${fast ? '<option value="fast" selected>Rápido (recomendado)</option>' : ''}<option value="rt">Compatibilidad (tiempo real)</option></select></div>
        <div class="row2"><label>Resolución</label><select class="field" id="exRes">${res.map(([v, n]) => `<option value="${v}"${v === 1080 ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="row2"><label>Tasa de bits</label><select class="field" id="exBr"><option value="low">Más baja</option><option value="rec" selected>Recomendada</option><option value="high">Más alta</option></select></div>
        <div class="row2" id="exFmtRow"><label>Formato</label><select class="field" id="exFmt">${fm.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select></div>
        <div class="row2"><label>Fotogramas</label><select class="field" id="exFps">${[24, 25, 30, 50, 60].map(f => `<option${f === S.fps ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
        <p class="hint" id="exSize"></p></div>
      <div class="exp-sec off"><label class="hd"><input type="checkbox" id="exAudio"> Solo audio (.wav)</label><p class="hint">La mezcla de audio completa, al instante.</p></div>
      <div class="exp-sec off"><label class="hd"><input type="checkbox" id="exSrt"> Subtítulos (.srt)</label><p class="hint">Todos los textos de la línea de tiempo con sus tiempos.</p></div>
      <div class="exp-sec off"><label class="hd"><input type="checkbox" id="exPng"> Fotograma actual (.png)</label><p class="hint">Captura en 1080p del cabezal.</p></div>
    </div>
  </div>
  <div class="progress" id="exProgWrap" hidden><div id="exBar"></div></div><p class="hint" id="exHint" style="margin-top:6px"></p>
  <div class="actions"><span class="grow"></span><button class="btn" id="exCancel">Cancelar</button><button class="btn primary" id="exGo">${ic('download')}Exportar</button></div>`;
  const body = $('#exportBody');
  body.querySelectorAll('.exp-sec input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => { cb.closest('.exp-sec').classList.toggle('off', !cb.checked); estimate(); }));
  ['exRes', 'exBr', 'exFps', 'exMode'].forEach(id => { const el = $('#' + id); if (el) el.addEventListener('change', estimate); });
  $('#exGo').onclick = startExport; $('#exCancel').onclick = cancelExport;
  estimate();
  $('#exportModal').hidden = false;
}
function exportDims(res) { const [w, h] = RATIOS[S.ratio], k = res / Math.min(w, h); return [Math.round(w * k / 2) * 2, Math.round(h * k / 2) * 2]; }
function estimate() {
  const el = $('#exSize'); if (!el || !$('#exRes')) return;
  const fast = $('#exMode') && $('#exMode').value === 'fast';
  $('#exFmtRow').hidden = fast;
  const [w, h] = exportDims(+$('#exRes').value), fps = +$('#exFps').value, bps = w * h * fps * .1 * BITRATES[$('#exBr').value];
  el.textContent = `${w}×${h} · ~${(bps / 1e6).toFixed(1)} Mbps · tamaño aprox. ${(bps * total() / 8 / 1048576).toFixed(1)} MB`;
  $('#exHint').textContent = fast ? 'Modo rápido: se procesa fotograma a fotograma y suele ir más rápido que el tiempo real.' : 'Modo compatibilidad: se graba en tiempo real. Mantén esta pestaña visible.';
}
async function startExport() {
  const wantV = $('#exVideo').checked, wantA = $('#exAudio').checked, wantS = $('#exSrt').checked, wantP = $('#exPng').checked;
  const name = safeName($('#exName').value || S.name);
  if (!wantV && !wantA && !wantS && !wantP) return toast('Elige al menos una opción');
  if (wantP) await exportFrame(name);
  if (wantS) exportSRT(name);
  if (wantA) await exportWav(name);
  if (!wantV) { $('#exportModal').hidden = true; return; }
  const res = +$('#exRes').value, fps = +$('#exFps').value, br = $('#exBr').value;
  if ($('#exMode').value === 'fast') return exportFastVideo(name, res, fps, br);
  return exportRealtime(name, res, fps, br);
}

/* ---------- Mezcla de audio sin conexión (rápida y exacta) ---------- */
async function mixAudio(T) {
  const list = S.clips.filter(c => (c.kind === 'audio' || c.kind === 'video') && c.mediaId && !c.detached && !(trackById(c.trackId) || {}).mute && (med(c.mediaId) || {}).hasAudio !== false);
  if (!list.length || !T) return null;
  const sr = 48000, oc = new OfflineAudioContext(2, Math.ceil(T * sr) + 1, sr);
  for (const c of list) {
    const m = med(c.mediaId), b = await decodedBuffer(m); if (!b) continue;
    const src = oc.createBufferSource(), d = dur(c), g = oc.createGain(); src.buffer = b;
    if (c.curve) for (let s = 0; s <= 48; s++) { const lt = d * s / 48; src.playbackRate.setValueAtTime(clamp(rateAt(c, lt), .0625, 16), c.start + lt); }
    else src.playbackRate.value = c.speed || 1;
    const n = Math.max(1, Math.ceil(d * 30));
    for (let s = 0; s <= n; s++) {
      const lt = Math.min(d, s / 30); let v = kv(c, 'volume', lt);
      if (c.fadeIn > 0) v *= clamp(lt / c.fadeIn, 0, 1); if (c.fadeOut > 0) v *= clamp((d - lt) / c.fadeOut, 0, 1);
      if (s === 0) g.gain.setValueAtTime(v, c.start); else g.gain.linearRampToValueAtTime(v, c.start + lt);
    }
    buildFxChain(oc, src, c, [], c.start).connect(g); g.connect(oc.destination);
    src.start(c.start, clamp(c.in, 0, b.duration), Math.max(0, c.out - c.in));
  }
  return oc.startRendering();
}
async function exportWav(name) {
  toast('Mezclando audio…');
  const ab = await mixAudio(total());
  if (!ab) return toast('El proyecto no tiene audio');
  download(wavBlob(ab), `${name}.wav`); toast('Audio exportado (.wav)');
}

/* ---------- Codificador MP4 (WebCodecs) reutilizable ---------- */
let MUXER = null;
function loadMuxer() { if (!MUXER) MUXER = import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm'); return MUXER; }
async function encodeMP4({ width, height, fps, frames, drawFrame, audio, bitrate, onProgress, isCancelled }) {
  const M = await loadMuxer();
  const vcfg = { codec: width * height > 1920 * 1088 ? 'avc1.640033' : 'avc1.640028', width, height, bitrate: Math.round(bitrate), framerate: fps };
  if (!(await VideoEncoder.isConfigSupported(vcfg)).supported) vcfg.codec = 'avc1.42003e';
  const acfg = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 };
  const useAudio = !!audio && (await AudioEncoder.isConfigSupported(acfg)).supported;
  const target = new M.ArrayBufferTarget();
  const muxer = new M.Muxer({ target, video: { codec: 'avc', width, height, frameRate: fps }, audio: useAudio ? { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
  let err = null;
  const ve = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => { err = e; } });
  ve.configure(vcfg);
  if (useAudio) {
    const ae = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: e => { err = e; } }); ae.configure(acfg);
    const L = audio.getChannelData(0), R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L, n = audio.length, CH = 4096;
    for (let i = 0; i < n; i += CH) {
      const k = Math.min(CH, n - i), data = new Float32Array(k * 2); data.set(L.subarray(i, i + k), 0); data.set(R.subarray(i, i + k), k);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: k, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data });
      ae.encode(ad); ad.close();
    }
    await ae.flush(); ae.close();
  }
  for (let i = 0; i < frames; i++) {
    if (err) throw err;
    if (isCancelled && isCancelled()) { try { ve.close(); } catch (e) { } return null; }
    const src = await drawFrame(i);
    const vf = new VideoFrame(src, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    ve.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
    while (ve.encodeQueueSize > 6) await sleep(4);
    if (onProgress && i % 4 === 0) { onProgress(i / frames); await sleep(0); }
  }
  await ve.flush(); ve.close(); if (err) throw err;
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}
/* Deja cada video exactamente en el fotograma que toca antes de dibujar */
async function prepareFrame() {
  syncMedia();
  const T = total(), t = S.t >= T ? T - 1e-3 : S.t, waits = [];
  for (const c of S.clips) {
    if (c.kind !== 'video' || !(t >= c.start && t < endOf(c))) continue;
    const el = c._el; if (!el) continue;
    const exp = srcTime(c, t - c.start);
    if (el.seeking || el.readyState < 2 || Math.abs(el.currentTime - exp) > .5 / S.fps) {
      if (!el.seeking) el.currentTime = exp;
      waits.push(new Promise(r => { const f = () => { el.removeEventListener('seeked', f); r(); }; el.addEventListener('seeked', f); setTimeout(f, 2000); }));
    }
  }
  await Promise.all(waits);
}
async function exportFastVideo(name, res, fps, br) {
  const ex = { fast: true, cancelled: false, t0: performance.now() };
  pause(); S.sel = null; S.msel = []; S.selTrans = null; S.cropMode = null; renderTL(); renderProps();
  S.exporting = ex; S.exportScale = res / 720; setCanvasSize();
  $('#exGo').disabled = true; $('#exProgWrap').hidden = false; $('#exHint').textContent = 'Mezclando audio…';
  const T = total(), N = Math.max(1, Math.round(T * fps)), t0 = S.t;
  try {
    const audio = await mixAudio(T);
    const blob = await encodeMP4({
      width: W, height: H, fps, frames: N, audio, bitrate: W * H * fps * .1 * BITRATES[br], isCancelled: () => ex.cancelled,
      drawFrame: async i => { S.t = Math.min(i / fps, T - 1e-3); await prepareFrame(); draw(); return cv; },
      onProgress: p => { const el = (performance.now() - ex.t0) / 1000; $('#exBar').style.width = (p * 100) + '%'; $('#exHint').textContent = `Exportando… ${Math.round(p * 100)}% · ${el.toFixed(0)} s`; }
    });
    if (blob) {
      const secs = (performance.now() - ex.t0) / 1000;
      download(blob, `${name}.mp4`);
      $('#exBar').style.width = '100%'; $('#exHint').textContent = `Listo: ${name}.mp4 · ${(blob.size / 1048576).toFixed(1)} MB en ${secs.toFixed(1)} s (${(T / secs).toFixed(1)}× tiempo real)`;
      toast('Exportación completada'); setTimeout(() => { $('#exportModal').hidden = true; }, 2200);
    }
  } catch (e) {
    console.warn('Exportación rápida:', e);
    $('#exHint').textContent = 'La exportación rápida falló en este navegador. Elige el modo Compatibilidad.';
    toast('La exportación rápida falló');
  } finally {
    S.exporting = null; S.exportScale = 1; setCanvasSize(); S.t = t0; invalidate();
    const g = $('#exGo'); if (g) g.disabled = false;
  }
}

/* ---------- Modo compatibilidad: grabación en tiempo real ---------- */
async function exportRealtime(name, res, fps, br) {
  if (!window.MediaRecorder) return toast('Tu navegador no permite exportar');
  ensureAudio();
  S.sel = null; S.msel = []; S.selTrans = null; S.cropMode = null; renderTL(); renderProps();
  const f = videoFormats().find(x => x[0] === $('#exFmt').value) || videoFormats()[0];
  const mime = f[2], ext = f[0];
  S.exportScale = res / 720; setCanvasSize();
  const stream = new MediaStream([...cv.captureStream(fps).getVideoTracks(), ...recDest.stream.getAudioTracks()]);
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(W * H * fps * .1 * BITRATES[br]), audioBitsPerSecond: 192000 }); }
  catch (e) { restoreAfterExport(); return toast('No se pudo iniciar la exportación con ese formato'); }
  const chunks = [], ex = { rec, cancelled: false, t0: performance.now() };
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    restoreAfterExport();
    if (ex.cancelled) return;
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    download(blob, `${name}.${ext}`);
    $('#exBar').style.width = '100%'; $('#exHint').textContent = `Listo: ${name}.${ext} · ${(blob.size / 1048576).toFixed(1)} MB`;
    toast('Exportación completada'); setTimeout(() => { $('#exportModal').hidden = true; }, 1600);
  };
  S.exporting = ex;
  try { masterGain.disconnect(AC.destination); } catch (e) { }      // sin sonido por los altavoces mientras exporta
  $('#exGo').disabled = true; $('#exProgWrap').hidden = false; $('#exHint').textContent = 'Preparando…';
  S.t = 0; syncMedia(); draw();
  await sleep(450);
  if (ex.cancelled) return;
  rec.start(250); S.playing = true; updPlayBtn();
}
function updExportProgress() {
  const T = total(), p = clamp(S.t / T, 0, 1), bar = $('#exBar'); if (!bar) return;
  bar.style.width = (p * 100) + '%';
  $('#exHint').textContent = `Exportando… ${Math.round(p * 100)}% · quedan ~${Math.max(0, Math.ceil(T - S.t))} s. Mantén esta pestaña visible.`;
}
function finishExport() {
  const ex = S.exporting; if (!ex || ex.fast) return;
  S.exporting = null; S.playing = false; updPlayBtn();
  if (ex.rec.state !== 'inactive') ex.rec.stop(); else restoreAfterExport();
}
function restoreAfterExport() {
  try { masterGain.connect(AC.destination); } catch (e) { }
  S.exportScale = 1; setCanvasSize(); invalidate();
  const g = $('#exGo'); if (g) g.disabled = false;
}
function cancelExport() {
  if (S.exporting) { S.exporting.cancelled = true; if (!S.exporting.fast) finishExport(); toast('Exportación cancelada'); }
  $('#exportModal').hidden = true;
}

/* ---------- Video en reversa (crea un archivo nuevo al revés) ---------- */
async function reverseClip(c = S.sel && clipById(S.sel)) {
  if (!c || c.kind !== 'video') return toast('Selecciona un clip de video');
  if (!fastSupported()) return toast('Tu navegador no permite crear la reversa');
  const m = med(c.mediaId), len = c.out - c.in;
  if (len > 90) return toast('La reversa admite clips de hasta 90 s. Divide el clip primero.');
  const fps = 30, N = Math.max(1, Math.round(len * fps)), k = Math.min(1, 1920 / Math.max(m.w, m.h));
  const w = Math.round(m.w * k / 2) * 2, h = Math.round(m.h * k / 2) * 2;
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = m.url;
  await new Promise(r => { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 4000); });
  const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = h; const x = cnv.getContext('2d');
  const seekTo = t => new Promise(r => { const f = () => { v.removeEventListener('seeked', f); r(); }; v.addEventListener('seeked', f); v.currentTime = t; setTimeout(f, 2500); });
  let rev = null;
  if (m.hasAudio !== false) {
    const b = await decodedBuffer(m);
    if (b) {
      const a = Math.floor(c.in * b.sampleRate), z = Math.min(b.length, Math.floor(c.out * b.sampleRate));
      rev = new AudioBuffer({ length: Math.max(1, z - a), numberOfChannels: 2, sampleRate: b.sampleRate });
      for (let ch = 0; ch < 2; ch++) { const src = b.getChannelData(Math.min(ch, b.numberOfChannels - 1)).subarray(a, z), dst = rev.getChannelData(ch); for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i]; }
    }
  }
  toast('Creando la reversa…', 60000);
  try {
    const blob = await encodeMP4({
      width: w, height: h, fps, frames: N, audio: rev, bitrate: w * h * fps * .12,
      drawFrame: async i => { await seekTo(clamp(c.out - (i + .5) / fps, 0, m.duration - .001)); x.drawImage(v, 0, 0, w, h); return cnv; },
      onProgress: p => toast(`Creando la reversa… ${Math.round(p * 100)}%`, 60000)
    });
    v.removeAttribute('src'); v.load();
    const nm = registerMedia({ name: m.name.replace(/\.[^.]+$/, '') + ' (reversa).mp4', type: 'video', folder: 'local' }, blob);
    await nm.readyP;
    commit();
    let obj = c.obj ? JSON.parse(JSON.stringify(c.obj)) : null;     // el seguimiento también se invierte
    if (obj) { const f = s => clamp(c.out - s, 0, nm.duration); if (obj.track) obj.track = obj.track.map(p => ({ ...p, t: +f(p.t).toFixed(3) })).sort((a, b) => a.t - b.t); obj.pt.t = f(obj.pt.t ?? c.in); }
    Object.assign(c, { mediaId: nm.id, name: nm.name, in: 0, out: nm.duration, reversed: !c.reversed, obj }); afterChange();
    toast('Clip en reversa listo');
  } catch (e) { console.warn('Reversa:', e); toast('No se pudo crear la reversa'); }
}

/* Fotograma actual en PNG (1080p) */
async function exportFrame(name = safeName(S.name)) {
  pause(); const was = S.exportScale;
  S.exportScale = 1.5; setCanvasSize(); S._noSel = true; draw();
  const blob = await canvasBlob(cv, 'image/png');
  S._noSel = false; S.exportScale = was; setCanvasSize(); draw();
  download(blob, `${name} - ${fmt(S.t, S.fps).replace(/:/g, '-')}.png`);
  toast('Fotograma exportado');
}

/* Subtítulos SRT */
const srtTime = t => { const ms = Math.round((t % 1) * 1000); return `${pad2(t / 3600)}:${pad2(t / 60 % 60)}:${pad2(t % 60)},${String(ms).padStart(3, '0')}`; };
function exportSRT(name = safeName(S.name)) {
  const list = S.clips.filter(c => c.kind === 'text').sort((a, b) => a.start - b.start);
  if (!list.length) return toast('No hay textos para exportar');
  const srt = list.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(endOf(c))}\n${c.text}\n`).join('\n');
  download(new Blob([srt], { type: 'text/plain' }), `${name}.srt`);
  toast('Subtítulos exportados (.srt)');
}
async function importSRT(file) {
  const txt = (await file.text()).replace(/\r/g, ''), segs = [];
  const toS = s => { const [h, m, r] = s.replace(',', '.').split(':'); return +h * 3600 + +m * 60 + parseFloat(r); };
  for (const block of txt.split(/\n\s*\n/)) {
    const m = block.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/); if (!m) continue;
    const text = block.slice(block.indexOf(m[0]) + m[0].length).trim().replace(/<[^>]+>/g, '');
    if (text) segs.push({ s: toS(m[1]), e: toS(m[2]), text });
  }
  if (!segs.length) return toast('El archivo SRT no tiene subtítulos válidos');
  commit(); addCaptionClips(segs, 'plain', true); afterChange();
  toast(`${segs.length} subtítulos importados`);
}

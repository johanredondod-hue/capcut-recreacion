'use strict';
/* =========================================================
   export.js — exportar video (MP4/WebM), solo audio,
   fotograma PNG y subtítulos SRT. Sin marca de agua.
   El video se graba en tiempo real desde el lienzo.
   ========================================================= */

const BITRATES = { low: .5, rec: 1, high: 2 };
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
  const fm = videoFormats(), res = [[480, '480p'], [720, '720p'], [1080, '1080p'], [1440, '2K'], [2160, '4K']];
  $('#exportBody').innerHTML = `<h2>Exportar <button class="icon-btn" data-close>${ic('close')}</button></h2>
  <div class="exp-grid">
    <div><div class="exp-cover"><img src="${projectThumb(480)}" alt="Portada"></div>
      <p class="hint" style="margin-top:8px">${fmt(total(), S.fps)} · ${S.ratio}</p>
      <div class="note gold"><b>Sin marca de agua.</b> 2K, 4K y 60 fps incluidos (en CapCut son Pro).</div></div>
    <div>
      <div class="row2"><label>Título</label><input class="field" id="exName" value="${esc(S.name)}"></div>
      <div class="exp-sec${fm.length ? '' : ' off'}"><label class="hd"><input type="checkbox" id="exVideo"${fm.length ? ' checked' : ' disabled'}> Video</label>
        <div class="row2"><label>Resolución</label><select class="field" id="exRes">${res.map(([v, n]) => `<option value="${v}"${v === 1080 ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="row2"><label>Tasa de bits</label><select class="field" id="exBr"><option value="low">Más baja</option><option value="rec" selected>Recomendada</option><option value="high">Más alta</option></select></div>
        <div class="row2"><label>Formato</label><select class="field" id="exFmt">${fm.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select></div>
        <div class="row2"><label>Fotogramas</label><select class="field" id="exFps">${[24, 25, 30, 50, 60].map(f => `<option${f === S.fps ? ' selected' : ''}>${f}</option>`).join('')}</select></div>
        <p class="hint" id="exSize"></p></div>
      <div class="exp-sec off"><label class="hd"><input type="checkbox" id="exAudio"> Solo audio</label><p class="hint">Exporta la mezcla de audio (WebM/Opus).</p></div>
      <div class="exp-sec off"><label class="hd"><input type="checkbox" id="exSrt"> Subtítulos (.srt)</label><p class="hint">Todos los textos de la línea de tiempo con sus tiempos.</p></div>
      <div class="exp-sec off"><label class="hd"><input type="checkbox" id="exPng"> Fotograma actual (.png)</label><p class="hint">Captura en 1080p del cabezal.</p></div>
    </div>
  </div>
  <div class="progress" id="exProgWrap" hidden><div id="exBar"></div></div><p class="hint" id="exHint" style="margin-top:6px">${fm.length ? 'La exportación se graba en tiempo real: tarda lo mismo que dura el video.' : 'Tu navegador no permite exportar video. Usa Chrome o Edge.'}</p>
  <div class="actions"><span class="grow"></span><button class="btn" id="exCancel">Cancelar</button><button class="btn primary" id="exGo">${ic('download')}Exportar</button></div>`;
  const body = $('#exportBody');
  body.querySelectorAll('.exp-sec input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => { cb.closest('.exp-sec').classList.toggle('off', !cb.checked); estimate(); }));
  ['exRes', 'exBr', 'exFps'].forEach(id => { const el = $('#' + id); if (el) el.addEventListener('change', estimate); });
  $('#exGo').onclick = startExport; $('#exCancel').onclick = cancelExport;
  estimate();
  $('#exportModal').hidden = false;
}
function exportDims(res) { const [w, h] = RATIOS[S.ratio], k = res / Math.min(w, h); return [Math.round(w * k / 2) * 2, Math.round(h * k / 2) * 2]; }
function estimate() {
  const el = $('#exSize'); if (!el || !$('#exRes')) return;
  const [w, h] = exportDims(+$('#exRes').value), fps = +$('#exFps').value, bps = w * h * fps * .1 * BITRATES[$('#exBr').value];
  el.textContent = `${w}×${h} · ~${(bps / 1e6).toFixed(1)} Mbps · tamaño aprox. ${(bps * total() / 8 / 1048576).toFixed(1)} MB`;
}
async function startExport() {
  const wantV = $('#exVideo').checked, wantA = $('#exAudio').checked, wantS = $('#exSrt').checked, wantP = $('#exPng').checked;
  const name = safeName($('#exName').value || S.name);
  if (!wantV && !wantA && !wantS && !wantP) return toast('Elige al menos una opción');
  if (wantP) await exportFrame(name);
  if (wantS) exportSRT(name);
  if (!wantV && !wantA) { $('#exportModal').hidden = true; return; }
  if (!window.MediaRecorder) return toast('Tu navegador no permite exportar');
  ensureAudio();
  const res = +$('#exRes').value, fps = +$('#exFps').value, br = $('#exBr').value;
  S.sel = null; S.selTrans = null; renderTL(); renderProps();
  let stream, mime, ext;
  if (wantV) {
    const f = videoFormats().find(x => x[0] === $('#exFmt').value) || videoFormats()[0];
    mime = f[2]; ext = f[0];
    S.exportScale = res / 720; setCanvasSize();
    stream = new MediaStream([...cv.captureStream(fps).getVideoTracks(), ...recDest.stream.getAudioTracks()]);
  } else {
    mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    ext = mime.includes('mp4') ? 'm4a' : 'webm'; stream = recDest.stream;
  }
  const bps = wantV ? Math.round(W * H * fps * .1 * BITRATES[br]) : 192000;
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bps, audioBitsPerSecond: 192000 } : {}); }
  catch (e) { restoreAfterExport(); return toast('No se pudo iniciar la exportación con ese formato'); }
  const chunks = [], ex = { rec, cancelled: false, t0: performance.now() };
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    restoreAfterExport();
    if (ex.cancelled) return;
    const blob = new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] });
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
  const ex = S.exporting; if (!ex) return;
  S.exporting = null; S.playing = false; updPlayBtn();
  if (ex.rec.state !== 'inactive') ex.rec.stop(); else restoreAfterExport();
}
function restoreAfterExport() {
  try { masterGain.connect(AC.destination); } catch (e) { }
  S.exportScale = 1; setCanvasSize(); invalidate();
  const g = $('#exGo'); if (g) g.disabled = false;
}
function cancelExport() {
  if (S.exporting) { S.exporting.cancelled = true; finishExport(); toast('Exportación cancelada'); }
  $('#exportModal').hidden = true;
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

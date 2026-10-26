'use strict';
/* =========================================================
   catalog.js — catálogos: filtros, efectos, transiciones, animaciones…
   Para añadir un elemento nuevo basta con agregar una línea aquí.
   `pro: true` muestra la insignia Pro (todo está desbloqueado).
   ========================================================= */

const RATIOS = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720], '4:3': [960, 720], '3:4': [720, 960], '21:9': [1680, 720], '2:1': [1440, 720], '4:5': [720, 900] };
const RATIO_NAMES = { '16:9': '16:9 YouTube', '9:16': '9:16 TikTok', '1:1': '1:1 Instagram', '4:3': '4:3', '3:4': '3:4', '21:9': '21:9 Cine', '2:1': '2:1', '4:5': '4:5 Instagram' };

/* ---------- Filtros ---------- */
const FILTER_CATS = ['Destacados', 'Vida', 'Retrato', 'Paisaje', 'Cine', 'Retro', 'B/N'];
const FILTERS = [
  { id: 'none', name: 'Original', cat: 'Destacados', css: '' },
  { id: 'vivid', name: 'Vívido', cat: 'Destacados', css: 'saturate(1.5) contrast(1.1)' },
  { id: 'clear', name: 'Nítido', cat: 'Destacados', css: 'contrast(1.15) brightness(1.05) saturate(1.1)' },
  { id: 'softglow', name: 'Brillo suave', cat: 'Destacados', css: 'brightness(1.12) contrast(.92) saturate(1.1)' },
  { id: 'warm', name: 'Cálido', cat: 'Vida', css: 'sepia(.3) saturate(1.35) brightness(1.03)' },
  { id: 'cold', name: 'Frío', cat: 'Vida', css: 'saturate(.85) hue-rotate(15deg) brightness(1.05) contrast(1.05)' },
  { id: 'berry', name: 'Fresa', cat: 'Vida', css: 'sepia(.2) saturate(1.4) hue-rotate(-20deg)' },
  { id: 'morning', name: 'Mañana', cat: 'Vida', css: 'brightness(1.1) saturate(1.2) contrast(.95)' },
  { id: 'skin', name: 'Piel suave', cat: 'Retrato', css: 'brightness(1.08) contrast(.9) saturate(1.05)' },
  { id: 'rose', name: 'Rosado', cat: 'Retrato', css: 'sepia(.25) hue-rotate(-25deg) saturate(1.3)', pro: true },
  { id: 'porcelain', name: 'Porcelana', cat: 'Retrato', css: 'brightness(1.15) saturate(.8) contrast(.95)' },
  { id: 'green', name: 'Verde', cat: 'Paisaje', css: 'saturate(1.4) hue-rotate(-8deg)' },
  { id: 'sky', name: 'Cielo', cat: 'Paisaje', css: 'saturate(1.3) hue-rotate(8deg) contrast(1.1)' },
  { id: 'sunset', name: 'Atardecer', cat: 'Paisaje', css: 'sepia(.45) saturate(1.6) hue-rotate(-15deg) contrast(1.05)', pro: true },
  { id: 'teal', name: 'Teal & Orange', cat: 'Cine', css: 'contrast(1.2) saturate(1.3) sepia(.2) hue-rotate(-10deg)', pro: true },
  { id: 'drama', name: 'Drama', cat: 'Cine', css: 'contrast(1.45) saturate(.7) brightness(.9)' },
  { id: 'night', name: 'Noche', cat: 'Cine', css: 'brightness(.8) contrast(1.2) hue-rotate(15deg) saturate(.8)', pro: true },
  { id: 'fade', name: 'Desvaído', cat: 'Cine', css: 'contrast(.8) brightness(1.12) saturate(.75)' },
  { id: 'vintage', name: 'Vintage', cat: 'Retro', css: 'sepia(.45) contrast(.9) brightness(1.05) saturate(.8)' },
  { id: 'polaroid', name: 'Polaroid', cat: 'Retro', css: 'sepia(.3) contrast(1.1) brightness(1.1) saturate(1.2)', pro: true },
  { id: 'kodak', name: 'Kodak', cat: 'Retro', css: 'sepia(.25) saturate(1.5) contrast(1.15)', pro: true },
  { id: 'sepia', name: 'Sepia', cat: 'Retro', css: 'sepia(.85)' },
  { id: 'bw', name: 'B/N', cat: 'B/N', css: 'grayscale(1) contrast(1.1)' },
  { id: 'noir', name: 'Noir', cat: 'B/N', css: 'grayscale(1) contrast(1.5) brightness(.9)' },
  { id: 'silver', name: 'Plata', cat: 'B/N', css: 'grayscale(1) brightness(1.15) contrast(.9)' },
  { id: 'neg', name: 'Negativo', cat: 'B/N', css: 'invert(1)' },
  { id: 'hicon', name: 'B/N intenso', cat: 'B/N', css: 'grayscale(1) contrast(2) brightness(1.05)' },
  { id: 'cyber', name: 'Cyberpunk', cat: 'Cine', css: 'hue-rotate(-30deg) saturate(1.8) contrast(1.2)', pro: true },
  { id: 'matrix', name: 'Matrix', cat: 'Cine', css: 'sepia(1) hue-rotate(60deg) saturate(2.2) brightness(.9) contrast(1.2)' },
  { id: 'amber', name: 'Ámbar', cat: 'Vida', css: 'sepia(.6) saturate(1.8) hue-rotate(-12deg) brightness(1.05)' },
  { id: 'lavender', name: 'Lavanda', cat: 'Retrato', css: 'sepia(.3) hue-rotate(220deg) saturate(1.2) brightness(1.08)' },
  { id: 'seventies', name: 'Años 70', cat: 'Retro', css: 'sepia(.5) saturate(1.6) contrast(.85) brightness(1.1) hue-rotate(-8deg)', pro: true }
];
const FILTER_MAP = Object.fromEntries(FILTERS.map(f => [f.id, f]));

/* ---------- Efectos de video (se colocan como segmentos en la línea de tiempo) ---------- */
const EFFECT_CATS = ['Básicos', 'Luz', 'Fiesta', 'Retro', 'Distorsión'];
const EFFECTS = [
  { id: 'blur', name: 'Desenfoque', cat: 'Básicos', bg: 'radial-gradient(circle,#8ac 0,#334 80%)' },
  { id: 'bw', name: 'Blanco y negro', cat: 'Básicos', bg: 'linear-gradient(135deg,#ddd,#222)' },
  { id: 'vignette', name: 'Viñeta', cat: 'Básicos', bg: 'radial-gradient(circle,#999 20%,#000 90%)' },
  { id: 'cine', name: 'Barras de cine', cat: 'Básicos', bg: 'linear-gradient(#000 22%,#4a6a8a 22% 78%,#000 78%)' },
  { id: 'zoom', name: 'Pulso de zoom', cat: 'Básicos', bg: 'radial-gradient(circle,#4af 0 25%,#123 26% 45%,#4af 46% 60%,#123 61%)' },
  { id: 'shake', name: 'Temblor', cat: 'Básicos', bg: 'linear-gradient(135deg,#8a3,#246)' },
  { id: 'mirror', name: 'Espejo', cat: 'Básicos', bg: 'linear-gradient(90deg,#f80,#40f 50%,#f80)' },
  { id: 'split4', name: 'Pantalla x4', cat: 'Básicos', bg: 'conic-gradient(#e44 0 25%,#4c4 0 50%,#44e 0 75%,#ec4 0)', pro: true },
  { id: 'flash', name: 'Destello', cat: 'Luz', bg: 'radial-gradient(circle,#fff 10%,#888 60%)' },
  { id: 'lens', name: 'Fuga de luz', cat: 'Luz', bg: 'radial-gradient(circle at 30% 40%,#ffb15e,#5a2a0a 70%)', pro: true },
  { id: 'sparkle', name: 'Destellos', cat: 'Luz', bg: 'radial-gradient(circle at 30% 30%,#fff 0 3%,transparent 4%),radial-gradient(circle at 70% 60%,#fff 0 2%,transparent 3%),#1a1f3a' },
  { id: 'confetti', name: 'Confeti', cat: 'Fiesta', bg: 'radial-gradient(circle at 20% 30%,#f44 0 5%,transparent 6%),radial-gradient(circle at 60% 20%,#4cf 0 5%,transparent 6%),radial-gradient(circle at 75% 70%,#fd4 0 5%,transparent 6%),#2a1a3a', pro: true },
  { id: 'rainbow', name: 'Arcoíris', cat: 'Fiesta', bg: 'linear-gradient(90deg,#f44,#fd4,#4c4,#4cf,#84f)' },
  { id: 'strobe', name: 'Parpadeo', cat: 'Fiesta', bg: 'repeating-linear-gradient(90deg,#000 0 10px,#fff 10px 20px)' },
  { id: 'grain', name: 'Grano', cat: 'Retro', bg: 'repeating-radial-gradient(circle at 30% 30%,#777 0 1px,#333 1px 3px)' },
  { id: 'vhs', name: 'VHS', cat: 'Retro', bg: 'repeating-linear-gradient(#335 0 3px,#557 3px 5px)', pro: true },
  { id: 'film', name: 'Película antigua', cat: 'Retro', bg: 'linear-gradient(135deg,#a8844a,#3a2a14)', pro: true },
  { id: 'scan', name: 'Líneas de escaneo', cat: 'Retro', bg: 'repeating-linear-gradient(#456 0 2px,#123 2px 4px)' },
  { id: 'glitch', name: 'Fallo', cat: 'Distorsión', bg: 'linear-gradient(90deg,#f0f 0 30%,#0ff 30% 60%,#222 60%)', pro: true },
  { id: 'rgb', name: 'Separación RGB', cat: 'Distorsión', bg: 'linear-gradient(90deg,#f33,#3f3,#33f)' },
  { id: 'rain', name: 'Lluvia', cat: 'Básicos', bg: 'repeating-linear-gradient(100deg,#9bd 0 1px,#234 1px 9px)' },
  { id: 'snow', name: 'Nieve', cat: 'Fiesta', bg: 'radial-gradient(circle at 20% 30%,#fff 0 4%,transparent 5%),radial-gradient(circle at 70% 60%,#fff 0 3%,transparent 4%),#3a4a6a' },
  { id: 'hearts', name: 'Corazones', cat: 'Fiesta', bg: 'radial-gradient(circle at 35% 45%,#ff4d7d 0 14%,transparent 15%),radial-gradient(circle at 65% 45%,#ff4d7d 0 14%,transparent 15%),#3a1a2a', pro: true },
  { id: 'bokeh', name: 'Luces bokeh', cat: 'Luz', bg: 'radial-gradient(circle at 30% 40%,rgba(255,200,120,.8) 0 12%,transparent 13%),radial-gradient(circle at 70% 60%,rgba(120,200,255,.7) 0 16%,transparent 17%),#1a1a2a' },
  { id: 'kaleido', name: 'Caleidoscopio', cat: 'Distorsión', bg: 'conic-gradient(#f4a,#4af,#fa4,#f4a,#4af,#fa4,#f4a)', pro: true },
  { id: 'pixel', name: 'Pixelado', cat: 'Distorsión', bg: 'conic-gradient(#4a8 0 25%,#8a4 0 50%,#48a 0 75%,#a84 0) 0 0/14px 14px' },
  { id: 'duotone', name: 'Duotono', cat: 'Retro', bg: 'linear-gradient(135deg,#ff2f8e,#2a1cff)' },
  { id: 'zoomburst', name: 'Ráfaga de zoom', cat: 'Distorsión', bg: 'repeating-radial-gradient(circle,#579 0 4px,#123 4px 10px)', pro: true },
  { id: 'ghost', name: 'Eco fantasma', cat: 'Distorsión', bg: 'linear-gradient(90deg,#5a8 30%,rgba(90,170,140,.4) 30% 60%,rgba(90,170,140,.15) 60%)' }
];
const EFFECT_MAP = Object.fromEntries(EFFECTS.map(e => [e.id, e]));

/* ---------- Transiciones (entre dos clips de la pista principal) ---------- */
const TRANS_CATS = ['Básicas', 'Movimiento', 'Formas', 'Efectos'];
const TRANSITIONS = [
  { id: 'mix', name: 'Mezclar', cat: 'Básicas' },
  { id: 'black', name: 'Fundido a negro', cat: 'Básicas' },
  { id: 'white', name: 'Fundido a blanco', cat: 'Básicas' },
  { id: 'blur', name: 'Desenfoque', cat: 'Básicas' },
  { id: 'wipeL', name: 'Barrido izquierda', cat: 'Movimiento' },
  { id: 'wipeR', name: 'Barrido derecha', cat: 'Movimiento' },
  { id: 'wipeU', name: 'Barrido arriba', cat: 'Movimiento' },
  { id: 'wipeD', name: 'Barrido abajo', cat: 'Movimiento' },
  { id: 'pushL', name: 'Empujar izquierda', cat: 'Movimiento' },
  { id: 'pushR', name: 'Empujar derecha', cat: 'Movimiento' },
  { id: 'pushU', name: 'Empujar arriba', cat: 'Movimiento' },
  { id: 'slide', name: 'Deslizar', cat: 'Movimiento' },
  { id: 'zoomIn', name: 'Acercar', cat: 'Efectos' },
  { id: 'zoomOut', name: 'Alejar', cat: 'Efectos' },
  { id: 'spin', name: 'Girar', cat: 'Efectos', pro: true },
  { id: 'shrink', name: 'Contraer', cat: 'Efectos' },
  { id: 'glitch', name: 'Fallo', cat: 'Efectos', pro: true },
  { id: 'circle', name: 'Círculo', cat: 'Formas' },
  { id: 'blinds', name: 'Persiana', cat: 'Formas', pro: true },
  { id: 'diag', name: 'Diagonal', cat: 'Formas' },
  { id: 'clock', name: 'Reloj', cat: 'Formas' },
  { id: 'doors', name: 'Puertas', cat: 'Formas' },
  { id: 'heart', name: 'Corazón', cat: 'Formas', pro: true },
  { id: 'splitV', name: 'Dividir', cat: 'Movimiento' },
  { id: 'bounceIn', name: 'Rebote', cat: 'Movimiento' },
  { id: 'cube', name: 'Cubo 3D', cat: 'Efectos', pro: true },
  { id: 'pixelate', name: 'Pixelar', cat: 'Efectos' },
  { id: 'zoomblur', name: 'Zoom borroso', cat: 'Efectos', pro: true }
];
const TRANS_MAP = Object.fromEntries(TRANSITIONS.map(t => [t.id, t]));

/* ---------- Animaciones (entrada / salida / bucle) ---------- */
const ANIM_IN = [['none', 'Ninguna'], ['fade', 'Fundido'], ['zoomIn', 'Acercar'], ['zoomOut', 'Alejar'], ['slideL', 'Deslizar ←'], ['slideR', 'Deslizar →'], ['slideU', 'Deslizar ↑'], ['slideD', 'Deslizar ↓'], ['spin', 'Girar'], ['bounce', 'Rebote'], ['blur', 'Desenfoque'], ['type', 'Máquina de escribir']];
const ANIM_OUT = [['none', 'Ninguna'], ['fade', 'Fundido'], ['zoomIn', 'Acercar'], ['zoomOut', 'Alejar'], ['slideL', 'Deslizar ←'], ['slideR', 'Deslizar →'], ['slideU', 'Deslizar ↑'], ['slideD', 'Deslizar ↓'], ['spin', 'Girar'], ['blur', 'Desenfoque']];
const ANIM_LOOP = [['none', 'Ninguna'], ['pulse', 'Pulso'], ['shake', 'Temblor'], ['float', 'Flotar'], ['swing', 'Balanceo'], ['flicker', 'Parpadeo'], ['rotate', 'Rotar']];

/* ---------- Texto ---------- */
const FONTS = [['system-ui', 'Sistema'], ['Arial', 'Arial'], ['Segoe UI', 'Segoe UI'], ['Georgia', 'Georgia'], ['Impact', 'Impact'], ['Trebuchet MS', 'Trebuchet'], ['Verdana', 'Verdana'], ['Courier New', 'Courier'], ['Times New Roman', 'Times'], ['Comic Sans MS', 'Comic'], ['Palatino Linotype', 'Palatino'], ['Brush Script MT', 'Caligrafía']];
const TEXT_STYLES = [
  { name: 'Predeterminado', s: {} },
  { name: 'Negrita', s: { bold: true, size: 64 } },
  { name: 'Contorno', s: { bold: true, strokeOn: true, stroke: '#000000', strokeW: 8 } },
  { name: 'Amarillo', s: { bold: true, color: '#ffde00', strokeOn: true, stroke: '#000000', strokeW: 8 } },
  { name: 'Neón', s: { bold: true, color: '#b8fbff', glowOn: true, glow: '#00e5ff' } },
  { name: 'Neón rosa', s: { bold: true, color: '#ffd0f2', glowOn: true, glow: '#ff2fb9' }, pro: true },
  { name: 'Etiqueta', s: { bold: true, color: '#111111', bgOn: true, bg: '#ffd400', bgA: 1 } },
  { name: 'Caja blanca', s: { bold: true, color: '#111111', bgOn: true, bg: '#ffffff', bgA: 1 } },
  { name: 'Caja roja', s: { bold: true, color: '#ffffff', bgOn: true, bg: '#ff2a4f', bgA: 1 } },
  { name: 'Sombra', s: { bold: true, shadowOn: true, shadow: '#000000' } },
  { name: 'Título', s: { font: 'Georgia', size: 90, bold: true, strokeOn: true, stroke: '#000000', strokeW: 5 } },
  { name: 'Impacto', s: { font: 'Impact', size: 84, color: '#ffffff', strokeOn: true, stroke: '#ff2a4f', strokeW: 8 }, pro: true },
  { name: 'Degradado', s: { bold: true, size: 70, color: '#ffd400', gradOn: true, grad2: '#ff2a8a' } },
  { name: 'Arcoíris', s: { font: 'Impact', size: 80, color: '#00e5ff', gradOn: true, grad2: '#c03cff', strokeOn: true, stroke: '#ffffff', strokeW: 5 }, pro: true },
  { name: 'Curvo', s: { bold: true, size: 56, arc: 45, strokeOn: true, stroke: '#000000', strokeW: 5 } }
];
const TEXT_TEMPLATES = [
  { name: 'Título épico', text: 'TÍTULO ÉPICO', s: { font: 'Impact', size: 110, strokeOn: true, stroke: '#000000', strokeW: 8 }, anim: { in: 'zoomOut', out: 'fade', loop: 'none' }, bg: 'linear-gradient(135deg,#222,#555)' },
  { name: 'Suscríbete', text: '¡SUSCRÍBETE!', s: { bold: true, color: '#ffffff', bgOn: true, bg: '#ff0033', bgA: 1, size: 60 }, anim: { in: 'bounce', out: 'zoomIn', loop: 'pulse' }, bg: 'linear-gradient(135deg,#400,#a00)', pro: true },
  { name: 'Máquina', text: 'Había una vez…', s: { font: 'Courier New', size: 56, bold: true }, anim: { in: 'type', inD: 1.5, out: 'fade', loop: 'none' }, bg: 'linear-gradient(135deg,#123,#345)' },
  { name: 'Neón flotante', text: 'NIGHT VIBES', s: { bold: true, color: '#d8fcff', glowOn: true, glow: '#00e5ff', size: 76 }, anim: { in: 'blur', out: 'blur', loop: 'float' }, bg: 'linear-gradient(135deg,#0a0a2a,#2a0a3a)', pro: true },
  { name: 'Oferta', text: '-50% HOY', s: { font: 'Impact', size: 96, color: '#ffde00', strokeOn: true, stroke: '#000000', strokeW: 8 }, anim: { in: 'spin', out: 'zoomIn', loop: 'swing' }, bg: 'linear-gradient(135deg,#a50,#f80)' },
  { name: 'Cita', text: '"Crea sin límites"', s: { font: 'Georgia', italic: true, size: 58, shadowOn: true, shadow: '#000000' }, anim: { in: 'slideU', out: 'fade', loop: 'none' }, bg: 'linear-gradient(135deg,#2a2a2a,#4a3a2a)' },
  { name: 'Gaming', text: 'GAME OVER', s: { font: 'Impact', size: 100, color: '#7dff5a', glowOn: true, glow: '#2aff00' }, anim: { in: 'zoomIn', out: 'fade', loop: 'flicker' }, bg: 'linear-gradient(135deg,#031,#142)', pro: true },
  { name: 'Boda', text: 'Ana & Luis', s: { font: 'Brush Script MT', size: 96, color: '#fff5e6', shadowOn: true, shadow: '#5a3a1a' }, anim: { in: 'fade', inD: 1.2, out: 'fade', loop: 'none' }, bg: 'linear-gradient(135deg,#5a4030,#c8a888)' },
  { name: 'Noticia', text: 'ÚLTIMA HORA', s: { bold: true, size: 54, color: '#ffffff', bgOn: true, bg: '#d80027', bgA: 1, bgR: 0 }, anim: { in: 'slideR', out: 'slideL', loop: 'none' }, bg: 'linear-gradient(135deg,#600,#d80027)' },
  { name: 'Degradado pop', text: '¡WOW!', s: { font: 'Impact', size: 130, color: '#ffe600', gradOn: true, grad2: '#ff2a8a', strokeOn: true, stroke: '#ffffff', strokeW: 6 }, anim: { in: 'bounce', out: 'zoomIn', loop: 'swing' }, bg: 'linear-gradient(135deg,#ff2a8a,#ffe600)', pro: true },
  { name: 'Arco', text: 'MIS VACACIONES', s: { bold: true, size: 60, arc: 55, strokeOn: true, stroke: '#000000', strokeW: 5 }, anim: { in: 'fade', out: 'fade', loop: 'float' }, bg: 'linear-gradient(135deg,#0a6,#06a)' },
  { name: 'Receta', text: 'Paso 1: mezclar', s: { font: 'Georgia', size: 52, color: '#3a2a10', bgOn: true, bg: '#fff3d6', bgA: 1, bgR: .5 }, anim: { in: 'slideU', out: 'fade', loop: 'none' }, bg: 'linear-gradient(135deg,#d8a35a,#fff3d6)' }
];

/* ---------- Stickers ---------- */
const STICKER_CATS = {
  'Tendencia': '🔥 ✨ 💯 ⭐ 🎉 💥 ⚡ 🚀 ❤️ 👀 💬 ✅ ❌ 🆕 🔔 📌',
  'Caras': '😀 😂 🤣 😍 🥰 😎 🤩 🥳 😱 🤯 😭 😡 🤔 🙄 😴 🤫',
  'Gestos': '👍 👎 👏 🙌 🙏 👋 ✌️ 🤞 👌 🤙 💪 👉 👈 👆 👇 🫶',
  'Amor': '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💖 💕 💘 💝 💌 😘 🌹 💍',
  'Fiesta': '🎉 🎊 🎈 🎂 🎁 🥂 🍾 🎆 🎇 🪩 🎵 🎶 🎤 🎧 🕺 💃',
  'Naturaleza': '☀️ 🌙 ⭐ 🌈 ☁️ ⛈️ ❄️ 🌊 🌸 🌻 🍀 🌴 🐶 🐱 🦋 🐝',
  'Comida': '🍕 🍔 🍟 🌮 🍣 🍩 🍪 🍫 🍦 🍓 🍉 🥑 ☕ 🧋 🍿 🥤',
  'Flechas': '⬆️ ⬇️ ⬅️ ➡️ ↗️ ↘️ ↙️ ↖️ ↔️ ↕️ 🔄 🔁 ⤴️ ⤵️ ▶️ ⏩'
};

/* Formas animadas dibujadas por código (se pueden pegar a un objeto con el seguimiento) */
const SHAPES = [
  { id: 'ring', name: 'Aro de luz', color: '#ffd400' },
  { id: 'halo', name: 'Aura', color: '#7ff7ff' },
  { id: 'pulse', name: 'Pulso', color: '#ffffff' },
  { id: 'spark', name: 'Destello', color: '#fff6b0' },
  { id: 'arrow', name: 'Flecha', color: '#ff2a4f' },
  { id: 'frame', name: 'Marco neón', color: '#ff2fb9' },
  { id: 'underline', name: 'Subrayado', color: '#ffd400' },
  { id: 'check', name: 'Visto bueno', color: '#22c55e' }
];

/* Voces de texto a voz (Piper, se descargan una vez) */
const TTS_VOICES = [
  ['es_MX-claude-high', 'Claudio · México'], ['es_MX-ald-medium', 'Aldo · México'], ['es_ES-davefx-medium', 'David · España'],
  ['es_ES-sharvard-medium', 'Sharvard · España'], ['es_ES-carlfm-x_low', 'Carlos · España (ligera)'],
  ['en_US-amy-medium', 'Amy · Inglés'], ['en_US-ryan-medium', 'Ryan · Inglés'], ['pt_BR-faber-medium', 'Faber · Portugués']
];
const ASR_MODELS = [['Xenova/whisper-tiny', 'Rápido (40 MB)'], ['Xenova/whisper-base', 'Preciso (80 MB)'], ['Xenova/whisper-small', 'Muy preciso (250 MB)']];

/* ---------- Curvas de velocidad (como en CapCut: Velocidad > Curva) ---------- */
const CURVES = [
  { id: 'montage', name: 'Montaje', pts: [1.4, 1.4, .5, 1.4, 1.4] },
  { id: 'hero', name: 'Héroe', pts: [1.2, 1.2, .2, .2, 1.2] },
  { id: 'bullet', name: 'Bala', pts: [2.5, .3, .3, .3, 2.5], pro: true },
  { id: 'jump', name: 'Salto', pts: [1, 1, 6, 1, 1] },
  { id: 'flashIn', name: 'Destello entrada', pts: [6, 2, 1, 1, 1] },
  { id: 'flashOut', name: 'Destello salida', pts: [1, 1, 1, 2, 6], pro: true }
];

/* ---------- Audio ---------- */
const VOICE_FX = [['none', 'Ninguno'], ['echo', 'Eco'], ['hall', 'Gran sala'], ['radio', 'Radio'], ['phone', 'Teléfono'], ['robot', 'Robot'], ['deep', 'Grave'], ['megaphone', 'Megáfono']];
const MUSIC = [
  { id: 'pop', name: 'Pop alegre', bpm: 120, dur: 16, mood: 'Alegre' },
  { id: 'lofi', name: 'Lo-fi chill', bpm: 80, dur: 18, mood: 'Relajado' },
  { id: 'epic', name: 'Épico', bpm: 90, dur: 16, mood: 'Cinemático' },
  { id: 'tropical', name: 'Tropical', bpm: 104, dur: 16, mood: 'Verano' },
  { id: 'hiphop', name: 'Hip hop', bpm: 88, dur: 16, mood: 'Urbano' },
  { id: 'edm', name: 'Electrónica', bpm: 128, dur: 15, mood: 'Energía' }
];
const SFX = [
  { id: 'whoosh', name: 'Whoosh', dur: .9 }, { id: 'pop', name: 'Pop', dur: .3 }, { id: 'click', name: 'Clic', dur: .15 },
  { id: 'ding', name: 'Ding', dur: 1.4 }, { id: 'boom', name: 'Boom', dur: 1.6 }, { id: 'applause', name: 'Aplausos', dur: 2.5 },
  { id: 'shutter', name: 'Cámara', dur: .4 }, { id: 'riser', name: 'Subida', dur: 2.2 },
  { id: 'glitch', name: 'Glitch', dur: .6 }, { id: 'notif', name: 'Notificación', dur: .7 }, { id: 'drumroll', name: 'Redoble', dur: 2.4 }, { id: 'laser', name: 'Láser', dur: .5 }
];

/* ---------- Video ---------- */
const BLENDS = [['source-over', 'Normal'], ['darken', 'Oscurecer'], ['multiply', 'Multiplicar'], ['color-burn', 'Subexponer color'], ['lighten', 'Aclarar'], ['screen', 'Trama'], ['color-dodge', 'Sobreexponer color'], ['overlay', 'Superponer'], ['soft-light', 'Luz suave'], ['hard-light', 'Luz fuerte'], ['difference', 'Diferencia'], ['exclusion', 'Exclusión'], ['hue', 'Tono'], ['saturation', 'Saturación'], ['color', 'Color'], ['luminosity', 'Luminosidad']];
const MASKS = [['none', 'Ninguna'], ['line', 'Lineal'], ['mirror', 'Espejo'], ['circle', 'Círculo'], ['rect', 'Rectángulo'], ['heart', 'Corazón'], ['star', 'Estrella']];
const ADJ_PRESETS = [
  { name: 'Personalizado', adj: {} },
  { name: 'Cálido', adj: { temp: 40, s: 10 } },
  { name: 'Frío', adj: { temp: -40, b: 4 } },
  { name: 'Alto contraste', adj: { c: 35 } },
  { name: 'Suave', adj: { c: -20, b: 8 } },
  { name: 'Dramático', adj: { c: 30, s: -25, vig: 45 } },
  { name: 'Brillante', adj: { b: 18, s: 15 } },
  { name: 'Desaturado', adj: { s: -60 } }
];
const KF_PROPS = ['x', 'y', 'scale', 'rot', 'opacity', 'volume', 'adj.b', 'adj.s', 'adj.blur', 'filterK'];
const KF_EASE = [['smooth', 'Suave'], ['linear', 'Lineal'], ['in', 'Acelerar'], ['out', 'Frenar'], ['hold', 'Salto']];
const CROP_RATIOS = [['free', 'Libre'], ['orig', 'Original'], ['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1'], ['4:3', '4:3'], ['3:4', '3:4']];

/* ---------- Biblioteca de medios (generados sin conexión) ---------- */
const LIB_COLORS = ['#000000', '#ffffff', '#ff4d4f', '#ffb020', '#ffe14d', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#ec4899'];
const LIB_GRADS = [['#00c8d7', '#4b2bd6'], ['#ff7a59', '#ffcf3f'], ['#0f9b58', '#0b3d91'], ['#e0306b', '#311b6b'], ['#141e30', '#243b55'], ['#f857a6', '#ff5858'], ['#43cea2', '#185a9d'], ['#fceabb', '#f8b500']];
const LIB_PATTERNS = [['grid', 'Cuadrícula'], ['dots', 'Puntos'], ['stripes', 'Rayas'], ['bokeh', 'Bokeh'], ['sunburst', 'Rayos'], ['paper', 'Papel']];

/* ---------- Panel de recursos ---------- */
const RES_TABS = [['media', 'Medios', 'media'], ['audio', 'Audio', 'audio'], ['text', 'Texto', 'text'], ['stickers', 'Stickers', 'sticker'], ['effects', 'Efectos', 'effects'], ['transitions', 'Transiciones', 'transitions'], ['captions', 'Subtítulos', 'captions'], ['filters', 'Filtros', 'filters'], ['adjust', 'Ajuste', 'adjust'], ['templates', 'Plantillas', 'template']];
const RES_SUBS = {
  media: [['local', 'Local'], ['library', 'Biblioteca']],
  audio: [['music', 'Música'], ['sfx', 'Efectos de sonido'], ['tts', 'Texto a voz'], ['extracted', 'Extraído'], ['record', 'Grabar voz'], ['local', 'Mis audios']],
  text: [['add', 'Añadir texto'], ['templates', 'Plantillas de texto'], ['tts', 'Texto a voz']],
  stickers: [['shapes', 'Formas animadas'], ...Object.keys(STICKER_CATS).map(k => [k, k])],
  effects: [['all', 'Todos'], ...EFFECT_CATS.map(k => [k, k])],
  transitions: [['all', 'Todas'], ...TRANS_CATS.map(k => [k, k])],
  captions: [['auto', 'Automáticos'], ['manual', 'Manual'], ['srt', 'Importar / exportar']],
  filters: [['all', 'Todos'], ...FILTER_CATS.map(k => [k, k])],
  adjust: [['custom', 'Ajustes']],
  templates: [['all', 'Todas']]
};

/* ---------- Planes (todo desbloqueado en esta recreación) ---------- */
const PLAN_ROWS = [
  ['Edición básica, texto, stickers y filtros', 1, 1, 1],
  ['Exportar sin marca de agua', 0, 1, 1],
  ['Exportar en 2K / 4K y 60 fps', 0, 1, 1],
  ['Subtítulos automáticos', 0, 1, 1],
  ['Quitar fondo automático (IA)', 0, 1, 1],
  ['Reducción de ruido y aislar voz', 0, 1, 1],
  ['Efectos, transiciones y filtros Pro', 0, 1, 1],
  ['Curvas de velocidad Pro', 0, 1, 1],
  ['Sin créditos de IA ni límites', 0, 0, 1],
  ['Proyectos guardados en tu equipo (privado)', 0, 0, 1]
];

const SHORTCUTS = [
  ['Reproducir / pausar', 'Espacio'], ['Dividir', 'Ctrl + B'], ['Eliminar a la izquierda del cabezal', 'Q'], ['Eliminar a la derecha del cabezal', 'W'],
  ['Eliminar', 'Supr'], ['Seleccionar varios', 'Ctrl/Shift + clic · arrastrar en vacío'], ['Seleccionar todo', 'Ctrl + A'], ['Copiar / pegar', 'Ctrl + C / Ctrl + V'], ['Duplicar', 'Ctrl + D'], ['Deshacer / rehacer', 'Ctrl + Z / Ctrl + Y'],
  ['Añadir marcador', 'M'], ['Fotograma anterior / siguiente', '← / →'], ['Saltar 1 segundo', 'Shift + ← / →'], ['Inicio / final', 'Inicio / Fin'],
  ['Acercar / alejar línea de tiempo', 'Ctrl + = / Ctrl + −'], ['Ajustar línea de tiempo', 'Shift + Z'], ['Guardar', 'Ctrl + S'], ['Exportar', 'Ctrl + E'],
  ['Pantalla completa', 'F'], ['Deseleccionar', 'Esc']
];

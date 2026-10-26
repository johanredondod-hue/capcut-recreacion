# CapCut – Recreación (proyecto universitario)

Editor de video que funciona en el navegador y recrea la interfaz y las funciones de **CapCut para computadora** y de la **app móvil**. Incluye mejoras basadas en lo que la comunidad pide en reseñas y foros.

## Cómo abrirlo

- **En la computadora:** abre `index.html` con doble clic en **Chrome o Edge** (versiones recientes).
- **Como app instalable (PWA) y en el celular:** súbelo a un hosting estático con HTTPS (GitHub Pages, Netlify o Vercel). Abre la URL en el navegador y elige «Instalar app» o «Añadir a pantalla de inicio». Después funciona sin conexión.
  - El service worker y la instalación no funcionan con `file://`. Es una limitación del navegador.

## Qué recrea de CapCut

| Zona | Funciones |
|---|---|
| **Inicio** | Crear proyecto, accesos rápidos, lista de proyectos (abrir, renombrar, duplicar, eliminar), plantillas |
| **Medios** | Importar video, foto y audio (botón o arrastrar); biblioteca de colores, degradados y fondos |
| **Audio** | Música y efectos de sonido incluidos, audio extraído, grabar voz en off, importar audio |
| **Texto** | 12 estilos y 8 plantillas animadas; fuente, contorno, fondo, sombra, neón, espaciado, alineación |
| **Stickers** | 8 categorías de emojis animables |
| **Efectos** | 20 efectos de video como segmentos en la línea de tiempo (VHS, fallo, RGB, confeti, destellos, película antigua…) |
| **Transiciones** | 20 transiciones reales entre clips, con solapamiento (mezclar, barridos, empujar, zoom, girar, círculo, persiana, fallo…) |
| **Subtítulos** | Automáticos (IA), manuales, importar y exportar `.srt`, resaltado palabra por palabra (karaoke) |
| **Filtros / Ajuste** | 26 filtros por categoría con intensidad; capas de ajuste (brillo, contraste, saturación, temperatura, tono, desenfoque, viñeta) |
| **Detalles del clip** | Escala, posición, rotación, opacidad, espejo, modos de fusión, recorte, máscaras (lineal, espejo, círculo, rectángulo, corazón, estrella), croma con cuentagotas, quitar fondo con IA |
| **Velocidad** | Estándar (0,1x–10x, mantener tono) y **curvas** (Montaje, Héroe, Bala, Salto, Destello) con editor de puntos |
| **Animación** | Entrada, salida y bucle; **fotogramas clave** ◆ en escala, posición, rotación, opacidad y volumen |
| **Audio del clip** | Volumen hasta 200 %, fundidos, reducción de ruido, aislar voz, normalizar, cambiador de voz (eco, sala, radio, teléfono, robot, grave, megáfono), detección de ritmo |
| **Línea de tiempo** | Pistas ilimitadas (texto, efectos, superposición, principal, audio), pista principal magnética, imán, arrastrar entre pistas, recortar bordes, dividir, Q/W, congelar fotograma, separar audio, marcadores, bloquear/ocultar/silenciar pista, portada, menú de clic derecho, zoom con Ctrl+rueda o pellizco |
| **Reproductor** | Mover, escalar (esquinas o rueda) y girar elementos directamente; 8 proporciones; fondo de color o desenfocado; pantalla completa |
| **Exportar** | MP4 (H.264) o WebM, 480p–4K, 24–60 fps, tasa de bits, solo audio, fotograma PNG, subtítulos SRT |
| **Móvil** | Interfaz tipo app: cabezal fijo en el centro, barra inferior de herramientas, paneles deslizables, pellizcar para zoom |

## Mejoras basadas en la comunidad

Lo que más se repite en reseñas (Trustpilot, análisis de G2/CostBench, eesel, VEED, NemoVideo) y foros (Adobe Community, Shotcut):

1. **«Las funciones gratis pasaron a ser de pago».** Aquí todo lo Pro está incluido: sin marca de agua, 2K/4K/60 fps, subtítulos automáticos, quitar fondo, reducción de ruido y efectos Pro. Sin créditos de IA ni suscripción. Ver `Menú → Planes y Pro`.
2. **«Se cierra y pierdo mi trabajo».** Hay **autoguardado** continuo en el equipo (IndexedDB), incluidos los archivos importados. Los proyectos reaparecen en Inicio aunque se cierre el navegador.
3. **«Los subtítulos automáticos ahora son Pro / la gramática falla».** Son gratis y funcionan en el propio equipo con Whisper. Cada subtítulo se puede editar y exportar en `.srt`.
4. **Privacidad.** Nada se sube a servidores. Los modelos de IA se descargan una vez y se ejecutan localmente.
5. **«La línea de tiempo se queda corta para proyectos complejos».** Pistas ilimitadas que se crean solas al superponer clips, y bloqueo, ocultar o silenciar por pista.
6. **«Las transiciones modernas son lo mejor de CapCut».** Hay 20 transiciones con solapamiento real y la opción «Aplicar a todos».
7. **«La versión de escritorio parece una copia del móvil».** Hay interfaz de escritorio completa (atajos, clic derecho, Q/W, marcadores) y una interfaz móvil propia.
8. **Música bloqueada por región o derechos.** Toda la música y los efectos de sonido se generan en el equipo y no tienen derechos de autor.

## Optimización

- El lienzo solo se redibuja cuando algo cambia o durante la reproducción.
- Cada archivo tiene su propio grupo de reproductores, y el siguiente clip se precarga para evitar saltos en los cortes.
- Las tiras de fotogramas y las formas de onda se generan una sola vez y se guardan con el proyecto.
- La regla de la línea de tiempo se dibuja en un canvas y solo en la zona visible.
- El croma y quitar fondo se procesan a resolución reducida durante la edición.
- Los patrones de ruido y líneas se precalculan.
- El autoguardado espera 1,5 s sin cambios antes de guardar.

## Estructura del código

```
index.html          Estructura de la página (Inicio, editor, modales)
css/app.css         Estilos (tema, paneles, línea de tiempo, versión móvil)
js/util.js          Utilidades, iconos, avisos, base de datos local, WAV
js/catalog.js       Catálogos: filtros, efectos, transiciones, animaciones, textos, stickers…
js/state.js         Estado del proyecto, pistas, clips, deshacer, fotogramas clave, edición
js/media.js         Importar, reproducir, efectos de voz, miniaturas, ondas, música generada, grabar
js/render.js        Compositor: clips, transiciones, efectos, máscaras, croma, texto
js/timeline.js      Línea de tiempo: dibujo, arrastrar, recortar, imán, menú contextual
js/panels.js        Panel de recursos, panel de detalles y barra móvil
js/ai.js            Subtítulos automáticos, quitar fondo y detección de ritmo
js/export.js        Exportar video, audio, PNG y SRT
js/projects.js      Inicio, proyectos, autoguardado y plantillas
js/app.js           Reproducción, interacción con el lienzo, teclado y arranque
sw.js, manifest.webmanifest, icons/   App instalable (PWA)
```

Para añadir un filtro, efecto, transición o estilo de texto basta con agregar una línea en `js/catalog.js`. Los efectos se programan en `fxEffect()` y las transiciones en `drawTransition()`, ambos en `js/render.js`.

## Atajos

`Espacio` reproducir · `Ctrl+B` dividir · `Q`/`W` eliminar a la izquierda/derecha del cabezal · `Supr` eliminar · `Ctrl+C/V/X/D` copiar, pegar, cortar, duplicar · `Ctrl+Z/Y` deshacer y rehacer · `M` marcador · `←/→` fotograma · `Shift+←/→` 1 s · `Ctrl+=`/`Ctrl+−` zoom · `Shift+Z` ajustar · `Ctrl+S` guardar · `Ctrl+E` exportar · `F` pantalla completa.

## Limitaciones conocidas

- **La exportación es en tiempo real:** un video de 1 minuto tarda 1 minuto. Hay que mantener la pestaña visible.
- **Subtítulos automáticos:** la primera vez se descargan unos 40 MB (alrededor de 1 minuto). Después quedan en caché.
- **Quitar fondo:** funciona mejor con personas, porque usa un modelo de segmentación de selfies.
- **No incluye** video en reversa, seguimiento de movimiento, estabilización, avatares IA ni texto a voz exportable.

## Fuentes consultadas

- CapCut para computadora (sitio oficial): https://www.capcut.com/tools/desktop-video-editor
- Guía oficial «How to use CapCut»: https://capcut.com/resource/how-to-use-capcut
- Reseñas de CapCut 2026, pros y contras (eesel): https://www.eesel.ai/blog/capcut-reviews
- Reseña de CapCut (VEED): https://www.veed.io/learn/capcut-review
- Reseña de CapCut 2026 (NemoVideo): https://www.nemovideo.com/blog/capcut-review-2026
- Opiniones sobre precio y valor (CostBench): https://costbench.com/software/video-editing/capcut/reviews/
- Reseñas en Trustpilot: https://www.trustpilot.com/review/www.capcut.com
- Adobe Community, pedidos de funciones tipo CapCut: https://community.adobe.com/questions-737/pro-effects-like-capcut-1432909
- Foro de Shotcut, transiciones de CapCut: https://forum.shotcut.org/t/implementing-free-transition-effect-from-capcut/43732

> Proyecto académico con fines educativos. CapCut es una marca de su respectivo propietario. Esta recreación no está afiliada a ByteDance.

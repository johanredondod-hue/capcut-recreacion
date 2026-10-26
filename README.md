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
| **Audio** | 6 canciones y 12 efectos de sonido incluidos, **texto a voz**, **audio de un video de tu equipo**, grabar voz en off, importar audio |
| **Texto** | 15 estilos y 12 plantillas animadas; fuente, contorno, fondo, sombra, neón, **degradado**, **texto curvo**, espaciado, alineación; **leer en voz alta** |
| **Stickers** | 8 categorías de emojis y 8 **formas animadas** (aro de luz, aura, pulso, destello, flecha, marco neón, subrayado, visto bueno) |
| **Efectos** | 29 efectos de video como segmentos (VHS, fallo, RGB, lluvia, nieve, corazones, bokeh, caleidoscopio, pixelado, duotono, eco…) |
| **Transiciones** | 28 transiciones reales con solapamiento (mezclar, barridos, empujar, zoom, girar, círculo, corazón, reloj, puertas, cubo 3D, pixelar…) |
| **Voz a texto** | Subtítulos automáticos con 3 niveles de precisión, traducción al inglés, manuales, importar/exportar `.srt`, resaltado palabra por palabra |
| **Texto a voz** | 8 voces naturales (México, España, inglés, portugués); crea el audio y, si quieres, su subtítulo |
| **Filtros / Ajuste** | 32 filtros con intensidad; capas de ajuste; **curvas** (sombras, medios, luces) y **ruedas de color** por clip |
| **Detalles del clip** | Escala, posición, rotación, opacidad, espejo, rellenar/ajustar, modos de fusión, máscaras con **borde difuminado**, croma con cuentagotas, quitar fondo con IA |
| **Recortar** | **En pantalla con asas** (esquinas y bordes), proporciones fijas (16:9, 9:16, 1:1, 4:3, 3:4, original) y deslizadores |
| **Objeto (IA)** | **Clic sobre un objeto** (zapato, taza, mascota…): recortarlo, quitarlo, **contorno de luz**, **seguimiento** por el video, **aro de luz o texto que lo siguen**, reencuadre automático |
| **Velocidad** | Estándar (0,1x–10x, mantener tono), **curvas** con editor de puntos y **reproducir en reversa** |
| **Animación** | Entrada, salida y bucle; **fotogramas clave** ◆ en escala, posición, rotación, opacidad, volumen, brillo, saturación y desenfoque, con 5 tipos de interpolación |
| **Audio del clip** | Volumen hasta 200 %, fundidos, reducción de ruido, aislar voz, normalizar, cambiador de voz (eco, sala, radio, teléfono, robot, grave, megáfono), detección de ritmo |
| **Línea de tiempo** | **Selección múltiple** (Ctrl/Shift + clic, recuadro, Ctrl+A) para mover, duplicar, copiar, borrar y editar varios clips; pistas ilimitadas, pista principal magnética, imán, arrastrar entre pistas, dividir, Q/W, congelar, separar audio, marcadores, bloquear/ocultar/silenciar, menú de clic derecho |
| **Reproductor** | Mover, escalar y girar elementos directamente; 8 proporciones; fondo de color o desenfocado; pantalla completa |
| **Exportar** | **Rápido** (WebCodecs, MP4 H.264 + AAC) o compatibilidad (MP4/WebM en tiempo real), 480p–4K, 24–60 fps, **audio WAV al instante**, fotograma PNG, subtítulos SRT |
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

`Espacio` reproducir · `Ctrl/Shift+clic` seleccionar varios · `Ctrl+A` seleccionar todo · `Enter` terminar recorte · `Ctrl+B` dividir · `Q`/`W` eliminar a la izquierda/derecha del cabezal · `Supr` eliminar · `Ctrl+C/V/X/D` copiar, pegar, cortar, duplicar · `Ctrl+Z/Y` deshacer y rehacer · `M` marcador · `←/→` fotograma · `Shift+←/→` 1 s · `Ctrl+=`/`Ctrl+−` zoom · `Shift+Z` ajustar · `Ctrl+S` guardar · `Ctrl+E` exportar · `F` pantalla completa.

## Limitaciones conocidas

- **Exportación rápida:** suele ir más rápido que el tiempo real, pero con «Recortar objeto» o «Contorno de luz» la IA analiza cada fotograma y tarda más. Si el navegador no tiene WebCodecs se usa el modo compatibilidad (tiempo real, con la pestaña visible).
- **Primera vez de cada IA:** se descarga el modelo una sola vez. Voz a texto: 40–250 MB. Texto a voz: unos 60 MB por voz, alrededor de 1 minuto. Objetos: unos 6 MB.
- **Seguimiento de objetos:** funciona mejor con objetos que se distinguen del fondo. Si el objeto sale de la imagen, se queda en la última posición conocida.
- **Quitar fondo** automático funciona mejor con personas. Para otros objetos usa «Objeto (IA)».
- **La exportación rápida no mantiene el tono** al cambiar la velocidad. El modo compatibilidad sí lo mantiene.
- **iPhone/Safari:** algunos filtros del lienzo pueden no verse. La app está pensada para Chrome, Edge o Android.
- **No incluye:** estabilización, avatares IA, generación de imágenes con IA ni edición en equipo.

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

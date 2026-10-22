<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Platform visual rules
- Course sequence navigation always shows the previous destination on the left, the current class/activity in the center, and the next destination on the right, using the same ordered classes as the sidebar in editor and student views. Within a class follow lesson, individual exercises, quiz, and any authored jam; then the next class. From the lesson, Previous opens the preceding class. Keep internal lesson page controls inside the lesson, separate from this course navigation.
- Watch and Exercise/PlaySense are independent: each owns its video, score, BPM and synchronization. Watch sections must render even without a graded exercise score; never borrow the graded score/video as a Watch fallback. A score editor auditions its own click grid, not the separate video-level metronome.
- Keep synchronization anchor actions together in the shared left inspector, immediately below “Place score at playhead”, in Watch, Exercise and Jam authoring. Do not put anchor placement in the transport tempo menu. Preserve the authored click anchor in previews and student playback.
- Every user-facing video player must expose mouse/touch click-and-drag seeking (and keyboard access), in both authoring and student views. Preserve playback/paused state when seeking and update annotations, round counters and synchronized score from the resulting media time. Decorative background loops and hidden clock media use their owning surface's controls rather than redundant native controls.
- Treat the user's general UI instructions as platform-wide requirements: implement them in shared components and check equivalent desktop/mobile, admin/student and preview surfaces. Do not restrict a general correction to the screenshot or one instrument; keep content-specific timing and geometry scoped to the appropriate content.
- Keep the shared language selector accessible in every application shell, including admin/PlaySense on desktop and mobile; new player views must retain access to it and follow the platform locale.
- Apply the same score heading to lessons, exercises, jam sessions and previews: centered title at the top; instrument/rhythm metadata on the left and composer/credit (default LMM) on the right; BPM immediately above the staff at the left, below the metadata.
- Every app-owned video surface uses the shared VideoWatermark at its lower right, scaled with the visible video picture (excluding letterbox/pillarbox bars), with subtle transparency and brand-colored glow. Preserve the supplied logo and keep branding non-interactive and clear of playback controls.
- Action controls use the established LMM brand colors.

- Keep the selected language consistent across server-rendered course content and client controls. Use authored language variants for descriptions and rich notes; never silently show English notes in Spanish mode. Preserve both variants when editing.

- Keep the floating score playback palette horizontal and rectangular (wide and low), with its own width rather than the narrow symbol-palette width. Keep time, measure, beat and BPM on one row when space allows.

- Keep each control label immediately beside its input or selector. Do not separate labels and their controls across a wide panel with justify-between. Keep related action buttons next to the fields they act on.

## Exercise video presentation (user preference)
- The user-supplied Watch opening template is `public/local-course-assets/templates/watch-logo-intro.mp4` (2.869542 seconds). Use it before exercise Watch videos; do not add it to PlaySense graded playback. Before prepending it, check for an existing intro and preserve score/video synchronization by accounting for the added duration.
- Treat these as a flexible creative direction, not identical effects/copy/timing for every video. Adapt tips, animations, technique markers and repetition counts to the particular exercise. The shared presentation principles are: show the exercise title before the preparation countdown, concise tips for precision/timing/control during playback, a clear last-round notice at the start of the actual final round, and a motivating completion card.
- Use established brand colors, modern restrained animations, the shared VideoWatermark, reduced-motion support, and controls for pausing/replaying and hiding technique annotations. Keep guidance out of the hands and playback controls.
- Technique arrows must be authored for the particular video, hand and timing; never apply the Sobao hand marker to unrelated instruments. Completion encouragement is not a measured performance grade.
- The initial local preview is “Cáscara con Sobao Simple”, class item 8965d41a-569b-4295-a449-afbcbbcb4fad, with left-hand Sobao guidance. This video contains five rounds, each two 4/4 measures; count rounds within the video using BPM and the confirmed first-beat anchor, without replaying the clip between rounds. Do not add a score until the user supplies it.
- Keep coaching cards brief with gaps between them. Do not stack a hand-technique label with a competing coaching card; keep picture-in-picture views unobstructed. Hide or relocate the round counter when a camera composition needs that space. Check camera cuts before timing technique arrows.

- For student-facing changes, complete and verify the same flow in the local student view as well as the authoring view before calling the work done. Share playback/effects logic and authored settings between the two; an editor-only preview does not complete a student-facing change. Keep work local unless publishing is explicitly requested.

## Unified LMM lesson presentation
- Keep the platform unified across instruments, theory, editor previews and student lessons. Reuse shared lesson frames, transport, settings/setup, language and theme controls; do not build reduced standalone versions.
- For exercise intro and completion graphics, retain the actual Ritmo básico de la cáscara template (`CoachingCard` and `cascara-video-coaching.css`). For lesson video overlays, use the approved Codex-Intro reference presentation described below. Preserve the logo aspect ratio and fill the entire assigned stage background.
- Place Video, Quiz, Exercise and Jam Session elements above lesson content and community/comments below. Use local-only storage for local drafts.
- Historical details use an adjacent image button, a locally stored documentary image and internal provenance/license metadata. Do not fabricate portraits or describe later depictions as photographs.
- These requirements apply to every existing and future class; do not wait for the user to repeat them per lesson. Reuse shared implementations rather than making per-class copies.
- Keep lesson videos and interactive explanations separate from practice: finish with a motivating completion card, then offer explicit Previous and Next: Exercise navigation. Never include exercise questions or answer reviews in the lesson video, and never advance automatically into practice.
- All question-based exercises use the existing QuizRunner in Exercise mode, shared grading engine, answer feedback sounds (respecting the sound preference), percentage score, correct/incorrect answer review, retry and next-part navigation. They remain Exercise items, not Quiz items. Performance exercises retain their established measured scoring; do not invent grades from completion alone.
- Use the shared content-sized frame for document lessons so all text, diagrams and navigation remain accessible on desktop/mobile and in admin/student previews.
- Authored pitched sounds must derive from named notes with explicit octave via the tested conversion in lib/solfeo/notes.ts (Tonal), preserving enharmonic spelling and accidental meaning. Verify staff-position mappings independently, including sharps, flats, double accidentals and octave crossings; never reuse line pitches for spaces.

## Approved lesson video layers (2026-10-10)
- Apply the approved Codex-Intro/reference-video concept across classes: reusable instructor/title banners and synchronized explanatory layers, rendered separately from the original video. Reuse `ReferencePresentationCue` and `LessonPresentationOverlay` rather than duplicating implementations.
- Author each video's copy, graphics, entrances and exits from its actual content and narration. Use timelines, genre labels, arrows or other explanations only where appropriate; never copy Codex-Intro names, dates, genres or timestamps into unrelated lessons. Inspect camera cuts and existing embedded graphics to avoid duplication or obscuring the instructor, hands or picture-in-picture.
- Keep layers synchronized to media time during playback, pause, seeking and replay, with reduced-motion support and a hide/show control. Keep transport clear of banners, preserve shared branding and language support, and verify student/editor and desktop/mobile views.
- This is the approved direction for existing and future classes; approving the template does not mean all videos have already been individually authored. Continue local-only work until publishing is explicitly requested.
- Preserve every uploaded Codex video exactly: no copied intro, cuts, padding, audio replacement or duration changes. Adapt overlays and score timing to the uploaded media clock using verified intermediate anchors. Keep changes local unless publishing is requested.

- When an instructor counts aloud, add editable number overlays synchronized to the actual spoken counts. Author timings per video; do not run a continuous counter during silent demonstrations or mistake numbers mentioned in explanations for counting.

## Whole-section tempo (user requirement)
- Changing BPM in the left score sidebar applies that BPM to every measure and staff of the current score/section, including repeats. Clear earlier per-measure tempo marks and playback overrides so they cannot silently change the click later. Keep this behavior shared by Watch, Exercise, authoring and student playback, with undo support.

- Quantization controls must stay available after applying an adjustment, with visible undo independent of the current selection and repeated undo within the editor session. Keep the options open so users can compare grids and strengths.
- Every score section closes with a double/final bar (repeat endings retain their notation). Barline choices from the symbol palette must render in the synchronized editor as well as the score/player views.

## Undo/Redo contract
- All editing surfaces must use chronological transactions: Undo restores the immediately preceding edit; Redo reapplies that same edit. A new edit after Undo clears the redo branch. Never silently prefer notation history over a more recent timing, Flex, quantization or settings edit.
- A compound edit must restore its score and timing together, flush pending gestures before undo, and preserve the document history when switching Studio views in the current session. Keep text-field native undo intact. Do not claim universal undo for server deletions or uploads without implementing and testing their inverse operations.

- Newly inserted measures, before or after existing/imported bars, must use the same editing and history paths as existing measures. Open accepted blank insertions ready for note/rest entry; keep blank measures selectable and reopenable in both page and synchronized staff views.

- All score editing controls (including before/after measure insertion, selectors, palettes and portalled popovers) must preserve score selection during pointerdown. Use the shared toolbar or data-score-preserve-selection boundary; regression tests must simulate pointerdown before click, since click-only tests miss layout shifts that swallow clicks. Apply this across instruments, Watch/Exercise and page/sync editors.

## Infantil: respuesta visual al aprendizaje
- En el mundo infantil, cada acierto evaluado en lecciones, ejercicios y quizzes activa una celebración breve: Corcheita salta, el sol irradia y aparecen fuegos artificiales. Adaptar las celebraciones al ambiente temático de la actividad. Debe contrastar con el movimiento suave del estado normal.
- Ante una respuesta incorrecta, Corcheita muestra tristeza suave y lágrimas blancas en ambos ojos, junto con una pista amable y la oportunidad de reintentar. Compartir estas reacciones entre alumno y autor, respetando pausa de animaciones y movimiento reducido; no celebrar como acierto la simple exploración de una nota.

- Solfeo Infantil Aplicado: aplicar el sistema infantil compartido a los 12 módulos y sus 149 clases, también portadas, prácticas y evaluaciones. Variar los ambientes por tema (océano con plantas y burbujas, cosmos con planetas/constelaciones, bosques, montañas/nieve, islas/ríos y dinosaurios para el ritmo). Mantener partituras, audios, traducciones y acceso al material completo; las reacciones negativas deben ser suaves y acompañarse de pistas.

## Solfeo infantil: explicaciones visibles
- Cada explicación infantil debe apoyarse en una demostración, figura manipulable o juego relacionado con el concepto; no dejar páginas de texto como única experiencia.
- Para demostrar línea frente a espacio, usar frutas u objetos redondos como cabezas de notas, separados horizontalmente. El trazo cruza el centro en una línea; en un espacio el objeto queda entre dos líneas. Nunca usar animales como blancos de flechas.

## Eliminación de medios
- Cuando el usuario elimine o reemplace un medio y pida retirarlo, eliminar también sus copias locales obsoletas y referencias de sustitución, salvo que solicite conservarlas. Nunca restaurar automáticamente un video eliminado desde una copia de prueba. Conservar por separado las capas y configuraciones que el usuario pida reutilizar.

## Presentación de cada ejercicio
- Todo ejercicio nuevo debe incluir la presentación inicial compartida (`LessonStartCard` / `ExerciseVideoGuidance`), con título propio, una indicación breve pertinente y botón «Comenzar». También aplica a ejercicios de observación o canto sin partitura ni PlaySense evaluado. Verificar la misma presentación en alumno y autor, sin modificar la duración ni los tiempos del video.

- Todos los ejercicios del curso de timbal, incluidos los de solo video, observación o canto sin partitura, usan el aula compartida de `TimbalTheater` / `TheaterVideoSlot` en modo infantil: fondo, niños y contenido dentro de la pizarra. No omitir el aula en rutas de reproducción sin PlaySense.

- Los cambios funcionales de estructura se comparten entre Mundo Clásico y Mundo Infantil, en todos los cursos y actividades. La barra inferior de acciones y navegación (Tu turno, Siguiente, Anterior y ubicación actual) debe poder ocultarse y volver a mostrarse en ambos mundos, sin reiniciar el contenido ni la reproducción.

- Todas las lecciones y ejercicios con video, incluidos reproductores de efectos y vistas previas, comparten TransportBar con reproducir/pausar, reiniciar, búsqueda por arrastre y teclado, velocidad, volumen y pantalla completa. Play debe funcionar desde la presentación inicial; la ausencia de partitura o de una guía específica no cambia el formato de controles.

- En vistas con video, integrar Siguiente/Tu turno en la barra de reproducción junto al metrónomo; no mostrar otra franja de estado/progreso ni lectura sintética del texto debajo. Conservar acciones de respuesta en quizzes y actividades, y narración en documentos sin reproductor. Aplicar en ambos mundos y todos los cursos.

- Referencia final de timbal suministrada el 2026-10-21: `lib/playsense-studio/__tests__/fixtures/timbal-final-legend.mxl` (18 golpes, Mauricio Upmann), con imagen y procedencia en `local-artifacts/timbal-final-legend/`. Consultarla al actualizar la leyenda compartida. Confirmación del usuario: mantener los golpes abiertos/cerrados y usar las figuras del MXL: abierto = óvalo hueco atravesado (compás 14); cerrado/presionado = círculo con cruz (compás 15), ambos en Fa4. Conservar la referencia anterior como prueba de compatibilidad de partituras existentes.

- Notación: colocar la indicación de compás (por ejemplo 4/4) delante del primer compás de cada ejemplo, sin repetirla en cada compás consecutivo. Separar los silencios de las notas de otras voces; en el sobao, bajar los silencios de negra de la voz inferior para evitar superposición con las corcheas.

- En las voces separadas de cáscara con sobao, los silencios de la mano derecha (anaranjados) van arriba, centrados en la zona superior del pentagrama; los de la izquierda (azules) van abajo. No bajar los silencios de ambas voces juntos. Conservar la cáscara de relleno en una sola voz con corcheas unidas según el MXL.

- Agrupar dos silencios de corchea consecutivos que ocupan un tiempo completo en un silencio de negra, en ambas voces. Conservar la corchea de silencio cuando comparte el tiempo con un golpe; no agrupar cruzando tiempos. Referencia aprobada: cáscara/sobao de Variaciones, `lib/playsense-studio/variaciones-staff.ts`, con reglas y fuentes en `local-artifacts/codex-variaciones/hand-coordination-authorship.json`. Reutilizar la notación, adaptando siempre los golpes y tiempos al video.

- Idioma del video: seleccionar por defecto la pista de audio disponible que coincida con el idioma de la aplicación, también al cambiarlo durante la lección. Conservar el video original como reloj maestro para partituras, capas, búsqueda y velocidad. Si falta o falla el doblaje, mantener el original; no usar una muestra parcial como pista de una lección completa.

- Doblajes de lecciones musicales: sustituir únicamente la voz y conservar el acompañamiento original a su nivel, sin normalización ni compresión global. Usar el audio original directamente en demostraciones sin voz; verificar sincronía, picos y comparación de muestras. Cuando se superponen voz e instrumento, documentar las limitaciones de separación y no afirmar identidad perfecta.

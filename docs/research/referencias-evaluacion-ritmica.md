# Referencias de evaluación rítmica y registro de decisiones

Registro local solicitado por Rafael para conservar las fuentes del desarrollo de Latin Music Mastery y facilitar una futura revisión de documentación relacionada con una patente. Fecha de consulta y registro: 2 de octubre de 2026. Se conservan referencias y notas propias, no copias completas de las publicaciones.

Este registro distingue métodos publicados de decisiones del producto. No constituye una búsqueda exhaustiva de antecedentes ni una conclusión sobre novedad o patentabilidad.

## Fuentes científicas y técnicas

### R1 Documentación de mir_eval sobre detección de ataques

Autor institucional: proyecto mir_eval. Título: mir_eval.onset. Versión web consultada: stable; la búsqueda la identificó como 0.8.2. La URL stable puede cambiar de versión.

URL: https://mir-eval.readthedocs.io/stable/api/onset.html

Sección relevante: mir_eval.onset.f_measure, parámetro window y valores de retorno.

La documentación define precisión, recuperación y F1 comparando tiempos de ataques detectados con tiempos de referencia. El margen predeterminado es 0,05 segundos. Su objeto es evaluar algoritmos de detección, no certificar competencia musical ni fijar notas académicas.

Aplicación local: ventana de ±50 ms y F1 para evaluación rítmica de los ataques captados por micrófono en el recorrido de percusión. Adaptación pedagógica propia; no se ha demostrado equivalencia completa de nuestra implementación con mir_eval.

### R2 Publicación de mir_eval

Colin Raffel, Brian McFee, Eric J. Humphrey, Justin Salamon, Oriol Nieto, Dawen Liang y Daniel P. W. Ellis. “mir_eval: A Transparent Implementation of Common MIR Metrics”. 15th International Society for Music Information Retrieval Conference, 2014.

PDF del autor: https://colinraffel.com/publications/ismir2014mir_eval.pdf

El artículo presenta una biblioteca de métricas de recuperación de información musical y compara implementaciones. Sirve como fundamento bibliográfico del marco de evaluación, no como validación de nuestro detector o de un umbral para aprobar alumnos. La página inicial declara licencia CC BY 4.0 para el artículo.

### R3 Documentación de transcripción musical

Autor institucional: proyecto mir_eval. Título: mir_eval.transcription.

URL: https://mir-eval.readthedocs.io/stable/api/transcription.html

Secciones relevantes: introducción, match_note_onsets y precision_recall_f1_overlap.

Distingue evaluación de ataques, afinación y finales de notas. Documenta correspondencias uno a uno y criterios de referencia MIREX. Se consultó para separar las dimensiones de evaluación. No se activaron por esta referencia evaluaciones nuevas de afinación, duración, timbre o dinámica.

### R4 Repositorio de mir_eval

URL: https://github.com/mir-evaluation/mir_eval

Referencia complementaria de implementación y procedencia, localizada en la búsqueda. No se copió código del repositorio ni se fijó una revisión concreta durante esta sesión. La implementación local es TypeScript; no depende de instalar la biblioteca Python mir_eval.

## Referencias académicas de contexto

### R5 Universidad de Granada

Título: Cómo obtener mis calificaciones.

URL: https://www.ugr.es/info/perfiles/futuros-estudiantes/internacional-erasmus-otros-programas/calificaciones

Se consultó por la pregunta sobre notas universitarias: 0–4,9 corresponde a suspenso y 5–6,9 a aprobado. Es una escala académica, no una conversión de F1 ni una norma de precisión rítmica.

### R6 Harvard College

Entidad: FAS Registrar’s Office. Título: Transcripts.

URL: https://registrar.fas.harvard.edu/transcripts

Se consultó para mostrar diferencias entre instituciones: D+, D y D− son aprobatorias aunque insatisfactorias; E es reprobatoria. La página no establece una equivalencia porcentual única con F1.

## Decisiones del producto y su procedencia

- Alcance acordado actualmente: solo ritmo. Las dinámicas P, PP, PPP, MP, MF y otras se definirán más adelante; ahora no intervienen en la nota.
- Coincidencia temporal: ±50 ms, basada en el valor predeterminado de R1. Es una referencia de evaluación de ataques, pendiente de validación pedagógica y experimental con el equipo real.
- Calificación rítmica: 100 × F1. Cada ataque y cada referencia se emparejan como máximo una vez.
- Fórmulas: precisión = aciertos / ataques detectados; recuperación = aciertos / ataques esperados; F1 = 2 × aciertos / (ataques esperados + ataques detectados). Una ejecución vacía recibe 0 en el producto.
- El error medio absoluto y el sesgo se calculan únicamente entre ataques emparejados. No describen por sí solos las notas omitidas ni los ataques fuera de ventana.
- Aprobación provisional: 75 % y ejercicio completo. Solicitud inicial del usuario, mantenida provisionalmente tras aclarar que R1 no proporciona un porcentaje universitario de aprobación. No atribuir este 75 % a mir_eval.
- No descontar automáticamente el desfase de palmadas de Timing como latencia exclusiva del equipo: incluye posibles anticipaciones o retrasos del intérprete.
- Los criterios experimentales de calibración de intensidad (+3 dB entre rondas, tolerancia a un golpe diferente y margen de entrada) son decisiones locales. No proceden de R1 ni constituyen una escala universal de dinámica musical.
- El cálculo de RMS descontando potencia de ruido estima la señal útil bajo supuestos de ruido estable y no correlacionado; no equivale a medir presión acústica absoluta en dB SPL.
- Calibración guardada localmente por usuario, micrófono, instrumento y modalidad de escucha. No por clase ni curso. Requiere recalibrar al cambiar ganancia, posición o condiciones acústicas.

## Archivos locales vinculados

- Evaluación de ataques: ../../lib/play-sense/rhythm-evaluation.ts
- Pruebas de la métrica: ../../lib/play-sense/__tests__/rhythm-evaluation.test.ts
- Integración en sesión: ../../hooks/use-exercise-session.ts
- Detección y niveles: ../../hooks/use-onset-detection.ts
- Procesador de audio: ../../public/audio-worklets/onset-detector-processor.js
- Perfiles de calibración: ../../lib/audio/acoustic-profile.ts
- Asistente: ../../components/class-viewer/lesson-viewer/mic-setup-wizard.tsx
- Resultado y aprobación: ../../components/class-viewer/lesson-viewer/part-done.tsx

## Evidencia y trabajo pendiente

Las pruebas automáticas cubren casos sintéticos de ataques exactos, omisiones, golpes extra, límite de 50 ms, emparejamiento y aislamiento de perfiles. Esto no demuestra precisión del detector para todos los instrumentos ni sustituye ensayos con audio real anotado.

Queda por registrar un conjunto de muestras con tiempos de referencia, micrófono, ganancia, distancia, ruido ambiente y resultados. No se ha hecho una búsqueda especializada de patentes. Las ideas publicadas en R1–R4 deben permanecer atribuidas a sus autores y separadas de cualquier contribución propia que se documente posteriormente.

Todo este registro se creó en el repositorio local. No se publicó ni se envió como solicitud de patente.

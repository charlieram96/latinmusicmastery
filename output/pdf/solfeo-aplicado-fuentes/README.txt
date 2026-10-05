SOLFEO APLICADO - LATIN MUSIC MASTERY
Edición de revisión 0.1, español. Contenido local; no publicado ni importado al curso.

ESTADO
Propuesta de 16 módulos y 85 títulos de lecciones, con lecciones ilustradas de muestra.
No es todavía el desarrollo completo de las 85 lecciones. Las fuentes utilizadas
se identifican en el PDF y en sources.json. Los dos manuales originales no se
redistribuyen en este paquete. Los ejemplos de la muestra son de nueva elaboración.

EDITAR
- content.es.json: texto y datos de diagramas. Es la fuente editorial principal.
- curriculum.json: módulos y lecciones con IDs estables, independientes del idioma.
- percussion-legend.json: posiciones y cabezas extraídas del mapa local de LMM.
- scores/*.json: eventos musicales con IDs, alturas, duración y onset en pulsos.
- scores/*.musicxml y *.mxl: partituras editables; la maquetación puede variar entre editores.
- render.py: diagramas vectoriales y maquetación. Algunos rótulos gráficos aún están
  en español dentro del renderer y deben localizarse al preparar otra edición.
- music-glyphs.json: trazados Bravura para impresión; véase OFL.txt.
- export_scores.py: regenera ejemplos MusicXML/MXL y JSON a partir del contenido.

REGENERAR
Requiere Python 3 y reportlab. Fuentes Arial y Arial Bold, no distribuidas aquí.
En macOS:
  python3 render.py
  python3 export_scores.py
En otro sistema, establece LMM_FONT_DIR a una carpeta que contenga Arial.ttf y
Arial Bold.ttf con licencia apropiada, o cambia las dos rutas de fuente del renderer.
El PDF se escribe en la carpeta superior. No necesita base de datos ni red.

INTERACTIVIDAD
Los onsets y duraciones son fracciones de negra, no coordenadas de pantalla.
Una negra a B BPM dura 60000/B milisegundos. Los esquemas sin compás se exportan
como senza-misura, sin inventar metrónomo ni sincronización. Los ejemplos métricos
conservan 4/4; LMM-practice-001 es una primera frase original de dos compases.
videoSync es null: debe vincularse a material audiovisual real cuando exista.
No se ha implementado ni probado aún un reproductor, quiz o sincronizador dentro
de la aplicación; este paquete entrega la base editorial y musical para ese paso.
La importación MusicXML en LMM o en otro editor debe verificarse al integrar.

IDIOMAS
Esta edición está redactada en español. Se pueden crear content.en.json y rótulos
localizados manteniendo IDs musicales; no existe todavía una traducción inglesa
completa y revisada. Conservar textos de cada idioma por separado.

EDICIÓN DEL PDF
Texto seleccionable y notación vectorial; el contenido se edita preferentemente
mediante las fuentes JSON/Python y se regenera. No es un formulario AcroForm ni un
editor interactivo de partituras incrustado en el PDF.

TIPOGRAFÍA Y PROCEDENCIA
Bravura: SIL Open Font License, OFL.txt. La autoría LMM del contenido no se extiende
a esta fuente. El mapa de percusión se conserva del código local de la plataforma;
sus comentarios remiten a las leyendas de Finale utilizadas por LMM.

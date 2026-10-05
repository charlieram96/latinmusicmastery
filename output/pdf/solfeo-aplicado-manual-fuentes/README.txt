LATIN MUSIC MASTERY — SOLFEO APLICADO
Manual de estudio, edición de trabajo 0.2 (español)

CONTENIDO EDITABLE
- author.py: autoría y generación del contenido original.
- content.es.json: textos, diagramas y notación semántica en español.
- curriculum.json: módulos, títulos de las lecciones y páginas.
- render.py: maquetación del PDF y dibujos vectoriales (pentagramas, figuras,
  árbol de duraciones, manos y trayectorias de marcación, teclado, llaves).
- music-glyphs.json: contornos vectoriales Bravura; licencia en OFL.txt.
- scores/: 264 ejemplos en MusicXML 4.0, MXL y JSON con alturas y tiempos exactos.
- export_scores.py: regeneración de partituras editables.
- validate.py y validation.json: comprobación de duraciones, escalas y exportación.
- sources.json: referencias consultadas.

RECONSTRUCCIÓN
Requiere Python 3, reportlab y pypdf. Los tipos de texto predeterminados son Arial
(macOS); LMM_FONT_DIR permite indicar otra carpeta con Arial.ttf y Arial Bold.ttf.
Desde esta carpeta:
  python3 author.py
  python3 render.py
  python3 export_scores.py
  python3 validate.py
El PDF se escribe en la carpeta superior con el nombre LMM-Solfeo-Aplicado-Manual.pdf.

IDIOMAS E INTERACTIVIDAD
Los textos están separados del motor de dibujo. Para una traducción, crear una
variante del contenido conservando IDs y datos musicales. Esta entrega contiene
la variante española, no una traducción inglesa ya realizada.
Los JSON de scores conservan duración y onset en fracciones de negra: la conversión
a milisegundos depende del tempo. MusicXML conserva compás, armadura, silencios,
puntillos, grupos especiales, ligaduras, articulaciones y dinámicas del ejemplo.
Los esquemas explicativos de recorrido, manos y divisiones permanecen editables
en render.py/content.es.json; no son todos ejercicios musicales autónomos.
videoSync y tempo quedan sin asignar cuando no existe una referencia concreta.
La fuente permite elaborar actividades interactivas y sincronización posterior;
esas funciones no se han instalado ni conectado a la aplicación en esta entrega.

EDICIÓN
El PDF es una salida vectorial con texto seleccionable. La edición musical se
realiza en los archivos fuente y MusicXML/MXL, no mediante formularios del PDF.
Para modificar un texto permanentemente, cambia author.py o conserva una variante
de content.es.json y ejecuta solo render.py; author.py regenera content.es.json.
Las partituras son ejercicios originales de LMM. No se han copiado ejemplos de
los manuales aportados. Esta versión no incluye el capítulo de instrumentos.
No se modificó ni publicó contenido del curso en la aplicación.

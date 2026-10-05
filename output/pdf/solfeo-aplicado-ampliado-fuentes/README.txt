LATIN MUSIC MASTERY - SOLFEO APLICADO
Edición ampliada 0.3 - revisión editorial

ENTREGA
Manual PDF de 273 páginas; diez módulos con un examen integrado de diez
preguntas cada uno; examen final de cincuenta preguntas; veinte estudios
de entonación de dieciséis compases cada uno; índice y solucionario.

FUENTES EDITABLES
- author.py: base del contenido y ejemplos.
- revise.py: reorganización y ampliaciones de esta edición.
- practice.py: talleres y veinte estudios de entonación.
- cantabile.py: diseño melódico y rítmico de las veinte lecciones.
- supplements.py y coverage_expansion.py: ampliaciones de teoría y práctica.
- meter_revision.py: normalización de ejemplos medidos.
- audit_coverage.py: comparación temática y localización de contenidos.
- comparison.json y comparison.csv: 73 registros de cobertura de ambos PDF.
- assessments.py: exámenes y respuestas.
- render.py: composición del PDF y gráficos vectoriales.
- content.es.json: contenido resultante por página, con identificadores.
- curriculum.json: organización del material.
- assessments.json: preguntas, soluciones y puntuaciones.
- repertoire.json: veinte estudios completos con sistemas y notas.
- scores/: MusicXML 4.0, MXL comprimido y JSON de cada ejemplo.
  Los archivos estudio-completo-01 a estudio-completo-20 contienen cada obra
  completa. lectura-conjunta-completa y danza-conjunto-completa reúnen los
  estudios a dos pentagramas de doce y dieciséis compases, respectivamente.
  Los otros archivos corresponden a ejemplos o sistemas individuales.
  manifest.json enumera los 765 ejemplos y partituras de esta edición.
- music-glyphs.json y OFL.txt: contornos de tipografía musical y licencia.
- sources.json: referencias de consulta.
- validation.json: resultados de comprobación.

REGENERACIÓN
Python 3 con reportlab y pypdf. Arial.ttf y Arial Bold.ttf en
/System/Library/Fonts/Supplemental, o en el directorio LMM_FONT_DIR.
Ejecutar build.py desde esta carpeta, usando el Python con esas dependencias.
El PDF se escribe en la carpeta superior.
Cada compilación reconstruye primero la base: no ejecutar revise.py dos veces
seguidas sobre contenido ya ampliado. Editar los autores para cambios persistentes;
content.es.json y los demás archivos derivados se regeneran.

EDICIÓN Y FUTURA INTERACTIVIDAD
La partitura se representa como datos, no como imágenes escaneadas. Los tiempos
JSON se expresan en negras y fracciones exactas, no en milisegundos fijos.
Los adornos conservan su notación; su realización temporal depende del estilo.
MusicXML admite edición en un editor compatible; el aspecto puede variar entre
editores. No se ha probado la importación en todos los programas de notación.
No se ha conectado esta entrega a PlaySense ni a vídeos. No se han modificado
cursos o datos de la aplicación. El PDF es de lectura; la edición se realiza en
los archivos fuente, no mediante campos de formulario PDF.
El idioma de esta entrega es español. Identificadores y campos de texto permiten
variantes posteriores; no se incluyen traducciones aún.

REFERENCIAS
Los veinte estudios son originales de esta edición. La referencia a Solfège des
solfèges se limita a sus datos bibliográficos: no se obtuvo acceso íntegro a esa
obra durante esta revisión. El alcance de las fuentes está explicado en el PDF.

COMPARACIÓN
Se revisaron los dos archivos suministrados completos: 83 y 70 páginas PDF.
La matriz recorre los 50 apartados del índice de Pezzuti y 23 bloques del
segundo archivo. Es una comparación de contenidos y objetivos de práctica,
no una certificación de originalidad ni un cotejo de cada nota. Las ampliaciones
usan nuevas secuencias musicales para trabajar esos objetivos.

COMPROBACIONES
894 compases de ejemplos a una voz y 86 compases de pentagramas conjuntos;
intervalos de las escalas; reguladores con extremos explícitos; duraciones
MusicXML y equivalencia MXL; 10 exámenes de 10 preguntas y final de 50.
Se revisaron visualmente las páginas añadidas y los ejemplos modificados.

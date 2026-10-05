"""Reproducible coverage map of both supplied references. No source score copying."""
from pathlib import Path
import json,csv,html
R=Path(__file__).resolve().parent
pages=json.loads((R/'content.es.json').read_text())['pages'];lookup={p['id']:(i+1,p.get('title','Portada')) for i,p in enumerate(pages)}
# Reference 1: every entry of the original 50-item contents list, printed pagination.
rows=[
(1,5,'Elementos de rítmica','figuras relaciones','Conservado: figuras, silencios y equivalencias.'),
(2,6,'Primeras células rítmicas','combinaciones taller-2-a','Conservado: práctica métrica inicial.'),
(3,7,'Figuras y silencios combinados','silencio-compas taller-2-a','Conservado y ampliado con dictados.'),
(4,8,'Escala básica y preparación melódica','escala repertorio-01','Escala en ambos sentidos; lección de 16 compases.'),
(5,9,'Lectura melódica inicial','repertorio-02 repertorio-03','Lecciones ampliadas.'),
(6,10,'Grados de Do mayor','escala repertorio-05','Conservado y ampliado.'),
(7,11,'Fórmulas rítmicas y pulso ternario','compas taller-2-a repertorio-03','Conservado.'),
(8,13,'Fa mayor','tonal-2-mayor repertorio-10','Escala, armadura y lección.'),
(9,14,'Lectura con acompañamiento y dos voces','dos-voces lectura-conjunta-retornos-1','Lectura simultánea ampliada.'),
(10,15,'Alteración y dos voces','alteraciones-entonadas-1 independencia-0','Ejemplos nuevos.'),
(11,16,'Sol mayor','repertorio-09 orden-sostenidos','Lección y armadura.'),
(12,17,'Práctica a dos voces','independencia-0','Añadida coordinación progresiva.'),
(13,18,'Compás y unidades','unidades unidades-cuadro','Añadido cuadro comparativo.'),
(14,19,'Compases con blanca como pulso','compas-blanca-2 compas-blanca-3 compas-blanca-4','Práctica adaptada por indicación editorial a 2/4, 3/4 y 4/4, con negra como pulso.'),
(15,22,'Marcación del compás','marcar-2 marcar-3 marcar-4','Conservados diagramas de marcación.'),
(16,23,'Dictado y entonación a dos voces','dictado-procedimiento dictado-modelo-1 independencia-0','Añadidos procedimiento y modelos.'),
(17,24,'Dos voces en práctica','lectura-conjunta-retornos-1','Añadido estudio completo de retorno.'),
(18,25,'Intervalos melódicos, armónicos y compuestos','intervalo intervalos-simultaneos-0 intervalos-simultaneos-1','Añadida representación simultánea.'),
(19,26,'La menor','menor repertorio-11','Conservado.'),
(20,27,'Terceras y cuartas','terceras-control intervalo-preparado-4','Añadida práctica específica.'),
(21,28,'Ligaduras, puntillos y dictado de intervalos','puntillos triple-puntillo dictado-modelo-3','Ampliados triple puntillo y dictados.'),
(22,29,'Quintas y sextas','intervalo-preparado-5 intervalo-preparado-6','Añadida preparación en ambos sentidos.'),
(23,30,'Séptimas, octavas y resumen','intervalo-preparado-7 intervalo-preparado-8 intervalos-5','Añadida preparación.'),
(24,31,'Lectura a dos voces','independencia-0 lectura-conjunta-retornos-1','Ampliada.'),
(25,32,'Fórmulas rítmicas con ligaduras','puntillos sincopas-niveles','Ampliadas variantes.'),
(26,33,'Dictados con figuras ligadas','dictado-modelo-3','Añadido modelo.'),
(27,35,'División de unidades','unidades-cuadro','Añadido cuadro original con tres columnas.'),
(28,36,'Semicorcheas','semicorcheas-progresivas repertorio-13 repertorio-19','Añadidas células y ampliado repertorio.'),
(29,37,'Dictado y lectura con semicorcheas','dictado-modelo-4 repertorio-13','Añadidos modelos.'),
(30,38,'Puntillo simple','puntillos repertorio-07','Conservado y aplicado.'),
(31,39,'Mi menor natural','menor-natural-lectura','Añadida lectura que conserva la subtónica.'),
(32,41,'Alteraciones y tono','tonos alteraciones enarmonia-ejemplos','Conservadas correcciones del usuario.'),
(33,43,'Clasificación interválica','intervalo intervalos-0 intervalos-5','Conservado y reforzado.'),
(34,44,'Segundas mayores y menores','segundas-control-0 segundas-control-1','Añadida serie ascendente y descendente.'),
(35,45,'Entonación de alteraciones y referencia tonal','alteraciones-entonadas-0 alteraciones-entonadas-1 alteraciones-entonadas-2 centros-tonales','Añadidas diez células cromáticas y lectura tonal.'),
(36,50,'Ritmos combinados','semicorcheas-progresivas sincopas-niveles','Ampliados.'),
(37,51,'Lecciones a dos voces','independencia-0 independencia-1 lectura-conjunta-retornos-1','Añadida coordinación y retorno.'),
(38,55,'Tresillo: valores iguales y mixtos','tresillos-variados-0 tresillos-variados-1 tresillos-variados-2','Añadidas doce comparaciones.'),
(39,56,'Aplicación rítmica del tresillo','repertorio-18 dictado-modelo-5','Aplicación y dictado.'),
(40,57,'Clave de Fa y lectura progresiva','fa fa-mapa-ampliado fa-estudio-1 fa-estudio-2 fa-estudio-3','Añadidos mapa y tres estudios.'),
(41,64,'Acento y síncopa larga y breve','acentos sincopas-niveles','Ampliados niveles métricos.'),
(42,66,'Síncopa breve y contratiempo','sincopas-niveles','Añadidas variantes.'),
(43,67,'Especies de tercera','terceras-control terceras-alteradas','Añadidas disminuida y aumentada.'),
(44,68,'Entonación de terceras','terceras-control terceras-alteradas','Añadida práctica.'),
(45,71,'Dictados de terceras','dictado-modelo-2 intervalos-simultaneos-0','Modelos escritos y práctica simultánea.'),
(46,72,'Ritmos combinados y birritmia','independencia-0 independencia-1','Añadida coordinación de dos ritmos.'),
(47,74,'Canto y ritmo simultáneos','independencia-0 repertorio-09 repertorio-12','Aplicación coordinada y tonal.'),
(48,77,'Recapitulación de segundas y terceras','segundas-control-0 terceras-control repertorio-05','Recapitulación distribuida.'),
(49,79,'Seisillo y doble tresillo','seisillos-aplicados seisillo-agrupacion','Añadidas comparación y aplicación.'),
(50,81,'Lecciones de conjunto y navegación final','danza-conjunto-1 danza-conjunto-4 lectura-conjunta-retornos-1 lectura-conjunta-retornos-3','Danza nueva de 16 compases y estudio nuevo a dos voces con casillas, segno y D.S. al Fine; no reproducción de los arreglos de la fuente.')]
second=[
('1-4','Notación y emisión vocal','pentagrama sol figuras repertorio-intro'),('5-8','Preparación de intervalos','terceras-control intervalo-preparado-4 intervalo-preparado-8'),('9-10','Aires y compases','agogica compas-blanca-2'),('11-12','Puntillo y síncopa','puntillos sincopas-niveles'),('13-18','Corchea, intervalos, alteraciones e indicadores','corcheas alteraciones dinamica'),('19-20','Tresillos y semicorcheas','tresillos-variados-2 semicorcheas-progresivas'),('21-24','Lectura progresiva y fusas','repertorio-13 repertorio-20-2 figuras'),('25-27','Variantes rítmicas y transposición','consolidacion irregulares-0'),('28-30','Recapitulación y compás ternario','compas repertorio-03'),('31-35','Tonos, modos, compases y Sol mayor','menor orden-sostenidos repertorio-09'),('36-40','Lectura en Fa y Mi menor','fa-estudio-1 fa-estudio-2 menor-natural-lectura'),('41-42','Doble puntillo y apoyatura','triple-puntillo apoyaturas'),('43-46','Fa mayor y Re menor','repertorio-10 repertorio-12'),('47-49','Mordentes y resolución escrita','adornos-realizados'),('50-54','6/8, Re mayor y Sol menor','compuestos repertorio-13 menor'),('55-56','Si menor y grupetos','menor adornos-realizados'),('57-58','6/4 y Si bemol mayor','compuesto-practica-6-4 repertorio-14'),('59-60','Adornos y lectura expresiva','adornos-realizados fraseo'),('61-62','Sol menor y 12/8','menor compuesto-practica-12-8'),('63-65','9/8 y recapitulación avanzada','compuesto-practica-9-8 repertorio-20'),('66-67','Procedimiento del dictado','dictado-procedimiento dictado-modelo-1 dictado-modelo-6'),('68','Clave de Do en primera línea','do-primera'),('69-70','La mayor y continuidad de lectura','orden-sostenidos tonal-5-mayor')]
result=[]
for no,pn,topic,ids,action in rows:
 ids=ids.split();assert all(x in lookup for x in ids),(no,ids)
 result.append(dict(reference='Pezzuti, Parte I',entry=str(no),sourcePages=str(pn),topic=topic,action=action,targets=[dict(id=x,page=lookup[x][0],title=lookup[x][1]) for x in ids]))
for span,topic,ids in second:
 ids=ids.split();assert all(x in lookup for x in ids),(span,ids)
 result.append(dict(reference='Segundo PDF aportado',entry='',sourcePages=span,topic=topic,action='Cobertura temática contrastada; conservar o ampliar con notación original de LMM.',targets=[dict(id=x,page=lookup[x][0],title=lookup[x][1]) for x in ids]))
(R/'comparison.json').write_text(json.dumps(dict(scope='Pezzuti: 83 páginas de archivo, índice de 50 apartados. Segundo PDF: las 70 páginas aportadas. Comparación temática y de tipos de práctica, no reproducción ni equivalencia nota por nota.',entries=result),ensure_ascii=False,indent=2))
with (R/'comparison.csv').open('w',newline='',encoding='utf-8-sig') as f:
 w=csv.writer(f);w.writerow(['Referencia','Apartado','Página fuente','Tema','Acción','Páginas LMM'])
 for x in result:w.writerow([x['reference'],x['entry'],x['sourcePages'],x['topic'],x['action'],'; '.join(f"{y['page']}: {y['title']}" for y in x['targets'])])
body=''.join('<tr>'+''.join('<td>'+html.escape(str(v))+'</td>' for v in [x['reference'],x['entry'],x['sourcePages'],x['topic'],x['action'],'; '.join(str(y['page'])+': '+y['title'] for y in x['targets'])])+'</tr>' for x in result)
(R.parent/'LMM-Comparacion-Manuales.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>LMM · Comparación de cobertura</title><style>body{font:15px/1.5 Arial;margin:40px;color:#252723}h1{color:#265b4d}td,th{padding:10px;border:1px solid #ddd;vertical-align:top}table{border-collapse:collapse}th{background:#fff3e7}tr:nth-child(even){background:#fafafa}</style><h1>Comparación de cobertura pedagógica</h1><p>Pezzuti: 83 páginas de archivo y los 50 apartados del índice. Segundo manual: las 70 páginas aportadas. Se conservan las correcciones de LMM y sus exámenes. Esta tabla compara contenidos y tipos de práctica; no afirma equivalencia nota por nota,.</p><p>En Pezzuti se usa la página impresa; en el segundo archivo, la posición de página del PDF. Las referencias LMM corresponden a esta compilación.</p><table><tr><th>Fuente</th><th>N.º</th><th>Página</th><th>Tema</th><th>Acción</th><th>Ubicación LMM</th></tr>'+body+'</table></html>')
print('Coverage map:',len(result),'entries')

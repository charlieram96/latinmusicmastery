"""Build the expanded Spanish edition after author.py. Retains stable musical IDs."""
from pathlib import Path
import json,copy,math
from fractions import Fraction
R=Path(__file__).resolve().parent
D0=json.loads((R/'content.es.json').read_text());pages=[p for p in D0['pages'] if not p['id'].startswith('indice')]
def P(t):return {'type':'p','text':t}
def H(t):return {'type':'h','text':t}
def S(t):return {'type':'small','text':t}
def D(kind,h=160,**kw):return dict(type='diagram',kind=kind,height=h,**kw)
def N(p,d=4,**kw):return dict(pitch=p,dur=d,**kw)
def RS(d):return dict(rest=True,dur=d)
def SC(*rows,rh=120):return D('score',len(rows)*rh,rows=list(rows),rowHeight=rh)
def row(t,notes,d=1,**kw):return dict(title=t,events=[N(n,d) for n in notes],**kw)
def page(id,title,sec,*bs):return dict(id=id,title=title,section=sec,blocks=list(bs))
def get(id):return next(p for p in pages if p['id']==id)
def after(id,*new):
 i=next(i for i,p in enumerate(pages) if p['id']==id);pages[i+1:i+1]=new
M={i:next(p['section'] for p in pages if p.get('section','').startswith(f'Módulo {i} ·')) for i in range(1,11)}
# Clarify accidentals before the later study of key signatures.
get('alteraciones')['blocks'][0]=P('El <b>sostenido</b> eleva la nota natural un semitono; el <b>bemol</b> la baja un semitono. El <b>doble sostenido</b>, cuyo signo tiene forma de cruz, la eleva dos semitonos, es decir, un tono. El <b>doble bemol</b> la baja dos semitonos. El <b>becuadro</b> restituye la nota natural. Cada alteración se escribe antes de la cabeza de la nota.')
after('alteraciones',page('enarmonia-ejemplos','Enarmonía y alteraciones dobles',M[3],P('La <b>enarmonía</b> relaciona sonidos de igual altura escritos con nombres distintos. En el <b>temperamento igual</b>, como en el piano habitual, las parejas siguientes corresponden a la misma tecla. Sus nombres y posiciones en el pentagrama son diferentes.'),SC(row('Mi sostenido y Fa natural · misma altura',['E#4','F4'],1),row('Do bemol y Si natural · misma altura',['Cb5','B4'],1),row('Fa doble sostenido y Sol natural · misma altura',['F##4','G4'],1),row('Si doble bemol y La natural · misma altura',['Bbb4','A4'],1),rh=100),P('<b>El doble sostenido se calcula desde la nota natural.</b> Fa doble sostenido está un tono por encima de fa natural y un semitono por encima de fa sostenido. Si la armadura ya contiene fa sostenido, el signo de doble sostenido no añade dos semitonos más: fija la altura fa doble sostenido.'),P('<b>La escritura depende del contexto.</b> En Fa sostenido mayor, el VII grado se llama mi sostenido, no fa: la escala conserva un nombre distinto por grado. En Do bemol mayor, la tónica se escribe do bemol, aunque corresponda a la tecla de si natural.'),S('Ejemplos de alturas sin medida de compás. Localiza cada pareja en el teclado y explica qué cambia en su escritura.'),S('Referencias: <link href="https://ibero.enciclo.es/articulo/enarmonia">Enciclopedia Iberoamericana: enarmonía</link>; <link href="https://dictionary.onmusic.org/terms/1195-double_sharp">OnMusic: Double sharp</link>.')))
get('armaduras')['blocks'][-1]['text']+=' Mi sostenido, do bemol y las alteraciones dobles se explican en «Enarmonía y alteraciones dobles», módulo 3. La equivalencia sonora no permite cambiar libremente sus nombres dentro de una escala.'
# Foundational sequence and clearer lexical distinctions.
p=get('nomenclatura');p['blocks'][-1]['text']=p['blocks'][-1]['text'].replace('Escribe las letras correspondientes a re, sol, la y si.','Escribe las letras de la notación alfabética anglosajona que equivalen a los nombres re, sol, la y si. Ejemplo: do = C.')
p['blocks'].insert(4,P('La <b>notación alfabética</b> nombra las notas con letras. El <b>cifrado de acordes</b> utiliza esas letras junto con números y otros signos para identificar acordes: C designa Do mayor en ese contexto; Cm, Do menor. Nombrar una nota y cifrar un acorde no son la misma operación. [9]'))
order=['nomenclatura','pentagrama','sol','figuras','relaciones','partes']
start=next(i for i,p in enumerate(pages) if p['id']=='nomenclatura');items=[get(id) for id in order];pages=[p for p in pages if p['id'] not in order];pages[start:start]=items
get('pentagrama')['blocks']=[P('El <b>pentagrama</b> está formado por cinco líneas y cuatro espacios. Se cuentan de abajo hacia arriba. Una cabeza de nota se coloca sobre una línea o dentro de un espacio; su posición representa una altura cuando la clave establece la referencia.'),D('staffmap',185),P('Las líneas están señaladas con trazos naranjas; los espacios, con guías verdes discontinuas. Cada número queda a la misma altura que la línea o el espacio al que corresponde.'),H('Práctica de ubicación'),P('Dibuja dos pentagramas. En el primero señala las líneas 1, 3 y 5. En el segundo señala los espacios 1, 2 y 4. Explica qué diferencia hay entre una cabeza atravesada por una línea y otra situada entre dos líneas.'),D('blank',180,count=2,clef='')]
after('sol',page('adicionales','Líneas adicionales y registros',M[1],P('Las <b>líneas adicionales</b> permiten escribir notas fuera del pentagrama. Se cuentan desde el borde más cercano. Hacia arriba representan alturas más agudas; hacia abajo, alturas más graves. Los espacios adicionales también reciben notas.'),SC(row('Por debajo: La3, Si3, Do4, Re4, Mi4',['A3','B3','C4','D4','E4']),row('Por encima: Fa5, Sol5, La5, Si5, Do6',['F5','G5','A5','B5','C6'],space=7)),P('Do4 ocupa la primera línea adicional inferior de Sol. La5 ocupa la primera superior. No dibujes una línea adicional para una nota que solo necesita el espacio contiguo.'),H('Escritura'),P('Copia ambas series y señala con una flecha cada línea adicional. Después escribe do4-mi4-sol4 y fa5-la5-do6.'),D('blank',90,count=1)))
get('figuras')['blocks'][0]=P('Las duraciones se comparan tomando la redonda como referencia. Cada figura dura la mitad de la anterior y su silencio tiene el mismo valor. La tabla reúne las figuras desde la redonda hasta la semigarrapatea; la práctica inicial utiliza redondas, blancas y negras.')
get('figuras')['blocks'][-1]=S('El silencio de redonda cuelga de una línea; el de blanca se apoya sobre ella. Cuando el signo de redonda aparece centrado y solo en un compás, representa el silencio de todo ese compás. Los ejemplos del módulo 2 muestran cómo cambia su duración según el compás.')
get('partes')['blocks']=[P('La <b>cabeza</b> indica la posición y puede ser hueca o llena. La <b>plica</b> es el trazo vertical. El <b>corchete</b> se añade a partir de la corchea. Cada corchete adicional divide el valor por dos. El <b>puntillo</b> añade la mitad del valor original. Las <b>barras de unión</b> sustituyen los corchetes de un grupo de notas.'),D('parts-map',340),H('Identificación y escritura'),P('Dibuja una blanca, una negra y una corchea sobre sol4. Identifica cabeza, plica y corchete. Añade un puntillo a la negra. Escribe dos corcheas unidas por una barra; conserva sus valores.'),D('blank',90,count=1)]
after('compas',page('silencio-compas','Silencio de compás completo',M[2],P('El signo del silencio de redonda tiene dos usos. Como figura, equivale a una redonda. <b>Solo y centrado en el compás</b>, indica que todo ese compás queda en silencio. En este segundo uso adopta la duración del compás.'),SC(*[dict(title=f'{n}/4: {n} tiempos de negra en silencio',meter=f'{n}/4',bars=[[dict(rest=True,dur=1,measureRest=True,value=str(n))]]) for n in [2,3,4]]),P('La forma del signo es la misma en los tres ejemplos, pero su función es indicar un compás vacío de sonidos. Cuenta los pulsos durante el silencio antes de entrar en el siguiente compás.')))
# Display both directions together, in unmeasured whole-note pitch examples.
def descending(rr,title):
 x=copy.deepcopy(rr);x['title']=title;x['events'].reverse()
 if x.get('intervals'):x['intervals'].reverse()
 return x
p=get('escala');bs=[b for b in p['blocks'] if b.get('kind')=='score'];asc=bs[0]['rows'][0];asc['title']='Do mayor ascendente · I-II-III-IV-V-VI-VII-I'
bs[0]['rows'].append(descending(asc,'Do mayor descendente · I-VII-VI-V-IV-III-II-I'));bs[0]['rowHeight']=105;bs[0]['height']=210
for e in bs[1]['rows'][0]['events']:e['dur']=1
p['blocks'][0]['text']+=' Los ejemplos en redondas representan alturas sin medida de compás.'
p=get('menor');rows=[r for b in p['blocks'] if b.get('kind')=='score' for r in b['rows']]
natural=copy.deepcopy(rows[0])
for i,rr in enumerate(rows):
 source=natural if i==2 else copy.deepcopy(rr)
 rr['events']+=copy.deepcopy(list(reversed(source['events'][:-1])))
 rr['intervals']+=list(reversed(source['intervals']))
 rr['title']=['La menor natural · ascenso y descenso','La menor armónica · ascenso y descenso','La menor melódica clásica · ascenso y descenso'][i]
p['blocks'][1]=SC(*rows,rh=145)
for b in get('acordes')['blocks']:
 if b.get('kind')=='score':
  for rr in b['rows']:
   rr['events']+=copy.deepcopy(list(reversed(rr['events'][:-1])));rr['title']+=' · ascenso y descenso'
   for e in rr['events']:e['dur']=1
for k in range(15):
 ma=get(f'tonal-{k}-mayor');mi=get(f'tonal-{k}-menor');mrs=[r for b in ma['blocks'] if b.get('kind')=='score' for r in b['rows']];nrs=[r for b in mi['blocks'] if b.get('kind')=='score' for r in b['rows']]
 mrs[0]['title']='Escala mayor ascendente · T / S'
 for rr in mrs[1:3]:
  rr['events']+=copy.deepcopy(list(reversed(rr['events'][:-1])));rr['title']+=' · ascenso y descenso'
  for e in rr['events']:e['dur']=1
 ma['blocks']=[ma['blocks'][0],SC(mrs[0],descending(mrs[0],'Escala mayor descendente · T / S'),*mrs[1:],rh=103),S('Escalas y arpegios: alturas sin medida de compás. El ejercicio final sí se lee con el compás indicado.')]
 natural, harmonic, melodic, mel_down,ar=nrs
 natural['title']='Menor natural ascendente';harmonic['title']='Menor armónica ascendente'
 mi['blocks']=[mi['blocks'][0],SC(natural,descending(natural,'Menor natural descendente'),harmonic,descending(harmonic,'Menor armónica descendente'),rh=120),S('La forma natural conserva la armadura; la armónica eleva el VII grado en ambos sentidos. La forma melódica y los arpegios continúan en la página siguiente.')]
 ar_rows=[]
 for j,label in [(0,'Arpegio de tónica · i'),(4,'Arpegio de dominante · V7')]:
  rr=copy.deepcopy(ar);notes=copy.deepcopy(ar['events'][j:j+4]);rr['events']=notes+copy.deepcopy(list(reversed(notes[:-1])));rr['title']=label+' · ascenso y descenso'
  for e in rr['events']:e['dur']=1
  ar_rows.append(rr)
 name=mi['title'].split(' · ')[1]
 after(mi['id'],page(f'tonal-{k}-desc',f'{name}: forma melódica y arpegios',M[6],P('La forma melódica clásica eleva los grados VI y VII al ascender y recupera la forma natural al descender. Compara ambos recorridos y sus tonos y semitonos.'),SC(melodic,mel_down,*ar_rows,rh=122),S('Ejemplos de alturas sin medida de compás. Cada arpegio muestra el ascenso y el regreso; conserva las alteraciones propias de cada acorde.')))
# Interval models explicitly show their return to the starting pitch.
for k in range(6):
 p=get(f'intervalos-{k}')
 for b in p['blocks']:
  if b.get('kind')!='score':continue
  for rr in b['rows']:
   ev=rr['events']
   if len(ev)==2:ev.append(copy.deepcopy(ev[0]));rr['title']+=' · ascenso y descenso'
   else:
    if ev[-1]['pitch']!=ev[0]['pitch']:ev.append(copy.deepcopy(ev[0]))
    rr['title']='Preparación, intervalo ascendente y regreso'
   for e in ev:e['dur']=1
 p['blocks'][-1 if k!=5 else -2]['text']='Entona cada ejemplo en ambos sentidos. En la preparación, canta primero las notas intermedias; después realiza el intervalo directo y regresa a la nota inicial. Ejemplos de alturas sin medida de compás.'
# Each key signature is followed by a complete ascending/descending scale.
key_scales={}
for k in range(15):
 rr=next(b for b in get(f'tonal-{k}-mayor')['blocks'] if b.get('kind')=='score')['rows'][0]
 key_scales[rr.get('key',0)]=rr
for page_id in ['armaduras','orden-sostenidos','orden-bemoles']:
 p=get(page_id)
 for i,b in enumerate(p['blocks']):
  if b.get('kind')!='keys':continue
  rows=[]
  for entry in b['rows']:
   rr=copy.deepcopy(key_scales[entry['key']]);rr['title']=entry['title']+' · ascenso y descenso'
   rr['events']+=copy.deepcopy(list(reversed(rr['events'][:-1])))
   rr['intervals']+=list(reversed(rr['intervals']))
   rows.append(rr)
  p['blocks'][i]=SC(*rows,rh=112 if len(rows)==5 else 120)
# Expand each expression sign with an explicit extent, not an isolated word.
for p in pages:
 for b in p.get('blocks',[]):
  if b.get('kind')!='score':continue
  for rr in b['rows']:
   for i,e in enumerate(rr.get('events',[])):
    if e.get('mark') in ['rit.','rall.','accel.']:
     mark=e.pop('mark');rr.setdefault('spans',[]).append(dict(text=mark,**{'from':i,'to':len(rr['events'])-1}))
after('adornos',page('octavas','Desplazamiento de octava: 8va y 8va bassa',M[8],P('<b>8va</b> sobre el pentagrama pide interpretar una octava por encima de lo escrito. <b>8va bassa</b> u <b>8vb</b> debajo pide una octava por debajo. La línea discontinua delimita el tramo; su terminación devuelve a la altura escrita. [10]'),SC(row('Escrito Do4-Re4-Mi4; suena Do5-Re5-Mi5',['C4','D4','E4'],2,spans=[dict(text='8va',hook=True)]),row('Escrito Do5-Re5-Mi5; suena Do4-Re4-Mi4',['C5','D5','E5'],2,spans=[dict(text='8va bassa',hook=True,below=True)])),P('La abreviatura reduce las líneas adicionales. No cambia nombres, figuras ni ritmo: cambia la octava de interpretación. Una indicación <b>loco</b> confirma el regreso a la altura escrita.'),H('Aplicación'),P('Escribe las alturas reales de ambos ejemplos sin indicación de octava. Verifica que cada sonido se desplaza exactamente doce semitonos.')),
page('glissando','Glissando y portamento',M[8],P('Un <b>glissando</b> enlaza dos alturas mediante un deslizamiento. La línea recta u ondulada conecta los extremos; puede acompañarse de gliss. Según la voz o el instrumento, el recorrido puede ser continuo o recorrer alturas discretas. El <b>portamento</b> designa un enlace expresivo entre alturas; su uso depende del estilo. [11]'),SC(row('Deslizamiento ascendente',['C4','G4'],2,gliss=[[0,1]]),row('Deslizamiento descendente',['G4','C4'],2,gliss=[[0,1]])),P('Distingue deslizamiento de escala: en la escala se reconocen ataques y alturas separadas. En el glissando continuo se percibe una transición. No confundas portamento con <b>portato</b>, que es una articulación de notas ligeramente separadas.'),H('Aplicación'),P('Identifica las alturas de salida y llegada. Emite un deslizamiento breve dentro de un registro cómodo y después canta los mismos extremos como dos notas separadas.')),
page('apoyaturas','Apoyaturas y notas de adorno',M[8],P('La <b>apoyatura</b> antecede a una nota principal y toma parte de su duración. Puede escribirse como una nota pequeña. La realización depende del estilo y del contexto; el ejemplo desarrolla explícitamente la duración escogida. [12]'),SC(dict(title='Apoyatura escrita antes de Do: Re pequeño',events=[N('C4',2,grace=dict(pitch='D4'))]),dict(title='Realización elegida: Re negra y Do negra, total una blanca',events=[N('D4',4),N('C4',4)]),dict(title='Nota de adorno breve: corchea pequeña atravesada',events=[N('C4',2,grace=dict(pitch='D4',slash=True))])),P('El trazo sobre la nota pequeña suele indicar un adorno breve. La relación entre apoyatura breve y acciaccatura cambia según la tradición; no asignes automáticamente una duración fija a todas las notas pequeñas.'),H('Lectura'),P('Distingue la nota principal del adorno. Entona primero la realización desarrollada; después lee la forma abreviada con la misma duración total.')))
after('barras',page('casillas-tres','Casillas de primera, segunda y tercera vez',M[9],P('Las casillas indican qué final corresponde a cada pasada. Los números no son números de compás. Un mismo final puede llevar <b>1, 2.</b>; otro, <b>3.</b>. La instrucción de repetición establece cuántas pasadas realizar.'),SC(dict(title='Tres pasadas: final común para 1 y 2; final distinto para 3',meter='2/4',bars=[[N('C4',4),N('D4',4)],[N('E4',4),N('G4',4)],[N('D4',2)],[N('C4',2)]],barStyles={'2':'repeat','3':'final'},endings=[{'from':2,'to':2,'number':'1, 2'},{'from':3,'to':3,'number':'3'}])),P('Recorrido: <b>1-2-3 / 1-2-3 / 1-2-4</b>. En la tercera pasada omite el compás de la casilla 1, 2 y entra directamente en la casilla 3.'),H('Aplicación'),P('Escribe el recorrido completo antes de cantar. Después ejecuta tres pasadas y conserva el pulso al saltar. Diseña un final de segunda vez diferente para otra frase de cuatro compases.')))
# Number foundational lessons after inserting prerequisite material.
for i,p in enumerate([p for p in pages if p.get('section')==M[1]],1):p['title']=f'1.{i} · '+p['title'].split(' · ')[-1]
# Further content and assessment are supplied as authored modules.
exec((R/'practice.py').read_text())
exec((R/'supplements.py').read_text())
exec((R/'coverage_expansion.py').read_text())
exec((R/'assessments.py').read_text())
exec((R/'meter_revision.py').read_text())
# Explicit pedagogical dynamic endpoints, shared by PDF and score sources.
def clarify_hairpin(rr):
 if not rr.get('hairpin'):return
 ev=rr.get('events') or [e for bar in rr['bars'] for e in bar]
 indices=[i for i,e in enumerate(ev) if not e.get('rest')]
 first,last=indices[0],indices[-1]
 ev[first]['dynamic']='p' if rr['hairpin']=='cresc' else 'mf'
 ev[last]['dynamic']='mf' if rr['hairpin']=='cresc' else 'p'
 rr['hairpinFrom']=first;rr['hairpinTo']=last
for p in pages:
 for b in p.get('blocks',[]):
  if b.get('kind')!='score':continue
  for rr in b['rows']:clarify_hairpin(rr)
  if any(rr.get('hairpin') for rr in b['rows']):
   b['rowHeight']=max(b.get('rowHeight',120),135);b['height']=b['rowHeight']*len(b['rows'])
for study in repertoire:
 for rr in study['rows']:clarify_hairpin(rr)
(R/'repertoire.json').write_text(json.dumps(repertoire,ensure_ascii=False,indent=2))
for exam in exams.values():
 for rr in exam['rows']:clarify_hairpin(rr)
(R/'assessments.json').write_text(json.dumps(dict(moduleExams=list(exams.values()),finalExam=final,pointsPerModuleQuestion=10,pointsPerFinalQuestion=2),ensure_ascii=False,indent=2))
get('dinamica')['blocks'][-1]['text']+=' En estos ejercicios, <b>p a mf</b> fija el recorrido del crescendo y <b>mf a p</b> el del diminuendo. Al llegar a la marca final se alcanza esa intensidad y se mantiene hasta una nueva indicación. En otras partituras, alguno de los niveles puede deducirse del contexto; aquí se escriben ambos para facilitar el aprendizaje.'
# Final thanks comes after answer key and references.
pages.append(page('agradecimiento','Agradecimiento','Cierre',P('Gracias por estudiar con Latin Music Mastery. La lectura, la escritura y la escucha se desarrollan mediante una práctica constante y atenta. Cada ejercicio realizado con comprensión amplía los recursos para interpretar, crear y comunicar música.'),P('Este manual reconoce la tradición pedagógica del solfeo y la labor de quienes la han transmitido. La revisión crítica, las preguntas y la experiencia musical de cada clase contribuyen a mejorar su enseñanza.'),P('<b>Latin Music Mastery</b><br/>Dirección pedagógica: Raffy Pérez')))
# Full index, not only module headings. No predicted page numbers: calculate after insertion.
entries=[p for p in pages if not p.get('cover') and p['id'] not in ['prologo','metodo']]
chunks=[entries[i:i+24] for i in range(0,len(entries),24)]
tocs=[page(f'toc-{i}','Índice de contenidos'+(f' · {i+1}' if i else ''),'Contenido') for i in range(len(chunks))]
pages[3:3]=tocs;idx={p['id']:i+1 for i,p in enumerate(pages)}
for toc,chunk in zip(tocs,chunks):toc['blocks']=[S(f"<link href=\"#{p['id']}\" color=\"#265b4d\">{p['title']}</link>  ·  {idx[p['id']]}") for p in chunk]
D0.update(edition='0.3',pages=pages);(R/'content.es.json').write_text(json.dumps(D0,ensure_ascii=False,indent=2))
(R/'curriculum.json').write_text(json.dumps([dict(module=m,lessons=[dict(id=p['id'],title=p['title'],page=idx[p['id']]) for p in pages if p.get('section')==m]) for m in list(M.values())+['Repertorio progresivo de solfeo y entonación']],ensure_ascii=False,indent=2))
print('Expanded pages:',len(pages))

"""Original progressive practice supplements; executed by revise.py after practice.py."""
# A comparative table, with each column retaining one fixed measure capacity.
unit_columns=[]
for beats,whole in [(2,2),(3,2),(4,1)]:
 cells=[dict(dur=whole,count=1,dot=beats==3)]+[dict(dur=d,count=beats*factor) for d,factor in [(4,1),(8,2),(16,4)]]
 for cell in cells:
  assert Fraction(cell['count']*4,cell['dur'])*(Fraction(3,2) if cell.get('dot') else 1)==beats
 unit_columns.append(dict(meter=f'{beats}/4',cells=cells))
after('unidades',page('unidades-cuadro','Unidades métricas: cuadro comparativo',M[2],P('Cada columna representa un compás completo: 2/4, 3/4 o 4/4. En los tres, la unidad de tiempo es la negra. De arriba abajo se muestran la figura que ocupa todo el compás, sus tiempos, su división en corcheas y su subdivisión en semicorcheas.'),D('unit-grid',360,columns=unit_columns),P('<b>2/4:</b> una blanca ocupa el compás y equivale a dos negras.<br/><b>3/4:</b> una blanca con puntillo ocupa el compás y equivale a tres negras.<br/><b>4/4:</b> una redonda ocupa el compás y equivale a cuatro negras.'),P('Cada tiempo se divide en dos corcheas y, después, en cuatro semicorcheas. Dentro de una columna, todas las filas tienen la misma duración total. Las barras de unión agrupan las corcheas y semicorcheas por tiempos.'),S('Lee cada columna de arriba abajo. Después compara las columnas: cambia el número de tiempos del compás, pero se conserva la negra como unidad de tiempo.')))
# Semiquavers: isolate cells before sustained melodic motion.
seqs=[(['C4','D4','E4','F4','G4'],[16,16,16,16,4]),(['E4','F4','G4','E4','D4','C4'],[16,16,8,16,16,8]),(['D4','E4','F4','G4','E4','D4'],[8,16,16,8,16,16]),(['C4','E4','D4','F4','E4','G4','F4','D4'],[16]*8)]
rows=[]
for i,(ns,ds) in enumerate(seqs):
 bs=[[N(n,d) for n,d in zip(ns,ds)],[N(n,d) for n,d in zip(reversed(ns),reversed(ds))]]
 rows.append(beamify(dict(title=f'{i+1} · Célula y recorrido contrario',meter='2/4',bars=bs)))
after('corcheas',page('semicorcheas-progresivas','Semicorcheas: división y agrupación',M[4],P('Cuatro semicorcheas ocupan un tiempo de negra. Una corchea ocupa la mitad de ese tiempo; dos semicorcheas completan la otra mitad. Las barras de agrupación permiten reconocer cada pulso.'),SC(*rows,rh=112),P('Percute cada línea antes de entonarla. Compara el movimiento ascendente con el descendente y conserva la duración total. En las lecciones avanzadas, estas células formarán frases más largas.')))
# Mixed triplets, including rests. Every row shows a normal reference followed by its substitution.
trip_pages=[]
for level,(meter,normal,td,unitname) in enumerate([('4/4',1,2,'redonda'),('2/4',2,4,'blanca'),('1/4',4,8,'negra')]):
 def te(p,d,rest=False):return dict(rest=True,dur=d,tuplet=[3,2]) if rest else N(p,d,tuplet=[3,2])
 patterns=[[(td,False)]*3,[(td//2,False),(td,False)],[(td,False),(td//2,False)],[(td,False),(td,True),(td,False)]]
 rows=[]
 for i,pat in enumerate(patterns):
  ns=['E4','G4','F4'];events=[te(ns[k],d,rest) for k,(d,rest) in enumerate(pat)]
  rr=beamify(dict(title=['Tres valores iguales','Valor largo + valor corto','Valor corto + valor largo','Silencio dentro del grupo'][i],meter=meter,bars=[[N('E4',normal)],events]))
  rows.append(rr)
 trip_pages.append(page(f'tresillos-variados-{level}','Tresillos sobre la '+unitname,M[4],P('El primer compás fija la duración de referencia. El segundo ocupa exactamente el mismo tiempo mediante un tresillo. El número 3 abarca el grupo completo, aunque sus valores sean diferentes o una parte sea silencio.'),SC(*rows,rh=110),P('En la relación <b>3:2</b>, tres unidades escritas ocupan la duración de dos unidades iguales fuera del grupo. Una figura larga puede reunir dos de esas tres partes: por eso un tresillo no tiene que contener tres ataques.'),S('Compara las duraciones antes de cantar. La barra del grupo debe abarcar también el silencio. El compás de 1/4, cuando aparece, aísla un solo pulso con finalidad didáctica.')))
after('irregulares-0',*trip_pages)
# Controlled seconds in both directions and multiple spellings.
interval_rows=[]
for title,pairs in [('Segundas mayores: dos semitonos',[('D4','E4'),('F4','G4'),('Bb4','C5')]),('Segundas menores: un semitono',[('E4','F4'),('A4','Bb4'),('F#4','G4')])]:
 for j,(a,b) in enumerate(pairs):
  interval_rows.append(dict(title=f'{title} · ejemplo {j+1}',meter='4/4',bars=[[N(a,2),N(b,2)],[N(b,2),N(a,2)]]))
# Split to leave ample notation space.
anchor='enarmonia-ejemplos'
for part in range(2):
 pp=page(f'segundas-control-{part}','Entonación de segundas '+('mayores' if part==0 else 'menores'),M[3],P('Entona cada intervalo ascendente y descendente con la sílaba «la». Repite con los nombres de las notas. Comprueba la distancia sonora y la escritura: una segunda se reconoce por dos nombres consecutivos.'),SC(*interval_rows[part*3:part*3+3],rh=120),P('Sostén el primer sonido, escucha interiormente el segundo y cántalo. Usa un instrumento afinado como referencia y comprueba la llegada. Conserva el mismo intervalo al cambiar de altura inicial.'))
 after(anchor,pp);anchor=pp['id']
# Bass clef map and complete original reading studies.
fa_rows=[row('Líneas adicionales inferiores: Mi-Do-La',['E2','C2','A1'],1,clef='F'),row('Líneas adicionales superiores: Do-Mi-Sol',['C4','E4','G4'],1,clef='F')]
fa_scale=['C2','D2','E2','F2','G2','A2','B2','C3','D3','E3','F3','G3','A3','B3','C4']
fa_rows += [row('Recorrido ascendente · Do2 a Do4',fa_scale,1,clef='F'),row('Recorrido descendente · Do4 a Do2',list(reversed(fa_scale)),1,clef='F')]
after('fa',page('fa-mapa-ampliado','Clave de Fa: registro y líneas adicionales',M[10],P('Las líneas adicionales prolongan el pentagrama hacia los sonidos graves y agudos. Conservan la alternancia línea-espacio. En clave de Fa, do4 ocupa la primera línea adicional superior; do2, la segunda inferior.'),SC(*fa_rows,rh=116),S('Mapa de alturas sin compás. Lee y escribe estos nombres; el recorrido de dos octavas no exige cantarlo íntegro en una sola tesitura.')))
fa_studies=[
 ('Lectura conjunta y terceras','2/2',0,[[('C3',2),('D3',2)],[('E3',4),('G3',4),('F3',2)],[('E3',2),('D3',2)],[('C3',1)],[('G2',2),('B2',2)],[('C3',4),('E3',4),('D3',2)],[('F3',2),('D3',2)],[('C3',1)]]),
 ('Tresillos y alteraciones','2/4',0,None),
 ('Lectura con finales alternativos','2/4',-1,None)]
for k,(title,meter,key,raw) in enumerate(fa_studies):
 if raw:bars=[[N(p,d) for p,d in bar] for bar in raw]
 else:
  patterns=[['C3','D3','E3','G3'],['F3','E3','D3','C3'],['E3','F#3','G3','D3'],['E3','D3','C3','C3'],['G2','A2','B2','D3'],['E3','D3','C3','G2'],['B2','D3','F3','D3'],['C3']]
  if k==2:patterns=[['F2','G2','A2','C3'],['Bb2','A2','G2','F2'],['A2','Bb2','C3','G2'],['A2','G2','F2','F2'],['C3','D3','E3','G3'],['F3','E3','D3','C3'],['E3','G3','Bb3','G3'],['F3']]
  bars=[]
  for ns in patterns:
   bars.append([N(n,8,tuplet=[3,2]) for n in ns[:3]]+[N(ns[3],4)] if len(ns)>1 else [N(ns[0],2)])
 rows=[]
 for j in range(0,8,2):
  rr=beamify(dict(title=f'Compases {j+1}-{j+2}',clef='F',meter=meter,key=key,bars=bars[j:j+2]))
  if j==0:rr['bars'][0][0]['dynamic']='p'
  if j==2:rr['hairpin']='cresc'
  if k==2 and j==4:rr['endings']=[dict(number='1',**{'from':1,'to':1})];rr['barStyles']={'1':'repeat'}
  if k==2 and j==6:rr['endings']=[dict(number='2',**{'from':0,'to':1})]
  if j==6:rr.setdefault('barStyles',{})['1']='final'
  rows.append(rr)
 pp=page(f'fa-estudio-{k+1}',title+' en clave de Fa',M[10],P('Reconoce las notas desde fa3 y do3. Prepara el ritmo y entona cada frase con una referencia afinada. Mantén el pulso en los silencios y respeta las alteraciones escritas.'),SC(*rows,rh=120),S('Recorrido: 1-2-3-4-5-6 / 1-2-3-4-5-7-8.' if k==2 else 'Lee primero los nombres de las notas; añade después las duraciones y la expresión.'))
 after('fa-mapa-ampliado' if k==0 else f'fa-estudio-{k}',pp)
# Apply compound groups in complete measures, rather than listing symbols only.
sixrows=[]
for i,ns in enumerate([['C4','D4','E4','G4','F4','E4'],['G4','E4','F4','D4','E4','C4'],['C4','E4','G4','F4','D4','C4']]):
 ev=[N(n,16,tuplet=[6,4]) for n in ns]
 bs=[ev+[N('D4',4)],[N('E4',8,tuplet=[3,2]),N('D4',8,tuplet=[3,2]),N('C4',8,tuplet=[3,2]),N('C4',4)]]
 sixrows.append(beamify(dict(title=f'{i+1} · Seisillo en un pulso; tresillo en el siguiente compás',meter='2/4',bars=bs)))
after('irregulares-1',page('seisillos-aplicados','Tresillos y seisillos en la lectura melódica',M[4],P('Seis semicorcheas en relación <b>6:4</b> ocupan una negra. Tres corcheas en relación <b>3:2</b> también ocupan una negra. La duración total coincide; cambia el número de sonidos que se distribuye dentro del pulso.'),SC(*sixrows,rh=120),P('Marca dos pulsos por compás. Primero canta solo las notas que coinciden con cada pulso; después incorpora los sonidos interiores. No añadas tiempo al grupo ni aceleres el pulso para completarlo.')))
# Transfer third recognition to multiple pitch positions, separate from seconds.
thirds=[]
for title,a,b in [('Mayor: Do-Mi','C4','E4'),('Menor: Re-Fa','D4','F4'),('Mayor: Mi-Sol sostenido','E4','G#4'),('Menor: Sol-Si bemol','G4','Bb4')]:
 thirds.append(dict(title=title,meter='4/4',bars=[[N(a,2),N(b,2)],[N(b,2),N(a,2)]]))
after('segundas-control-1',page('terceras-control','Entonación de terceras mayores y menores',M[3],P('La tercera comprende tres nombres de nota. La <b>tercera mayor</b> abarca cuatro semitonos; la <b>tercera menor</b>, tres. Conserva la distancia al cambiar de registro o de sonido inicial.'),SC(*thirds,rh=110),P('Canta primero la nota intermedia y después omítela para realizar el salto. Repite en sentido descendente. Comprueba la diferencia entre Mi-Sol y Mi-Sol sostenido: la alteración cambia la especie, pero el intervalo sigue siendo una tercera.')))
# Real musical navigation: two staves with exact shared time alignment.
upper=[
 [('C4',4),('E4',8),('G4',8)],[('F4',8),('E4',8),('D4',4)],
 [('E4',8),('F4',8),('G4',4)],[('D4',2)],
 [('G4',8),('F4',8),('E4',4)],[('C4',2)],
 [('D4',8),('E4',8),('F4',4)],[('E4',8),('D4',8),('C4',4)],
 [('G4',8),('A4',8),('G4',4)],[('F4',4),('D4',4)],
 [('E4',8),('F4',8),('D4',4)],[('C4',2)]]
lower=[ [('C3',2)],[('G2',2)],[('C3',4),('E3',4)],[('G2',2)], [('G2',4),('B2',4)],[('C3',2)], [('F2',2)],[('C3',2)], [('E3',4),('C3',4)],[('G2',2)],[('G2',4),('B2',4)],[('C3',2)]]
up=[[N(p,d) for p,d in bar] for bar in upper];lo=[[N(p,d) for p,d in bar] for bar in lower]
up[6]=[N(n,8,tuplet=[3,2]) for n in ['D4','E4','F4']]+[N('G4',4)]
up[0][0]['dynamic']='p';lo[0][0]['dynamic']='p';up[8][0]['dynamic']='mf';up[11][0]['dynamic']='p'
up[8][0]['mark']='accent'
blocks=[]
for j in range(0,12,2):
 ur=beamify(dict(title=f'Compases {j+1}-{j+2}',clef='G',meter='2/4',bars=up[j:j+2],alignBeats=True))
 lr=beamify(dict(title='',clef='F',meter='2/4',bars=lo[j:j+2],alignBeats=True))
 if j==0:ur['nav']=[dict(bar=0,where='start',symbol='segno')]
 if j==2:ur['endings']=[dict(number='1',**{'from':1,'to':1})];ur['barStyles']={'1':'repeat'};lr['barStyles']={'1':'repeat'}
 if j==4:ur['endings']=[dict(number='2',**{'from':0,'to':1})];ur['nav']=[dict(bar=1,where='end',text='Fine')]
 if j==10:ur['nav']=[dict(bar=1,where='end',text='D.S. al Fine')];ur['barStyles']={'1':'final'};lr['barStyles']={'1':'final'}
 blocks.append(D('grand-study',230,upperRow=ur,lowerRow=lr))
for part in range(3):
 pp=page(f'lectura-conjunta-retornos-{part+1}',f'Lectura conjunta y signos de retorno · {part+1}/3',M[10],P('Una sola referencia de pulso coordina las dos voces. La barra inicial y la llave reúnen los pentagramas. Lee primero cada voz por separado y después ambas, con dos intérpretes o con una voz como referencia instrumental.' if part==0 else 'Continúa la lectura de las dos voces. Los signos de repetición y retorno afectan al sistema completo.'),*blocks[part*2:part*2+2],S('Recorrido completo: 1-2-3-4 / 1-2-3-5-6-7-8-9-10-11-12 / 1-2-3-5-6 y fin. En el retorno D.S. se omite la repetición interna y se toma la segunda casilla. Fine solo detiene la lectura en ese retorno.'))
 after('dos-voces' if part==0 else f'lectura-conjunta-retornos-{part}',pp)
# Dictation practice includes an actual answer, retained in the back matter.
dict_bars=[[N('C4',4),N('D4',8),N('E4',8)],[N('G4',4),RS(4)],[N('F4',8),N('E4',8),N('D4',4)],[N('C4',2)]]
after('taller-4-b',page('dictado-procedimiento','Dictado rítmico y melódico',M[4],P('El dictado relaciona lo que se escucha con su escritura. Una persona interpreta el modelo sin mostrar la partitura; otra lo escribe. Escucha primero la frase completa y después trabaja por unidades de dos compases.'),H('Preparación'),P('Recibe la nota inicial do4 y dos pulsos de referencia. El ejemplo está en 2/4, tiene cuatro compases y termina en do. Prepara cuatro compases vacíos en clave de sol.'),H('Escucha y escritura'),P('1. Escucha la frase sin escribir y reconoce dónde termina.<br/>2. Anota el ritmo, incluidos los silencios.<br/>3. Añade las alturas y comprueba el contorno.<br/>4. Escucha de nuevo y revisa la capacidad de cada compás.<br/>5. Entona lo escrito y compáralo con el modelo.'),D('blank',210),S('La partitura para quien dicta y la solución están en el apéndice «Modelo de dictado». No se incluye audio en esta edición.')))
after('respuestas',page('dictado-solucion','Modelo de dictado y comprobación','Apéndice · Comprobación y referencias',P('Modelo del módulo 4. Establece do4, marca dos pulsos previos y toca o canta sin nombrar las notas. Repite la frase completa y después por pares de compases.'),SC(beamify(dict(title='Compases 1-2',meter='2/4',bars=dict_bars[:2])),beamify(dict(title='Compases 3-4',meter='2/4',bars=dict_bars[2:],barStyles={'1':'final'})),rh=125),P('Cada compás suma dos negras. El segundo contiene un silencio de negra; el último, una blanca. Revisa por separado alturas, duraciones, silencios y barras divisorias.')))

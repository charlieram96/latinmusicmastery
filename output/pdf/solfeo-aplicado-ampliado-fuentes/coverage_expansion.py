"""Additional coverage found through the complete Pezzuti Part I review."""
# Introductory readings use the same quarter-note pulse as the comparison table.
for n in [2,3,4]:
 rows=[]
 for k in range(3):
  ns=['C4','D4','E4','F4','G4','A4','B4','C5']
  if k<2:
   ds=[4]*n if k==0 else [8,8]+[4]*(n-1)
   bars=[[N(ns[i],d) for i,d in enumerate(ds)],[N(ns[len(ds)-1-i],d) for i,d in enumerate(ds)]]
  else:
   bars=[[N('C4',1 if n==4 else 2,**({'dot':True} if n==3 else {}))],[N('E4',1 if n==4 else 2,**({'dot':True} if n==3 else {}))]]
  title=['Un sonido por pulso','División de un pulso en dos corcheas','Una figura ocupa todo el compás'][k]
  rows.append(beamify(dict(title=title,meter=f'{n}/4',bars=bars)))
 unit={2:'Una blanca equivale a los dos tiempos del compás.',3:'Una blanca con puntillo equivale a los tres tiempos del compás.',4:'Una redonda equivale a los cuatro tiempos del compás.'}[n]
 pp=page(f'compas-blanca-{n}',f'Lectura en {n}/4: la negra como pulso',M[2],P(f'El compás {n}/4 contiene {n} tiempos de negra. Cada corchea ocupa medio tiempo. {unit} Cuenta un pulso por cada negra y conserva esa referencia cuando cambian las figuras.'),SC(*rows,rh=115),P('Percute la unidad de tiempo con una mano y nombra las notas con sus duraciones. Compara los dos compases de cada línea: cambia el recorrido de las alturas, pero ambos conservan la misma duración.'))
 after('unidades-cuadro' if n==2 else f'compas-blanca-{n-1}',pp)
# Prepared intervals 4th to octave, still within one octave. Measured patterns.
for num in range(4,9):
 ns=['C4','D4','E4','F4','G4','A4','B4','C5'][:num]
 prepared=[N(x,4) for x in ns]
 while len(prepared)%4:prepared.append(RS(4))
 rows=[dict(title='Preparación ascendente por grados conjuntos',meter='4/4',bars=[prepared[j:j+4] for j in range(0,len(prepared),4)])]
 rev=[N(x,4) for x in reversed(ns)]
 while len(rev)%4:rev.append(RS(4))
 rows += [dict(title='Preparación descendente por grados conjuntos',meter='4/4',bars=[rev[j:j+4] for j in range(0,len(rev),4)]),dict(title='Intervalo directo en ambas direcciones',meter='4/4',bars=[[N(ns[0],2),N(ns[-1],2)],[N(ns[-1],2),N(ns[0],2)]])]
 name={4:'cuarta justa',5:'quinta justa',6:'sexta mayor',7:'séptima mayor',8:'octava justa'}[num]
 pp=page(f'intervalo-preparado-{num}','Preparación de la '+name,M[3],P('Canta primero el recorrido completo. Escucha interiormente las notas intermedias y realiza después el intervalo directo. Al descender conserva la misma distancia. Los silencios completan el compás y permiten preparar la siguiente entrada.'),SC(*rows,rh=120),P('Repite con una sílaba y después con los nombres de las notas. Compara la llegada con una referencia afinada. Para cambiar la especie del intervalo, consulta los ejemplos de alteraciones del módulo y modifica la altura, sin cambiar el número de nombres comprendidos.'))
 after('terceras-control' if num==4 else f'intervalo-preparado-{num-1}',pp)
# Compound/harmonic concepts are visible as two simultaneous parts.
irs=[]
for name,low,high in [('Tercera mayor','C4','E4'),('Sexta mayor','C4','A4'),('Novena mayor','C4','D5'),('Décima menor','C4','Eb5')]:
 ur=dict(title=name,clef='G',meter='4/4',bars=[[N(high,1)]],alignBeats=True)
 lr=dict(title='',clef='F',meter='4/4',bars=[[N(low,1)]],alignBeats=True)
 irs.append(D('grand-study',215,upperRow=ur,lowerRow=lr))
for k in range(2):
 after('intervalo-preparado-8' if k==0 else 'intervalos-simultaneos-0',page(f'intervalos-simultaneos-{k}','Intervalos '+('armónicos' if k==0 else 'compuestos'),M[3],P('Un intervalo <b>melódico</b> presenta los sonidos sucesivamente; un intervalo <b>armónico</b>, al mismo tiempo. Un intervalo <b>compuesto</b> supera la octava: una novena equivale a una octava más una segunda; una décima, a una octava más una tercera. Cada par vertical de estos ejemplos suena simultáneamente.'),*irs[k*2:k*2+2],S('Ejecuta los pares en un teclado o entre dos voces. No intentes cantar dos alturas simultáneamente. Identifica primero los nombres y después el número y la especie.')))
# Triple dot, and syncopation at different metric levels.
after('puntillos',page('triple-puntillo','Doble y triple puntillo: suma de duraciones',M[4],P('Cada nuevo puntillo añade la mitad del valor del puntillo anterior. Una negra con doble puntillo vale 1 + 1/2 + 1/4 de negra; con triple puntillo, 1 + 1/2 + 1/4 + 1/8. La prolongación total no cambia el compás.'),SC(dict(title='Doble puntillo: siete semicorcheas + una',meter='2/4',bars=[[N('E4',4,dots=2),N('F4',16)]]),dict(title='Triple puntillo: quince fusas + una',meter='2/4',bars=[[N('E4',4,dots=3),N('F4',32)]]),rh=130),P('El doble puntillo multiplica el valor inicial por 7/4; el triple, por 15/8. Son escrituras menos frecuentes que el puntillo simple. Cuenta la duración antes de entonar.')))
synrows=[dict(title='Prolongación entre compases',meter='4/4',bars=[[RS(2),N('E4',2)],[N('E4',2),N('D4',4),N('C4',4)]],ties=[[1,2]]),dict(title='Síncopa de negra entre corcheas',meter='2/4',bars=[[N('E4',8),N('F4',4),N('G4',8)],[N('F4',8),N('E4',4),N('D4',8)]]),dict(title='Síncopa de corchea entre semicorcheas',meter='2/4',bars=[[N('E4',16),N('F4',8),N('G4',16),N('E4',4)],[N('D4',16),N('E4',8),N('F4',16),N('C4',4)]]),dict(title='Contratiempo con silencios breves',meter='2/4',bars=[[RS(8),N('E4',8),RS(8),N('G4',8)],[RS(16),N('F4',16),RS(16),N('E4',16),N('C4',4)]])]
after('sincopa',page('sincopas-niveles','Síncopa y contratiempo en distintos niveles',M[4],P('Una prolongación puede atravesar una barra de compás, un pulso o una subdivisión. Localiza el ataque débil y el apoyo fuerte sobre el que continúa el sonido. En el contratiempo, escucha también la posición ocupada por el silencio.'),SC(*[beamify(r) for r in synrows],rh=112),S('Primero marca el pulso con una mano. Después percute o canta el ritmo escrito sin desplazar esa referencia. La ligadura de prolongación no añade un nuevo ataque.')))
# Chromatic neighbours in both directions; all five raised and lowered pitch classes.
alterpairs=[('Fa sostenido','F4','F#4','G4'),('Do sostenido','C4','C#4','D4'),('Sol sostenido','G4','G#4','A4'),('Re sostenido','D4','D#4','E4'),('La sostenido','A4','A#4','B4'),('Si bemol','B4','Bb4','A4'),('Mi bemol','E4','Eb4','D4'),('La bemol','A4','Ab4','G4'),('Re bemol','D4','Db4','C4'),('Sol bemol','G4','Gb4','F4')]
for part in range(3):
 rs=[]
 for title,a,b,c0 in alterpairs[part*4:part*4+4]:
  rs.append(dict(title=title+' · ida y regreso',meter='3/4',bars=[[N(a,4),N(b,4),N(c0,4)],[N(c0,4),N(b,4),N(a,4)]]))
 pp=page(f'alteraciones-entonadas-{part}','Entonación de alteraciones accidentales',M[7],P('Lee la altura escrita en cada ataque. El sostenido y el bemol modifican la nota natural; el becuadro la restituye. Sigue el ascenso y el descenso sin confundir un cambio de altura con un cambio de duración.'),SC(*rs,rh=110),P('Prepara la nota natural y compara su versión alterada. Repite el ejercicio omitiendo el sonido intermedio solo cuando puedas conservar la llegada afinada. Identifica dónde aparece un semitono cromático y dónde uno diatónico.'))
 i=max(i for i,p in enumerate(pages) if p.get('section')==M[7]);pages.insert(i+1,pp)
# Listening tasks progress alongside the notation, with answer models at the back.
DSETS=[
 ('Valores básicos','2/4',[[N('C4',4),N('D4',4)],[N('E4',2)],[N('D4',4),RS(4)],[N('C4',2)]]),
 ('Corcheas y terceras','2/4',[[N('C4',8),N('E4',8),N('D4',4)],[N('F4',4),N('E4',4)],[N('G4',8),N('E4',8),N('D4',4)],[N('C4',2)]]),
 ('Ligadura y silencio','3/4',[[N('C4',2),N('E4',4)],[N('E4',4),RS(4),N('D4',4)],[N('F4',4),N('E4',4),N('D4',4)],[N('C4',2,dot=True)]]),
 ('Semicorcheas','2/4',[[N(n,16) for n in ['C4','D4','E4','G4']]+[N('E4',4)],[N('D4',8),N('E4',16),N('F4',16),N('G4',4)],[N('F4',8),N('E4',8),N('D4',4)],[N('C4',2)]]),
 ('Tresillo y puntillo','2/4',[[N(n,8,tuplet=[3,2]) for n in ['C4','D4','E4']]+[N('G4',4)],[N('F4',4,dot=True),N('E4',8)],[N('D4',8),N('F4',8),N('E4',4)],[N('C4',2)]]),
 ('Alteraciones accidentales','2/4',[[N('D4',4),N('F#4',4)],[N('G4',8),N('F#4',8),N('E4',4)],[N('F4',4),N('D4',4)],[N('C4',2)]])]
for k,(title,meter,bars) in enumerate(DSETS):
 rs=[beamify(dict(title=f'Dictado {k+1} · compases {j+1}-{j+2}',meter=meter,bars=bars[j:j+2])) for j in [0,2]]
 if k==2:rs[0]['ties']=[[1,2]]
 pp=page(f'dictado-modelo-{k+1}',f'Dictado {k+1}: '+title,'Apéndice · Comprobación y referencias',P('Partitura de referencia para quien dicta y solución para la corrección. Da la nota inicial y un compás de pulsos previos. Interpreta sin nombrar notas; repite por frases y conserva el mismo pulso.'),SC(*rs,rh=135),P('Escribe primero el ritmo y después las alturas. Revisa silencios, alteraciones y barras. Entona tu respuesta para comprobarla. El modelo es una solución exacta de este dictado; no sustituye los ejercicios abiertos de composición.'),S('Aplicación: dictados 1-2, después del módulo 3; dictados 3-5, después del módulo 4; dictado 6, después del módulo 7.'))
 after('dictado-solucion' if k==0 else f'dictado-modelo-{k}',pp)
# Rhythmic independence and later simultaneous unequal subdivisions.
for part in range(2):
 bs=[]
 for k in range(2):
  if part==0:
   ub=[[N('G4',8),N('A4',8),N('G4',4)],[RS(8),N('F4',8),N('E4',4)]]
   lb=[[N('C3',4),N('G2',4)],[N('C3',4),N('G2',8),N('B2',8)]]
   if k:ub,lb=[[N('E4',4),RS(8),N('G4',8)],[N('F4',8),N('E4',8),N('D4',4)]],[[N('C3',8),N('G2',8),N('C3',4)],[N('G2',2)]]
  else:
   ub=[[N(n,4,tuplet=[3,2]) for n in ['E4','F4','G4']],[N(n,4,tuplet=[3,2]) for n in ['G4','E4','C4']]]
   lb=[[N('C3',4),N('G2',4)],[N('G2',4),N('C3',4)]]
   if k:ub=[[N('E4',4),N('G4',4)],[N('D4',4),N('C4',4)]];lb=[[N(n,4,tuplet=[3,2]) for n in ['C3','D3','E3']],[N(n,4,tuplet=[3,2]) for n in ['F3','G2','C3']]]
  bs.append(D('grand-study',220,upperRow=beamify(dict(title=f'Ejemplo {k+1}',clef='G',meter='2/4',bars=ub,alignBeats=True)),lowerRow=beamify(dict(title='',clef='F',meter='2/4',bars=lb,alignBeats=True))))
 pp=page(f'independencia-{part}','Coordinación de dos ritmos' if part==0 else 'Tres contra dos: subdivisiones simultáneas',M[10],P('Cada voz conserva su ritmo dentro del mismo compás. Estudia las partes por separado y después ejecútalas con dos manos, dos intérpretes o canto y acompañamiento. Los ataques alineados verticalmente coinciden.' if part==0 else 'Tres negras de tresillo ocupan el mismo tiempo que dos negras regulares. Divide mentalmente esa duración en seis partes: la voz de tres ataca en 1, 3 y 5; la de dos, en 1 y 4. Ambas regresan juntas al compás siguiente.'),*bs,S('Comienza con una sola altura por voz si es necesario. Añade las alturas escritas después de coordinar las duraciones. No aceleres una voz para alcanzar a la otra.'))
 after('dos-voces' if part==0 else 'independencia-0',pp)
# Compound-meter practice appears in the second reference beyond the definitions.
for n,d in [(3,8),(6,4),(9,8),(12,8)]:
 capacity=Fraction(n*4,d);pulse=Fraction(4,d) if n==3 else Fraction(12,d)
 group=1 if n==3 else 3
 ev=[N(['C4','D4','E4','G4','F4','E4','D4','E4','F4','E4','D4','C4'][i],d,mark='accent' if i%group==0 else None) for i in range(n)]
 bars=[ev,list(reversed(copy.deepcopy(ev)))]
 for e in bars[1]:e.pop('mark',None)
 rr=beamify(dict(title=f'{n}/{d} · ascenso y descenso',meter=f'{n}/{d}',bars=bars))
 unit='corchea' if (n,d)==(3,8) else 'blanca con puntillo' if d==4 else 'negra con puntillo'
 p=page(f'compuesto-practica-{n}-{d}',f'Lectura en {n}/{d}',M[4],P(f'En la lectura de referencia de este ejemplo, la unidad de tiempo es la <b>{unit}</b>. El compás reúne {int(capacity/pulse)} pulsos. Reconoce los comienzos de pulso antes de leer las subdivisiones.'),SC(rr,rh=150),P('Primero percute solo los comienzos de pulso. Después añade las notas interiores y conserva la duración total. En 3/8, el carácter y el tempo pueden llevar a marcar un solo pulso de negra con puntillo; aquí se muestran sus tres unidades escritas para estudiar la cifra.' if n==3 else 'Cada pulso se divide en tres partes iguales. Canta la línea completa, separa las agrupaciones y vuelve a unirlas. No confundas la cantidad de figuras escritas con la cantidad de pulsos principales.'),D('blank',180),S('Escribe dos compases nuevos con la misma capacidad e introduce al menos un silencio. Comprueba cada suma antes de entonar.'))
 after('compuestos',p)
# Supplementary historical clef, identified as such rather than replacing modern clefs.
after('do',page('do-primera','Clave de Do en primera línea',M[10],P('La clave de Do también puede situarse en la primera línea: esa línea representa do4. Se conoce como <b>clave de soprano</b> y aparece en repertorio vocal histórico. El principio es el mismo que en las claves de alto y tenor: el centro del signo fija la posición de do4.'),SC(row('Do mayor ascendente',['C4','D4','E4','F4','G4','A4','B4','C5'],1,clef='S'),row('Do mayor descendente',['C5','B4','A4','G4','F4','E4','D4','C4'],1,clef='S'),dict(title='Lectura breve: mismas alturas, otra posición escrita',clef='S',meter='4/4',bars=[[N('C4',2),N('E4',4),N('G4',4)],[N('F4',2),N('D4',4),N('C4',4)]]),rh=120),P('Transcribe el último ejemplo en clave de sol sin cambiar ninguna altura ni duración. Comprueba el resultado comparando los nombres y los números de octava.')))
# Ornament realization: a selected convention, not a universal timing rule.
after('apoyaturas',page('adornos-realizados','Adornos: signo y realización elegida',M[8],P('La duración y el comienzo de un adorno dependen del estilo. Estos ejemplos fijan una realización didáctica concreta: el adorno ocupa el primer pulso de negra y la nota final, el segundo. Compara el signo abreviado con la secuencia desarrollada.'),SC(dict(title='Mordente inferior sobre Mi',meter='2/4',bars=[[N('E4',4,mark='mordent'),N('C4',4)]]),beamify(dict(title='Realización breve: Mi-Re-Mi',meter='2/4',bars=[[N('E4',16),N('D4',16),N('E4',8),N('C4',4)]])),dict(title='Grupeto sobre Mi',meter='2/4',bars=[[N('E4',4,mark='turn'),N('C4',4)]]),beamify(dict(title='Realización elegida: Fa-Mi-Re-Mi',meter='2/4',bars=[[N(n,16) for n in ['F4','E4','D4','E4']]+[N('C4',4)]])),rh=108),S('En un repertorio concreto, confirma si el adorno comienza en la nota principal o en la auxiliar y si esta debe alterarse. La realización aquí escrita no se impone a todos los estilos.')))
# Review tonal departure through an explicit melodic example and return.
modbars=[[N(n,4) for n in ['C4','E4','G4','E4']],[N(n,4) for n in ['D4','F#4','A4','F#4']],[N('G4',2),N('B4',4),N('G4',4)],[N('D4',2),N('G4',2)],[N(n,4) for n in ['E4','F4','G4','B4']],[N('C5',2),N('G4',2)],[N(n,4) for n in ['F4','D4','B3','D4']],[N('C4',1)]]
modrows=[dict(title=f'Compases {j+1}-{j+2}',meter='4/4',bars=modbars[j:j+2]) for j in range(0,8,2)]
i=max(i for i,p in enumerate(pages) if p.get('section')==M[7]);pages.insert(i+1,page('centros-tonales','Referencias tonales y cambio de centro',M[7],P('Una alteración accidental no demuestra por sí sola una modulación. Una <b>modulación</b> establece otro centro tonal; una <b>tonicización</b> destaca de forma pasajera un acorde como punto de llegada. Escucha la dirección de la frase y su apoyo armónico.'),SC(*modrows,rh=105),P('El fa sostenido prepara la llegada a sol. La segunda mitad restituye fa natural y termina en do. Compara ambas llegadas; acompaña la primera mitad con Do-Re7-Sol y la segunda con Do-Fa-Sol7-Do. El ejemplo estudia el cambio de referencia y su retorno.'),S('Referencia conceptual: <link href="https://www.enciclopedia.cat/gran-enciclopedia-de-la-musica/modulacio">Gran Enciclopèdia de la Música · Modulació</link>.')))
# Natural minor melody and transposed parallel major/minor practice.
minor_ns=scale('E4',[0,2,3,5,7,8,10,12]);mb=compose_bars(3,minor_ns,'3/4')
rr=[beamify(dict(title=f'Compases {j+1}-{j+2}',meter='3/4',key=1,bars=mb[j:j+2])) for j in range(0,8,2)]
rr[-1]['bars'][-1]=[N('E4',2,dot=True)]
for k,r in enumerate(rr):
 if k==0:r['bars'][0][0]['dynamic']='p'
 if k==3:r['barStyles']={'1':'final'}
after('menor',page('menor-natural-lectura','Lectura en Mi menor natural',M[5],P('Mi menor natural comparte con Sol mayor la armadura de un sostenido. Re es subtónica: está un tono por debajo de mi. Conserva re natural en esta lección; no conviertas automáticamente la escala en menor armónica.'),SC(*rr,rh=110),S('Localiza cada fa sostenido y cada re natural. Entona las frases y verifica el regreso a mi. Después escribe la misma estructura de grados en La menor natural.')))
# Distinguish the chosen internal accent pattern, not merely the total duration.
a=[N(n,16,tuplet=[6,4],mark='accent' if i in [0,2,4] else None) for i,n in enumerate(['C4','D4','E4','F4','G4','E4'])]+[N('D4',4)]
b=[N(n,16,tuplet=[3,2],mark='accent' if i in [0,3] else None) for i,n in enumerate(['C4','D4','E4','F4','G4','E4'])]+[N('C4',4)]
r1=beamify(dict(title='Seisillo 6:4 · agrupación elegida 2 + 2 + 2',meter='2/4',bars=[a]))
r2=beamify(dict(title='Dos tresillos 3:2 · agrupación 3 + 3',meter='2/4',bars=[b]));r2['tupletGroups']=[dict(indices=[0,1,2],ratio=[3,2]),dict(indices=[3,4,5],ratio=[3,2])];r2['beams']=[[0,1,2],[3,4,5]]
after('seisillos-aplicados',page('seisillo-agrupacion','Seisillo y doble tresillo: agrupación interna',M[4],P('Las seis semicorcheas de cada ejemplo ocupan un tiempo de negra. La duración total coincide, pero los acentos propuestos organizan el grupo de forma distinta. El número del grupo no exige por sí solo una única acentuación: lee también las barras y los signos.'),SC(r1,r2,rh=155),P('Percute primero las seis partes iguales. En la primera línea apoya las posiciones 1, 3 y 5; en la segunda, 1 y 4. Conserva idéntica duración total. Después aplica las alturas y escucha la diferencia.'),S('Los acentos están escritos con finalidad comparativa; no conviertas todos los grupos rápidos en una sucesión de golpes fuertes.')))
after('terceras-control',page('terceras-alteradas','Terceras disminuidas y aumentadas',M[3],P('El número del intervalo depende de los nombres, no de las teclas que parecen equivalentes. Do-Mi es siempre una tercera. Sus alteraciones pueden cambiar la distancia sonora y, con ella, la especie.'),SC(dict(title='Disminuida: Do-Mi doble bemol · dos semitonos',meter='4/4',bars=[[N('C4',2),N('Ebb4',2)],[N('Ebb4',2),N('C4',2)]]),dict(title='Menor: Do-Mi bemol · tres semitonos',meter='4/4',bars=[[N('C4',2),N('Eb4',2)],[N('Eb4',2),N('C4',2)]]),dict(title='Mayor: Do-Mi · cuatro semitonos',meter='4/4',bars=[[N('C4',2),N('E4',2)],[N('E4',2),N('C4',2)]]),dict(title='Aumentada: Do-Mi sostenido · cinco semitonos',meter='4/4',bars=[[N('C4',2),N('E#4',2)],[N('E#4',2),N('C4',2)]]),rh=107),P('En temperamento igual, mi doble bemol coincide con re y mi sostenido con fa. Sin embargo, do-re es segunda y do-fa es cuarta: la equivalencia enarmónica no conserva necesariamente el nombre del intervalo.')))
# Keep interval practice after definitions and simple/compound meters in ascending order.
move_ids=[f'segundas-control-{i}' for i in range(2)]+['terceras-control','terceras-alteradas']+[f'intervalo-preparado-{i}' for i in range(4,9)]+['intervalos-simultaneos-0','intervalos-simultaneos-1']
move=[get(i) for i in move_ids];pages[:]=[p for p in pages if p['id'] not in move_ids];after('intervalos-5',*move)
move_ids=[f'compuesto-practica-{n}-{d}' for n,d in [(3,8),(6,4),(9,8),(12,8)]]
move=[get(i) for i in move_ids];pages[:]=[p for p in pages if p['id'] not in move_ids];after('compuestos',*move)
after('intervalos-simultaneos-1',page('consonancia-contexto','Consonancia, disonancia y contexto',M[3],P('La consonancia y la disonancia describen relaciones entre sonidos dentro de un contexto musical. En la armonía tonal, ciertas combinaciones funcionan como reposo y otras como tensión que puede dirigirse hacia otra sonoridad. No significan simplemente «correcto» e «incorrecto».'),P('Unísonos, octavas y quintas justas, y terceras y sextas mayores o menores, suelen tratarse como consonancias en el contrapunto tonal. Las segundas, séptimas y los intervalos aumentados o disminuidos requieren otro tratamiento. La cuarta justa depende especialmente de su relación con el bajo y del contexto.'),D('grand-study',230,upperRow=dict(title='Séptima mayor que resuelve en octava',clef='G',meter='4/4',alignBeats=True,bars=[[N('B4',2),N('C5',2)]]),lowerRow=dict(title='',clef='F',meter='4/4',alignBeats=True,bars=[[N('C4',1)]])),P('Toca o escucha simultáneamente ambas voces. Mantén do4 mientras la voz superior pasa de si4 a do5. Identifica las alturas y describe el cambio de relación.'),S('Referencia: <link href="https://www.enciclopedia.cat/gran-enciclopedia-de-la-musica/consonanciadissonancia">Gran Enciclopèdia de la Música · Consonància/dissonància</link>.')))
after('independencia-1',page('lectura-conjunto-indicaciones','Lectura de conjunto: unísono y división de voces',M[10],P('<b>Unísono:</b> varias voces ejecutan la misma altura. <b>Divisi:</b> una sección se reparte entre partes diferentes; cada intérprete sigue la parte asignada. <b>Unis.</b> indica volver al unísono. <b>Solo</b> destaca un intérprete o una parte; <b>tutti</b> indica la intervención del conjunto previsto.'),D('grand-study',240,upperRow=dict(title='Unísono inicial, división y regreso',clef='G',meter='4/4',alignBeats=True,bars=[[N('C4',2,mark='unis.'),N('E4',2,mark='div.')],[N('G4',2),N('C4',2,mark='unis.')]]),lowerRow=dict(title='',clef='F',meter='4/4',alignBeats=True,bars=[[N('C4',2),N('C4',2)],[N('E4',2),N('C4',2)]])),P('Dos grupos cantan el primer do juntos. Después se separan: uno canta mi y sol; el otro sostiene do y continúa a mi. Ambos terminan en do al mismo tiempo. La división de voces no altera la capacidad del compás.'),S('En una partitura de conjunto, identifica antes de comenzar qué pentagrama y qué voz debes seguir. Las barras alineadas y las indicaciones de retorno mantienen coordinadas las partes.')))
# A final original dance study carries rhythmic independence into a complete form.
dance_degrees=['135653','345432','123454','35','565432','345654','323212','55','135676','876543','454323','35','432123','454321','727272','11']
dscale=scale('C4',MA)
dupper=[]
for cell in dance_degrees:
 dupper.append([N(dscale[int(x)-1],8) for x in cell] if len(cell)==6 else [N(dscale[int(x)-1],4,dot=True) for x in cell])
# Offbeat attack followed by a held note; the complete measure remains six eighths.
dupper[5]=[RS(8),N('E4',8),N('G4',4),N('F4',8),N('E4',8)]
dbass=[['C3','E3','G3'],['G2','B2','D3'],['C3','E3','G3'],['G2','D3','B2'],['F2','A2','C3'],['C3','E3','G3'],['G2','B2','D3'],['G2','D3','G2'],['C3','E3','G3'],['F2','A2','C3'],['D3','F3','A3'],['G2','B2','D3'],['F2','A2','C3'],['D3','F3','A3'],['G2','B2','D3'],['C3']]
dlower=[[N(n,4) for n in bar] if len(bar)==3 else [N('C3',2,dot=True)] for bar in dbass]
systems=[]
for j in range(0,16,2):
 ur=beamify(dict(title=f'Compases {j+1}-{j+2}',clef='G',meter='6/8',bars=dupper[j:j+2],alignBeats=True))
 lr=beamify(dict(title='',clef='F',meter='6/8',bars=dlower[j:j+2],alignBeats=True))
 if j==0:ur['bars'][0][0]['dynamic']='p';lr['bars'][0][0]['dynamic']='p'
 if j==4:
  ev=sum(ur['bars'],[]);ev[0]['dynamic']='p';ev[-1]['dynamic']='mf';ur.update(hairpin='cresc',hairpinFrom=0,hairpinTo=len(ev)-1)
 if j==12:ur['spans']=[dict(text='rall.')]
 if j==14:ur['bars'][-1][-1]['mark']='fermata';lr['bars'][-1][-1]['mark']='fermata';ur['barStyles']={'1':'final'};lr['barStyles']={'1':'final'}
 systems.append(D('grand-study',230,upperRow=ur,lowerRow=lr))
for k in range(4):
 pp=page(f'danza-conjunto-{k+1}',f'Danza de cierre: acentuación cruzada · {k+1}/4',M[10],P('La melodía se organiza en dos pulsos de negra con puntillo; el bajo presenta tres negras dentro de la misma duración. Prepara cada voz y coordina después el comienzo de cada compás. Las dos partes forman una lección completa de dieciséis compases.' if k==0 else 'Mantén la relación entre ambas voces. La melodía conserva su fraseo mientras el bajo articula tres partes; las entradas alineadas verticalmente son simultáneas.'),*systems[k*2:k*2+2],S('Canta una parte mientras otra persona ejecuta la restante. Intercambia las partes y comprueba pulso, afinación, silencios, dinámica y cierre.'))
 after('lectura-conjunto-indicaciones' if k==0 else f'danza-conjunto-{k}',pp)

# Preserve the user's ascending/descending convention in the older clef maps.
for pid in ('fa','do'):
 for block in get(pid)['blocks']:
  if block.get('kind')=='score':
   for rr in block['rows']:
    if len(rr.get('events',[]))==8:
     rr['events']+=copy.deepcopy(list(reversed(rr['events'][:-1])))
     rr['title']+=' · ascenso y descenso'
     rr['intervals']=['T','T','S','T','T','T','S','S','T','T','T','S','T','T']

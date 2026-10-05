# Executed by revise.py: original drills alternate rhythmic cells and prepared intervals.
LET='CDEFGAB';PC=[0,2,4,5,7,9,11]
def midi(n):return (int(n[-1])+1)*12+PC[LET.index(n[0])]+n[1:-1].count('#')-n[1:-1].count('b')
def scale(t,steps):
 out=[];base=midi(t);di=int(t[-1])*7+LET.index(t[0])
 for i,v in enumerate(steps):
  oct,idx=divmod(di+i,7);diff=base+v-((oct+1)*12+PC[idx]);out.append(LET[idx]+('#'*diff if diff>=0 else 'b'*(-diff))+str(oct))
 return out
MA=[0,2,4,5,7,9,11,12];MI=[0,2,3,5,7,8,11,12]
def val(e):
 if e.get('value'):return Fraction(e['value'])
 v=Fraction(4,e['dur'])*(sum((Fraction(1,2**j) for j in range(e.get('dots',1)+1)),Fraction(0)) if e.get('dot') or e.get('dots') else 1)
 if e.get('tuplet'):v*=Fraction(e['tuplet'][1],e['tuplet'][0])
 return v

def beamify(r):
 groups=[];tgroups=[];idx=0
 for bar in r.get('bars',[r.get('events',[])]):
  t=Fraction(0);run=[];last=None;trun=[];ratio=None
  a,b=map(int,r.get('meter','4/4').split('/'));unit=Fraction(3,2) if b==8 and a in [6,9,12] else Fraction(4,b)
  for e in bar:
   slot=int(t/unit)
   if not e.get('rest') and e['dur']>=8 and not e.get('grace'):
    if last==slot:run.append(idx)
    else:
     if len(run)>1:groups.append(run)
     run=[idx]
    last=slot
   else:
    if len(run)>1:groups.append(run)
    run=[];last=None
   if e.get('tuplet'):
    if ratio==e['tuplet']:trun.append(idx)
    else:
     if trun:tgroups.append(dict(indices=trun,ratio=ratio))
     trun=[idx];ratio=e['tuplet']
   else:
    if trun:tgroups.append(dict(indices=trun,ratio=ratio))
    trun=[];ratio=None
   t+=val(e);idx+=1
  if len(run)>1:groups.append(run)
  if trun:tgroups.append(dict(indices=trun,ratio=ratio))
 if groups:r['beams']=groups
 if tgroups:r['tupletGroups']=tgroups
 return r

# Alternating types A and B, modeled on pedagogical procedures rather than copied melodies.
for mod in [1,2,3,4,5,7,8,9,10]:
 sec=M[mod];arr=[]
 if mod==1:
  arr=[page('taller-1','Taller · Identificación y escritura',sec,P('Reconoce las posiciones sin cambiar su altura. En la línea A identifica las partes de cada figura; en B cambia la duración conservando la posición.'),SC(dict(title='A · Figuras sobre Sol4',events=[N('G4',d) for d in [1,2,4,8,16]]),row('B · Líneas y espacios alternados',['E4','F4','G4','A4','B4','C5'],1)),P('1. Copia A y escribe el nombre de cada figura.<br/>2. Reescribe B con blancas.<br/>3. Señala las notas que ocupan espacios.<br/>4. Dibuja dos corcheas sobre mi4 y únelas con una barra.'),D('blank',90,count=1))]
 else:
  meter='4/4';key=0;tonic='C4';notes=scale(tonic,MA)
  patterns=[[2,4,4],[4,4,2],[4,4,4,4],[1]]
  if mod>=4:patterns=[[8,8,4,2],[4,8,8,2],[2,8,8,4],[1]]
  if mod>=5:key=1;notes=scale('G3',MA)
  bars=[]
  for j,ds in enumerate(patterns*2):
   degrees=([0,1,2,4],[4,3,2,1],[2,4,6,4],[0])[j%4]
   if isinstance(degrees,int):degrees=[degrees]
   bars.append([N(notes[degrees[i%len(degrees)]],d) for i,d in enumerate(ds)])
  arows=[beamify(dict(title=f'A · Células rítmicas · compases {i+1}-{i+2}',meter=meter,key=key,bars=copy.deepcopy(bars[i:i+2]))) for i in range(0,8,2)]
  if mod==8:
   arows[0]['bars'][0][0]['dynamic']='p';arows[1]['hairpin']='cresc';arows[2]['spans']=[dict(text='rit.')];arows[3]['bars'][0][0]['mark']='a tempo'
  if mod==9:arows[1]['barStyles']={'1':'repeat'};arows[1]['endings']=[dict(number='1',**{'from':1,'to':1})];arows[2]['endings']=[dict(number='2',**{'from':0,'to':0})]
  if mod==10:
   for rr in arows:
    rr['clef']='F'
    for e in sum(rr['bars'],[]):e['pitch']=e['pitch'][:-1]+str(int(e['pitch'][-1])-1)
  arr.append(page(f'taller-{mod}-a','Taller A · Lectura rítmica y melódica',sec,P('Percute las duraciones. Nombra después las notas y entona la frase. Conserva los silencios y relaciona los motivos que se repiten. Los números indican compases escritos.'),SC(*arows,rh=112),S('Escribe una variación de los compases 1-2 que mantenga la misma capacidad métrica.')))
  brows=[]
  for n in [2,3,4]:
   origin=n-2 if mod==2 else 0
   if mod==2:n=2
   seq=notes[origin:origin+n]+[notes[origin],notes[origin+n-1],notes[origin]]
   if mod==4:
    bars_b=[[N(pitch,2) for pitch in seq[i:i+2]] for i in range(0,len(seq),2)]
    if len(bars_b[-1])==1:bars_b[-1][0]['dur']=1
    brows.append(dict(title=f"B · Preparación de la { {2:'segunda',3:'tercera',4:'cuarta'}[n]} y salto directo",meter='4/4',key=key,bars=bars_b,barStyles={str(len(bars_b)-1):'final'}))
   else:
    brows.append(row(f'B · Preparación de {n} posiciones y salto directo',seq,2,key=key))
  arr.append(page(f'taller-{mod}-b','Taller B · Entonación con preparación',sec,P('Canta el recorrido por grados conjuntos y después el intervalo directo. Mantén cuatro pulsos de negra por compás: cada blanca dura dos pulsos y la redonda final, cuando aparece, dura cuatro.' if mod==4 else 'Canta primero las notas intermedias. Repite después solo la nota inicial y la de llegada. La preparación ayuda a reconocer el intervalo; la segunda ejecución comprueba su audición interior.'),SC(*brows,rh=120),P('Invierte la dirección de cada ejercicio. Escribe una respuesta de cuatro compases que utilice esos intervalos y termine en la tónica. Evalúa por separado afinación, ritmo y continuidad.')))
 i=max(i for i,p in enumerate(pages) if p.get('section')==sec);pages[i+1:i+1]=arr

# 20 complete original studies. Each has a bounded range, phrase closure, and explicit focus.
specs=[
 ('Lectura conjunta en Do',0,'C4','4/4','major','Redondas y blancas; grados conjuntos'),
 ('Blancas y dirección melódica',0,'C4','4/4','major','Blancas y negras; movimiento contrario'),
 ('Organización ternaria',0,'C4','3/4','major','Tres tiempos; cierre sobre la tónica'),
 ('Silencios y continuidad',0,'C4','2/4','major','Negra y silencio de negra'),
 ('Terceras preparadas',0,'C4','4/4','major','Terceras y ampliación hasta la sexta'),
 ('Subdivisión binaria',0,'C4','2/4','major','Corcheas y agrupación del pulso'),
 ('Puntillo y compensación rítmica',0,'C4','2/4','major','Negra con puntillo y corchea'),
 ('Síncopa y apoyo métrico',0,'C4','4/4','major','Síncopa interna; continuidad del pulso'),
 ('Entonación en Sol mayor',1,'G3','4/4','major','Armadura de un sostenido'),
 ('Entonación en Fa mayor',-1,'F4','3/4','major','Si bemol; articulación ligada'),
 ('La menor y sensible',0,'A3','4/4','minor','Sol sostenido y resolución'),
 ('Re menor y fraseo',-1,'D4','3/4','minor','Do sostenido; forma armónica'),
 ('Re mayor y dominante',2,'D4','2/4','major','Fa y Do sostenidos; semicorcheas y arpegios'),
 ('Si bemol mayor y matices',-2,'Bb3','4/4','major','Dos bemoles; reguladores'),
 ('Subdivisión ternaria en Sol',1,'G3','6/8','major','Dos pulsos compuestos'),
 ('Mi menor y contraste agógico',1,'E4','3/4','minor','Re sostenido; rit. y a tempo'),
 ('Cromatismo y becuadro',0,'C4','4/4','major','Alteraciones accidentales y cancelación'),
 ('Tresillos y quintillos',0,'C4','2/4','major','Grupos 3:2 de corcheas y 5:4 de semicorcheas'),
 ('Repeticiones y finales alternativos',-1,'F4','2/4','major','Casillas, recorrido y articulación'),
 ('Estudio de integración en Do',0,'C4','4/4','major','Fraseo, adornos, dinámica, agógica y retorno')]
exec((R/'cantabile.py').read_text())
repertoire=[]
for no,(title,key,t,meter,mode,focus) in enumerate(specs,1):
 ns=scale(t,MI if mode=='minor' else MA);a,b=map(int,meter.split('/'));capacity=Fraction(a*4,b)
 length=16
 bars=compose_bars(no,ns,meter)
 # deliberate dominant preparation and tonic conclusion, rather than arbitrary terminal notes.
 if capacity==4:bars[-1]=[N(ns[0],1)]
 elif capacity==3:bars[-1]=[N(ns[0],2,dot=True)] if meter!='6/8' else [N(ns[0],4,dot=True),N(ns[0],4,dot=True)]
 else:bars[-1]=[N(ns[0],2)]
 if mode=='minor':bars[-2][-1]=N(ns[6],bars[-2][-1]['dur'])
 if no==17:
  bars[4]=[N('F4',4),N('F#4',4),N('G4',4),N('F4',4)]
 if no==18:
  bars[4]=[N(n,8,tuplet=[3,2]) for n in ['C4','D4','E4']]+[N('G4',4)]
  bars[8]=[N(n,16,tuplet=[5,4]) for n in ['G4','F4','E4','D4','C4']]+[N('C4',4)]
 if no==20:
  bars[4]=[N('E4',2,grace={'pitch':'F4'}),N('D4',4),N('C4',4)]
  bars[8]=[N('G4',2,mark='tr'),N('F4',4),N('E4',4)]
  bars[10]=[N('F4',4),N('F#4',4),N('G4',2)]
  bars[12]=[N('G4',2,mark='mordent'),N('E4',2)]
 if no==20:
  bars[13]=[N(n,32) for n in ['G4','F4','E4','D4','C4','D4','E4','D4']]+[N('D4',4),N('C4',2)]
 if no>=1:bars[0][0]['dynamic']='p'
 for j in range(length):
  for e in bars[j]:assert val(e)>0
  assert sum(map(val,bars[j]))==capacity,(no,j)
 actual=[e['pitch'] for bar in bars for e in bar if not e.get('rest')];lo=min(actual,key=midi);hi=max(actual,key=midi)
 rr=[]
 for j in range(0,length,2):
  r=beamify(dict(title=f'Compases {j+1}-{j+2}',meter=meter,key=key,bars=copy.deepcopy(bars[j:j+2])))
  if j in [0,4,8,12]:r['slurs']=[[0,sum(map(len,r['bars']))-1]]
  if no>=10 and j==2:r['hairpin']='cresc'
  if no>=16 and j==length-4:r['spans']=[dict(text='rit.')]
  if no>=16 and j==length-2:r['bars'][0][0]['mark']='a tempo'
  if j==0:r['tempo']='Cantabile · negra = 60' if meter!='6/8' else 'Andantino · negra con puntillo = 48'
  if no==19:

   if j==4:r['barStyles']={'1':'repeat'};r['endings']=[dict(number='1',**{'from':1,'to':1})]
   if j==6:r['endings']=[dict(number='2',**{'from':0,'to':0})]
  if j==length-2:r.setdefault('barStyles',{})['1']='final'
  if no==20 and j==length-2:r['bars'][-1][0]['mark']='fermata'
  rr.append(r)
 obj=dict(number=no,title=title,key=key,meter=meter,range=[lo,hi],focus=focus,rows=rr,bars=bars)
 repertoire.append(obj)
sec='Repertorio progresivo de solfeo y entonación'
rep=[page('repertorio-intro','Repertorio progresivo de solfeo y entonación',sec,P('Veinte lecciones originales reúnen los contenidos del manual. Las primeras se limitan a un ámbito reducido y a duraciones sencillas. Después incorporan armaduras, alteraciones, subdivisiones, signos expresivos y recorridos.'),P('El ámbito escrito de cada lección se indica junto a su objetivo. <b>No existe una tesitura cómoda idéntica para todas las voces.</b> Acuerda una octava o transposición apropiada antes de cantar; conserva las relaciones interválicas y no fuerces los extremos.'),H('Preparación de cada lección'),P('1. Reconoce clave, armadura, compás y recorrido.<br/>2. Localiza la nota más grave y la más aguda.<br/>3. Percute el ritmo y resuelve las dificultades por frases.<br/>4. Escucha la tónica y entona la lección completa.<br/>5. Repite aplicando los signos de expresión.'),P('Las lecciones se cantan con nombres de notas o con una sílaba acordada. El trabajo combina preparación interválica, células rítmicas y frases completas. La ejecución no exige una rapidez ajena al contenido estudiado.'))]
for o in repertoire:
 for part in range((len(o['rows'])+3)//4):
  rs=o['rows'][part*4:part*4+4];id=f"repertorio-{o['number']:02}"+(f'-{part+1}' if part else '')
  bs=[P(f"<b>Estudio:</b> {o['focus']}. Frases de cuatro compases: presentación, respuesta, reexposición y cierre. <b>Ámbito escrito:</b> {o['range'][0]} a {o['range'][1]}. Letras según la notación alfabética; do central = C4."),SC(*rs,rh=112)]
  if part==0:bs.append(S('Preparación: identifica los motivos, nombra las notas y percute el ritmo. Ejecución: entona sin perder la continuidad de la frase.'))
  else:bs.append(S('Integra esta página con la anterior. Evalúa afinación, ritmo, continuidad, expresión y respeto del recorrido.'))
  rep.append(page(id,f"Lección {o['number']:02} · {o['title']}"+(' · continuación' if part else ''),sec,*bs))
# Place repertoire after module 10, before appendices. Assessment insertion follows.
i=max(i for i,p in enumerate(pages) if p.get('section')==M[10]);pages[i+1:i+1]=rep
(R/'repertoire.json').write_text(json.dumps(repertoire,ensure_ascii=False,indent=2))

"""Install only authored Eslava supplements; retain all existing course content."""
from pathlib import Path
import json,copy,runpy
R=Path(__file__).resolve().parents[2];REF=R/'local-artifacts/solfeo-course/references/eslava';OUT=R/'local-artifacts/solfeo-course/book-audit';TAG='eslava-authored-supplements-20261008'
source=runpy.run_path(str(R/'scripts/solfeo/build-eslava-supplements.py'));scores=source['read_scores']()
s=R/'scripts/solfeo/build-module-one-book.py';ns={'__file__':str(s)}
loader=s.read_text().split("pages=ns['DATA']['pages'];lessons=[]")[0]
loader=loader.replace("ns={'__file__'", "code=code.replace('pad=7;usable=bw-(18','pad=4;usable=bw-(10')\nns={'__file__'")
exec(compile(loader,str(s),'exec'),ns)
enpath=R/'lib/solfeo/book-en.json';en=json.loads(enpath.read_text());books={};placements=[]
def book(key):
 if key not in books:
  b=json.loads((OUT/f'local-solfeo-{key}.json').read_text())
  for mode in ['pages','practice']:b[mode]=[p for p in b[mode]if p.get('supplementId')!=TAG]
  books[key]=b
 return books[key]
def p(es,eng,kind='p'):
 en[es]=eng;return {'type':kind,'text':es,'supplementId':TAG}
def diagram(rows):
 block={'type':'diagram','kind':'score','rows':rows,'height':112*len(rows),'rowHeights':[112]*len(rows),'supplementId':TAG}
 visual=copy.deepcopy(block)
 for row in visual['rows']:
  if row.get('hideMeter'):row.pop('meter',None);row.pop('meterSymbol',None)
 block['vector']=ns['vector'](visual);return block
def rows_for(lesson):
 bars=[bar for system in lesson['systems']for bar in system['bars']];rows=[];start=0
 # Reflow only at existing bar lines; never split a tie across a playback section.
 while start<len(bars):
  stop=start;density=0
  while stop<len(bars) and stop-start<7 and (density+len(bars[stop])<=32 or stop==start):density+=len(bars[stop]);stop+=1
  while stop<len(bars)and bars[stop-1][-1].get('tieForward'):stop+=1
  part=copy.deepcopy(bars[start:stop]);flat=[e for bar in part for e in bar];ties=[[i,i+1]for i,e in enumerate(flat)if e.get('tieForward')]
  row={'bars':part,'space':7.6,'topOffset':52,'meter':'2/2' if lesson['number']<21 else '4/4','meterSymbol':'cut' if lesson['number']<21 else 'common','hideMeter':bool(start),'proportionalBars':True,'ties':ties}
  if not start and lesson['number']>=21:row['tempo']='Andantino' if lesson['number']==50 else 'Adagio' if lesson['number']==53 else 'Andante'
  # Beam only uninterrupted short-note groups within each quarter-note pulse.
  beams=[];index=0
  for bar in part:
   beat=0;group=[]
   for event in bar:
    if event['dur']>=8 and not event.get('rest'):group.append(index)
    else:
     if len(group)>1:beams.append(group)
     group=[]
    beat+=4/event['dur']*(1.5 if event.get('dot')else 1);index+=1
    if beat%1==0:
     if len(group)>1:beams.append(group)
     group=[]
   if len(group)>1:beams.append(group)
  row['beams']=beams
  if stop==len(bars):row['barStyles']={str(len(part)-1):'final'}
  rows.append(row);start=stop
 return rows
EN={11:'Thirds with preparation',12:'Thirds without preparation',13:'Fourths with preparation',14:'Fourths without preparation',15:'Fifths with preparation',16:'Fifths without preparation',17:'Sixths with preparation',18:'Sixths without preparation',19:'Octaves with preparation',20:'Octaves without preparation',21:'Progressive combinations of pitches and note values',22:'Pause or fermata',23:'Progressive combinations · Lesson 23',24:'Progressive combinations · Lesson 24',25:'The augmentation dot',26:'The quarter rest',34:'Dotted quarter notes',36:'Accidentals · Lesson 36',50:'Reduction of Lesson 34',53:'Very short syncopations · Reduction of Lesson 37'}
DEST={**{n:f'm03-c{5+(n-11)//2:02}'for n in range(11,21)},21:'m02-c08',22:'m08-c05',23:'m02-c08',24:'m02-c08',25:'m04-c02',26:'m04-c02',34:'m04-c02',36:'m03-c02',50:'m04-c02',53:'m04-c03'}
for n,lesson in scores.items():
 b=book(DEST[n]);rows=rows_for(lesson);first=len(b['pages'])+2
 for start in range(0,len(rows),3):
  title=f'LECCIÓN {n} · '+lesson['title'];eng=f'LESSON {n} · '+EN[n]
  if len(rows)>3:title+=f' · {start//3+1}/{(len(rows)+2)//3}';eng+=f' · {start//3+1}/{(len(rows)+2)//3}'
  en[title]=eng
  b['pages'].append({'title':title,'blocks':[diagram(rows[start:start+3])],'supplementId':TAG,'sourceLesson':n,'sourceReference':f'../references/eslava/usuario-{n}.png'})
 placements.append({'sourceLesson':n,'classId':'local-solfeo-'+DEST[n],'tab':'lesson','firstPage':first,'lastPage':len(b['pages'])+1})
# Authorized academic adaptation of the concluding guidance following lesson 20.
es='Antes de pasar a la lección 21, el estudiante debe afianzar la entonación de los intervalos estudiados. Practique las series de intervalos sin compás y sin acompañamiento, escuchando y comprobando la precisión de cada relación sonora. Esta práctica complementa la lectura medida y puede distribuirse en fragmentos breves entre las lecciones siguientes.'
eg='Before proceeding to Lesson 21, the student should consolidate the intonation of the intervals studied. Practise the interval sequences without metre or accompaniment, listening to and checking the accuracy of each pitch relationship. This practice complements measured reading and can be distributed in short sections among the following lessons.'
es2='El estudio autónomo debe seguir las orientaciones de la clase. Antes de abordar una nueva lección, el docente explicará sus novedades de ritmo, duración y altura; el estudiante identificará esas dificultades, practicará por secciones y comprobará sus avances antes de continuar.'
eg2='Independent study should follow the guidance given in class. Before a new lesson, the teacher should explain its new rhythmic, duration and pitch features; the student should identify these challenges, practise in sections and check progress before continuing.'
b=book('m03-c09');b['pages'][-1]['blocks'] += [p(es,eg),p(es2,eg2)]
# The supplied sheet explicitly headed EJERCICIOS belongs in Exercise.
ex=json.loads((REF/'interval-exercises.json').read_text())
def pitch(d):return 'CDEFGAB'[d%7]+str(4+d//7)
for interval,course in [(2,4),(3,5),(4,6),(5,7),(6,8),(8,9)]:
 pairs=[pair for line in ex['pairs']for pair in line if abs(pair[1]-pair[0])+1==interval]
 rows=[]
 for start in range(0,len(pairs),4):
  row={'events':[{'pitch':pitch(d),'dur':1}for pair in pairs[start:start+4]for d in pair],'space':7.6,'topOffset':52,'title':str(interval)+'ª','barStyles':{}}
  rows.append(row)
 title='EJERCICIOS · '+str(interval)+'ª';en[title]='EXERCISES · '+{2:'Seconds',3:'Thirds',4:'Fourths',5:'Fifths',6:'Sixths',8:'Octaves'}[interval]
 b=book(f'm03-c{course:02}');b['practice'].append({'title':title,'blocks':[p(title,en[title],'h'),diagram(rows)],'supplementId':TAG,'sourceReference':'usuario-interval-exercises.png'})
# Keep the original complete sequence available in the interval review lesson.
b=book('m03-c09');title='EJERCICIOS · Otros';en[title]='EXERCISES · Other sequences'
for start in range(0,4,2):
 rows=[{'events':[{'pitch':pitch(d),'dur':1}for d in line],'space':7.6,'topOffset':52,'title':''}for line in ex['others'][start:start+2]]
 b['practice'].append({'title':title,'blocks':[p(title,en[title],'h'),diagram(rows)],'supplementId':TAG})
runpy.run_path(str(R/'scripts/solfeo/eslava-prose.py'))['apply'](globals())
for key,b in books.items():
 b['vectors'].update(ns['assets']);b.setdefault('supplements',{})[TAG]={'reference':'../references/eslava/A3420041-1898.pdf','editableSource':'../references/eslava/intervals-transcription.txt','placement':'lesson','note':'Original numbered notation. Line breaks reflow at bar boundaries for readability. Concluding student guidance adapted academically at the user’s request.'}
 (OUT/f'local-solfeo-{key}.json').write_text(json.dumps(b,ensure_ascii=False,separators=(',',':'))+'\n')
enpath.write_text(json.dumps(en,ensure_ascii=False,indent=2)+'\n');(REF/'placements.json').write_text(json.dumps(placements,ensure_ascii=False,indent=2)+'\n')
placements=[]
for key,b in books.items():
 for i,page in enumerate(b['pages']):
  if page.get('supplementId')==TAG:placements.append({'classId':'local-solfeo-'+key,'tab':'lesson','page':i+2,'title':page['title']})
(REF/'placements.json').write_text(json.dumps(placements,ensure_ascii=False,indent=2)+'\n')
print('Installed',len(placements),'supplement pages')

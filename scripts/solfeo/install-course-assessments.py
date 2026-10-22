"""Build local bilingual, source-traceable questions without external transmission."""
from pathlib import Path
import json,re,html,math,wave,struct
R=Path(__file__).resolve().parents[2];O=R/'local-artifacts/solfeo-course/book-audit';S=json.loads((O/'complete-book-editable.json').read_text());EN=json.loads((R/'lib/solfeo/book-en.json').read_text());manifest=json.loads((O/'manifest.json').read_text())
def plain(t):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]*>',' ',t))).strip()
def tr(t):return EN.get(t.strip(),t)
def numbered(key):return [b for p in S['pages']for b in p['blocks']if b.get('_sourcePage')==key and re.match(r'<b>\d+\.',b.get('text',''))]
def withoutnum(t):return re.sub(r'^\d+\.\s*','',plain(t))
def question(es,en,choices,correct,why,why_en,page=None,evidence=None):return dict(question_es=es,question_en=en,choices=[{'es':a,'en':b}for a,b in choices],correct=correct,explanation_es=why,explanation_en=why_en,sourcePage=page,evidence=evidence)
def rotate(q,seed):
 n=len(q['choices']);shift=seed%n;q['choices']=q['choices'][shift:]+q['choices'][:shift];q['correct']=(q['correct']-shift)%n;return q
terms=[]
for p in S['pages']:
 for b in p['blocks']:
  es=re.findall(r'<b>(.*?)</b>',b.get('text',''));en=re.findall(r'<b>(.*?)</b>',tr(b.get('text','')))
  if len(es)==len(en):
   for a,z in zip(es,en):
    if 3<=len(plain(a))<=42 and not re.search(r'\d|[.:]',a):terms.append((plain(a),plain(z)))
terms=list(dict.fromkeys(terms))
OVERRIDES=json.loads((O/'assessment-drafts/curated-local-overrides.json').read_text())
def cloze(blocks):
 out=[]
 for b in blocks:
  text=b.get('text','');en=tr(text)
  if b['type'] not in ['p','small'] or text==en or '<link' in text:continue
  bold=re.findall(r'<b>(.*?)</b>',text);english=re.findall(r'<b>(.*?)</b>',en)
  if len(bold)!=len(english):continue
  for term,translation in zip(bold,english):
   a,z=plain(term),plain(translation)
   if not 3<=len(a)<=42 or re.search(r'\d|[.:]',a):continue
   statement=plain(text);eng=plain(en)
   if len(statement)>650:continue
   localterms=[(plain(x),plain(y))for x,y in zip(bold,english)]
   candidates=list(dict.fromkeys(localterms+terms))
   choices=[(a,z)]+[t for t in candidates if t[0].casefold()!=a.casefold() and a.casefold() not in t[0].casefold()][:3]
   stem=next((v for v in re.split(r'(?<=[.!?])\s+',statement)if a in v),statement)
   enstem=next((v for v in re.split(r'(?<=[.!?])\s+',eng)if z in v),eng)
   if len(choices)<4:continue
   q=question('Completa la afirmación del manual: «'+stem.replace(a,'____',1)+'»','Complete the manual statement: “'+enstem.replace(z,'____',1)+'”',choices,0,statement,eng,b.get('pdfPage'),statement)
   out.append(q);break
  if len(out)==2:break
 return out
notes={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11};names={'C':'Do','D':'Re','E':'Mi','F':'Fa','G':'Sol','A':'La','B':'Si'}
def midi(p):
 m=re.fullmatch(r'([A-G])([#bn]*)(-?\d+)',p);assert m,p
 return (int(m[3])+1)*12+notes[m[1]]+m[2].count('#')-m[2].count('b')
def label(p):
 m=re.fullmatch(r'([A-G])([#bn]*)(-?\d+)',p);acc={'':'','n':' natural','#':' sostenido','##':' doble sostenido','b':' bemol','bb':' doble bemol'}
 return names[m[1]]+acc[m[2]]+m[3]
def audiofile(cid,events):
 folder=R/'public/local-course-assets/course-quiz';folder.mkdir(exist_ok=True)
 path=folder/(cid+'.wav');rate=22050;dur=len(events)*.9+.1;data=[]
 for i in range(int(rate*dur)):
  t=i/rate;j=int(t/.9);local=t-j*.9;v=0
  if j<len(events) and local<.72:
   env=min(1,local/.015)*min(1,(.72-local)/.08);v=.25*env*math.sin(2*math.pi*events[j]*local)
  data.append(struct.pack('<h',int(v*32767)))
 with wave.open(str(path),'wb')as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(b''.join(data))
 return '/local-course-assets/course-quiz/'+cid+'.wav'
def musicquestions(book):
 out=[];blocks=[b for p in book['pages']+book['practice']for b in p['blocks']]
 diagram=next((b for b in blocks if b.get('vector')and book['vectors'][b['vector']].get('audio',{}).get('events')),None)
 if not diagram:return out
 v=book['vectors'][diagram['vector']];events=[e for e in v['audio']['events']if not e['pitch'].startswith('click')]
 if not events:return out
 e=events[0];p=e['pitch'];correct=label(p)
 alternatives=[x for x in ['C4','D4','E4','F4','G4','A4','B4']if midi(x)!=midi(p)][:3]
 q=question('Escucha primero Do4 como referencia. ¿Qué nota suena después?','Listen to C4 as a reference. Which note sounds next?',[(correct,p)]+[(label(x),x)for x in alternatives],0,'Suena '+correct+'. La altura procede del ejemplo del manual.','The note is '+p+'. Its pitch comes from the manual example.',diagram.get('pdfPage'),p)
 q['audio_url']=audiofile(book['id'],[261.6255653005986,e['frequency']]);out.append(q)
 rows=diagram.get('rows',[]);row=rows[0]if rows else diagram.get('upperRow',{})
 meter=row.get('meter')
 if meter:
  n,d=map(int,meter.split('/'));fraction=n*4/d;options=list(dict.fromkeys([fraction,1,2,3,4,6,8]))[:4]
  num=lambda x:str(int(x))if x==int(x)else str(x)
  out.append(question(f'En {meter}, ¿cuántas negras o su duración equivalente caben en un compás?',f'In {meter}, how many quarter notes or their equivalent duration fit in one measure?',[(num(x),num(x))for x in options],0,f'{meter} equivale a {num(fraction)} negras por compás.',f'{meter} equals {num(fraction)} quarter notes per measure.',diagram.get('pdfPage'),meter))
 else:
  raw=row.get('events')or[e for bar in row.get('bars',[])for e in bar]
  tones=[e['pitch']for e in raw if e.get('pitch')]
  if len(tones)>1:
   a,z=tones[:2];distance=abs(midi(z)-midi(a));options=list(dict.fromkeys([distance,1,2,3,4,5,7,12]))[:4]
   out.append(question(f'¿Cuántos semitonos separan {label(a)} y {label(z)} del ejemplo?',f'How many semitones separate {a} and {z} in the example?',[(str(x),str(x))for x in options],0,f'La distancia entre {label(a)} y {label(z)} es de {distance} semitonos.',f'The distance from {a} to {z} is {distance} semitones.',diagram.get('pdfPage'),a+' '+z))
 return out
fallback=[question('¿Qué debes identificar antes de entonar un ejemplo?','What should you identify before singing an example?',[('La clave, la armadura y el compás','The clef, key signature and meter'),('Solo la última nota','Only the final note'),('Solo el título','Only the title')],0,'La lectura comienza identificando las referencias de altura y duración.','Reading starts by identifying the pitch and duration references.'),question('¿Qué debes conservar mientras ejecutas un silencio?','What should you maintain while performing a rest?',[('El pulso y la duración escrita','The beat and written duration'),('Un sonido continuo','A continuous sound'),('Una pausa de duración libre','A freely timed pause')],0,'El silencio tiene una duración; el conteo continúa.','A rest has a duration; counting continues.')]
allbooks=[]
for entry in manifest:
 if entry['module']<3:continue
 f=O/(entry['id']+'.json');book=json.loads(f.read_text());blocks=[b for p in book['pages']+book['practice']for b in p['blocks']]
 if not book.get('exam'):
  qs=cloze(blocks);music=musicquestions(book)
  if music:qs=qs[:1]+music[:1]if qs else music
  qs=(qs+fallback)[:2]
  curated=OVERRIDES.get(book['id'].replace('local-solfeo-',''),[])
  if curated:qs=curated+( [q for q in qs if q.get('audio_url')][:1] if len(curated)==1 else [] )
 else:
  prompts=book.get('sourceQuestions',[]);key='soluciones-final-1'if book['module']==12 else f'soluciones-m{book["module"]:02}'
  answers=numbered(key);qs=[]
  if prompts:
   assert len(prompts)==len(answers)==10,(book['id'],len(prompts),len(answers))
   for i,(prompt,answer)in enumerate(zip(prompts,answers)):
    others=[answers[j]for j in range(len(answers))if j!=i][:3]
    choices=[(withoutnum(answer['text']),withoutnum(tr(answer['text'])))]+[(withoutnum(x['text']),withoutnum(tr(x['text'])))for x in others]
    q=question(withoutnum(prompt['text']),withoutnum(tr(prompt['text'])),choices,0,withoutnum(answer['text']),withoutnum(tr(answer['text'])),prompt['pdfPage'],answer['text']);q['manualPrompt']=prompt['text'];qs.append(q)
  else:
   # Repertoire chapter has no ten-question exam in the PDF: select ten specific checks from its lessons.
   chapter=[b for b in allbooks if b['module']==book['module']]
   qs=[dict(q)for q in chapter[0]['questions']]
   for j,b in enumerate(chapter[1::5][:8]):
    q=dict(b['questions'][j%2]);q['question_es']=b['title']+': '+q['question_es'];q['question_en']=tr(b['title'])+': '+q['question_en'];qs.append(q)
   assert len(qs)==10
  book['assessmentAdaptation']='Las consignas y soluciones del manual se presentan como selección de respuesta; la ejecución vocal no se califica automáticamente.'
 book['questions']=[rotate(dict(q),i+book['number'])for i,q in enumerate(qs)]
 f.write_text(json.dumps(book,ensure_ascii=False,separators=(',',':'))+'\n');allbooks.append(book)
# New UI copy only; original manual translations remain untouched.
EN['Practica los ejemplos de esta lección: escucha, identifica sus elementos y repítelos respetando las indicaciones del manual.']='Practice the examples in this lesson: listen, identify their elements and repeat them following the manual instructions.'
EN['Integración y evaluación: preparación']='Integration and assessment: preparation'
for m in range(3,13):EN[f'Examen final · Módulo {m}']=f'Final exam · Module {m}'
(R/'lib/solfeo/book-en.json').write_text(json.dumps(EN,ensure_ascii=False,indent=2)+'\n')
print('Installed',len(allbooks),'classes;',sum(len(b['questions'])for b in allbooks),'questions;',sum(q.get('audio_url')is not None for b in allbooks for q in b['questions']),'audio questions')

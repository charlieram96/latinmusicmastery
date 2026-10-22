"""Build reviewable explanation-only storyboards; keep practice in its own track."""
from pathlib import Path
import json,re,html,hashlib
ROOT=Path(__file__).resolve().parents[2];PROD=ROOT/'local-artifacts/solfeo-course/production'
catalog=json.loads((PROD/'curriculum.json').read_text());assets=json.loads((PROD/'diagram-assets.json').read_text())['assets']

def clean(text):return html.unescape(re.sub('<[^>]+>','',text)).strip()
def diagram_key(b):return hashlib.sha256(json.dumps({k:v for k,v in b.items() if k not in ('sourcePageId','_sourcePage')},sort_keys=True).encode()).hexdigest()[:20]
def chunks(text,max_chars=430):
 words=text.split();chunk=[]
 for word in words:
  if len(' '.join(chunk+[word]))>max_chars and chunk:yield ' '.join(chunk);chunk=[]
  chunk.append(word)
 if chunk:yield ' '.join(chunk)

all_lessons=[]
for lesson in catalog['lessons']:
 m,n=lesson['module'],lesson['number'];title=lesson['title']['es'].split(' · ',1)[-1]
 scenes=[{'kind':'intro','title':title,'label':f'SOLFEO APLICADO · CLASE {m}.{n}','instructor':'Raffy Pérez','duration':6}]
 practice=[];practice_section=False;topic=None
 for b in lesson['blocks']:
  if b.get('_sourcePage')!=topic:practice_section=False;topic=b.get('_sourcePage')
  text=clean(b.get('text',''))
  if b['type']=='h' and re.search(r'ejercicios|práctica|actividad|comprueba|autoevaluación',text,re.I):practice_section=True
  if practice_section:practice.append(b);continue
  if b['type'] in ('p','small','h','callout'):
   if text.startswith(('Fuente','Referencia')):continue
   if b['type']=='h':continue
   for chunk in chunks(text):scenes.append({'kind':'explanation','title':title,'text':chunk,'duration':max(8,round(len(chunk.split())/2.2)),'sourceTopic':topic})
  elif b['type']=='diagram':
   if m==12 and 2<=n<=7:
    practice.append(b);continue
   panels=[b]
   if b['kind']=='score':
    panels=[]
    for i,row in enumerate(b['rows']):
     height=b.get('rowHeights',[b.get('rowHeight',120)]*len(b['rows']))[i]
     panels.append({**b,'rows':[row],'height':height,'rowHeights':[height]})
   for panel in panels:
    key=diagram_key(panel)
    assert key in assets,(lesson['id'],key)
    scenes.append({'kind':'notation','title':panel.get('rows',[{}])[0].get('title',title),'image':assets[key]['url'],'positions':assets[key].get('positions',[]),'diagram':panel,'sourceTopic':topic,'duration':12})
  elif b['type']=='table':
   scenes.append({'kind':'table','title':title,'rows':b['rows'],'duration':max(12,len(b['rows'])*3),'sourceTopic':topic})
 # Do not silently turn source reuse into duplicated finished lessons.
 review=[]
 if (m,n) in [(4,2),(5,5),(5,6),(5,7),(5,8),(7,5),(7,6),(8,1),(8,2),(8,5),(8,6),(9,3),(9,4),(9,5),(12,8)]:review.append('Split/rewrite shared source for this specific class objective')
 if m==11:review.append('Use full assembled repertoire score; preserve written navigation and expressive marks')
 if m==12 and 2<=n<=7:review.append('Keep dictation solution hidden until submitted; author explanation separately')
 photo=None
 if (m,n) in [(2,1),(8,5),(8,6)]:photo={'kind':'photo','title':'Una referencia para el pulso','image':'/local-course-assets/solfeo/photos/Metronome-Wittner-Taktell.jpg','text':'Cada oscilación marca un pulso regular. Comprueba la figura metronómica antes de tocar.','credit':'Benoît Prieur · CC0','duration':10}
 if (m,n) in [(3,5),(5,1),(10,3)]:photo={'kind':'photo','title':'La altura en el teclado','image':'/local-course-assets/solfeo/photos/PianoKeyboard2.jpg','text':'Los grupos de dos y tres teclas negras ayudan a localizar las notas. Entre teclas consecutivas hay un semitono.','credit':'Raysonho · CC0','duration':10}
 if (m,n) in [(3,15),(8,3),(11,20)]:photo={'kind':'photo','title':'De la lectura al sonido','image':'/local-course-assets/solfeo/photos/Violin-held-in-hands.jpg','text':'La lectura musical se aplica a la voz y a distintos instrumentos. Escucha la altura de referencia y conserva el pulso al interpretar la frase.','credit':'Tomwsulcer · CC0','duration':12}
 if photo:scenes.insert(2,photo)
 scenes.append({'kind':'completion','title':['¡Bien hecho!','¡Sigues progresando!','¡Un paso más en tu música!','¡Buen trabajo!'][(m+n)%4],'text':'Terminaste la explicación. Continúa a los ejercicios para aplicar lo aprendido.','duration':6})
 all_lessons.append({'id':lesson['id'],'title':lesson['title'],'module':m,'number':n,'scenes':scenes,'practiceSource':practice,'scores':[{'id':s['id'],'musicxml':s['musicxml']} for s in lesson['scores']],'reviewRequired':review,'status':'storyboard-draft'})
(PROD/'storyboards.json').write_text(json.dumps({'version':1,'lessons':all_lessons},ensure_ascii=False,indent=2)+'\n')
print(len(all_lessons),'storyboards;',sum(len(l['scenes']) for l in all_lessons),'scenes;',sum(bool(l['reviewRequired']) for l in all_lessons),'require targeted editorial review')

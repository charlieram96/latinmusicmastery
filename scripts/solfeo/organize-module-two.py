"""Rebuild only chapter two from the manual's authored source blocks."""
from pathlib import Path
import json,copy,re,hashlib,html,unicodedata
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'local-artifacts/solfeo-course';OUT=BASE/'book-audit'
source=json.loads((OUT/'complete-book-editable.json').read_text());draft=json.loads((BASE/'structure.json').read_text());original=copy.deepcopy(draft)
topics={};titles={};vectors={}
for n in range(1,13):
 b=json.loads((OUT/f'local-solfeo-m02-c{n:02}.json').read_text());vectors.update(b['vectors'])
for p in source['pages']:
 if not 25<=p['pdfPage']<=55:continue
 titles.setdefault(p['id'],p['title'].replace(' · continuación',''))
 for b in p['blocks']:
  if b['type']=='topic':titles[b['anchor']]=b['text'];continue
  key=b.get('_sourcePage',p['id']);topics.setdefault(key,[]).append(copy.deepcopy(b))
assert 'examen-m02' in topics
# A compact topic page keeps paragraphs together with their editable diagram.
def page(key,blocks):return {'title':titles[key],'blocks':blocks}
def split(key):
 theory=[];practice=[];active=False
 for b in topics[key]:
  if b['type']=='h' and b.get('text') in ['Ejercicios','Práctica','Cómo estudiar']:active=True
  (practice if active else theory).append(b)
 if practice:practice=[b for b in theory if b['type']=='diagram']+practice
 return theory,practice
mapping={1:['pulso'],2:['compas','silencio-compas','figuras-silencios-equivalencias','figuras-silencios-conteo'],3:['unidades','unidades-cuadro','compasillo-partido'],4:['redondas'],5:['combinaciones','reduccion-proporcional'],6:['marcar-2'],7:['marcar-3'],8:['marcar-4'],9:[]}
practiceMap={3:[],4:['lectura-inicial-1','lectura-inicial-2'],5:['lectura-inicial-3','lectura-inicial-4','lectura-inicial-5','lectura-inicial-6',*[f'formulas-I-{i}' for i in range(3)],*[f'formulas-II-{i}' for i in range(3)]],6:['compas-blanca-2'],7:['compas-blanca-3',*[f'formulas-III-{i}' for i in range(3)],'formula-melodica-3'],8:['compas-blanca-4','formula-melodica-4'],9:['completar','taller-2-a','taller-2-b']}
books=[]
for n in range(1,10):
 title=original['sections'][1]['classes'][n-1]['title_es'];pages=[];practice=[]
 for key in mapping[n]:
  t,e=split(key)
  if t:pages.append(page(key,t))
  if e:practice.append(page(key,e))
 for key in practiceMap.get(n,[]):practice.append(page(key,topics[key]))
 if n==3:practice=[page('unidades-cuadro',topics['unidades-cuadro'])]
 if n==9:
  pages=[{'title':title,'blocks':[b for b in topics['completar'] if b['type']=='diagram' and b['kind']=='score']}]
 # The conducting examples are both demonstrations and the matching lesson practice.
 if n in [6,7,8]:practice.insert(0,page(mapping[n][0],topics[mapping[n][0]]))
 assert practice,(n,'missing practice')
 ids={b['vector'] for p in pages+practice for b in p['blocks'] if b.get('vector')}
 for p in pages+practice:
  for b in p['blocks']:
   if b.get('kind')=='conduct':b['animation']='module-two-conduct'
   if b.get('kind')=='blank':b['animation']='module-two-completion'
 book={'id':f'local-solfeo-m02-c{n:02}','module':2,'number':n,'title':title,'pages':pages,'practice':practice,'vectors':{k:vectors[k] for k in ids},'nextHref':f'/solfeo-preview?class=local-solfeo-m02-c{n+1:02}'}
 books.append(book)
# Exam uses the original four-bar case, not a lesson/exercise placeholder.
ids={b['vector'] for b in topics['examen-m02'] if b.get('vector')}
exam={'id':'local-solfeo-m02-c10','module':2,'number':10,'title':'Examen final · Módulo 2','exam':True,'pages':[page('examen-m02',[b for b in topics['examen-m02'] if b['type']=='diagram'])],'practice':[],'vectors':{k:vectors[k] for k in ids},'nextHref':'/solfeo-preview?class=local-solfeo-m03-c01','sourceQuestions':[b for b in topics['examen-m02'] if b['type']=='small']}
books.append(exam)
# All source paragraphs and diagrams have an assigned home; exam prompts are retained.
covered={(b.get('pdfPage'),b.get('sourceBlock')) for book in books for p in book['pages']+book['practice'] for b in p['blocks']}
covered|={(b['pdfPage'],b['sourceBlock'])for b in topics['examen-m02']}
missing=[(k,b['pdfPage'],b['sourceBlock'])for k,bs in topics.items() for b in bs if (b['pdfPage'],b['sourceBlock'])not in covered]
assert not missing,missing
for book in books:(OUT/(book['id']+'.json')).write_text(json.dumps(book,ensure_ascii=False,separators=(',',':'))+'\n')
section=draft['sections'][1];classes=[]
for n,book in enumerate(books,1):
 c=copy.deepcopy(original['sections'][1]['classes'][min(n,9)-1]);c.update(id=book['id'],order_index=n-1,title_es=book['title']);c['items']=[]
 if n==10:c['title']='Final exam · Module 2'
 for order,(kind,suffix) in enumerate(([('QUIZ','quiz')] if n==10 else [('VIDEO','video'),('EXERCISE','exercise'),('QUIZ','quiz')])):
  item=copy.deepcopy(original['sections'][0]['classes'][0]['items'][0]);item.update(id=book['id']+'-'+suffix,class_id=book['id'],item_type=kind,order_index=order,title=c['title'],title_es=c['title_es'],description=None,description_es=None,video_url=None,video_duration_seconds=None)
  c['items'].append(item)
 classes.append(c)
section['classes']=classes
assert all(draft['sections'][i]==original['sections'][i]for i in range(len(draft['sections']))if i!=1)
(BASE/'structure.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n')
report={'sourcePages':[25,55],'lessons':9,'questionsPerLesson':2,'examQuestions':10,'sourceBlocks':sum(len(b)for b in topics.values()),'missingBlocks':missing,'otherModulesUnchanged':True,'moduleOneSha256':hashlib.sha256(json.dumps(original['sections'][0],sort_keys=True).encode()).hexdigest(),'mapping':{b['id']:{'lessonPages':len(b['pages']),'practicePages':len(b['practice'])}for b in books}}
(OUT/'module-two-organization.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

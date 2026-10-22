"""Organize chapters 3–12 from the verified manual; retain chapters 1–2."""
from pathlib import Path
import json,re,copy,hashlib
R=Path(__file__).resolve().parents[2];B=R/'local-artifacts/solfeo-course';O=B/'book-audit'
if (O/'remaining-modules-organization.json').exists():raise SystemExit('Already organized: edit the installed source mappings rather than reusing obsolete class IDs.')
source=json.loads((O/'complete-book-editable.json').read_text());draft=json.loads((B/'structure.json').read_text());before=copy.deepcopy(draft)
topics={};titles={}
for p in source['pages']:
 if not p['id'].startswith('flow-'):titles[p['id']]=p.get('title',p['id'])
 for b in p['blocks']:
  if b['type']=='topic':titles[b['anchor']]=b['text'];continue
  topics.setdefault(b.get('_sourcePage',p['id']),[]).append(b)
vectors=copy.deepcopy(source['vectors'])
for f in O.glob('local-solfeo-m*-c*.json'):vectors.update(json.loads(f.read_text()).get('vectors',{}))
heads={'Ejercicios','Práctica de ubicación','Escritura','Identificación y escritura','Práctica','Ejercicios de integración','Escucha y escritura','Cómo estudiar'}
def pages(key,blocks):
 # Keep each explanation and its diagram together. Additional diagrams get their own full-size page.
 result=[];pending=[]
 for b in blocks:
  if b['type']=='diagram' and any(x['type']=='diagram'for x in pending):result.append({'title':titles.get(key,key),'blocks':pending});pending=[]
  pending.append(copy.deepcopy(b))
 if pending:result.append({'title':titles.get(key,key),'blocks':pending})
 return result
def split(key):
 theory=[];practice=[];mode=False
 for b in topics[key]:
  if b['type']=='h' and b.get('text') in heads:mode=True
  (practice if mode else theory).append(b)
 if practice:practice=[b for b in theory if b['type']=='diagram']+practice
 return pages(key,theory),pages(key,practice)
allbooks=[];appendices=[]
for m in range(3,13):
 originals=[json.loads((O/(c['id']+'.json')).read_text())for c in before['sections'][m-1]['classes']]
 groups=[];examkeys=[]
 if m==12:
  # Dictation lessons first, then the complete fifty-question manual practice.
  keys=[k for b in originals for k in b.get('sourceTopics',[])]
  groups=[{'title':titles[k],'keys':[k],'practiceKeys':[]}for k in keys if k.startswith('dictado-')]
  finalkeys=[k for k in keys if k.startswith('examen-final')]
  groups.append({'title':'Integración y evaluación: preparación','keys':[],'practiceKeys':finalkeys})
  for k in keys:
   if not k.startswith(('dictado-','examen-final')):appendices+=pages(k,topics[k])
  examkeys=['examen-final-1']
 else:
  for b in originals:
   keys=b.get('sourceTopics',[])
   if any(k.startswith('examen-m')for k in keys):examkeys+=keys;continue
   if keys and keys[0].startswith('taller-'):
    groups[-1]['practiceKeys'] += [k for k in keys if k.startswith('taller-')]
    groups[-1]['keys'] += [k for k in keys if not k.startswith('taller-')]
   else:groups.append({'title':b['title'],'keys':keys,'practiceKeys':[]})
 if m==3:
  relocations={3:['intervalos-simultaneos-0','intervalos-simultaneos-1','melodico-armonico-un-pentagrama','consonancia-contexto'],4:['segundas-control-0','segundas-control-1'],5:['terceras-control','terceras-grados','terceras-alteradas'],6:['intervalo-preparado-4'],7:['intervalo-preparado-5'],8:['intervalo-preparado-6'],9:['intervalo-preparado-7','intervalo-preparado-8']}
  moved={k for ks in relocations.values()for k in ks}
  for g in groups:g['keys']=[k for k in g['keys']if k not in moved]
  for n,ks in relocations.items():groups[n-1]['keys']+=ks
 books=[]
 for n,g in enumerate(groups,1):
  lesson=[];practice=[]
  for k in g['keys']:
   t,e=split(k);lesson+=t;practice+=e
  for k in g['practiceKeys']:practice+=pages(k,topics[k])
  if not lesson:
   # Instructional source material remains visible; questions themselves belong to practice.
   lesson=[{'title':g['title'],'blocks':[copy.deepcopy(b)for k in g['practiceKeys']for b in topics[k]if b['type']=='p' and not re.match(r'<b>\d+',b.get('text',''))]}]
  if not practice:
   # The manual's existing demonstration is the practice reference, with an explicit application instruction.
   practice=copy.deepcopy(lesson)
   practice[0]['blocks'].insert(0,{'type':'p','text':'Practica los ejemplos de esta lección: escucha, identifica sus elementos y repítelos respetando las indicaciones del manual.','authoredPractice':True})
  cid=f'local-solfeo-m{m:02}-c{n:02}'
  books.append({'id':cid,'module':m,'number':n,'title':g['title'],'sourceTopics':g['keys']+g['practiceKeys'],'pages':lesson,'practice':practice})
 cid=f'local-solfeo-m{m:02}-c{len(books)+1:02}'
 examblocks=[copy.deepcopy(b)for k in examkeys for b in topics[k]]
 questions=[b for b in examblocks if re.match(r'<b>\d+\.',b.get('text',''))]
 exam={'id':cid,'module':m,'number':len(books)+1,'title':f'Examen final · Módulo {m}','exam':True,'sourceTopics':examkeys,'pages':[{'title':f'Examen final · Módulo {m}','blocks':[b for b in examblocks if b not in questions and b['type'] not in ['h']]}] if examblocks else [],'practice':[],'sourceQuestions':questions}
 if m==12:exam['appendices']=appendices
 books.append(exam)
 for b in books:
  allpages=b['pages']+b['practice']+b.get('appendices',[])
  ids={x['vector']for p in allpages for x in p['blocks']if x.get('vector')}
  b['vectors']={k:vectors[k]for k in ids}
  b['sourcePages']=sorted({x['pdfPage']for p in allpages for x in p['blocks']if x.get('pdfPage')})
  b['nextHref']='/solfeo-preview?class='+ (f'local-solfeo-m{m:02}-c{b["number"]+1:02}' if b is not books[-1] else f'local-solfeo-m{m+1:02}-c01' if m<12 else 'local-solfeo-m01-c01')
  # Retain a prior reviewed question bank on idempotent rebuilds only when the source is unchanged.
  b['sourceHash']=hashlib.sha256(json.dumps([b['sourceTopics'],b['pages'],b['practice']],sort_keys=True).encode()).hexdigest()
  out=O/(b['id']+'.json')
  if out.exists():
   previous=json.loads(out.read_text())
   if previous.get('sourceHash')==b['sourceHash'] and previous.get('questions'):b['questions']=previous['questions']
  out.write_text(json.dumps(b,ensure_ascii=False,separators=(',',':'))+'\n')
 section=draft['sections'][m-1];template=before['sections'][m-1]['classes'][0];itemtemplate=template['items'][0];section['classes']=[]
 for b in books:
  c=copy.deepcopy(template);c.update(id=b['id'],order_index=b['number']-1,title_es=b['title'],title=b['title'],items=[])
  for i,(kind,suffix) in enumerate([('QUIZ','quiz')]if b.get('exam')else[('VIDEO','video'),('EXERCISE','exercise'),('QUIZ','quiz')]):
   item=copy.deepcopy(itemtemplate);item.update(id=b['id']+'-'+suffix,class_id=b['id'],item_type=kind,order_index=i,title=b['title'],title_es=b['title'],video_url=None,audio_url=None,rich_content=None,description=None,description_es=None,video_duration_seconds=None,subtitles=[]);c['items'].append(item)
  section['classes'].append(c)
 allbooks+=books
assert draft['sections'][:2]==before['sections'][:2]
(B/'structure.json').write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n')
manifest=[json.loads((O/(c['id']+'.json')).read_text())for sec in draft['sections'][1:]for c in sec['classes']]
(O/'manifest.json').write_text(json.dumps([{k:b[k]for k in ['id','module','number','title','nextHref']}for b in manifest],ensure_ascii=False,indent=2)+'\n')
covered={(x.get('pdfPage'),x.get('sourceBlock'))for b in allbooks for p in b['pages']+b['practice']+b.get('appendices',[])for x in p['blocks']}
covered|={(x.get('pdfPage'),x.get('sourceBlock'))for b in allbooks for x in b.get('sourceQuestions',[])}
missing=[(p['pdfPage'],i,b.get('_sourcePage'),b.get('text','')[:80])for p in source['pages']if p['pdfPage']>=56 for i,b in enumerate(p['blocks'])if b['type']!='topic'and (b['pdfPage'],b['sourceBlock'])not in covered]
report={'modules':{m:sum(b['module']==m and not b.get('exam')for b in allbooks)for m in range(3,13)},'missingBlocks':missing,'firstTwoModulesUnchanged':True}
(O/'remaining-modules-organization.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))

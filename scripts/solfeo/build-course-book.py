"""Recover the whole book in PDF order, without editorial replacements or TOC.
The approved module-one reader is retained. Later classes follow source headings.
"""
from pathlib import Path
import json,re,copy
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'local-artifacts/solfeo-course/book-audit'
book=json.loads((OUT/'complete-book-editable.json').read_text())
structure=json.loads((ROOT/'local-artifacts/solfeo-course/structure.json').read_text())
topics={};titles={};order=[]
for p in book['pages']:
 if p.get('section','').startswith('Módulo '):module=int(re.match(r'Módulo (\d+)',p['section'])[1])
 elif p.get('section')=='Repertorio progresivo de solfeo y entonación':module=11
 elif p['pdfPage']>240:module=12
 else:continue
 if module==1:continue
 if p.get('title') and not p['id'].startswith('flow-'):titles[p['id']]=p['title']
 for b in p['blocks']:
  if b['type']=='topic':titles[b['anchor']]=b['text'];continue
  key=b.get('_sourcePage',p['id'])
  if key not in topics:topics[key]={'key':key,'module':module,'blocks':[]};order.append(key)
  topics[key]['blocks'].append(b)
# A numbered heading starts a lesson. Unnumbered expansions stay with it;
# workshops, exams, repertoire pieces and back matter retain distinct headings.
groups=[]
for key in order:
 t=topics[key];title=titles.get(key,key)
 numbered=re.match(r'^(\d+)\.(\d+)\s*·',title)
 continuation='continuación' in title.casefold()
 start=not groups or groups[-1]['module']!=t['module'] or bool(numbered and not continuation) or key.startswith(('taller-','examen-','soluciones-')) or t['module']==12
 if t['module']==11:start=not re.search(r'repertorio-\d+-\d+$',key)
 if start:groups.append({'module':t['module'],'title':title,'topics':[]})
 groups[-1]['topics'].append(t)
exercise_heads={'Ejercicios','Práctica de ubicación','Escritura','Identificación y escritura','Práctica','Ejercicios de integración','Escucha y escritura'}
def paginate(blocks,title):
 pages=[];pending=[]
 def estimated(items):
  diagrams=[b for b in items if b['type']=='diagram']
  text=sum((32 if b['type']=='h' else 26+len(re.sub('<[^>]+>','',b.get('text','')))*(.40 if diagrams else .16)) for b in items if b['type']!='diagram')
  graphic=sum(min(380,b.get('height',160)*1.6)+45 for b in diagrams)
  return max(text,graphic) if len(diagrams)==1 else text+graphic
 def flush():
  nonlocal pending
  if pending:pages.append({'title':title,'blocks':pending});pending=[]
 for b in blocks:
  if pending and (estimated([*pending,b])>490 or b['type']=='diagram' and any(x['type']=='diagram' for x in pending)):
   tail=pending.pop() if pending[-1]['type']=='h' else None
   flush()
   if tail:pending=[tail]
  pending.append(b)
 flush();return pages
classes=[];counts={}
for group in groups:
 m=group['module'];counts[m]=counts.get(m,0)+1;n=counts[m]
 cid=f'local-solfeo-m{m:02}-c{n:02}'
 body=[];practice=[]
 for topic in group['topics']:
  title=titles.get(topic['key'],topic['key']);is_practice=topic['key'].startswith(('taller-','examen-')) or topic['key']=='completar'
  target=practice if is_practice else body
  target.append({'type':'h','text':title,'pdfPage':topic['blocks'][0]['pdfPage']})
  reference=[]
  for b in topic['blocks']:
   if (b['type']=='h' and b.get('text') in exercise_heads) or b.get('kind')=='blank':
    if not is_practice:practice.extend(reference)
    is_practice=True
   (practice if is_practice else body).append(b)
   if b['type']=='diagram':reference.append(b)
 # Exercise-only source units are explicitly identified, not filled with reused diagrams.
 if not body:body=[{'type':'p','text':'Este apartado del manual contiene actividades. Ábrelas en la pestaña Ejercicio.','pdfPage':group['topics'][0]['blocks'][0]['pdfPage']}]
 ids={b['vector'] for b in [*body,*practice] if b.get('vector')}
 lesson={'id':cid,'module':m,'number':n,'title':group['title'],'sourceTopics':[t['key'] for t in group['topics']], 'sourcePages':sorted({b['pdfPage'] for t in group['topics'] for b in t['blocks']}),'pages':paginate(body,group['title']),'practice':paginate(practice,group['title']),'vectors':{k:book['vectors'][k] for k in ids}}
 classes.append(lesson)
for i,l in enumerate(classes):
 l['nextHref']='/solfeo-preview?class='+classes[i+1]['id'] if i+1<len(classes) else '/solfeo-preview?class=local-solfeo-m01-c01'
 (OUT/(l['id']+'.json')).write_text(json.dumps(l,ensure_ascii=False,separators=(',',':'))+'\n')
manifest=[{k:l[k] for k in ['id','module','number','title','sourceTopics','sourcePages','nextHref']} for l in classes]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Prepared',len(classes),'classes:',counts)

"""Re-engrave crowded key-order examples without changing pitches or audio IDs."""
from pathlib import Path
import json, copy
ROOT=Path(__file__).resolve().parents[2]
builder=ROOT/'scripts/solfeo/build-module-one-book.py'
ctx={'__file__':str(builder)}
exec(compile(builder.read_text().split("pages=ns['DATA']['pages'];lessons=[]")[0],str(builder),'exec'),ctx)
ctx['ns'].update(W=1280,CW=1200)
original_label=ctx['ns']['label']
def readable_label(t,x,y,size=9,color=ctx['ns']['INK'],bold=False,center=False):
 return original_label(t,x,y,size*1.4,color,bold,center)
ctx['ns']['label']=readable_label
for variant in ('solfeo-course/book-audit','solfeo-infantil-course/books'):
 for number in ('03','04'):
  prefix='local-solfeo-kids' if 'infantil' in variant else 'local-solfeo'
  path=ROOT/f'local-artifacts/{variant}/{prefix}-m05-c{number}.json'
  data=json.loads(path.read_text());changed=0
  for page in data['pages']:
   for block in page.get('blocks',[]):
    if not block.get('vector') or not any(row.get('explainSemitones') for row in block.get('rows',[])):continue
    widened=copy.deepcopy(block)
    for row in widened['rows']:row['space']=8;row['topOffset']=66
    widened['rowHeights']=[160]*len(widened['rows']);widened['height']=sum(widened['rowHeights'])
    key=ctx['vector'](widened);vector=ctx['assets'][key]
    old=data['vectors'][block['vector']]
    assert [n['pitch'] for n in vector['notes']]==[n['pitch'] for n in old['notes']]
    old.update(vector);old['minDisplayWidth']=1150
    block.update({k:v for k,v in widened.items() if k!='vector'})
    changed+=1
  path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
  print(path.name,changed)

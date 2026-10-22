"""Install local book metadata. Preserve module names and approved module one."""
from pathlib import Path
import json,copy
ROOT=Path(__file__).resolve().parents[2];BASE=ROOT/'local-artifacts/solfeo-course';OUT=BASE/'book-audit'
p=BASE/'structure.json';draft=json.loads(p.read_text());manifest=json.loads((OUT/'manifest.json').read_text())
backup=OUT/'structure-before-book.json'
if not backup.exists():backup.write_text(p.read_text())
for m,section in enumerate(draft['sections'],1):
 if m==1:continue
 template=section['classes'][0]
 classes=[]
 for l in (x for x in manifest if x['module']==m):
  c=copy.deepcopy(template);c.update(id=l['id'],section_id=section['id'],title=l['title'],title_es=l['title'],order_index=l['number']-1)
  c['items']=[]
  for kind,suffix,label in [('VIDEO','video',l['title']),('EXERCISE','exercise','Ejercicio · '+l['title'])]:
   item=copy.deepcopy(next(x for x in template['items'] if x['item_type']=='VIDEO'))
   item.update(id=l['id']+'-'+suffix,class_id=l['id'],item_type=kind,title=label,title_es=label,order_index=len(c['items']),video_url=None,video_duration_seconds=None,audio_url=None,rich_content=None,description=None,description_es=None,subtitles=[])
   c['items'].append(item)
  classes.append(c)
 section['classes']=classes
p.write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n')
print('Installed local book classes:',sum(len(s['classes']) for s in draft['sections']))

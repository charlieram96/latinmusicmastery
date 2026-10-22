"""Render local candidates; retain failures explicitly for review and retry."""
from pathlib import Path
import json,subprocess,concurrent.futures,time,sys
ROOT=Path(__file__).resolve().parents[2];PROD=ROOT/'local-artifacts/solfeo-course/production'
lessons=json.loads((PROD/'storyboards.json').read_text())['lessons']
lessons=[l for l in lessons if not(l['module']==1 and l['number']<=2)]
repair='--repair' in sys.argv
if repair:
 ids={x['id'] for x in json.loads((PROD/'film-audit.json').read_text())['failures']}
 ids.update(l['id'] for l in lessons if any(s.get('diagram',{}).get('kind') in ['grand','grand-study'] for s in l['scenes']))
 lessons=[l for l in lessons if l['id'] in ids]
def render(lesson):
 id=lesson['id'];out=PROD/'films'/id;out.mkdir(parents=True,exist_ok=True)
 manifest=out/'manifest.json'
 if not repair and manifest.exists() and json.loads(manifest.read_text()).get('rendererVersion')==4:
  return {'classId':id,'status':'candidate','log':str((out/'render.log').relative_to(ROOT)),'reused':True}
 with (out/'render.log').open('w') as log:
  result=subprocess.run(['node','scripts/solfeo/render-film.cjs',id],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
 return {'classId':id,'status':'candidate' if result.returncode==0 else 'needs-repair','log':str((out/'render.log').relative_to(ROOT))}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for future in concurrent.futures.as_completed([pool.submit(render,l) for l in lessons]):
  result=future.result();results.append(result)
  (PROD/'render-status.json').write_text(json.dumps({'results':results,'total':len(lessons),'complete':len(results)==len(lessons)},indent=2))
  print(len(results),'/',len(lessons),result['classId'],result['status'],flush=True)

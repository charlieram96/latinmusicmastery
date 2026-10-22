from pathlib import Path
import json,subprocess
root=Path('local-artifacts/solfeo-course/production');results=[];errors=[]
def frames(p):
 return [float(v['pts_time']) for v in json.loads(subprocess.check_output(['/Users/raffymac/bin/ffprobe','-v','error','-select_streams','v:0','-show_packets','-show_entries','packet=pts_time','-of','json',str(p)]))['packets']]
for rp in sorted((root/'ready').glob('*.json')):
 ready=json.loads(rp.read_text());d=root/'films'/ready['classId']
 if not (d/'manifest.json').exists():continue
 manifest=json.loads((d/'manifest.json').read_text());pts=frames('public'+ready['videoUrl']);offset=0
 for i,ch in enumerate(manifest['chapters']):
  local=frames(d/f'{i:03d}.mp4');part=pts[offset:offset+len(local)];offset+=len(local)
  if len(part)!=len(local):errors.append({'id':ready['classId'],'chapter':i,'reason':'packet count'});continue
  delta=max(abs(a-b-ch['start']) for a,b in zip(part,local))
  row={'id':ready['classId'],'chapter':i,'maxTimestampErrorSeconds':delta};results.append(row)
  if delta>1/18+.001:errors.append(row)
 (root/'picture-sync-audit.json').write_text(json.dumps({'scenes':len(results),'errors':errors,'results':results},indent=2))
 print(ready['classId'],'picture verified',flush=True)
print('DONE',len(results),len(errors))

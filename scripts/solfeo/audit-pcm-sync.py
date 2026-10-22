"""Measure decoded musical onsets against the installed synchronization maps."""
from pathlib import Path
import json,subprocess,numpy as np,time
root=Path('local-artifacts/solfeo-course/production'); rate=8000
expect=json.loads((root/'sync-audio-expectations.json').read_text()); groups={}
for ch in expect: groups.setdefault(ch['id'],[]).append(ch)
results=[];errors=[]
for lesson,chapters in groups.items():
 # The normalization report is written only after ffmpeg closes the new file.
 while True:
  installed=json.loads((root/'continuous-pcm-report.json').read_text())
  if any(r['id']==lesson for r in installed):break
  time.sleep(2)
 file='public/local-course-assets/solfeo/films/'+lesson+'-sync-v3.mp4'
 raw=subprocess.run(['/Users/raffymac/bin/ffmpeg','-v','error','-i',file,'-vn','-ac','1','-ar',str(rate),'-f','f32le','pipe:1'],capture_output=True,check=True).stdout
 data=np.frombuffer(raw,dtype=np.float32)
 for ch in chapters:
  t=ch['expectedStart'];lo=max(0,int((t-.4)*rate));hi=min(len(data),int((t+.4)*rate));samples=data[lo:hi]
  # 4 ms RMS ignores codec noise; all notated examples have a silent lead-in.
  n=32;usable=len(samples)//n*n
  rms=np.sqrt(np.mean(samples[:usable].reshape(-1,n)**2,axis=1))
  above=np.flatnonzero(rms>.002)
  actual=(lo+int(above[0])*n)/rate if len(above) else None
  delta=None if actual is None else actual-t
  row={'id':lesson,'chapter':ch['chapter'],'expected':t,'measured':actual,'deltaSeconds':delta}
  results.append(row)
  if delta is None or abs(delta)>.10:errors.append(row)
 (root/'media-sync-pcm-audit.json').write_text(json.dumps({'checkedScenes':len(results),'errors':errors,'results':results},indent=2))
 print(lesson,len(chapters),'scenes checked',flush=True)
print('DONE',len(results),'scenes',len(errors),'errors')

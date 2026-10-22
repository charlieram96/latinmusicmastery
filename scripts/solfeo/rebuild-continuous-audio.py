"""Place original PCM scenes on the authored absolute timeline; encode AAC only once."""
from pathlib import Path
import json, subprocess, numpy as np, math
import wave
root=Path('local-artifacts/solfeo-course'); prod=root/'production'; backup=prod/'backups/continuous-audio'; rate=48000
read=lambda p:json.loads(p.read_text())
def save(p,data):
 tmp=p.with_suffix(p.suffix+'.pcm-tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2));tmp.replace(p)
report=[]
for rp in sorted((prod/'ready').glob('*.json')):
 ready=read(rp);lesson=ready['classId']; directory=prod/'films'/lesson
 if not (directory/'manifest.json').exists():continue
 manifest=read(directory/'manifest.json');dest='/local-course-assets/solfeo/films/'+lesson+'-sync-v3.mp4';out=Path('public'+dest)
 structure=read(root/'structure.json');item=next(i for sec in structure['sections'] for c in sec['classes'] if c['id']==lesson for i in c['items'] if i['item_type']=='VIDEO')
 if not out.exists():
  length=max(manifest['duration'],manifest['chapters'][-1]['end']);pcm=np.zeros((math.ceil(length*rate),2),dtype=np.float32)
  for index,ch in enumerate(manifest['chapters']):
   prefix=directory/f'{index:03d}';source=Path(str(prefix)+'-tempo.wav')
   if not source.exists():source=Path(str(prefix)+'.wav')
   raw=subprocess.run(['/Users/raffymac/bin/ffmpeg','-v','error','-i',str(source),'-ac','2','-ar',str(rate),'-f','f32le','pipe:1'],capture_output=True,check=True).stdout
   a=np.frombuffer(raw,dtype=np.float32).reshape(-1,2)
   start=round(ch['start']*rate);end=min(round(ch['end']*rate),start+len(a),len(pcm));pcm[start:end]=a[:end-start,:2]
  temp=Path('/tmp')/(lesson+'-continuous.wav')
  with wave.open(str(temp),'wb') as w:
   w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);w.writeframes((np.clip(pcm,-1,1)*32767).astype(np.int16).tobytes())
  del pcm
  subprocess.run(['/Users/raffymac/bin/ffmpeg','-y','-v','error','-i','public'+item['video_url'],'-i',str(temp),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out)],check=True)
  temp.unlink()
 # Re-read at installation to preserve unrelated concurrent local edits.
 structure=read(root/'structure.json');item=next(i for sec in structure['sections'] for c in sec['classes'] if c['id']==lesson for i in c['items'] if i['item_type']=='VIDEO');item['video_url']=dest
 ready=read(rp);ready['videoUrl']=dest;save(rp,ready);save(root/'structure.json',structure)
 report.append({'id':lesson,'url':dest,'chapters':len(manifest['chapters'])});save(prod/'continuous-pcm-report.json',report);print(lesson,'PCM timeline rebuilt',flush=True)

from pathlib import Path
import subprocess,wave,json
import numpy as np
from PIL import Image,ImageDraw
root=Path('local-artifacts/codex-ritmo')
for name in ['reference','codex-ritmo']:
 times=list(range(0,440,10))
 sheet=Image.new('RGB',(1280,((len(times)+3)//4)*200))
 for n,t in enumerate(times):
  p=f'/tmp/ritmo-{name}-{t}.jpg'
  subprocess.run(['ffmpeg','-loglevel','error','-ss',str(t),'-i',str(root/(name+'.m4v')),'-frames:v','1','-vf','scale=320:180','-y',p],check=True)
  x,y=n%4*320,n//4*200;sheet.paste(Image.open(p),(x,y));ImageDraw.Draw(sheet).text((x+5,y+181),f'{name} {t}s',fill='white')
 sheet.save(root/(name+'-contact.jpg'))
def read(name):
 with wave.open(str(root/name)) as w:return np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
ref=read('reference.wav');new=read('codex.wav');sr=8000
rows=[]
for t in range(8,433,8):
 a=ref[t*sr:(t+4)*sr]; start=max(0,t-25);b=new[start*sr:min(len(new),(t+30)*sr)]
 size=1 << (len(a)+len(b)-1).bit_length()
 corr=np.fft.irfft(np.fft.rfft(b,size)*np.fft.rfft(a[::-1],size),size)[len(a)-1:len(b)]
 energy=np.r_[0,np.cumsum(b*b)];norm=np.sqrt(np.sum(a*a)*(energy[len(a):]-energy[:-len(a)]));score=corr/np.maximum(norm,1e-10)
 i=int(np.argmax(score));rows.append({'reference':t,'new':round(start+i/sr,4),'offset':round(start+i/sr-t,4),'correlation':round(float(score[i]),3)})
(root/'alignment.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))

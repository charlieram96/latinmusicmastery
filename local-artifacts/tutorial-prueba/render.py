from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
from pathlib import Path
import math, subprocess,json,wave
import numpy as np
P=Path(__file__).parent; W,H=1920,1080; FPS=24
ORANGE='#ff8a20'; CREAM='#fff5e7'; MUTED='#bbb1a8'; RED='#ff493d'
fonts={}
def font(n,bold=False):
 k=(n,bold)
 if k not in fonts:
  f=ImageFont.truetype(str(P/('Montserrat.ttf' if bold else 'Inter.ttf')),n)
  try:f.set_variation_by_name('Bold' if bold else 'Regular')
  except:pass
  fonts[k]=f
 return fonts[k]
def ease(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
def txt(im,s,x,y,n=30,color=CREAM,bold=False):ImageDraw.Draw(im).text((int(x),int(y)),s,font=font(n,bold),fill=color)
def wrap(s,n,width,bold=False):
 d=ImageDraw.Draw(Image.new('RGB',(1,1))); lines=[];line=''
 for word in s.split():
  test=(line+' '+word).strip()
  if d.textlength(test,font=font(n,bold))>width and line:lines.append(line);line=word
  else:line=test
 if line:lines.append(line)
 return lines
def para(im,s,x,y,n=30,width=530,color=MUTED):
 for line in wrap(s,n,width):txt(im,line,x,y,n,color);y+=n*1.45

def cover(im,w,h):return ImageOps.fit(im,(w,h),method=Image.Resampling.LANCZOS,centering=(.5,.36))
shots={f.stem:Image.open(f).convert('RGB') for f in (P/'captures').glob('*.png')}
portraits=[Image.open(P/f'portrait-{i}.png').convert('RGB') for i in [0,1,3,12]]
names=['Alexander Carriera','Frank La Rosa','Leysa Reyes','Patricio Díaz']
instruments=['TIMBAL','CONGAS','PIANO','TIMBAL · SON']
logo=Image.open(P.parent.parent/'public/lmm-horizontal-logo.png').convert('RGBA');logo.thumbnail((270,78))
base=Image.new('RGB',(W,H),'#0e0d0c'); bd=ImageDraw.Draw(base)
for y in range(H):
 c=int(17+11*(1-y/H));bd.line((0,y,W,y),fill=(c+3,c,c-2))
for x in range(-100,2100,120):bd.line((x,0,x-320,H),fill=(32,28,24),width=1)
scenes=[
('intro',5,'TU MÚSICA.','TU CAMINO.','Una guía visual para empezar a estudiar en LMM.','TIMBAL  /  SON CUBANO'),
('teachers',12,'Encuentra','tu maestro.','Conoce distintos estilos y elige con quién aprender.','MAESTROS'),
('patricio',6,'Patricio','“el Chino” Díaz','Nuestro recorrido: timbal y son cubano.','MAESTRO SELECCIONADO'),
('courses',8,'Elige','Timbal + Son.','Explorar cursos → Instrumento Timbal → Son Cubano Timbal.','01 / TU CURSO'),
('course',7,'Una ruta,','paso a paso.','El curso organiza tu aprendizaje en módulos y clases.','02 / RUTA DE APRENDIZAJE'),
('module',8,'Fundamentos','del Timbal.','Entra en Fundamentos del Timbal en el Son y selecciona Ritmo Básico del Timbal en el Son.','03 / TU MÓDULO'),
('exercise',9,'Ahora,','tu turno.','En la clase de ritmo básico, abre Ejercicio 1: Cáscara, mano derecha.','04 / EJERCICIO 1'),
('views',7,'Tú eliges','qué ver.','Activa u oculta Video, Partitura y PlaySense según lo que quieras estudiar.','05 / TU ESPACIO'),
('controls',8,'Practica','a tu ritmo.','Reproduce, pausa o vuelve al principio. Stop reinicia; Terminar toma cierra el intento.','06 / REPRODUCCIÓN'),
('mixer',9,'Toca con','la banda.','Abre Tocar junto con: silencia cada MP3 y ajusta el volumen de sus instrumentos.','07 / ACOMPAÑAMIENTO'),
('quiz',9,'Escucha.','Comprueba.','Introducción: El Timbal en el Son → Cuestionario 1. Lee, elige y comprueba tu respuesta.','08 / CUESTIONARIO'),
('outro',5,'Aprende. Practica.','Hazlo tuyo.','Timbal · Son · Patricio “el Chino” Díaz','LATIN MUSIC MASTERY')]
starts=[];total=0
for s in scenes:starts.append(total);total+=s[1]

def chrome(im,label,progress):
 im.paste(logo,(76,45),logo);txt(im,'GUÍA DEL ESTUDIANTE',1380,65,21,MUTED,True)
 d=ImageDraw.Draw(im);d.line((76,143,1844,143),fill='#494035',width=1)
 txt(im,label,76,180,22,ORANGE,True)
 d.rounded_rectangle((76,1030,1844,1035),radius=2,fill='#39302a')
 d.rounded_rectangle((76,1030,76+1768*progress,1035),radius=2,fill=ORANGE)
 txt(im,'LMM',76,990,17,MUTED,True);txt(im,'PRUEBA VISUAL · LOCAL',1530,990,16,MUTED)

def caption(im,text,u):
 d=ImageDraw.Draw(im);d.rounded_rectangle((680,887,1844,984),radius=18,fill='#252019')
 lines=wrap(text,26,1100)
 y=903 if len(lines)>1 else 920
 word_count=sum(len(line.split()) for line in lines)
 active=min(word_count-1,int(u*word_count));wi=0
 for line in lines:
  x=710
  for word in line.split():
   tw=d.textlength(word+' ',font=font(26))
   txt(im,word,x,y,26,ORANGE if wi==active else CREAM)
   if wi==active:d.line((x,y+31,x+tw-7,y+31),fill=ORANGE,width=3)
   x+=tw;wi+=1
  y+=35
 d.rounded_rectangle((680,887,686,984),radius=3,fill=ORANGE)

def screen(im,key,u,zoom=1.03,focus=(.5,.5),box=(680,232,1164,630)):
 src=shots[key];src=src.crop((64,0,src.width,src.height))
 # A slow editorial camera move over a genuine, unmodified UI capture.
 z=1+(zoom-1)*math.sin(math.pi*u)**2; cw=int(src.width/z);ch=int(src.height/z)
 x=int((src.width-cw)*focus[0]);y=int((src.height-ch)*focus[1]);src=src.crop((x,y,x+cw,y+ch))
 x,y,w,h=box
 panel=Image.new('RGB',(w,h),'#11100e');pic=ImageOps.contain(src,(w,h),Image.Resampling.LANCZOS);panel.paste(pic,((w-pic.width)//2,(h-pic.height)//2))
 mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=22,fill=255)
 im.paste(panel,(x,y),mask);ImageDraw.Draw(im).rounded_rectangle((x,y,x+w,y+h),radius=22,outline='#5a4631',width=2)

def card(im,pic,name,inst,x,y,w,h,selected=False):
 x,y,w,h=map(int,(x,y,w,h));p=cover(pic,w,h-94);layer=Image.new('RGB',(w,h),'#241e18');layer.paste(p,(0,0))
 d=ImageDraw.Draw(layer);d.rectangle((0,h-94,w,h),fill='#241e18');txt(layer,name,20,h-80,24,CREAM,True);txt(layer,inst,20,h-42,15,ORANGE,True)
 mask=Image.new('L',(w,h));ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=20,fill=255)
 im.paste(layer,(x,y),mask)
 if selected:ImageDraw.Draw(im).rounded_rectangle((x,y,x+w,y+h),radius=20,outline=ORANGE,width=5)

def frame(idx,t):
 kind,dur,a,b,desc,label=scenes[idx];u=t/dur;im=base.copy();chrome(im,label,(starts[idx]+t)/total);d=ImageDraw.Draw(im)
 if kind in ['intro','outro']:
  for j,p in enumerate(portraits):
   x=1070+j*182-int(ease(u)*60);y=300+(-1)**j*35
   card(im,p,names[j],instruments[j],x,y,290,415,j==3)
  txt(im,a,90,320,78,CREAM,True);txt(im,b,90,430,90,ORANGE,True)
  d.rounded_rectangle((92,552,92+int(820*ease(t/1.3)),562),radius=5,fill=RED)
  para(im,desc,95,625,32,800);txt(im,'OBSERVA  →  PRACTICA  →  AVANZA',95,810,25,CREAM,True)
 elif kind=='teachers':
  txt(im,a,76,265,67,CREAM,True);txt(im,b,76,348,67,ORANGE,True);para(im,desc,80,470,29,460)
  # Cards travel across the screen, resolving on Patricio.
  offset=540*ease((t-1)/9)
  for j,p in enumerate(portraits):card(im,p,names[j],instruments[j],650+j*335-offset,270+abs(j-3)*12,312,510,j==3 and t>7)
  # Restore title panel so passing cards travel behind it.
  im.paste(base.crop((0,215,630,860)),(0,215));txt(im,a,76,265,67,CREAM,True);txt(im,b,76,348,67,ORANGE,True);para(im,desc,80,470,29,460)
  caption(im,'Explora los perfiles. Hoy elegimos a Patricio “el Chino” Díaz.',u)
 elif kind=='patricio':
  txt(im,a,76,310,83,CREAM,True);txt(im,b,76,420,64,ORANGE,True);para(im,desc,80,560,30,500)
  card(im,portraits[3],'Patricio “el Chino” Díaz','TIMBAL · SON CUBANO',820-25*ease(u),225,650+50*ease(u),635,True)
  caption(im,'Elige tu instrumento, tu estilo y tu maestro.',u)
 else:
  txt(im,a,76,300+24*(1-ease(t/.6)),62,CREAM,True);txt(im,b,76,386,int(55+7*ease(t/.75)),ORANGE,True)
  d.rounded_rectangle((80,477,80+int(440*ease(t/1.2)),485),radius=4,fill=RED)
  para(im,desc,80,530,28,510)
  key='exercise' if kind in ['views','controls'] else kind
  screen(im,key,u,1.45 if kind=='mixer' else 1.2 if kind=='quiz' else 1.1,focus=(.95,.7) if kind=='mixer' else (.6,.5))
  if kind=='views':
   # Crop of the actual view controls, enlarged below the main view.
   crop=shots['exercise'].crop((420,96,760,155));p=ImageOps.contain(crop,(680,120));im.paste(p,(880,760));d.rounded_rectangle((870,750,870+p.width+20,770+p.height),radius=12,outline=ORANGE,width=3)
  if kind=='controls':
   crop=shots['exercise'].crop((530,617,998,666));p=crop.resize((936,98),Image.Resampling.LANCZOS);im.paste(p,(785,748));d.rounded_rectangle((775,738,1731,856),radius=12,outline=ORANGE,width=3)
  caption(im,desc,u)
  txt(im,f'{idx-2:02d}',80,815,68,ORANGE,True)
 return im

# Soft original percussive bed, synthesized locally (no third-party audio).
sr=44100;rng=np.random.default_rng(7);audio=np.zeros(total*sr,dtype=np.float32)
for beat in np.arange(0,total,.625):
 n=int(.12*sr);tt=np.arange(n)/sr;hit=(np.sin(2*np.pi*(130*tt-180*tt*tt))*np.exp(-tt*42))*.09
 at=int(beat*sr);audio[at:min(len(audio),at+n)]+=hit[:min(n,len(audio)-at)]
for hit in np.arange(.3125,total,.625):
 n=int(.06*sr);tt=np.arange(n)/sr;v=rng.normal(0,1,n)*np.exp(-tt*110)*.025;at=int(hit*sr);audio[at:min(len(audio),at+n)]+=v[:min(n,len(audio)-at)]
fade=np.minimum(np.arange(len(audio))/sr/2,(len(audio)-np.arange(len(audio)))/sr/2);audio*=np.minimum(1,fade)
with wave.open(str(P/'music.wav'),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(audio,-1,1)*32767).astype('<i2').tobytes())
(P/'storyboard.json').write_text(json.dumps({'duration':total,'fps':FPS,'scenes':scenes},ensure_ascii=False,indent=2))
# Review sheet before final output.
thumbs=[]
for i,s in enumerate(scenes):
 f=frame(i,s[1]/2);f.save(P/f'still-{i:02}.jpg',quality=93);thumbs.append(f.resize((480,270)))
sheet=Image.new('RGB',(1920,810));
for i,f in enumerate(thumbs):sheet.paste(f,((i%4)*480,(i//4)*270))
sheet.save(P/'contact-sheet.jpg',quality=94)
ff='/Users/raffymac/bin/ffmpeg'
cmd=[ff,'-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-i',str(P/'music.wav'),'-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',str(P/'LMM-guia-estudiante-prueba-final.mp4')]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for idx,s in enumerate(scenes):
 print('Render',idx,s[0],flush=True)
 for k in range(int(s[1]*FPS)):
  t=k/FPS;f=frame(idx,t)
  if idx>0 and t<.45:
   prev=frame(idx-1,scenes[idx-1][1]-.01);shift=int(100*(1-ease(t/.45)));moving=base.copy();moving.paste(f,(shift,0));f=Image.blend(prev,moving,ease(t/.45))
  proc.stdin.write(f.tobytes())
proc.stdin.close();rc=proc.wait();print('DONE',rc,total,flush=True)
if rc:raise SystemExit(rc)

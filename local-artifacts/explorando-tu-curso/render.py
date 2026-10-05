from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import subprocess, math, json, shutil
P=Path(__file__).parent; OLD=P.parent/'tutorial-prueba'; W,H,FPS=1920,1080,24
TMP=Path('/var/folders/g8/1yf5cx1s2fx4gkmj86s6j8700000gn/T')
ids={'courses':'2bc54a55-2d00-40b6-8d28-9705da725974','progress':'5c7259b5-be06-4fab-8ee0-9758515aa8f7','completed':'270a3e6f-5037-43bb-bf3e-9f33fde7bdf1','overview':'a0073c1a-3844-4a52-9d54-58ab02705f4b','scroll':'bcb0f8a1-7ae0-45e9-be1d-f00e88c40cab','closed':'972c03d3-b45c-47b4-a888-0922c67f3ace','open':'818eaf92-db9c-483e-80ed-48d7710179f0','lesson':'0b66d7d4-9e7b-49e7-84dd-2e2c73171e38','tuner':'fa5dc910-acee-4956-9ced-7a20ca506fcc'}
# Crop browser chrome and the administration/account rail from supplied captures.
crops={'courses':(55,118,1910,895),'progress':(10,118,1850,900),'completed':(12,61,1845,800),'overview':(64,56,1904,925),'scroll':(35,44,1875,887),'closed':(58,5,350,425),'open':(30,84,314,754),'lesson':(42,0,1865,890),'tuner':(18,48,1850,920)}
(P/'captures').mkdir(exist_ok=True)
shots={}
for key,uid in ids.items():
 src=Image.open(TMP/f'codex-clipboard-{uid}.png').convert('RGB');src=src.crop(crops[key]);src.save(P/'captures'/f'{key}.png');shots[key]=src
for key in ['exercise','mixer']:
 src=Image.open(OLD/'captures'/f'{key}.png').convert('RGB');shots[key]=src.crop((65,0,1280,665));shots[key].save(P/'captures'/f'{key}.png')
for f in ['Inter.ttf','Montserrat.ttf']:shutil.copy(OLD/f,P/f)
fonts={}
def font(n,b=False):
 k=(n,b)
 if k not in fonts:
  fonts[k]=ImageFont.truetype(str(P/('Montserrat.ttf' if b else 'Inter.ttf')),n)
  try:fonts[k].set_variation_by_name('Bold' if b else 'Regular')
  except:pass
 return fonts[k]
def text(im,s,xy,n=30,fill='#fff4e8',b=False):ImageDraw.Draw(im).text(xy,s,font=font(n,b),fill=fill)
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def lines(s,width,n):
 out=[];line='';d=ImageDraw.Draw(Image.new('RGB',(1,1)))
 for w in s.split():
  v=(line+' '+w).strip()
  if d.textlength(v,font=font(n))>width:out.append(line);line=w
  else:line=v
 return out+[line]
# Each target is measured on the cropped source, normalized to its dimensions.
S=[]
def add(key,dur,title,caption,target=None,rect=None,zoom=1):S.append(dict(key=key,dur=dur,title=title,caption=caption,target=target,rect=rect,zoom=zoom))
add('intro',6,'Explorando tu curso','Ya tienes acceso. Ahora descubre cómo encontrar tu clase y preparar tu espacio de estudio.')
add('courses',9,'01 · Tus cursos, en un solo lugar','En Mis cursos (My Courses) encuentras los cursos de tu cuenta, el maestro y tu avance.',(.09,.24),(.005,.20,.985,.23))
add('courses',7,'Todos · En progreso · Completados','Estos filtros organizan tu lista. Haz clic en In Progress para ver los cursos que has comenzado.',(.09,.167),(.008,.14,.165,.055),1.10)
add('progress',7,'Continúa lo que empezaste','En progreso muestra el curso que estás estudiando. Tu porcentaje te ayuda a ubicar tu avance.',(.91,.25),(.83,.22,.15,.07))
add('progress',6,'Consulta tus cursos terminados','Haz clic en Completed para consultar los cursos que ya has completado.',(.13,.17),(.11,.14,.07,.055),1.08)
add('completed',7,'Completados','Si todavía no terminaste ninguno, verás este mensaje. Puedes volver a Todos con Show all courses.',(.49,.475),(.40,.45,.17,.06))
add('courses',9,'02 · Entra a Son Cubano Timbal','Haz clic en el nombre o la imagen de Son Cubano Timbal, con Patricio «el Chino» Díaz.',(.12,.237),(.01,.22,.27,.083),1.12)
add('overview',9,'Conoce la página de tu curso','Arriba identificas el ritmo, el instrumento y el maestro. Continue lesson permite retomar una lección.',(.75,.11),(.68,.07,.12,.07))
add('overview',9,'Tu ruta de aprendizaje','La ruta visual ordena las clases. Un módulo agrupa clases; cada clase puede incluir diferentes actividades.',(.33,.34),(.01,.17,.79,.28),1.03)
add('scroll',10,'03 · Desplázate hacia los módulos','Baja por la página para leer cada módulo. Buscamos Fundamentos del Timbal en el Son.',(.29,.48),(.005,.44,.79,.22))
add('scroll',8,'Despliega las clases disponibles','Show all 3 lessons muestra las tres clases de este módulo. Dentro del aula también puedes navegar por ellas.',(.069,.636),(.026,.61,.088,.046),1.08)
add('closed',8,'04 · Abre el menú del módulo','En el menú lateral, haz clic en la flecha de Fundamentos del Timbal en el Son para desplegar sus clases.',(.88,.32),(.01,.265,.96,.23))
add('open',9,'Elige la clase que vas a estudiar','El módulo abierto muestra Introducción, Ritmo Básico y Variaciones de Cáscara. Selecciona Ritmo Básico.',(.54,.525),(.035,.493,.91,.081))
add('lesson',9,'05 · Ya estás dentro de la clase','Aquí se reúnen la lección y sus actividades. Las pestañas superiores permiten pasar de una parte a otra.',(.52,.035),(.42,.005,.35,.06))
add('lesson',8,'Recoge el menú cuando lo necesites','La flecha del módulo permite ocultar su lista. Para volver a verla, abre el mismo módulo otra vez.',(.14,.24),(.005,.21,.145,.38))
add('closed',6,'Más espacio, menos distracciones','Los módulos recogidos dejan visible la estructura del curso y sus indicadores de avance.',(.88,.32),(.01,.265,.96,.23))
add('lesson',10,'06 · Localiza tus herramientas','Debajo del video encuentras reproducción, reinicio, subtítulos, metrónomo y volumen. La línea de tiempo permite desplazarte.',(.33,.932),(.185,.86,.49,.10),1.02)
add('lesson',9,'Video y partitura, juntos','La partitura acompaña la clase. Los controles de disposición te permiten organizar cómo ves el material.',(.83,.167),(.80,.145,.18,.055),1.02)
add('lesson',7,'De la explicación a la práctica','Haz clic en Exercise 1 para pasar al primer ejercicio de la clase.',(.50,.035),(.47,.005,.055,.055))
add('exercise',10,'07 · Prepara tu ejercicio','En el ejercicio puedes elegir Video, Partitura y PlaySense. Activa las vistas que te ayuden a estudiar.')
add('mixer',10,'Elige qué instrumentos escuchar','Tocar junto con abre la mezcla: ajusta los volúmenes y silencia las pistas para practicar tu parte.')
add('tuner',9,'Herramientas para tu estudio','El afinador está disponible en el menú de herramientas. Lo veremos en detalle en otro capítulo.',(.41,.72),(.34,.695,.14,.05))
add('outro',7,'Tu curso, paso a paso','Ya sabes encontrar tu curso, abrir sus módulos y elegir una clase. Próximo capítulo: practicar con el reproductor.')
starts=[];total=0
for s in S:starts.append(total);total+=s['dur']
(P/'storyboard.json').write_text(json.dumps({'duration':total,'scenes':S},ensure_ascii=False,indent=2))
logo=Image.open(P.parent.parent/'public/lmm-horizontal-logo.png').convert('RGBA');logo.thumbnail((230,60))
BG=Image.new('RGB',(W,H),'#141210')
def render(i,t):
 s=S[i];u=t/s['dur'];im=BG.copy();d=ImageDraw.Draw(im)
 im.paste(logo,(60,28),logo);text(im,'CONOCE TU PLATAFORMA', (1330,41),23,'#b9aaa0',True)
 d.line((60,108,1860,108),fill='#493529',width=2)
 if s['key'] in ('intro','outro'):
  text(im,'CAPÍTULO 01' if i==0 else 'SIGUE EXPLORANDO',(120,270),29,'#ff8a20',True)
  for j,l in enumerate(lines(s['title'],1650,92)):text(im,l,(120,350+j*112),92,b=True)
  d.rounded_rectangle((122,494,640,501),radius=3,fill='#ff8220')
  for j,l in enumerate(lines(s['caption'],1560,38)):text(im,l,(122,564+j*55),38,'#d1c7bf')
  text(im,'SON CUBANO TIMBAL · PATRICIO «EL CHINO» DÍAZ',(122,835),25,'#ff8a20',True)
 else:
  text(im,s['title'],(60,126),35,b=True)
  src=shots[s['key']];area=(60,190,1800,690)
  if s['key'] in ('closed','open'):area=(160,190,530,690)
  x,y,w,h=area
  pic=ImageOps.contain(src,(w,h),Image.Resampling.BICUBIC);px=x+(w-pic.width)//2;py=y+(h-pic.height)//2
  im.paste(pic,(px,py));d=ImageDraw.Draw(im)
  d.rounded_rectangle((px-2,py-2,px+pic.width+2,py+pic.height+2),radius=5,outline='#70513b',width=2)
  if s['key'] in ('closed','open'):
   text(im,'CURSO → MÓDULO → CLASE',(840,315),28,'#ff8a20',True)
   text(im,'Fundamentos del Timbal',(840,390),43,b=True);text(im,'en el Son',(840,448),43,b=True)
   text(im,'Abre · elige · vuelve cuando quieras',(840,565),29,'#c9bcb1')
  if s['rect'] and t>1:
   rx,ry,rw,rh=s['rect'];box=(px+rx*pic.width,py+ry*pic.height,px+(rx+rw)*pic.width,py+(ry+rh)*pic.height)
   d.rounded_rectangle(box,radius=9,outline='#ff8317',width=4)
  if s['target']:
   tx,ty=s['target'];ex=px+tx*pic.width;ey=py+ty*pic.height;a=ease((t-.4)/1.5)
   cx=(px+pic.width*.72)*(1-a)+ex*a;cy=(py+pic.height*.8)*(1-a)+ey*a
   if s['dur']-.65<t<s['dur']:
    r=10+50*(t-(s['dur']-.65))/.65;d.ellipse((cx-r,cy-r,cx+r,cy+r),outline='#ff8a20',width=4)
   d.polygon([(cx,cy),(cx+4,cy+36),(cx+13,cy+26),(cx+23,cy+44),(cx+31,cy+39),(cx+21,cy+22),(cx+35,cy+21)],fill='white',outline='#191511',width=3)
  if s['zoom']>1:
   z=1+(s['zoom']-1)*math.sin(math.pi*u)**2
   panel=im.crop((60,190,1860,880));cw=int(1800/z);ch=int(690/z)
   fx,fy=s['target'] or (.5,.5);ox=int((1800-cw)*fx);oy=int((690-ch)*fy)
   panel=panel.crop((ox,oy,ox+cw,oy+ch)).resize((1800,690),Image.Resampling.BICUBIC)
   im.paste(panel,(60,190));d=ImageDraw.Draw(im)
  d.rounded_rectangle((60,900,1860,1013),radius=16,fill='#2c231c');d.rounded_rectangle((60,900,67,1013),radius=3,fill='#ff8a20')
  for j,l in enumerate(lines(s['caption'],1720,30)):text(im,l,(88,919+j*41),30)
  # A brief animated underline reinforces the current step.
  d.line((88,998,88+int(240*ease(t/1.1)),998),fill='#ff8a20',width=3)
 text(im,f'{i+1:02d} / {len(S):02d}',(60,1035),19,'#b9aaa0')
 d.line((200,1048,1860,1048),fill='#3f3025',width=4);d.line((200,1048,200+1660*(starts[i]+t)/total,1048),fill='#ff8a20',width=4)
 return im
# Local render only; no upload or application/database writes.
cmd=['/Users/raffymac/bin/ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r',str(FPS),'-i','-','-stream_loop','-1','-i',str(OLD/'music.wav'),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-af','volume=0.55','-b:a','128k','-t',str(total),'-movflags','+faststart',str(P/'Explorando-tu-curso.mp4')]
if __name__=='__main__':
 proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 for i,s in enumerate(S):
  print(i,s['title'],flush=True);render(i,min(3,s['dur']/2)).save(P/f'still-{i:02}.jpg',quality=85)
  prev=render(i-1,S[i-1]['dur']-.01) if i else None
  for f in range(s['dur']*FPS):
   t=f/FPS;im=render(i,t)
   if prev is not None and s['key']=='scroll' and S[i-1]['key']=='overview' and t<1.1:
    a=ease(t/1.1);old=prev.crop((60,190,1860,880));new=im.crop((60,190,1860,880));pan=Image.new('RGB',(1800,690),'#141210');dy=int(690*a);pan.paste(old,(0,-dy));pan.paste(new,(0,690-dy));im.paste(pan,(60,190))
   elif prev is not None and t<.4:im=Image.blend(prev,im,ease(t/.4))
   proc.stdin.write(im.tobytes())
 proc.stdin.close();rc=proc.wait();print('DONE',rc,total,flush=True)
 raise SystemExit(rc)

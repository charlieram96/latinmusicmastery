"""Legible 1280x720 film frame, with the source book's exact music glyphs."""
from pathlib import Path
import io, subprocess, sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'output/pdf/solfeo-aplicado-ampliado-fuentes'
code=(SOURCE/'render.py').read_text().split("for idx,page in enumerate(DATA['pages']):")[0]
code=code.replace('c=canvas.Canvas(str(OUT),pagesize=(W,H))','c=canvas.Canvas(io.BytesIO(),pagesize=(W,H))')
ns={'__file__':str(SOURCE/'render.py'),'io':io}
exec(compile(code,str(SOURCE/'render.py'),'exec'),ns)
pdfmetrics.registerFont(TTFont('Film','/Library/Fonts/Montserrat-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FilmBold','/Library/Fonts/Montserrat-ExtraBold.ttf'))
target=Path(sys.argv[1]); pdf=io.BytesIO(); c=canvas.Canvas(pdf,pagesize=(1280,720)); ns['c']=c
c.setFillColor(HexColor('#f9f7f4')); c.rect(0,0,1280,720,fill=1,stroke=0)
def text(value,x,y,size=20,bold=False,center=False,color='#25211e'):
 c.setFillColor(HexColor(color)); c.setFont('FilmBold' if bold else 'Film',size)
 (c.drawCentredString if center else c.drawString)(x,y,value)
text(sys.argv[2] if len(sys.argv)>2 else 'SOLFEO APLICADO · 1.5',48,681,13,True,color='#ef7909')
text('Figuras musicales y silencios',640,626,38,True,True)
c.setFillColor(HexColor('#ef7909')); c.roundRect(604,601,72,4,2,fill=1,stroke=0)
cols=[68,405,623,842,1070]
c.setFillColor(HexColor('#265b4d')); c.roundRect(48,533,1184,44,8,fill=1,stroke=0)
for title,x in zip(['FIGURA','NOTA','SILENCIO','FRACCIÓN','NEGRA = 60 BPM'],cols):
 text(title,x,549,16,True,x!=cols[0],color='#ffffff')
names=['Redonda','Blanca','Negra','Corchea','Semicorchea','Fusa','Semifusa','Garrapatea','Semigarrapatea']
glyph=ns['glyph']; GL=ns['GL']
def bounds(code):
 vals=[v for cmd in GL[str(code)]['commands'] for v in cmd['args'][1::2]]
 return min(vals),max(vals)
for i,name in enumerate(names):
 cy=508-i*46; dur=2**i
 c.setFillColor(HexColor('#ffffff' if i%2==0 else '#f2eee9')); c.rect(48,cy-23,1184,46,fill=1,stroke=0)
 text(name,cols[0],cy-7,21)
 size=37; xx=cols[1]-7
 if i==0: glyph(0xe0a2,xx,cy,size)
 else:
  flag=0xe240+2*(i-3) if i>=3 else None
  stem=max(33,-bounds(flag)[0]*size/1000+2) if flag else 33
  if stem>38: size*=38/stem; stem=38
  hy=cy-stem/2; glyph(0xe0a3 if i==1 else 0xe0a4,xx,hy,size)
  sx=xx+GL[str(0xe0a4)]['advance']*size/1000-.6
  c.setStrokeColor(HexColor('#25211e')); c.setLineWidth(1); c.line(sx,hy,sx,hy+stem)
  if flag:glyph(flag,sx,hy+stem,size)
 rest=0xe4e3+i;lo,hi=bounds(rest);rs=min(42,37*1000/max(1,hi-lo)); ry=cy-(lo+hi)/2*rs/1000
 glyph(rest,cols[2]-GL[str(rest)]['advance']*rs/2000,ry,rs)
 if i<2:
  c.setStrokeColor(HexColor('#25211e'));c.setLineWidth(1);c.line(cols[2]-16,ry,cols[2]+16,ry)
 text('1' if i==0 else f'1/{dur}',cols[3],cy-7,21,center=True)
 text(f'{4000/dur:g} ms',cols[4],cy-7,21,center=True)
text('Duraciones de referencia a 60 BPM. Al cambiar el tempo, cambia su duración en segundos.',68,92,16,color='#68615b')
text(sys.argv[3] if len(sys.argv)>3 else '3 / 5',48,30,14,color='#857c73')
c.showPage();c.save()
temp=target.with_suffix('.pdf'); temp.write_bytes(pdf.getvalue())
subprocess.run(['pdftoppm','-png','-singlefile','-r','72',str(temp),str(target.with_suffix(''))],check=True)
temp.unlink()

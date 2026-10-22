"""Compile the manual's editable semantic blocks to the local paged course.
Uses the SAME diagram functions and Bravura paths as the source manual.
No PDF screenshots or rasterized text. Run after editing content.es.json/render.py.
"""
from pathlib import Path
import json,io,re,hashlib
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'output/pdf/solfeo-aplicado-ampliado-fuentes'
code=(SOURCE/'render.py').read_text().split("for idx,page in enumerate(DATA['pages']):")[0].replace('c=canvas.Canvas(str(OUT),pagesize=(W,H))','c=canvas.Canvas(io.BytesIO(),pagesize=(W,H))')
code=code.replace("ny+65,10,GREEN,True);arrow((M+330,ny+58)","ny+43,10,GREEN,True);arrow((M+330,ny+36)")
ns={'__file__':str(SOURCE/'render.py'),'io':io};exec(compile(code,str(SOURCE/'render.py'),'exec'),ns)
class PathData:
 def __init__(self):self.d=[]
 def moveTo(self,x,y):self.d.append(f'M{x} {y}')
 def lineTo(self,x,y):self.d.append(f'L{x} {y}')
 def curveTo(self,*v):self.d.append('C'+' '.join(map(str,v)))
 def close(self):self.d.append('Z')
class SVGCanvas(canvas.Canvas):
 def __init__(self,height):
  super().__init__(io.BytesIO());self.height=height;self.elements=[]
 def transform_attr(self):
  a,b,c,d,e,f=self._currentMatrix
  return f'matrix({a} {-b} {c} {-d} {e} {self.height-f})'
 def color(self,c):return '#'+''.join(f'{round(v*255):02x}' for v in (c.red,c.green,c.blue))
 def add(self,tag,attrs,fill=0,stroke=1,body=None):
  a=f' transform="{self.transform_attr()}" fill="{self.color(self._fillColorObj) if fill else "none"}" stroke="{self.color(self._strokeColorObj) if stroke else "none"}" stroke-width="{self._lineWidth}"'
  dash=getattr(self,'_lineDash',None)
  if stroke and dash and dash[0]:a+=f' stroke-dasharray="{" ".join(map(str,dash[0]))}"'
  self.elements.append(f'<{tag} {attrs}{a}'+('/>' if body is None else f'>{body}</{tag}>'))
 def line(self,x1,y1,x2,y2):self.add('line',f'x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"')
 def rect(self,x,y,w,h,stroke=1,fill=0):self.add('rect',f'x="{x}" y="{y}" width="{w}" height="{h}"',fill,stroke)
 def circle(self,x,y,r,stroke=1,fill=0):self.add('circle',f'cx="{x}" cy="{y}" r="{r}"',fill,stroke)
 def beginPath(self):return PathData()
 def drawPath(self,p,stroke=1,fill=0,fillMode=None):self.add('path',f'd="{" ".join(p.d)}"',fill,stroke)
 def drawString(self,x,y,t,*args,**kwargs):
  self.elements.append(f'<g transform="{self.transform_attr()}"><text x="{x}" y="{-y}" transform="scale(1,-1)" fill="{self.color(self._fillColorObj)}" font-family="Arial,sans-serif" font-size="{self._fontsize}" font-weight="{700 if self._fontname=="Bold" else 400}">{escape(t)}</text></g>')
 def drawCentredString(self,x,y,t,*a,**k):self.drawString(x-self.stringWidth(t,self._fontname,self._fontsize)/2,y,t)
 def drawRightString(self,x,y,t,*a,**k):self.drawString(x-self.stringWidth(t,self._fontname,self._fontsize),y,t)
assets={}
def vector(b):
 key=hashlib.sha256(json.dumps(b,sort_keys=True).encode()).hexdigest()[:16]
 if key in assets:return key
 h=b.get('height',160)+24;c=SVGCanvas(h);ns['c']=c;hits=[];old=ns['note']
 def note(*a,**kw):
  c.elements.append(f'<g class="manual-note" style="--note-order:{len(hits)}">');y=old(*a,**kw);c.elements.append('</g>');hits.append(dict(pitch=a[0],x=a[1]+4,y=h-y,dur=kw.get('dur',a[4] if len(a)>4 else 4)));return y
 ns['note']=note
 try:ns['diagram'](b,h-12)
 finally:ns['note']=old
 if b['kind']=='parts-map' and hits:hits[0]['beats']=.75
 assets[key]=dict(width=ns['W'],height=h,svg=''.join(c.elements),notes=hits,kind=b['kind'])
 return key
pages=ns['DATA']['pages'];lessons=[]
anchors=['nomenclatura','pentagrama','sol','adicionales','figuras','relaciones','partes','taller-1','examen-m01']
titles=['Origen y nombres de las notas','Pentagrama, líneas y espacios','Clave de Sol y ubicación de las notas','Líneas adicionales y registros','Figuras musicales y silencios','Relaciones de duración','Cabeza, plica, corchete y barras de unión','Identificación y escritura musical','Análisis y comprensión','Escritura y aplicación']
# Exact paragraphs, including source-page provenance, in their original order.
allblocks=[dict(b,pdfPage=i+1) for i,p in enumerate(pages) if i in [1,2,*range(16,24)] for b in p.get('blocks',[])]
for num in range(1,11):
 anchor=anchors[min(num-1,8)];blocks=[b for b in allblocks if b.get('_sourcePage')==anchor]
 if num in [9,10]:
  split=next(i for i,b in enumerate(blocks) if b.get('text','')=='Escritura y aplicación · 50 puntos')
  blocks=blocks[:split] if num==9 else [blocks[0],blocks[1],*blocks[split:]]
 exercise=[];body=[];in_exercise=num>=8
 for b in blocks:
  if b['type']=='h' and b.get('text') in ['Ejercicios','Práctica de ubicación','Escritura','Identificación y escritura']:in_exercise=True
  (exercise if in_exercise else body).append(b)
 # Keep questions only in Exercise; lesson shows the authored reference models.
 if num>=8:
  body=[]
  for b in blocks:
   if b['type']!='diagram' or b.get('kind')=='blank':continue
   if num in [9,10]:
    # These are two sections of ONE authored exam, not duplicated lessons.
    # Keep the complete A/B reference in Exercise (question 10 needs both).
    row=num-9
    b={**b,'rows':[b['rows'][row]],'rowHeights':[b['rowHeights'][row]],'height':b['rowHeights'][row]}
   body.append(b)
  body.insert(0,dict(type='source-reference',text={8:'Taller · Identificación y escritura · páginas 22–23',9:'Examen del módulo 1 · Análisis y comprensión · preguntas 1–5 · páginas 23–24',10:'Examen del módulo 1 · Escritura y aplicación · preguntas 6–10 · página 24'}[num]))
 screens=[]
 if num==1:
  intro=[b for b in allblocks if b.get('_sourcePage') in ['prologo','metodo'] or b.get('anchor')=='metodo']
  body=[dict(type='manual-cover'),*intro,*body]
 def compile_screens(items):
  result=[];pending=[];weight=0;heading=titles[num-1]
  def flush():
   nonlocal pending,weight
   if pending:result.append(dict(title=heading,blocks=pending));pending=[];weight=0
  for raw in items:
   b=dict(raw)
   if b['type']=='manual-cover':
    flush();result.append(dict(title='Solfeo Aplicado',blocks=[b]));heading='Solfeo Aplicado: lectura y comprensión del lenguaje musical';continue
   if b['type']=='topic':flush();heading=b['text'];continue
   if b.get('_sourcePage')=='nomenclatura' and any(x.get('_sourcePage') in ['prologo','metodo'] for x in pending):flush();heading=titles[num-1]
   if b['type']=='diagram':
    b['vector']=vector(b);w=min(300,b.get('height',160))+40
   elif b['type']=='h':w=34
   else:w=25*max(1,len(re.sub('<[^>]+>','',b.get('text','')))/115)+18
   if pending and weight+w>520:
    # Keep a heading with its paragraph, never orphan it at the bottom.
    tail=pending.pop() if pending[-1]['type']=='h' else None
    flush()
    if tail:heading=tail['text'];pending=[tail];weight=34
   pending.append(b);weight+=w
  flush()
  # A short final explanation belongs with the preceding diagram, not alone.
  if len(result)>1 and len(result[-1]['blocks'])==1 and result[-1]['blocks'][0]['type'] in ['p','small'] and any(x['type']=='diagram' for x in result[-2]['blocks']):result[-2]['blocks']+=result.pop()['blocks']
  return result
 screens=compile_screens(body)
 if num==5:screens=[dict(title=titles[num-1],blocks=[{**b,'vector':vector(b)} if b['type']=='diagram' else b for b in body])]
 if num==1:
  # Retain the existing interactive hymn, C-major scale, and alphabetic equivalents.
  screens.extend([dict(title=t,blocks=[dict(type='interactive',step=s)]) for s,t in [(1,'De Ut a Do'),(2,'Escucha y descubre las notas'),(3,'Un sonido, dos nombres'),(4,'Altura, duración y silencio')]])
 lessons.append(dict(number=num,title=titles[num-1],pages=screens,practice=compile_screens(exercise)))
out=ROOT/'lib/solfeo/module-one-book.json';out.write_text(json.dumps(dict(source='LMM-Solfeo-Aplicado-Ampliado copy.pdf',edition='0.3',lessons=lessons,vectors=assets),ensure_ascii=False,indent=2)+'\n')
print(f'{len(lessons)} lessons, {sum(len(x["pages"]) for x in lessons)} pages, {len(assets)} editable vectors')

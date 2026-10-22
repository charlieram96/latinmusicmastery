"""Editable transcription of the user's two sextuplet sheets; local course only."""
from pathlib import Path
import json, hashlib, shutil
R=Path(__file__).resolve().parents[2]
REF=R/'local-artifacts/solfeo-course/references/eslava'
for name,uid in [('seisillo','06a2e58a-2fb2-430d-b5e5-4089f24897ef'),('seisillo-acentuacion','e527cafa-1547-44bb-9ba9-4e9d33a35a2f')]:
 shutil.copy2(Path('/var/folders/g8/1yf5cx1s2fx4gkmj86s6j8700000gn/T')/f'codex-clipboard-{uid}.png',REF/f'usuario-{name}.png')
s=R/'scripts/solfeo/build-module-one-book.py';ns={'__file__':str(s)}
exec(compile(s.read_text().split("pages=ns['DATA']['pages'];lessons=[]")[0],str(s),'exec'),ns)
rr=ns['ns'];TAG='source-sextuplets-20261008'
file=R/'local-artifacts/solfeo-course/book-audit/local-solfeo-m04-c07.json';book=json.loads(file.read_text())
efile=R/'lib/solfeo/book-en.json';en=json.loads(efile.read_text())
def text(es,eng):en[es]=eng;return {'type':'p','text':es}
def event(dur,ratio=None,accent=False):
 e={'pitch':'B4','dur':dur}
 if ratio:e['tuplet']=ratio
 if accent:e['mark']='accent'
 return e
def render_grid(cells,width,height):
 c=ns['SVGCanvas'](height);rr['c']=c;hits=[];rows=[]
 def label(t,x,y,size=16):rr['label'](t,x,y,size,rr['INK'])
 for cell in cells:
  x,y=cell['x'],height-cell['y'];events=cell['events'];xs=cell['noteXs'];base=len(hits)
  for k,line in enumerate(cell['label']):label(line,x,y-k*20)
  for i,(e,nx) in enumerate(zip(events,xs)):
   c.elements.append(f'<g class="manual-note" style="--note-order:{len(hits)}">')
   ny=rr['note']('B4',nx,y-20,'G',e['dur'],10,stem=not any(i in g for g in cell.get('beams',[])))
   c.elements.append('</g>');hits.append({'pitch':'B4','x':nx+4,'y':height-ny,'dur':e['dur']})
  beam_levels=cell.get('beamLevels')
  if beam_levels:
   sx=sorted({i for level in beam_levels for group in level for i in group});by=y-35
   c.setStrokeColor(rr['INK']);c.setLineWidth(.9)
   for i in sx:c.line(xs[i],y,xs[i],by)
   for level,groups_at_level in enumerate(beam_levels):
    for group in groups_at_level:
     c.setLineWidth(3);c.line(xs[group[0]],by+level*6,xs[group[-1]],by+level*6)
  else:
   for group in cell.get('beams',[]):
    sx=[xs[i] for i in group];by=y-35
    c.setStrokeColor(rr['INK']);c.setLineWidth(.9)
    for nx in sx:c.line(nx,y,nx,by)
    for level in range((events[group[0]]['dur']).bit_length()-3):
     c.setLineWidth(3);c.line(sx[0],by+level*6,sx[-1],by+level*6)
  for group in cell.get('groups',[]):
   a,b=xs[group['indices'][0]],xs[group['indices'][-1]]+10;ty=y+22
   c.setStrokeColor(rr['INK']);c.setLineWidth(.8);mid=(a+b)/2
   c.line(a,ty-5,a,ty);c.line(a,ty,mid-10,ty);c.line(mid+10,ty,b,ty);c.line(b,ty,b,ty-5)
   label(str(group['ratio'][0]),mid-4,ty-5,16)
  rows.append({'events':events,'tupletGroups':cell.get('groups',[]),'beams':cell.get('beams',[])})
 block={'type':'diagram','kind':'score','rows':rows,'sourceGeometry':cells,'height':height,'supplementId':TAG}
 key=hashlib.sha256(json.dumps(block,sort_keys=True).encode()).hexdigest()[:16]
 block['vector']=key;book['vectors'][key]={'width':width,'height':height,'minDisplayWidth':800,'svg':''.join(c.elements),'notes':hits,'kind':'score'}
 return block
intro=text('El seisillo es un grupo de figuras irregulares, que provienen de una figura simple al igual que el tresillo, cuya división real es binaria.','The sextuplet is a group of irregular note values derived from a simple note value, like the triplet, whose normal division is binary.')
construction=text('Para formar un seisillo, se toma la cuarta parte del valor de una figura simple y se escribe seis veces; luego se indica con un 6 y una línea o ligadura que abarca el grupo.','To form a sextuplet, take one quarter of a simple note value and write it six times; then indicate the group with a 6 and a bracket or slur encompassing it.')
accent=text('En el seisillo la acentuación se debe producir en el I, III y V sonidos; en el doble tresillo se debe producir en el I y IV sonidos, es decir, que el doble tresillo es la división ternaria de un grupo binario y el seisillo es la división binaria de un grupo ternario:','In the sextuplet, accents fall on sounds I, III and V; in the double triplet they fall on I and IV. Thus the double triplet is the ternary division of a binary group, and the sextuplet is the binary division of a ternary group:')
cells=[]
for i,(dur,name) in enumerate([(1,'negras'),(2,'corcheas'),(4,'semicorcheas'),(8,'fusas'),(16,'semifusas')]):
 # The original reference figure, its quarter value, and the complete sextuplet.
 cell={'x':20,'y':45+i*76,'label':['Figura simple, la'], 'events':[event(dur),event(dur*4)]+[event(dur*4,[6,4])for _ in range(6)],'noteXs':[218,465]+[722+j*32 for j in range(6)],'groups':[{'indices':list(range(2,8)),'ratio':[6,4]}],'beams':[list(range(2,8))]if dur>1 else []}
 cells.append(cell)
formula=render_grid(cells,960,415)
# Insert all sentence fragments as editable SVG text, retaining their exact words.
v=book['vectors'][formula['vector']];c=ns['SVGCanvas'](415);rr['c']=c
for i,(_,name) in enumerate([(1,'negras'),(2,'corcheas'),(4,'semicorcheas'),(8,'fusas'),(16,'semifusas')]):
 rr['label'](', la cuarta parte, la',247,415-(45+i*76),16,rr['INK'])
 rr['label']('= al seisillo de '+name,492,415-(45+i*76),16,rr['INK'])
v['svg']+=''.join(c.elements)
comparison=[]
labels=[(['Figura simple, la Negra'],['Figura simple, la negra:']),(['División ternaria de una','figura simple, el Tresillo:'],['División binaria de','una figura simple:']),(['División binaria de un','grupo ternario, el Seisillo:'],['División ternaria de un grupo','binario, doble Tresillo:']),(['* Otra forma de escritura:'],['Otra forma de escritura:'])]
for row in range(4):
 for col in range(2):
  x=20+col*480;nx=x+310;y=50+row*104
  if row==0:events=[event(4)];beams=[];groups=[]
  elif row==1:
   count=3 if col==0 else 2;events=[event(8,[3,2]if col==0 else None)for _ in range(count)];beams=[list(range(count))];groups=[{'indices':[0,1,2],'ratio':[3,2]}]if col==0 else []
  else:
   events=[event(16,[6,4]if col==0 else [3,2],i in ([0,2,4]if col==0 else [0,3]))for i in range(6)]
   beams=([[0,1],[2,3],[4,5]]if col==0 else [[0,1,2],[3,4,5]])if row==2 else [list(range(6))]
   groups=[{'indices':list(range(6)),'ratio':[6,4]}]if col==0 else [{'indices':[0,1,2],'ratio':[3,2]},{'indices':[3,4,5],'ratio':[3,2]}]
  comparison.append({'x':x,'y':y,'label':labels[row][col],'events':events,'noteXs':[nx+i*22 for i in range(len(events))],'beams':beams,'groups':groups})
comparison[4]['beamLevels']=[[[0,1,2,3,4,5]],[[0,1],[2,3],[4,5]]]
chart=render_grid(comparison,980,445)
# A text page followed by the full-width source table avoids shrinking this dense diagram.
pages=[{'title':'El Seisillo','blocks':[intro,construction,formula]}, {'title':'Acentuación del seisillo y del doble tresillo','blocks':[accent,chart]}]
for p in pages:p.update(supplementId=TAG,layout='full-width',sourceReference='usuario-seisillo'+('-acentuacion'if 'Acentuación'in p['title']else '')+'.png')
en.update({'El Seisillo':'The sextuplet','Acentuación del seisillo y del doble tresillo':'Accentuation of the sextuplet and double triplet'})
en.update({'Figura simple, la':'Simple note value, the', ', la cuarta parte, la':', one quarter of it, the', 'Figura simple, la Negra':'Simple note value, the quarter note', 'Figura simple, la negra:':'Simple note value, the quarter note:', 'División ternaria de una':'Ternary division of a', 'figura simple, el Tresillo:':'simple value: the triplet', 'División binaria de':'Binary division of', 'una figura simple:':'a simple note value:', 'División binaria de un':'Binary division of a', 'grupo ternario, el Seisillo:':'ternary group: the sextuplet', 'División ternaria de un grupo':'Ternary division of a group', 'binario, doble Tresillo:':'of two: the double triplet', '* Otra forma de escritura:':'* Alternative notation:', 'Otra forma de escritura:':'Alternative notation:'})
for es,eng in [('negras','quarter notes'),('corcheas','eighth notes'),('semicorcheas','sixteenth notes'),('fusas','thirty-second notes'),('semifusas','sixty-fourth notes')]:en['= al seisillo de '+es]='= a sextuplet of '+eng
book['pages']=[p for p in book['pages']if p.get('supplementId')!=TAG]+pages
file.write_text(json.dumps(book,ensure_ascii=False,separators=(',',':'))+'\n');efile.write_text(json.dumps(en,ensure_ascii=False,indent=2)+'\n')
(REF/'sextuplet-editable.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2)+'\n')
print('Installed 4.7 lesson pages',len(book['pages']),len(book['pages'])+1)

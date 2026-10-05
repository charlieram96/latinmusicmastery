"""Export every semantic score to MusicXML 4.0, compressed MXL and timing JSON.
Graphic-only explanations retain editable vector drawing code in render.py.
"""
from pathlib import Path
import json,xml.etree.ElementTree as ET,zipfile,copy
from fractions import Fraction
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'scores';OUT.mkdir(exist_ok=True)
DATA=json.loads((ROOT/'content.es.json').read_text());manifest=[];DIV=20160
TYPES={1:'whole',2:'half',4:'quarter',8:'eighth',16:'16th',32:'32nd',64:'64th',128:'128th',256:'256th'}
def sub(p,t,text=None,**kw):
 e=ET.SubElement(p,t,kw)
 if text is not None:e.text=str(text)
 return e
def dur(e,r):
 value=Fraction(4,e.get('dur',1))
 if e.get('dot') or e.get('dots'):value*=sum((Fraction(1,2**i) for i in range(e.get('dots',1)+1)),Fraction(0))
 if r.get('tuplet'):
  a,b=map(int,r['tuplet'].split(':'));value*=Fraction(b,a)
 return value

def attrs(m,r,grand=False):
 a=sub(m,'attributes');sub(a,'divisions',DIV);k=sub(a,'key');sub(k,'fifths',r.get('key',0));t=sub(a,'time')
 if r.get('meter'):
  n,d=r['meter'].split('/');sub(t,'beats',n);sub(t,'beat-type',d)
 else:sub(t,'senza-misura')
 if grand:sub(a,'staves',2)
 for i,cl in enumerate(['G','F'] if grand else [r.get('clef','G')]):
  c=sub(a,'clef',**({'number':str(i+1)} if grand else {}));sub(c,'sign','C' if cl in ('C','T') else 'percussion' if cl=='P' else cl)
  if cl!='P':sub(c,'line',dict(G=2,F=4,C=3,T=4)[cl])

def direction(m,words=None,dynamic=None,staff=None,wedge=None):
 d=sub(m,'direction',placement='below' if dynamic or wedge else 'above');dt=sub(d,'direction-type')
 if words:sub(dt,'words',words)
 if dynamic:sub(sub(dt,'dynamics'),dynamic)
 if wedge:sub(dt,'wedge',type=wedge,number='1')
 if staff:sub(d,'staff',staff)

def addnote(m,e,r,idx,total,staffno=None):
 mark=e.get('mark');dyn=e.get('dynamic')
 known={'staccato','tenuto','accent','marcato','fermata','tr','turn','mordent',',','//'}
 if mark and mark not in known:direction(m,words=mark,staff=staffno)
 if dyn:direction(m,dynamic=dyn,staff=staffno)
 n=sub(m,'note');p=e.get('pitch');v=dur(e,r)
 if e.get('rest'):sub(n,'rest')
 else:
  pp=sub(n,'pitch');sub(pp,'step',p[0]);alter=p[1:-1].count('#')-p[1:-1].count('b');sub(pp,'alter',alter);sub(pp,'octave',p[-1])
 sub(n,'duration',int(v*DIV))
 ties=[]
 for a,b in r.get('ties',[]):
  if idx==a:ties.append('start')
  if idx==b:ties.append('stop')
 for t in ties:sub(n,'tie',type=t)
 if staffno:sub(n,'voice',staffno)
 sub(n,'type',TYPES[e.get('dur',1)])
 if e.get('dot') or e.get('dots'):
  for _ in range(e.get('dots',1)):sub(n,'dot')
 if r.get('tuplet'):
  a,b=r['tuplet'].split(':');tm=sub(n,'time-modification');sub(tm,'actual-notes',a);sub(tm,'normal-notes',b);sub(tm,'normal-type',TYPES[e.get('dur',1)])
 if staffno:sub(n,'staff',staffno)
 for group in r.get('beams',[]):
  if idx in group:
   for level in range(1,int(__import__('math').log2(e['dur']))-1):sub(n,'beam','begin' if idx==group[0] else 'end' if idx==group[-1] else 'continue',number=str(level))
 nt=None
 def notations():
  nonlocal nt
  if nt is None:nt=sub(n,'notations')
  return nt
 for t in ties:sub(notations(),'tied',type=t)
 for no,(a,b) in enumerate(r.get('slurs',[]),1):
  if idx in (a,b):sub(notations(),'slur',type='start' if idx==a else 'stop',number=str(no))
 if mark in {'staccato','tenuto','accent','marcato',',','//'}:sub(sub(notations(),'articulations'),{'marcato':'strong-accent',',':'breath-mark','//':'caesura'}.get(mark,mark))
 if mark=='fermata':sub(notations(),'fermata')
 if mark in {'tr','turn','mordent'}:sub(sub(notations(),'ornaments'),{'tr':'trill-mark','turn':'turn','mordent':'mordent'}[mark])
 if e.get('slashes'):sub(sub(notations(),'ornaments'),'tremolo',e['slashes'],type='single')
 if r.get('tuplet') and idx in (0,total-1):sub(notations(),'tuplet',type='start' if idx==0 else 'stop',number='1',bracket='yes')
 if e.get('label'):sub(sub(n,'lyric'),'text',e['label'])
 return v

def export(id,title,r,grand=None):
 root=ET.Element('score-partwise',version='4.0');sub(sub(root,'work'),'work-title',title);sub(sub(root,'identification'),'creator','Latin Music Mastery',type='composer')
 pl=sub(root,'part-list');sp=sub(pl,'score-part',id='P1');sub(sp,'part-name','Solfeo Aplicado');part=sub(root,'part',id='P1')
 obj={'schemaVersion':'2.0','id':id,'title':{'es':title},'meter':r.get('meter'),'keyFifths':r.get('key',0),'clef':r.get('clef','G'),'quarterNoteDivisions':DIV,'tempo':None,'videoSync':None,'events':[],'notation':copy.deepcopy(r)}
 onset=Fraction(0);idx=0;bars=r.get('bars') or [r['events']];total=sum(map(len,bars))
 for bi,events in enumerate(bars):
  m=sub(part,'measure',number=str(bi+1),**({'implicit':'yes'} if r.get('pickup') and bi==0 else {}))
  if bi==0:
   attrs(m,r,bool(grand))
   if r.get('tempo'):direction(m,words=r['tempo'])
   if r.get('hairpin'):direction(m,wedge='crescendo' if r['hairpin']=='cresc' else 'diminuendo')
  start=onset
  for e in events:
   v=addnote(m,e,r,idx,total,1 if grand else None)
   obj['events'].append(dict(id=f'{id}.n{idx+1}',onsetBeats=str(onset),durationBeats=str(v),measure=bi+1,staff=1,**e));onset+=v;idx+=1
  if grand:
   sub(sub(m,'backup'),'duration',int((onset-start)*DIV));lo=start
   for j,e in enumerate(grand[bi]):
    v=addnote(m,e,r,j,len(grand[bi]),2);obj['events'].append(dict(id=f'{id}.lower{bi}-{j}',onsetBeats=str(lo),durationBeats=str(v),measure=bi+1,staff=2,**e));lo+=v
   assert lo==onset
  if r.get('hairpin') and bi==len(bars)-1:direction(m,wedge='stop')
 ET.indent(root);xml=ET.tostring(root,encoding='utf-8',xml_declaration=True)
 (OUT/f'{id}.musicxml').write_bytes(xml);(OUT/f'{id}.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2))
 with zipfile.ZipFile(OUT/f'{id}.mxl','w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('META-INF/container.xml','<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>');z.writestr('score.musicxml',xml)
 manifest.append(dict(id=id,title=title,musicxml=f'{id}.musicxml',mxl=f'{id}.mxl',json=f'{id}.json'))
for page in DATA['pages']:
 seq=0
 for b in page.get('blocks',[]):
  if b.get('kind')=='score':
   for r in b['rows']:
    seq+=1;export(f'{page["id"]}-{seq:02}',r.get('title',page['title']),r)
  elif b.get('kind')=='grand':
   seq+=1;d=b.get('dur',1);bars=[[dict(pitch=n,dur=d)] for n in b['upper']];lower=[[dict(pitch=n,dur=d)] for n in b['lower']]
   if not b.get('bars'):bars=[sum(bars,[])];lower=[sum(lower,[])]
   export(f'{page["id"]}-{seq:02}',page['title'],dict(bars=bars,meter='4/4' if b.get('meter') else None),lower)
  elif b.get('kind')=='keys':
   for r in b['rows']:
    seq+=1;export(f'{page["id"]}-{seq:02}',r['title'],dict(key=r['key'],events=[dict(pitch=r['tonic'],dur=1)]))
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(len(manifest),'editable scores')

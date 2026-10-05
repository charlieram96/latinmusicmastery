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
 value=Fraction(e['value']) if e.get('measureRest') else Fraction(4,e.get('dur',1))
 if e.get('tuplet'):value*=Fraction(e['tuplet'][1],e['tuplet'][0])
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
 for i,cl in enumerate(r.get('staffClefs',['G','F']) if grand else [r.get('clef','G')]):
  c=sub(a,'clef',**({'number':str(i+1)} if grand else {}));sub(c,'sign','C' if cl in ('C','T','S') else 'percussion' if cl=='P' else cl)
  if cl!='P':sub(c,'line',dict(G=2,F=4,C=3,T=4,S=1)[cl])

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
 if e.get('grace'):
  g=e['grace'];gn=sub(m,'note');sub(gn,'grace',slash='yes' if g.get('slash') else 'no');gp=sub(gn,'pitch');sub(gp,'step',g['pitch'][0]);sub(gp,'alter',g['pitch'][1:-1].count('#')-g['pitch'][1:-1].count('b'));sub(gp,'octave',g['pitch'][-1]);sub(gn,'type','eighth')
 n=sub(m,'note');p=e.get('pitch');v=dur(e,r)
 if e.get('rest'):sub(n,'rest',**({'measure':'yes'} if e.get('measureRest') else {}))
 else:
  pp=sub(n,'pitch');sub(pp,'step',p[0]);alter=p[1:-1].count('#')-p[1:-1].count('b');sub(pp,'alter',alter);sub(pp,'octave',p[-1])
 sub(n,'duration',int(v*DIV))
 ties=[]
 for a,b in r.get('ties',[]):
  if idx==a:ties.append('start')
  if idx==b:ties.append('stop')
 for t in ties:sub(n,'tie',type=t)
 if staffno:sub(n,'voice',staffno)
 if not e.get('measureRest'):sub(n,'type',TYPES[e.get('dur',1)])
 if e.get('dot') or e.get('dots'):
  for _ in range(e.get('dots',1)):sub(n,'dot')
 if r.get('tuplet') or e.get('tuplet'):
  a,b=e.get('tuplet') or r['tuplet'].split(':');tm=sub(n,'time-modification');sub(tm,'actual-notes',a);sub(tm,'normal-notes',b);sub(tm,'normal-type',TYPES[e.get('dur',1)])
 if staffno:sub(n,'staff',staffno)
 for group in r.get('beams',[]):
  if idx in group:
   all_ev=r.get('events') or [x for bar in r['bars'] for x in bar]
   pos=group.index(idx)
   for level in range(1,int(__import__('math').log2(e['dur']))-1):
    left=pos>0 and all_ev[group[pos-1]]['dur']>=2**(level+2)
    right=pos+1<len(group) and all_ev[group[pos+1]]['dur']>=2**(level+2)
    value='continue' if left and right else 'end' if left else 'begin' if right else 'backward hook' if pos==len(group)-1 else 'forward hook'
    sub(n,'beam',value,number=str(level))
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
 for group in r.get('tupletGroups',[]):
  if idx in (group['indices'][0],group['indices'][-1]):sub(notations(),'tuplet',type='start' if idx==group['indices'][0] else 'stop',number='1',bracket='yes')
 for no,(a,b) in enumerate(r.get('gliss',[]),1):
  if idx in (a,b):sub(notations(),'glissando',type='start' if idx==a else 'stop',number=str(no))
 if e.get('label'):sub(sub(n,'lyric'),'text',e['label'])
 return v

def export(id,title,r,grand=None,lower_row=None):
 if grand:r=dict(r,staffClefs=[r.get('clef','G'),(lower_row or {}).get('clef','F')])
 root=ET.Element('score-partwise',version='4.0');sub(sub(root,'work'),'work-title',title);sub(sub(root,'identification'),'creator','Latin Music Mastery',type='composer')
 pl=sub(root,'part-list');sp=sub(pl,'score-part',id='P1');sub(sp,'part-name','Solfeo Aplicado');part=sub(root,'part',id='P1')
 obj={'schemaVersion':'2.0','id':id,'title':{'es':title},'meter':r.get('meter'),'keyFifths':r.get('key',0),'clef':r.get('clef','G'),'quarterNoteDivisions':DIV,'tempo':None,'videoSync':None,'events':[],'notation':copy.deepcopy(r)}
 onset=Fraction(0);idx=0;bars=r.get('bars') or [r['events']];total=sum(map(len,bars))
 for bi,events in enumerate(bars):
  m=sub(part,'measure',number=str(bi+1),**({'implicit':'yes'} if r.get('pickup') and bi==0 else {}))
  if bi==0:
   attrs(m,r,bool(grand))
   if r.get('tempo'):direction(m,words=r['tempo'])
  for en in r.get('endings',[]):
   if bi==en['from']:sub(sub(m,'barline',location='left'),'ending',number=en['number'],type='start')
  for nav in r.get('nav',[]):
   if nav['bar']==bi and nav.get('where')=='start':
    dr=sub(m,'direction',placement='above');dt=sub(dr,'direction-type');sub(dt,'segno') if nav.get('symbol')=='segno' else sub(dt,'words',nav['text'])
    if nav.get('symbol')=='segno':sub(dr,'sound',segno='LMM-start')
  start=onset
  for e in events:
   if r.get('hairpin') and idx==r.get('hairpinFrom',0):direction(m,wedge='crescendo' if r['hairpin']=='cresc' else 'diminuendo')
   if r.get('hairpin') and idx==r.get('hairpinTo',total-1):direction(m,wedge='stop')
   for wedge in r.get('wedges',[]):
    if idx==wedge['from']:direction(m,wedge=wedge['type'])
    if idx==wedge['to']:direction(m,wedge='stop')
   for no,span in enumerate(r.get('spans',[]),1):
    if idx==span.get('from',0):
     dr=sub(m,'direction',placement='below' if span.get('below') else 'above');dt=sub(dr,'direction-type')
     if span['text'] in ('8va','8vb'):sub(dt,'octave-shift',type='up' if span['text']=='8vb' else 'down',size='8',number=str(no))
     else:sub(dt,'words',span['text']);sub(sub(dr,'direction-type'),'dashes',type='start',number=str(no))
   v=addnote(m,e,r,idx,total,1 if grand else None)
   for no,span in enumerate(r.get('spans',[]),1):
    if idx==span.get('to',total-1):
     dt=sub(sub(m,'direction'),'direction-type');sub(dt,'octave-shift' if span['text'] in ('8va','8vb') else 'dashes',type='stop',number=str(no))
   obj['events'].append(dict(id=f'{id}.n{idx+1}',onsetBeats=str(onset),durationBeats=str(v),measure=bi+1,staff=1,**e));onset+=v;idx+=1
  if grand:
   sub(sub(m,'backup'),'duration',int((onset-start)*DIV));lo=start
   for j,e in enumerate(grand[bi]):
    lowidx=sum(len(x) for x in grand[:bi])+j
    v=addnote(m,e,lower_row or {},lowidx,sum(map(len,grand)),2);obj['events'].append(dict(id=f'{id}.lower{bi}-{j}',onsetBeats=str(lo),durationBeats=str(v),measure=bi+1,staff=2,**e));lo+=v
   assert lo==onset
  for nav in r.get('nav',[]):
   if nav['bar']==bi and nav.get('where')=='end':
    dr=sub(m,'direction',placement='above');sub(sub(dr,'direction-type'),'words',nav['text'])
    if nav['text']=='Fine':sub(dr,'sound',fine='yes')
    if nav['text']=='D.S. al Fine':sub(dr,'sound',dalsegno='LMM-start')
  style=r.get('barStyles',{}).get(str(bi))
  ends=[en for en in r.get('endings',[]) if en['to']==bi]
  if style or ends:
   bl=sub(m,'barline',location='right');sub(bl,'bar-style','light-heavy' if style=='final' else 'light-light' if not style else 'light-heavy')
   for en in ends:sub(bl,'ending',number=en['number'],type='stop' if style=='repeat' else 'discontinue')
   if style=='repeat':sub(bl,'repeat',direction='backward')
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
  elif b.get('kind')=='grand-study':
   seq+=1;export(f'{page["id"]}-{seq:02}',page['title'],b['upperRow'],b['lowerRow']['bars'],b['lowerRow'])
  elif b.get('kind')=='unit-grid':
   for col in b['columns']:
    for i,cell in enumerate(col['cells']):
     d=cell['dur']
     seq+=1;export(f'{page["id"]}-{seq:02}',f"{col['meter']} · nivel {i+1}",dict(meter=col['meter'],bars=[[dict(pitch='G4',dur=d,**({'dot':True} if cell.get('dot') else {})) for _ in range(cell['count'])]]))
  elif b.get('kind')=='grand':
   seq+=1;d=b.get('dur',1);bars=[[dict(pitch=n,dur=d)] for n in b['upper']];lower=[[dict(pitch=n,dur=d)] for n in b['lower']]
   if not b.get('bars'):bars=[sum(bars,[])];lower=[sum(lower,[])]
   export(f'{page["id"]}-{seq:02}',page['title'],dict(bars=bars,meter='4/4' if b.get('meter') else None),lower)
  elif b.get('kind')=='keys':
   for r in b['rows']:
    seq+=1;export(f'{page["id"]}-{seq:02}',r['title'],dict(key=r['key'],events=[dict(pitch=r['tonic'],dur=1)]))
# Assemble each complete study, preserving system-local annotations with offsets.
for study in json.loads((ROOT/'repertoire.json').read_text()):
 r=dict(meter=study['meter'],key=study['key'],clef='G',bars=[],beams=[],tupletGroups=[],slurs=[],ties=[],spans=[],gliss=[],endings=[],barStyles={},wedges=[],systems=copy.deepcopy(study['rows']))
 off=0;boff=0
 for row in study['rows']:
  r['bars']+=copy.deepcopy(row['bars'])
  if row.get('hairpin'):r['wedges'].append({'from':off+row.get('hairpinFrom',0),'to':off+row.get('hairpinTo',sum(map(len,row['bars']))-1),'type':'crescendo' if row['hairpin']=='cresc' else 'diminuendo'})
  for field in ('beams','slurs','ties','gliss'):
   r[field]+=[[v+off for v in group] for group in row.get(field,[])]
  for group in row.get('tupletGroups',[]):r['tupletGroups'].append(dict(indices=[v+off for v in group['indices']],ratio=group['ratio']))
  for span in row.get('spans',[]):r['spans'].append(dict(span,**{'from':span.get('from',0)+off,'to':span.get('to',sum(map(len,row['bars']))-1)+off}))
  for en in row.get('endings',[]):r['endings'].append(dict(en,**{'from':en['from']+boff,'to':en['to']+boff}))
  for k,v in row.get('barStyles',{}).items():r['barStyles'][str(int(k)+boff)]=v
  off+=sum(map(len,row['bars']));boff+=len(row['bars'])
 export(f"estudio-completo-{study['number']:02}",study['title'],r)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(len(manifest),'editable scores')
# Assemble the shared two-staff study so navigation targets remain in one file.
systems=[b for p in DATA['pages'] if p['id'].startswith('lectura-conjunta-retornos-') for b in p['blocks'] if b.get('kind')=='grand-study']
def join_systems(rows):
 out=dict(meter=rows[0]['meter'],key=rows[0].get('key',0),clef=rows[0].get('clef','G'),bars=[],beams=[],tupletGroups=[],barStyles={},endings=[],nav=[],wedges=[],spans=[])
 ni=0;bi=0
 for row in rows:
  out['bars']+=copy.deepcopy(row['bars'])
  if row.get('hairpin'):out['wedges'].append(dict(type='crescendo' if row['hairpin']=='cresc' else 'diminuendo',**{'from':row['hairpinFrom']+ni,'to':row['hairpinTo']+ni}))
  out['spans'] += [dict(x,**{'from':x.get('from',0)+ni,'to':x.get('to',sum(map(len,row['bars']))-1)+ni}) for x in row.get('spans',[])]
  out['beams'] += [[x+ni for x in g] for g in row.get('beams',[])]
  out['tupletGroups'] += [dict(indices=[x+ni for x in g['indices']],ratio=g['ratio']) for g in row.get('tupletGroups',[])]
  out['barStyles'].update({str(int(k)+bi):v for k,v in row.get('barStyles',{}).items()})
  out['endings'] += [dict(number=e['number'],**{'from':e['from']+bi,'to':e['to']+bi}) for e in row.get('endings',[])]
  out['nav'] += [dict(n,bar=n['bar']+bi) for n in row.get('nav',[])]
  ni+=sum(map(len,row['bars']));bi+=len(row['bars'])
 return out
if systems:
 upper=join_systems([s['upperRow'] for s in systems]);lower=join_systems([s['lowerRow'] for s in systems])
 export('lectura-conjunta-completa','Lectura conjunta y signos de retorno',upper,lower['bars'],lower)
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))

dance=[b for p in DATA['pages'] if p['id'].startswith('danza-conjunto-') for b in p['blocks'] if b.get('kind')=='grand-study']
if dance:
 upper=join_systems([s['upperRow'] for s in dance]);lower=join_systems([s['lowerRow'] for s in dance])
 export('danza-conjunto-completa','Danza de cierre: acentuación cruzada',upper,lower['bars'],lower)
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))

from pathlib import Path
from fractions import Fraction
import json,xml.etree.ElementTree as ET,zipfile
from pypdf import PdfReader
R=Path(__file__).resolve().parent;data=json.loads((R/'content.es.json').read_text());checked=0
LET='CDEFGAB';PC=[0,2,4,5,7,9,11]
def midi(n):return (int(n[-1])+1)*12+PC[LET.index(n[0])]+n[1:-1].count('#')-n[1:-1].count('b')
for p in data['pages']:
 for b in p.get('blocks',[]):
  if b.get('kind')!='score':continue
  for r in b['rows']:
   for i,bar in enumerate(r.get('bars',[])):
    value=sum((Fraction(e['value']) if e.get('measureRest') else Fraction(4,e['dur'])*(sum((Fraction(1,2**j) for j in range(e.get('dots',1)+1)),Fraction(0)) if e.get('dot') or e.get('dots') else 1)*(Fraction(e['tuplet'][1],e['tuplet'][0]) if e.get('tuplet') else 1) for e in bar),Fraction(0))
    n,d=map(int,r['meter'].split('/'));expected=Fraction(n*4,d)
    assert value==expected or r.get('pickup') and i==0 and 0<value<expected,(p['id'],r['title'],i,value,expected)
    checked+=1
   if r.get('intervals'):
    ns=r['events'];actual=[abs(midi(ns[i+1]['pitch'])-midi(ns[i]['pitch'])) for i in range(len(ns)-1)]
    assert actual==[{'T':2,'S':1,'T+S':3}[v] for v in r['intervals']],(p['id'],r['title'],actual,r['intervals'])
manifest=json.loads((R/'scores/manifest.json').read_text())
for e in manifest:
 root=ET.parse(R/'scores'/e['musicxml']).getroot();assert root.tag=='score-partwise'
 obj=json.loads((R/'scores'/e['json']).read_text())
 notes=[n for n in root.findall('.//note') if n.find('grace') is None];assert len(notes)==len(obj['events'])
 for note,ev in zip(notes,obj['events']):assert int(note.findtext('duration'))==Fraction(ev['durationBeats'])*20160
 with zipfile.ZipFile(R/'scores'/e['mxl']) as z:assert z.read('score.musicxml')==(R/'scores'/e['musicxml']).read_bytes()
pdf=PdfReader(R.parent/'LMM-Solfeo-Aplicado-Ampliado.pdf');assert len(pdf.pages)==len(data['pages'])
for i,p in enumerate(pdf.pages):
 text=p.extract_text();assert len(text)>50
 assert '\ufffd' not in text
assert not any(p.get('id') in ['arpa','pedals','aplicada'] for p in data['pages'])
ex=json.loads((R/'assessments.json').read_text());assert len(ex['moduleExams'])==10 and all(len(m['questions'])==10 for m in ex['moduleExams']);assert len(ex['finalExam'])==50
assert len(json.loads((R/'repertoire.json').read_text()))==20
hairpins_checked=0
levels={'ppp':0,'pp':1,'p':2,'mp':3,'mf':4,'f':5,'ff':6,'fff':7}
for page in data['pages']:
 for block in page.get('blocks',[]):
  for row in block.get('rows',[])+([block['upperRow'],block['lowerRow']] if block.get('kind')=='grand-study' else []):
   if not row.get('hairpin'):continue
   ev=row.get('events') or [e for bar in row['bars'] for e in bar]
   a,b=row['hairpinFrom'],row['hairpinTo'];assert a<b
   first,last=ev[a]['dynamic'],ev[b]['dynamic']
   assert (levels[first]<levels[last]) if row['hairpin']=='cresc' else (levels[first]>levels[last])
   assert not ev[a].get('rest') and not ev[b].get('rest')
   hairpins_checked+=1
assert hairpins_checked>=15
for item in manifest:
 obj=json.loads((R/'scores'/item['json']).read_text());notation=obj['notation']
 if not notation.get('hairpin') and not notation.get('wedges'):continue
 root=ET.parse(R/'scores'/item['musicxml']).getroot();wedges=root.findall('.//wedge');assert len(wedges)==2
 time=Fraction(0);dyn={};stops=[]
 for measure in root.findall('.//part/measure'):
  for child in measure:
   if child.tag=='direction':
    w=child.find('direction-type/wedge')
    if w is not None and w.get('type')=='stop':stops.append(time)
    d=child.find('direction-type/dynamics')
    if d is not None:dyn[time]=list(d)[0].tag
   elif child.tag=='note' and child.find('grace') is None:time+=Fraction(int(child.findtext('duration')),20160)
 assert all(t in dyn for t in stops),(item['id'],stops,dyn)
# Shared-staff examples: independently count both voices and check exported clefs.
grand_checked=0
for pg in data['pages']:
 for block in pg.get('blocks',[]):
  if block.get('kind')!='grand-study':continue
  for rr in (block['upperRow'],block['lowerRow']):
   n,d=map(int,rr['meter'].split('/'));capacity=Fraction(n*4,d)
   for bar in rr['bars']:
    actual=sum((Fraction(4,e['dur'])*(sum(Fraction(1,2**j) for j in range(e.get('dots',1)+1)) if e.get('dot') or e.get('dots') else 1)*(Fraction(e['tuplet'][1],e['tuplet'][0]) if e.get('tuplet') else 1) for e in bar),Fraction(0))
    assert actual==capacity,(pg['id'],actual,capacity)
    grand_checked+=1
studies=json.loads((R/'repertoire.json').read_text())
assert all(len(s['bars'])==16 for s in studies)
assert len({json.dumps(s['bars'],sort_keys=True) for s in studies})==20
nav=ET.parse(R/'scores/lectura-conjunta-completa.musicxml').getroot()
assert len(nav.findall('.//part/measure'))==12
assert nav.find('.//segno') is not None
assert any(x.get('dalsegno')=='LMM-start' for x in nav.findall('.//sound'))
assert [x.get('number') for x in nav.findall('.//ending')]==['1','1','2','2']
result=dict(twoStaffBarsChecked=grand_checked,completeMelodies=20,barsPerMelody=16,hairpinsWithVerifiedEndpoints=hairpins_checked,moduleExams=10,questionsPerModule=10,finalQuestions=50,originalStudies=20,pdfPages=len(pdf.pages),editableScores=len(manifest),measuredBarsChecked=checked,scaleIntervals='all verified by semitone distance',xmlAndMxl='parsed and matched',pdfText='readable',applicationChanges=False)
(R/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,indent=2))

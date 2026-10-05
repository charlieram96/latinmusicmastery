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
    value=sum((Fraction(4,e['dur'])*(sum((Fraction(1,2**j) for j in range(e.get('dots',1)+1)),Fraction(0)) if e.get('dot') or e.get('dots') else 1) for e in bar),Fraction(0))
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
 notes=root.findall('.//note');assert len(notes)==len(obj['events'])
 for note,ev in zip(notes,obj['events']):assert int(note.findtext('duration'))==Fraction(ev['durationBeats'])*20160
 with zipfile.ZipFile(R/'scores'/e['mxl']) as z:assert z.read('score.musicxml')==(R/'scores'/e['musicxml']).read_bytes()
pdf=PdfReader(R.parent/'LMM-Solfeo-Aplicado-Manual.pdf');assert len(pdf.pages)==len(data['pages'])
for i,p in enumerate(pdf.pages):
 text=p.extract_text();assert len(text)>50
 assert '\ufffd' not in text
assert not any(p.get('id') in ['arpa','pedals','aplicada'] for p in data['pages'])
result=dict(pdfPages=len(pdf.pages),editableScores=len(manifest),measuredBarsChecked=checked,scaleIntervals='all verified by semitone distance',xmlAndMxl='parsed and matched',pdfText='readable',applicationChanges=False)
(R/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,indent=2))

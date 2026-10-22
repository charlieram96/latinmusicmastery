"""Install the six supplied Eslava lessons, preserving their authored notation.
Edit references/eslava/lessons-1-6.json to revise the transcription; reruns replace
only this supplement. The reference PDF is retained for future comparisons.
"""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[2];O=R/'local-artifacts/solfeo-course/book-audit';REF=R/'local-artifacts/solfeo-course/references/eslava';tag='supplement-20261008-redonda-blanca'
s=R/'scripts/solfeo/build-module-one-book.py';ns={'__file__':str(s)}
loader=s.read_text().split("pages=ns['DATA']['pages'];lessons=[]")[0]
# Dense historical systems need less inter-bar padding so half-note heads stay separate.
loader=loader.replace("ns={'__file__'", "code=code.replace('pad=7;usable=bw-(18','pad=4;usable=bw-(10')\nns={'__file__'")
exec(compile(loader,str(s),'exec'),ns)
bpath=O/'local-solfeo-m02-c05.json';book=json.loads(bpath.read_text());source=json.loads((REF/'lessons-1-6.json').read_text());enpath=R/'lib/solfeo/book-en.json';en=json.loads(enpath.read_text())
def mini(kind):
 # Engrave the small un-cleffed examples that are embedded in the original prose.
 c=ns['SVGCanvas'](48);d=ns['ns'];d['c']=c;c.setStrokeColor(d['INK']);c.setFillColor(d['INK']);c.setLineWidth(.5)
 for y in [10,16,22,28,34]:c.line(2,y,116,y)
 if kind=='rest1':d['glyph'](0xe4e3,53,28,24)
 elif kind=='rest2':d['glyph'](0xe4e4,53,22,24)
 else:
  dur=2 if kind=='halves' else 1
  for x in [29,80]:d['note']('G4',x,10,'G',dur,6,acc=False)
  if kind=='tie':c.line(59,10,59,34);d['curve'](41,11,78,11,8)
 return '<svg aria-label="'+{'rest1':'Silencio de redonda','rest2':'Silencio de blanca','halves':'Dos blancas','tie':'Dos redondas ligadas'}[kind]+'" role="img" viewBox="0 0 120 48" style="display:inline-block;width:100px;height:40px;vertical-align:middle;color:inherit">'+''.join(c.elements)+'</svg>'
def textblock(pair):
 es,eng=pair
 for k in ['rest1','rest2','halves','tie']:
  es=es.replace('{'+k+'}',mini(k));eng=eng.replace('{'+k+'}',mini(k))
 en[es]=eng
 return {'type':'p','text':es,'supplementId':tag}
def figure(lesson):
 rows=[]
 for i,raw in enumerate(lesson['systems']):
  row={**raw,'space':6.8,'topOffset':52,'meter':'2/2','meterSymbol':'cut','title':''}
  if lesson['number']==1 and i==0:row['tempo']='(1)'
  # The continuation line in the supplied sheet repeats the clef, not the meter.
  if i:row['hideMeter']=True
  if i==len(lesson['systems'])-1:row['barStyles']={str(len(row['bars'])-1):'final'}
  rows.append(row)
 block={'type':'diagram','kind':'score','rows':rows,'height':115*len(rows),'rowHeights':[115]*len(rows),'supplementId':tag,'_sourcePage':tag+'-'+str(lesson['number'])}
 # Hide the repeated meter only in engraving; retain 2/2 for the audio clock.
 visual=json.loads(json.dumps(block))
 for row in visual['rows']:
  if row.get('hideMeter'):row.pop('meter');row.pop('meterSymbol')
 block['vector']=ns['vector'](visual)
 return block
practice=[]
for lesson in source['lessons']:
 title='LECCIÓN '+str(lesson['number']);en[title]='LESSON '+str(lesson['number'])
 blocks=[{'type':'h','text':title,'supplementId':tag},figure(lesson)]
 if lesson.get('after'):blocks.append(textblock(lesson['after']))
 practice.append({'title':title,'blocks':blocks,'supplementId':tag,'sourceLesson':lesson['number']})
# The supplied numbered material belongs in Lesson, as requested.
packed=[]
for i in range(0,len(practice),2):
 pair=practice[i:i+2];title='LECCIONES '+str(i+1)+'–'+str(i+2);en[title]='LESSONS '+str(i+1)+'–'+str(i+2)
 packed.append({'title':title,'layout':'source-sections','blocks':[b for p in pair for b in p['blocks']],'supplementId':tag,'sourceLessons':[i+1,i+2]})
book['pages']=[p for p in book['pages']if p.get('supplementId')!=tag]+packed
book['practice']=[p for p in book['practice']if p.get('supplementId')!=tag]
book['vectors'].update(ns['assets'])
book.setdefault('supplements',{})[tag]={'source':'../references/eslava/hoja-usuario-1-6.png','verificationReference':'../references/eslava/A3420041-1898.pdf','editableSource':'../references/eslava/lessons-1-6.json','status':'six-numbered-lessons-transcribed','placement':'module 2 lesson 2.5; Lesson pages 4–6','referenceUrl':'https://archive.org/details/A3420041','note':'User screenshot controls wording and numbering; public-domain reference pp. 3–4 used to resolve staff positions. No substitute demonstration melodies.'}
bpath.write_text(json.dumps(book,ensure_ascii=False,separators=(',',':'))+'\n');enpath.write_text(json.dumps(en,ensure_ascii=False,indent=2)+'\n')
print('Installed original lessons 1–6 in module 2, class 2.5, Lesson pages 4–6')

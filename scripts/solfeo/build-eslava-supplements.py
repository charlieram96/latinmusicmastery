"""Rebuild retained Eslava transcriptions as editable, bilingual lesson pages.
Source tokens: C4=0 diatonic; w/h/q/e/s=whole/half/quarter/eighth/sixteenth;
.=dot, '=breath, ~=tie forward, !=fermata; #/b/n=written accidental.
"""
from pathlib import Path
import json,re,copy
R=Path(__file__).resolve().parents[2];REF=R/'local-artifacts/solfeo-course/references/eslava';OUT=R/'local-artifacts/solfeo-course/book-audit'
def read_scores():
 scores={};current=None
 for line in (REF/'intervals-transcription.txt').read_text().splitlines():
  if not line or line.startswith('#'):continue
  if line.startswith('@'):
   n,title=line[1:].split(' ',1);current={'number':int(n),'title':title,'systems':[]};scores[int(n)]=current;continue
  bars=[]
  for bar in line.split('|'):
   events=[]
   for token in bar.split():
    m=re.fullmatch(r"(-?\d+|R)([#bn]*)([whqes]?)([.'~!]*)",token)
    if not m:raise ValueError(token)
    step,acc,dur,marks=m.groups();e={'dur':{'w':1,'h':2,'q':4,'e':8,'s':16,'':4}[dur]}
    if step=='R':e['rest']=True
    else:
     d=int(step);e['pitch']='CDEFGAB'[d%7]+acc+str(4+d//7)
     if acc:e['showAcc']=True
    if '.' in marks:e['dot']=True
    if "'" in marks:e['breath']=True
    if '~' in marks:e['tieForward']=True
    if '!' in marks:e['mark']='fermata'
    events.append(e)
   length=sum(4/e['dur']*(1.5 if e.get('dot') else 1)for e in events)
   if length!=4:raise ValueError(f'Lesson {current["number"]}, bar {bar}: {length} beats')
   bars.append(events)
  current['systems'].append({'bars':bars})
 # The supplied Lesson 50 is the notated rhythmic reduction of Lesson 34.
 reduced=[];pending=[]
 for system in scores[34]['systems']:
  for bar in system['bars']:
   half=copy.deepcopy(bar)
   for e in half:e['dur']*=2
   pending+=half
   if sum(4/e['dur']*(1.5 if e.get('dot')else 1)for e in pending)==4:
    reduced.append(pending);pending=[]
 if pending:reduced.append(pending+[{'rest':True,'dur':2}])
 scores[50]={'number':50,'title':'Reducción de la Lección 34','systems':[{'bars':reduced}]}
 return scores
if __name__=='__main__':
 scores=read_scores();print({n:sum(len(s['bars'])for s in l['systems']) for n,l in scores.items()})
 (REF/'lessons-11-onwards.json').write_text(json.dumps({'lessons':list(scores.values())},ensure_ascii=False,indent=2)+'\n')

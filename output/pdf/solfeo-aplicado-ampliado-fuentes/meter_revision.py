"""Give duration-bearing musical examples explicit, complete measures."""
def value(e):
 v=Fraction(4,e.get('dur',1))
 if e.get('dots') or e.get('dot'):v*=sum((Fraction(1,2**j) for j in range(e.get('dots',1)+1)),Fraction(0))
 if e.get('tuplet'):v*=Fraction(e['tuplet'][1],e['tuplet'][0])
 return v
for p in pages:
 # These are figure-identification illustrations, before measured reading.
 if p['id'] in ('taller-1','examen-m01','examen-final-1'):continue
 for b in p.get('blocks',[]):
  if b.get('kind')!='score':continue
  for rr in b['rows']:
   events=rr.get('events')
   if not events or not any(e.get('dur',1)!=1 for e in events):continue
   if p['id']=='unidades' or p['id']=='compuestos':
    # Each column demonstrates an equivalence, not a sequential melody.
    meter='6/8' if p['id']=='compuestos' else rr['title'].split(':')[0]
    num,den=map(int,meter.split('/'));cap=Fraction(4*num,den);bars=[]
    for e in events:
     count=cap/value(e);assert count.denominator==1
     bars.append([copy.deepcopy(e) for _ in range(int(count))])
    rr.pop('events');rr['bars']=bars;rr['meter']=meter
    rr['title']+=' · compases equivalentes'
    continue
   total=sum(map(value,events),Fraction(0))
   if rr.get('tuplet'):
    a,normal=map(int,rr.pop('tuplet').split(':'))
    for e in events:e['tuplet']=[a,normal]
    rr['tupletGroups']=[dict(indices=list(range(len(events))),ratio=[a,normal])]
    total=sum(map(value,events),Fraction(0))
   meter={Fraction(3,2):'3/8',Fraction(2):'2/4',Fraction(3):'3/4'}.get(total,'4/4')
   if total==3 and any(e.get('tuplet') for e in events):meter='6/8'
   num,den=map(int,meter.split('/'));cap=Fraction(4*num,den)
   bars=[];bar=[];used=Fraction(0)
   for e in events:
    v=value(e)
    assert used+v<=cap,(p['id'],rr['title'],used,v)
    bar.append(e);used+=v
    if used==cap:bars.append(bar);bar=[];used=Fraction(0)
   if bar:
    missing=cap-used
    if len(bar)==1 and bar[0].get('dur')==2 and missing==2:
     bar[0]['dur']=1
    else:
     for dur in [1,2,4,8,16,32,64,128,256]:
      while missing>=Fraction(4,dur):bar.append(dict(rest=True,dur=dur));missing-=Fraction(4,dur)
     assert missing==0
    bars.append(bar)
   rr.pop('events');rr['bars']=bars;rr['meter']=meter;rr['barStyles']={str(len(bars)-1):'final'}

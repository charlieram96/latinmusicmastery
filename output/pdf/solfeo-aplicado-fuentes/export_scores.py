"""Export editable MusicXML and semantic JSON from the PDF's pitch/rhythm data."""
from pathlib import Path
import json,xml.etree.ElementTree as ET,zipfile
from fractions import Fraction
ROOT=Path(__file__).resolve().parent; OUT=ROOT/'scores'; OUT.mkdir(exist_ok=True)
data=json.loads((ROOT/'content.es.json').read_text()); manifest=[]
TYPES={1:'whole',2:'half',4:'quarter',8:'eighth',16:'16th',32:'32nd',64:'64th',128:'128th',256:'256th'}
def sub(parent,name,text=None,**attrs):
    e=ET.SubElement(parent,name,attrs)
    if text is not None:e.text=str(text)
    return e

def export(id,title,events,clef='G',free=False):
    # Standalone rows are free-time reference sequences; measured rhythms retain 4/4.
    obj={'id':id,'title':{'es':title},'schemaVersion':'1.0','timeUnit':'quarter-note','meter':None if free else [4,4],'clef':clef,'tempo':None,'videoSync':None,'events':[]}
    root=ET.Element('score-partwise',version='4.0'); work=sub(root,'work'); sub(work,'work-title',title)
    ident=sub(root,'identification'); sub(ident,'creator','Latin Music Mastery',type='composer')
    pl=sub(root,'part-list'); sp=sub(pl,'score-part',id='P1');sub(sp,'part-name','LMM')
    part=sub(root,'part',id='P1'); current=None; used=0; idx=0; onset=Fraction(0)
    for e in events:
        dur=e.get('duration',4); value=Fraction(4,dur)*Fraction(e.get('normal',1),e.get('actual',1))
        if current is None or (not free and used==4):
            idx+=1; current=sub(part,'measure',number=str(idx)); used=0
            if idx==1:
                att=sub(current,'attributes'); sub(att,'divisions',6720)
                t=sub(att,'time')
                if free: sub(t,'senza-misura')
                else: sub(t,'beats',4);sub(t,'beat-type',4)
                cl=sub(att,'clef');sub(cl,'sign','percussion' if clef=='P' else 'C' if clef in ('C','T') else clef)
                if clef!='P':sub(cl,'line',{'G':2,'F':4,'C':3,'T':4}[clef])
        n=sub(current,'note'); pitch=e.get('pitch'); ev={'id':f'{id}.N{len(obj["events"])+1:03d}','onsetBeats':str(onset),'durationBeats':str(value),'measure':idx}
        if not pitch or e.get('rest'):sub(n,'rest');ev['kind']='rest'
        elif clef=='P':
            un=sub(n,'unpitched');sub(un,'display-step',pitch[0]);sub(un,'display-octave',pitch[-1]);ev.update(kind='unpitched',staffPosition=pitch)
        else:
            pp=sub(n,'pitch');sub(pp,'step',pitch[0]);acc=pitch[1:-1]
            if acc:sub(pp,'alter',{'#':1,'b':-1,'n':0}[acc])
            sub(pp,'octave',pitch[-1]);ev.update(kind='note',pitch=pitch)
        sub(n,'duration',int(value*6720));sub(n,'type',TYPES[dur])
        if pitch and pitch[1:-1] and clef!='P':sub(n,'accidental',{'#':'sharp','b':'flat','n':'natural'}[pitch[1:-1]])
        if e.get('actual'):
            tm=sub(n,'time-modification');sub(tm,'actual-notes',e['actual']);sub(tm,'normal-notes',e['normal']);sub(tm,'normal-type',TYPES[dur])
            ev['tuplet']={'actual':e['actual'],'normal':e['normal']}
            if e.get('tupletBoundary'):
                nt=sub(n,'notations');sub(nt,'tuplet',type=e['tupletBoundary'],number='1',bracket='yes')
        obj['events'].append(ev);onset+=value;used+=value
        if not free:assert used<=4
    ET.indent(root); xml=ET.tostring(root,encoding='utf-8',xml_declaration=True)
    (OUT/f'{id}.musicxml').write_bytes(xml);(OUT/f'{id}.json').write_text(json.dumps(obj,ensure_ascii=False,indent=2))
    container='<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>'
    with zipfile.ZipFile(OUT/f'{id}.mxl','w',zipfile.ZIP_DEFLATED) as z:z.writestr('META-INF/container.xml',container);z.writestr('score.musicxml',xml)
    manifest.append({'id':id,'title':title,'source':'content.es.json','musicxml':f'{id}.musicxml','mxl':f'{id}.mxl','json':f'{id}.json'})
for page in data['pages']:
    k=0
    for b in page.get('blocks',[]):
        if b['type']!='diagram':continue
        if b['kind']=='staves':
            for r in b['rows']:
                k+=1;export(f'{page["id"]}-{k:02d}',r.get('title') or page['title'],[{'pitch':n,'duration':r.get('duration',1)} for n in r['notes']],r.get('clef','G'),True)
        elif b['kind']=='rhythm':
            k+=1; export(f'{page["id"]}-{k:02d}',page['title'],[{**e,'pitch':'B4'} for bar in b['bars'] for e in bar],'P')
        elif b['kind']=='tuplets':
            for actual,normal in b['groups']:
                k+=1;export(f'{page["id"]}-{k:02d}',f'Grupo {actual}:{normal}',[{'pitch':'B4','duration':8,'actual':actual,'normal':normal,**({'tupletBoundary':'start'} if j==0 else {'tupletBoundary':'stop'} if j==actual-1 else {})} for j in range(actual)],'P',True)
        elif b['kind']=='intervals':
            for title,notes,_ in b['rows']:
                k+=1;export(f'{page["id"]}-{k:02d}',title,[{'pitch':n,'duration':1} for n in notes],'G',True)
# A measured starter exercise for future quizzes and synchronization.
export('LMM-practice-001','Primera lectura en Do · LMM',[{'pitch':n,'duration':4} for n in ['C4','D4','E4','G4','E4','F4','D4','C4']])
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('Exported',len(manifest),'editable scores')

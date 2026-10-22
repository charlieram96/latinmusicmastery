"""Render existing semantic notation without redrawing pitches or clefs by hand."""
from pathlib import Path
import json,io,hashlib,subprocess,os
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'output/pdf/solfeo-aplicado-ampliado-fuentes';OUT=ROOT/'public/local-course-assets/solfeo/diagrams';OUT.mkdir(parents=True,exist_ok=True)
# Load only definitions; do not execute the source book's document-writing loop.
code=(SOURCE/'render.py').read_text().split("for idx,page in enumerate(DATA['pages']):")[0]
code=code.replace('c=canvas.Canvas(str(OUT),pagesize=(W,H))','c=canvas.Canvas(io.BytesIO(),pagesize=(W,H))')
ns={'__file__':str(SOURCE/'render.py'),'io':io};exec(compile(code,str(SOURCE/'render.py'),'exec'),ns)
from reportlab.pdfgen import canvas
catalog=json.loads((ROOT/'local-artifacts/solfeo-course/production/curriculum.json').read_text())
assets={};failures=[]
def expanded_blocks(blocks):
 for block in blocks:
  yield block
  if block.get('kind')=='score':
   for i,row in enumerate(block['rows']):
    height=block.get('rowHeights',[block.get('rowHeight',120)]*len(block['rows']))[i]
    yield {**block,'rows':[row],'height':height,'rowHeights':[height]}
for lesson in catalog['lessons']:
 for block in expanded_blocks(lesson['blocks']):
  if block['type']!='diagram':continue
  payload={k:v for k,v in block.items() if k not in ('sourcePageId','_sourcePage')};key=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()[:20]
  if key in assets:continue
  target=OUT/key
  try:
   if True:
    height=max(block.get('height',160)+50,130)
    pdf=io.BytesIO();c=canvas.Canvas(pdf,pagesize=(ns['W'],height));ns['c']=c
    c.setFillColorRGB(1,1,1);c.rect(0,0,ns['W'],height,fill=1,stroke=0)
    positions=[];original_note=ns['note']
    def traced_note(*args,**kwargs):
     ny=original_note(*args,**kwargs)
     if len(args)>=3:positions.append({'pitch':args[0],'x':args[1]/ns['W'],'y':(height-ny)/height})
     return ny
    ns['note']=traced_note
    try:ns['diagram'](block,height-20)
    finally:ns['note']=original_note
    c.showPage();c.save()
    temp=Path('/private/tmp')/f'lmm-diagram-{key}.pdf';temp.write_bytes(pdf.getvalue())
    subprocess.run(['pdftoppm','-png','-singlefile','-r','150',str(temp),str(target)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    temp.unlink()
   assets[key]={'url':'/local-course-assets/solfeo/diagrams/'+key+'.png','kind':block['kind'],'positions':positions}
  except Exception as e:failures.append({'lesson':lesson['id'],'key':key,'error':str(e)})
(ROOT/'local-artifacts/solfeo-course/production/diagram-assets.json').write_text(json.dumps({'assets':assets,'failures':failures},indent=2)+'\n')
print('Rendered',len(assets),'diagrams; failures',len(failures),flush=True)
if failures:print(failures);raise SystemExit(1)

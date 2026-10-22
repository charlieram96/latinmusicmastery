"""Compile the complete verified PDF source to editable pages and SVG geometry.
This is a staging artifact: publishing to course routes requires visual/audio QA.
"""
from pathlib import Path
import runpy,json,hashlib
ROOT=Path(__file__).resolve().parents[2]
ctx=runpy.run_path(str(ROOT/'scripts/solfeo/build-module-one-book.py'))
source=ctx['pages'];vector=ctx['vector'];out=[]
for i,page in enumerate(source,1):
 if page.get('id','').startswith('toc'):continue
 blocks=[]
 for j,b in enumerate(page.get('blocks',[])):
  copy={**b,'pdfPage':i,'sourceBlock':j}
  if b['type']=='diagram':copy['vector']=vector(b)
  blocks.append(copy)
 out.append({**page,'pdfPage':i,'blocks':blocks})
result={'source':'LMM-Solfeo-Aplicado-Ampliado copy.pdf','pages':out,'vectors':ctx['assets'],'status':{'textVerified':True,'visualVerified':False,'audioVerified':False}}
p=ROOT/'local-artifacts/solfeo-course/book-audit/complete-book-editable.json';p.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print('Compiled',len(out),'pages,',len(ctx['assets']),'editable diagrams,',p.stat().st_size,'bytes')

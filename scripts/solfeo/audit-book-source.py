"""Compare every authored paragraph with its physical page in the supplied PDF.
Read-only audit: never substitutes editorial text or silently remaps a class.
"""
from pathlib import Path
from html import unescape
import json,re,unicodedata,hashlib
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2]
PDF=Path('/Volumes/ThunderBay/Latin Music Mastery/INSTRUMENTOS/Solfeo Aplicado/LMM-Solfeo-Aplicado-Ampliado copy.pdf')
SOURCE=ROOT/'output/pdf/solfeo-aplicado-ampliado-fuentes/content.es.json'
def normalize(text):
 text=unescape(re.sub(r'<[^>]+>',' ',text))
 return re.sub(r'\s+','',unicodedata.normalize('NFKC',text)).casefold()
source=json.loads(SOURCE.read_text());pdf=PdfReader(PDF)
assert len(source['pages'])==len(pdf.pages),(len(source['pages']),len(pdf.pages))
report=[];topics={};mismatches=[]
for i,(page,physical) in enumerate(zip(source['pages'],pdf.pages),1):
 actual=normalize(physical.extract_text());checks=[]
 for j,b in enumerate(page.get('blocks',[])):
  key=b.get('_sourcePage',b.get('anchor',page['id']))
  entry=topics.setdefault(key,{'id':key,'section':page.get('section'),'pages':[],'blocks':[]})
  if i not in entry['pages']:entry['pages'].append(i)
  entry['blocks'].append({'page':i,'index':j,'type':b['type'],'kind':b.get('kind'),'hash':hashlib.sha256(json.dumps(b,sort_keys=True).encode()).hexdigest()})
  if b.get('text') and b['type'] not in ['topic']:
   ok=normalize(b['text']) in actual
   item={'block':j,'topic':key,'matchesPdf':ok,'text':b['text']}
   checks.append(item)
   if not ok:mismatches.append({'page':i,**item})
 report.append({'page':i,'title':page.get('title'),'section':page.get('section'),'paragraphs':checks,'diagrams':sum(b['type']=='diagram' for b in page.get('blocks',[]))})
result={'pdf':str(PDF),'pdfSha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),'pages':report,'topics':list(topics.values()),'summary':{'pdfPages':len(pdf.pages),'checkedParagraphs':sum(len(p['paragraphs']) for p in report),'mismatches':len(mismatches),'diagrams':sum(p['diagrams'] for p in report)},'mismatches':mismatches,'visualVerification':'pending','soundVerification':'pending'}
out=ROOT/'local-artifacts/solfeo-course/book-audit/source-comparison.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result['summary'],ensure_ascii=False))
for m in mismatches[:20]:print(m['page'],m['text'][:140])

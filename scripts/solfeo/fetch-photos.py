from pathlib import Path
import urllib.request,urllib.parse,re,json
base=Path('public/local-course-assets/solfeo/photos');base.mkdir(parents=True,exist_ok=True)
assets=[]
for name,author in [('PianoKeyboard2.jpg','Raysonho @ Open Grid Scheduler / Grid Engine'),('Metronome Wittner Taktell.jpg','Benoît Prieur'),('Violin held in hands.jpg','Tomwsulcer')]:
 url='https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(name.replace(' ','_'))
 request=urllib.request.Request(url,headers={'User-Agent':'LMM-local-course-assets/1.0'})
 html=urllib.request.urlopen(request,timeout=30).read().decode()
 match=re.search(r'class="fullImageLink"[^>]*>\s*<a href="([^"]+)"',html)
 if not match:raise RuntimeError('No original image URL for '+name)
 imageurl=match.group(1)
 data=urllib.request.urlopen(urllib.request.Request(imageurl,headers={'User-Agent':'LMM-local-course-assets/1.0'}),timeout=30).read()
 dest=base/name.replace(' ','-');dest.write_bytes(data)
 assets.append({'file':'/'+str(dest.relative_to('public')),'source':url,'original':imageurl,'author':author,'license':'CC0-1.0','verified':'2026-10-06','type':'photograph'})
Path('local-artifacts/solfeo-course/production/photo-provenance.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2))
print('Downloaded',len(assets),'local photographs')

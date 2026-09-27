import base64,json,os
D=os.path.dirname(os.path.abspath(__file__)); I=os.environ.get('LMM_PHOTOS',os.path.join(D,'img'))  # teacher photos: 520px JPEGs named by teacher key (frank.jpg, patricio.jpg ...)
ph={}
for f in sorted(os.listdir(I)):
    if f.endswith('.jpg') and not f.startswith('raw'):
        ph[f[:-4]]='data:image/jpeg;base64,'+base64.b64encode(open(os.path.join(I,f),'rb').read()).decode()
css=open(os.path.join(D,'style.css')).read()+open(os.path.join(D,'pages.css')).read(); body=open(os.path.join(D,'body.html')).read(); js=open(os.path.join(D,'app.js')).read()
html=f'''<title>Latin Music Mastery</title>
<meta name="description" content="Learn Latin music from the masters.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=DM+Mono:wght@400;500&family=Hanken+Grotesk:wght@400;500;600&family=Instrument+Serif:ital@1&display=swap">
<style>{css}</style>
{body}
<script src="https://cdn.jsdelivr.net/npm/vexflow@5.0.0/build/cjs/vexflow-bravura.js"></script>
<script>window.__PHOTOS={json.dumps(ph)};</script>
<script>{js}</script>
'''
open(os.path.join(D,'lmm-landing.html'),'w').write(html)
open(os.path.join(D,'preview.html'),'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>')
print(len(html)//1024,'KB')

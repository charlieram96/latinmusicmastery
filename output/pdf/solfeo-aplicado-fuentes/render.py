"""LMM Solfeo Aplicado - deterministic, editable PDF renderer. Python 3 + reportlab."""
from pathlib import Path
import json, math, os
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color, white
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
ROOT=Path(__file__).resolve().parent
FONT_DIR=Path(os.environ.get('LMM_FONT_DIR','/System/Library/Fonts/Supplemental'))
for name,file in [('Body','Arial.ttf'),('Bold','Arial Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONT_DIR/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
INK=HexColor('#252723'); GRAY=HexColor('#686d67'); ORANGE=HexColor('#df670b'); PALE=HexColor('#fff3e7'); LINE=HexColor('#d7ddd5'); GREEN=HexColor('#265b4d')
W,H=595.28,841.89; M=46; CW=W-2*M
STYLE=ParagraphStyle('body',fontName='Body',fontSize=10.5,leading=15,textColor=INK,spaceAfter=8)
SMALL=ParagraphStyle('small',parent=STYLE,fontSize=8.3,leading=11)
HEAD=ParagraphStyle('head',parent=STYLE,fontName='Bold',fontSize=13,leading=17,textColor=GREEN)
GL=json.loads((ROOT/'music-glyphs.json').read_text())['glyphs']
DATA=json.loads((ROOT/'content.es.json').read_text())
OUT=ROOT.parent/'LMM-Solfeo-Aplicado-Revision.pdf'
c=canvas.Canvas(str(OUT),pagesize=(W,H)); c.setTitle('Solfeo Aplicado | Latin Music Mastery | Edición de revisión'); c.setAuthor('Latin Music Mastery'); c.setSubject('Propuesta curricular y lecciones de muestra originales; edición 0.1')

def label(t,x,y,size=9,color=INK,bold=False,center=False):
    c.setFillColor(color); c.setFont('Bold' if bold else 'Body',size)
    (c.drawCentredString if center else c.drawString)(x,y,t)

def glyph(code,x,y,size=36):
    g=GL.get(str(code)); assert g is not None,hex(code)
    c.saveState(); c.translate(x,y); c.scale(size/1000,size/1000); c.setFillColor(INK)
    p=c.beginPath(); px=py=0
    for cmd in g['commands']:
        a=cmd['args']; k=cmd['command']
        if k=='moveTo': p.moveTo(*a); px,py=a
        elif k=='lineTo': p.lineTo(*a); px,py=a
        elif k=='quadraticCurveTo':
            qx,qy,ex,ey=a; p.curveTo(px+2*(qx-px)/3,py+2*(qy-py)/3,ex+2*(qx-ex)/3,ey+2*(qy-ey)/3,ex,ey); px,py=ex,ey
        elif k=='bezierCurveTo': p.curveTo(*a); px,py=a[-2:]
        elif k=='closePath': p.close()
        else: raise ValueError(k)
    c.drawPath(p,fill=1,stroke=0); c.restoreState()

def paragraph(text,y,style=STYLE,x=M,width=CW):
    p=Paragraph(text,style); _,h=p.wrap(width,700); p.drawOn(c,x,y-h); return y-h-9

def staff(x,y,width=430,clef='G',space=9):
    c.setLineWidth(.55); c.setStrokeColor(GRAY)
    for i in range(5): c.line(x,y+i*space,x+width,y+i*space)
    if clef=='G': glyph(0xe050,x+7,y+space,space*4)
    elif clef=='F': glyph(0xe062,x+7,y+space*3,space*4)
    elif clef=='C': glyph(0xe05c,x+7,y+space*2,space*4)
    elif clef=='T': glyph(0xe05c,x+7,y+space*3,space*4)
    elif clef=='P': glyph(0xe069,x+7,y+space*2,space*4)

LETTERS='CDEFGAB'
def degree(n): return int(n[-1])*7+LETTERS.index(n[0])
def note(n,x,y,clef='G',dur=4,space=9,head=None,acc=True,stem=True):
    base={'G':'E4','F':'G2','C':'F3','T':'D3','P':'E4'}[clef]
    d=degree(n)-degree(base); ny=y+d*space/2
    c.setStrokeColor(INK); c.setLineWidth(.7)
    for k in range(-2,d-1,-2) if d<0 else range(10,d+1,2): c.line(x-4,y+k*space/2,x+14,y+k*space/2)
    accidental=n[1:-1]
    if accidental and acc: glyph({'b':0xe260,'#':0xe262,'n':0xe261}[accidental],x-12,ny,space*3.5)
    glyph(head or (0xe0a2 if dur==1 else 0xe0a3 if dur==2 else 0xe0a4),x,ny,space*4)
    if dur!=1 and stem:
        sx=x+space*1.16; c.line(sx,ny+1,sx,ny+space*3.5)
        if dur>=8: glyph(0xe240+2*(int(math.log2(dur))-3),sx,ny+space*3.5,space*4)
    return ny

def sequence(notes,x,y,width=CW,clef='G',dur=1,labels=None,bars=None):
    staff(x,y,width,clef); start=x+55; dx=(width-75)/max(len(notes)-1,1)
    for i,n in enumerate(notes):
        nx=start+i*dx
        if n: note(n,nx,y,clef,dur)
        if labels: label(labels[i],nx+4,y-23,8,GRAY,center=True)
    if bars:
        for i in bars:
            xx=start+(i-.45)*dx; c.line(xx,y,xx,y+36)

HEADS={'normal':0xe0a4,'x':0xe0a9,'ornate-x':0xe0aa,'plus':0xe0af,'circled':0xe0e8,'slash':0xe100,'slashed':0xe0cf,'diamond':0xe0db,'triangle-down':0xe0c7,'triangle-up':0xe0be,'square':0xe1b3}

def diagram(b,y):
    kind=b['kind']; h=b.get('height',160); top=y; bottom=y-h
    if kind=='staves':
        rows=b['rows']; step=h/len(rows)
        for i,r in enumerate(rows):
            yy=top-i*step-65
            if r.get('title'): label(r['title'],M,top-i*step-10,9,GREEN,True)
            sequence(r['notes'],M,yy,CW,r.get('clef','G'),r.get('duration',1),r.get('labels'),r.get('bars'))
    elif kind=='staffmap':
        x=M+25; yy=top-100; staff(x,yy,265,'G',12)
        for i in range(5): label(str(i+1),x+290,yy+i*12-3,10,ORANGE,True)
        for i in range(4): label(str(i+1),x+335,yy+(i+.5)*12-3,10,GREEN,True)
        label('Líneas',x+277,yy+70,10,ORANGE); label('Espacios',x+328,yy+70,10,GREEN)
        label('Se cuentan de abajo hacia arriba.',x,yy-34,10)
    elif kind=='values':
        names=['Redonda','Blanca','Negra','Corchea','Semicorchea','Fusa','Semifusa','Garrapatea','Semigarrapatea']
        label('FIGURA',M,top-13,9,GRAY,True); label('NOTA',M+180,top-13,9,GRAY,True); label('SILENCIO',M+263,top-13,9,GRAY,True); label('FRACCIÓN',M+350,top-13,9,GRAY,True); label('A 60 BPM*',M+433,top-13,9,GRAY,True)
        for i,name in enumerate(names):
            yy=top-53-i*45; dur=2**i
            label(name,M,yy,10); note('B4',M+190,yy-18,'G',dur,8 if dur<=16 else 5)
            glyph(0xe4e3+i,M+280,yy+(3 if dur<=16 else 8),30 if dur<=16 else 22)
            if i<2:
                c.setStrokeColor(INK); c.setLineWidth(.6); c.line(M+274,yy+3,M+297,yy+3)
            label('1' if i==0 else f'1/{dur}',M+362,yy,10); label(f'{4000/dur:g} ms',M+430,yy,9)
            c.setStrokeColor(LINE); c.line(M,yy-15,M+CW,yy-15)
        label('* Negra = 60; valores derivados, no duraciones fijas de las figuras.',M,top-h+6,9,GRAY)
    elif kind=='pyramid':
        for r in range(5):
            n=2**r; yy=top-35-r*61; label(str(n),M+8,yy,17,ORANGE,True)
            dx=min(33,420/n); start=M+65+(420-n*dx)/2
            for i in range(n): note('B4',start+i*dx,yy-18,'G',n,7)
        label('32 fusas = 64 semifusas = 128 garrapateas = 256 semigarrapateas',M+CW/2,top-h+14,10,GREEN,center=True)
    elif kind=='keyboard':
        # Full 88-key piano, A0..C8. White-key geometry follows MIDI pitch classes.
        whites=[m for m in range(21,109) if m%12 in (0,2,4,5,7,9,11)]; kw=CW/len(whites); yy=top-100
        for i,m in enumerate(whites):
            c.setFillColor(PALE if m==60 else white); c.setStrokeColor(GRAY); c.setLineWidth(.35); c.rect(M+i*kw,yy,kw,64,fill=1,stroke=1)
            if m%12==0: label('C'+str(m//12-1),M+i*kw+kw/2,yy-15,7,ORANGE if m==60 else GRAY,center=True)
        for m in range(22,108):
            if m%12 not in (0,2,4,5,7,9,11):
                idx=sum(1 for w in whites if w<m); c.setFillColor(INK); c.rect(M+idx*kw-kw*.3,yy+26,kw*.6,38,fill=1,stroke=0)
        label('A0 / La0',M,yy-35,9); label('C8 / Do8',M+CW-48,yy-35,9); label('C4 = Do central',M+CW/2,yy-35,10,ORANGE,True,True)
        sequence(['C4','D4','E4','F4','G4','A4','B4','C5'],M,yy-115,CW,'G',1)
        sequence(['C3','D3','E3','F3','G3','A3','B3','C4'],M,yy-215,CW,'F',1)
    elif kind=='stair':
        ns=['Do','Re','Mi','Fa','Sol','La','Si','Do']; heights=[0,2,4,5,7,9,11,12]; xx=M+25; yy=top-178
        for i,(n,k) in enumerate(zip(ns,heights)):
            x=xx+i*60; v=yy+k*10
            c.setStrokeColor(GREEN); c.setLineWidth(2); c.line(x,v,x+43,v)
            label(n,x+21,v+10,11,INK,True,True)
            if i<7:
                c.line(x+43,v,x+43,yy+heights[i+1]*10)
                label('S' if heights[i+1]-k==1 else 'T',x+46,v-15,8,ORANGE,True)
    elif kind=='pedals':
        for i,n in enumerate(['Re','Do','Si','Mi','Fa','Sol','La']):
            x=M+65+i*60; yy=top-40
            label(n,x,yy+15,11,INK,True,True)
            c.setStrokeColor(GRAY); c.setLineWidth(1); c.line(x,yy,x,yy-60)
            for j in range(3): c.line(x-8,yy-j*30,x+8,yy-j*30)
            c.setFillColor(ORANGE); c.circle(x,yy-30,3.5,fill=1,stroke=0)
        label('Bemol',M,top-43,8); label('Natural',M,top-73,8); label('Sostenido',M,top-103,8)
        label('Pie izquierdo',M+125,top-135,10,GREEN,center=True); label('Pie derecho',M+365,top-135,10,GREEN,center=True)
    elif kind=='notation-signs':
        yy=top-75
        staff(M,yy,220,'G');note('G4',M+65,yy,dur=4);note('G4',M+150,yy,dur=4)
        c.setStrokeColor(INK);c.setLineWidth(1);pp=c.beginPath();pp.moveTo(M+68,yy+1);pp.curveTo(M+90,yy-15,M+132,yy-15,M+155,yy+1);c.drawPath(pp)
        label('Ligadura de prolongación',M,yy+58,10,GREEN,True)
        xx=M+270;staff(xx,yy,220,'G');note('C4',xx+65,yy,dur=4);note('D4',xx+115,yy,dur=4);note('E4',xx+170,yy,dur=4)
        pp=c.beginPath();pp.moveTo(xx+65,yy-20);pp.curveTo(xx+90,yy-40,xx+147,yy-40,xx+176,yy-13);c.drawPath(pp)
        label('Ligadura de fraseo',xx,yy+58,10,GREEN,True)
        yy=top-215;staff(M,yy,220,'G');ny=note('A4',M+80,yy,dur=4);c.setFillColor(INK);c.circle(M+95,ny,1.8,fill=1,stroke=0)
        label('Negra con puntillo',M,yy+58,10,GREEN,True);label('1 + 1/2 tiempos de negra',M,yy-30,9)
        xx=M+270;staff(xx,yy,220,'G');ny=note('A4',xx+80,yy,dur=4)
        for dx in [15,23]:c.circle(xx+80+dx,ny,1.8,fill=1,stroke=0)
        label('Negra con doble puntillo',xx,yy+58,10,GREEN,True);label('1 + 1/2 + 1/4 tiempos de negra',xx,yy-30,9)
        yy=top-365
        c.setStrokeColor(INK);c.line(M+25,yy,M+175,yy+12);c.line(M+25,yy,M+175,yy-12)
        c.line(M+285,yy+12,M+435,yy);c.line(M+285,yy-12,M+435,yy)
        label('Crescendo',M+95,yy-32,10,GREEN,True,True);label('Diminuendo',M+355,yy-32,10,GREEN,True,True)
    elif kind=='tuplets':
        for i,(count,normal) in enumerate(b['groups']):
            yy=top-85-i*120;staff(M,yy,CW,'P')
            start=M+70;end=M+CW-30;dx=(end-start)/max(count-1,1)
            for j in range(count):note('B4',start+j*dx,yy,'P',8,9)
            by=yy+63;c.setStrokeColor(INK);c.setLineWidth(.8);c.line(start,by-5,start,by);c.line(end,by-5,end,by)
            mid=(start+end)/2;c.line(start,by,mid-18,by);c.line(mid+18,by,end,by)
            label(f'{count}:{normal}',mid,by-3,10,INK,True,True)
            label(f'{count} corcheas en el tiempo de {normal} corcheas',M,yy-24,9,GREEN)
    elif kind=='legend':
        for i,r in enumerate(b['items']):
            col=i%2; row=i//2; x=M+col*(CW/2+6); yy=top-62-row*82
            staff(x,yy,75,'P',6)
            n=r['position'][0].upper()+r['position'][-1]; ny=note(n,x+40,yy,'P',4,6,HEADS[r['head']])
            if r.get('marcato'): glyph(0xe4ac,x+39,ny+27,24)
            p=Paragraph(escape(r['label']),SMALL); _,ph=p.wrap(160,55); p.drawOn(c,x+85,yy+25-ph)
            label(r['position'].upper(),x+85,yy-4,7,GRAY)
    elif kind=='intervals':
        for i,r in enumerate(b['rows']):
            yy=top-i*85-55; x=M
            label(r[0],x,yy+53,10,GREEN,True)
            sequence(r[1],x,yy,190,'G',1)
            label(r[2],x+220,yy+16,10)
    elif kind=='rhythm':
        yy=top-70; staff(M,yy,CW,'P'); start=M+65; bw=(CW-75)/len(b['bars'])
        label(b.get('meter','4/4'),M+29,yy+13,11,INK,True)
        for k,events in enumerate(b['bars']):
            t=0; x=start+k*bw
            for e in events:
                d=e['duration']; nx=x+5+t/4*(bw-8)
                if e.get('rest'): glyph(0xe4e3+int(math.log2(d)),nx,yy+18,32)
                else: note('B4',nx,yy,'P',d,9)
                t+=4/d
            assert abs(t-4)<1e-9,events
            c.setStrokeColor(INK); c.line(x+bw,yy,x+bw,yy+36)
            label(str(k+1),x+bw/2,yy-23,8,GRAY,center=True)
    else: raise ValueError(kind)
    return bottom-12

def block(b,y):
    typ=b['type']
    if typ=='p': return paragraph(b['text'],y)
    if typ=='h': return paragraph(b['text'],y-5,HEAD)
    if typ=='small': return paragraph(b['text'],y,SMALL)
    if typ=='callout':
        p=Paragraph(b['text'],STYLE); _,h=p.wrap(CW-26,650)
        c.setFillColor(PALE); c.roundRect(M,y-h-23,CW,h+23,7,fill=1,stroke=0); p.drawOn(c,M+13,y-h-11); return y-h-35
    if typ=='table':
        rows=[[Paragraph(escape(str(v)),ParagraphStyle('th',parent=SMALL,textColor=white,fontName='Bold') if ri==0 else SMALL) for v in row] for ri,row in enumerate(b['rows'])]
        widths=[CW*v for v in b.get('widths',[1/len(rows[0])]*len(rows[0]))]
        t=Table(rows,colWidths=widths,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),GREEN),('TEXTCOLOR',(0,0),(-1,0),white),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#f4f6f1')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),.6,GREEN)]))
        for p in rows[0]: p.style=ParagraphStyle('th',parent=SMALL,textColor=white,fontName='Bold')
        _,h=t.wrap(CW,700); t.drawOn(c,M,y-h); return y-h-14
    if typ=='diagram': return diagram(b,y)
    raise ValueError(typ)

for idx,page in enumerate(DATA['pages']):
    n=idx+1
    c.setFillColor(white); c.rect(0,0,W,H,fill=1,stroke=0)
    if page.get('cover'):
        c.setFillColor(GREEN); c.rect(0,0,W,H,fill=1,stroke=0)
        label('LATIN MUSIC MASTERY',M,H-73,12,white,True)
        label('MÉTODO DE LECTURA Y TEORÍA MUSICAL',M,H-103,9,HexColor('#c9ddd1'))
        label('SOLFEO',M,H-235,52,white,True); label('APLICADO',M,H-296,52,white,True)
        label('Leer. Comprender. Tocar.',M,H-348,22,HexColor('#ffb976'))
        for i in range(5):
            c.setStrokeColor(Color(.7,.85,.75,.4)); c.setLineWidth(.6); c.line(M,250+i*14,W-M,250+i*14)
        for i,pos in enumerate([0,1,2,4,3,5,7]):
            c.setFillColor(HexColor('#ffb976')); c.ellipse(M+45+i*60,255+pos*7,M+59+i*60,264+pos*7,fill=1,stroke=0)
        label('EDICIÓN DE REVISIÓN 0.1',M,148,11,white,True)
        label('Propuesta curricular + lecciones ilustradas de muestra',M,124,11,white)
        label('Dirección pedagógica: Raffy Pérez',M,88,10,HexColor('#c9ddd1'))
        label('Octubre 2026  |  Documento local para revisión',M,65,9,HexColor('#c9ddd1'))
    else:
        label('LMM  /  SOLFEO APLICADO',M,H-32,8,GREEN,True)
        label(page.get('section','EDICIÓN DE REVISIÓN').upper(),M,H-65,8,ORANGE,True)
        title=Paragraph(escape(page['title']),ParagraphStyle('title',fontName='Bold',fontSize=25,leading=29,textColor=INK))
        _,th=title.wrap(CW,150); title.drawOn(c,M,H-83-th); y=H-102-th
        c.bookmarkPage(page['id']); c.addOutlineEntry(page['title'],page['id'],level=0,closed=False)
        for b in page['blocks']:
            y=block(b,y)
            if y<63: raise RuntimeError(f'Overflow page {n}: {page["title"]}, y={y}, block={b.get("text",b.get("kind",b["type"]))[:60]}')
        c.setStrokeColor(LINE); c.setLineWidth(.6); c.line(M,48,W-M,48)
        label('Latin Music Mastery · Revisión 0.1',M,32,8,GRAY)
        label(f'{n:02d}',W-M-14,32,9,GREEN,True)
    c.showPage()
c.save()
print(f'Created {OUT} ({len(DATA["pages"])} pages)')

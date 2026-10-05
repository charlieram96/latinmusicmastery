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
OUT=ROOT.parent/'LMM-Solfeo-Aplicado-Manual.pdf'
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
    if accidental and acc: glyph({'b':0xe260,'#':0xe262,'n':0xe261,'##':0xe263,'bb':0xe264}[accidental],x-12,ny,space*3.5)
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


# Semantic score renderer. Coordinates are points; pitches use scientific notation.
from fractions import Fraction
OLD_DIAGRAM=diagram
RAW_NOTE=note

def note(n,x,y,clef='G',dur=4,space=9,head=None,acc=True,stem=True):
    ny=RAW_NOTE(n,x,y,clef,dur,space,head,acc,False)
    base={'G':'E4','F':'G2','C':'F3','T':'D3','P':'E4'}[clef]
    down=degree(n)-degree(base)>=4
    if dur!=1 and stem:
        sx=x if down else x+space*1.16; sy=ny-space*3.5 if down else ny+space*3.5
        c.setStrokeColor(INK);c.setLineWidth(.7);c.line(sx,ny-1 if down else ny+1,sx,sy)
        if dur>=8:glyph(0xe240+2*(int(math.log2(dur))-3)+(1 if down else 0),sx,sy,space*4)
    return ny

def curve(x1,y1,x2,y2,drop=12):
    p=c.beginPath();p.moveTo(x1,y1);p.curveTo(x1+(x2-x1)*.25,y1-drop,x2-(x2-x1)*.25,y2-drop,x2,y2);c.setStrokeColor(INK);c.setLineWidth(.8);c.drawPath(p)

def key_draw(fifths,x,y,clef='G',sp=8):
    pitches=(['F5','C5','G5','D5','A4','E5','B4'] if fifths>0 else ['B4','E5','A4','D5','G4','C5','F4'])
    base={'G':'E4','F':'G2','C':'F3','T':'D3'}[clef]
    for i,n in enumerate(pitches[:abs(fifths)]):
        d=degree(n)-degree('E4')
        if clef=='F':d-=2
        if clef in ('C','T'):d-=1 if clef=='C' else 3
        glyph(0xe262 if fifths>0 else 0xe260,x+i*9,y+d*sp/2,sp*3.5)
    return abs(fifths)*9

def key_map(fifths):
    return {l:('#' if fifths>0 else 'b') for l in ('FCGDAEB' if fifths>0 else 'BEADGCF')[:abs(fifths)]}

def score_row(r,top):
    sp=r.get('space',8);yy=top-66;x=M;clef=r.get('clef','G'); fifths=r.get('key',0)
    if r.get('title'):label(r['title'],M,top-9,9,GREEN,True)
    staff(x,yy,CW,clef,sp)
    off=37+key_draw(fifths,M+32,yy,clef,sp)
    meter=r.get('meter')
    if meter:
        a,b=map(int,meter.split('/')); label(str(a),M+off+5,yy+sp*2+2,13,INK,True,True);label(str(b),M+off+5,yy+2,13,INK,True,True);off+=23
    if r.get('tempo'):label(r['tempo'],M+off,yy+sp*4+14,8,GRAY)
    start=M+off+12;end=M+CW-25
    positions=[]
    bars=r.get('bars')
    groups=bars or [r.get('events',[])]
    bw=(end-start)/len(groups)
    for bi,evs in enumerate(groups):
        active={};left=start+bi*bw;pad=7;usable=bw-18
        weights=[max(.65,float(Fraction(4,e.get('dur',1)))*(1.5 if e.get('dot') else 1)) for e in evs]
        total=sum(weights) or 1;t=0
        for j,e in enumerate(evs):
            xx=left+pad+(t/total)*usable if bars else left+pad+j*usable/max(len(evs)-1,1)
            t+=weights[j];d=e.get('dur',1)
            if e.get('rest'):
                glyph(0xe4e3+int(math.log2(d)),xx,yy+sp*2,sp*4);ny=yy+sp*2
            else:
                n=e.get('pitch','B4');acc=n[1:-1];natural=acc in ('','n'); desired='' if natural else acc
                prior=active.get(n[0]+n[-1],key_map(fifths).get(n[0],''))
                show=desired!=prior or e.get('showAcc',False)
                shown=n[0]+('n' if desired=='' and show else desired)+n[-1]
                ny=note(shown,xx,yy,clef,d,sp,acc=show,stem=not any(len(g)>1 and len(positions) in g for g in r.get('beams',[])));active[n[0]+n[-1]]=desired
            if e.get('dot') or e.get('dots'):
                c.setFillColor(INK)
                for k in range(e.get('dots',1)):c.circle(xx+sp*1.8+k*6,ny+(sp/2 if round((ny-yy)/(sp/2))%2==0 else 0),1.4,fill=1,stroke=0)
            if e.get('label'):label(e['label'],xx+4,yy-22,7,GRAY,center=True)
            mark=e.get('mark');my=yy+sp*4+14
            if mark=='staccato':c.setFillColor(INK);c.circle(xx+4,my,1.6,fill=1,stroke=0)
            elif mark=='tenuto':c.setStrokeColor(INK);c.line(xx,my,xx+9,my)
            elif mark=='accent':c.setStrokeColor(INK);c.line(xx,my+3,xx+10,my);c.line(xx+10,my,xx,my-3)
            elif mark=='marcato':c.setStrokeColor(INK);c.line(xx,my,xx+5,my+8);c.line(xx+5,my+8,xx+10,my)
            elif mark=='fermata':glyph(0xe4c0,xx-2,my,sp*3)
            elif mark in ('tr','turn','mordent'):glyph({'tr':0xe566,'turn':0xe567,'mordent':0xe56d}[mark],xx,my,sp*3)
            elif mark:label(mark,xx,my,9,INK,True)
            if e.get('dynamic'):
                dx=xx
                for letter in e['dynamic']:
                    code={'p':0xe520,'m':0xe521,'f':0xe522,'s':0xe524,'z':0xe525}[letter];glyph(code,dx,yy-22,22);dx+=GL[str(code)]['advance']*22/1000
            if e.get('slashes'):
                # quarter-note stem, upper half; compact diagonal tremolo strokes.
                down=degree(e.get('pitch','B4'))-degree({'G':'E4','F':'G2','C':'F3','T':'D3','P':'E4'}[clef])>=4
                sx=xx if down else xx+sp*1.16;sy=ny-sp*2 if down else ny+sp*2
                for k in range(e['slashes']):
                    p=c.beginPath();p.moveTo(sx-5,sy+k*5);p.lineTo(sx+6,sy+k*5+5);p.lineTo(sx+6,sy+k*5+2);p.lineTo(sx-5,sy+k*5-3);p.close();c.setFillColor(INK);c.drawPath(p,fill=1,stroke=0)
            positions.append((xx,ny,e))
        if bars:c.setStrokeColor(INK);c.setLineWidth(.6);c.line(left+bw,yy,left+bw,yy+sp*4)
    for group in r.get('beams',[]):
        pts=[positions[i] for i in group]
        if len(pts)<2:continue
        base={'G':'E4','F':'G2','C':'F3','T':'D3','P':'E4'}[clef]
        down=sum(degree(p[2]['pitch'])-degree(base) for p in pts)/len(pts)>=4
        by=min(p[1] for p in pts)-sp*3.5 if down else max(p[1] for p in pts)+sp*3.5
        sx=[p[0] if down else p[0]+sp*1.16 for p in pts]
        c.setStrokeColor(INK);c.setLineWidth(.7)
        for xx,(_,ny,e) in zip(sx,pts):c.line(xx,ny,xx,by)
        levels=min(int(math.log2(p[2]['dur']))-2 for p in pts)
        for level in range(levels):
            by2=by+(level*5 if down else -level*5);c.setLineWidth(3);c.line(sx[0],by2,sx[-1],by2)
        c.setLineWidth(.7)
    for pair in r.get('slurs',[])+r.get('ties',[]):
        a,b=pair;xa,ya,_=positions[a];xb,yb,_=positions[b];curve(xa+3,min(yy-5,ya-7),xb+7,min(yy-5,yb-7),10)
    if r.get('hairpin'):
        a=start+20;b=end-25;v=yy-19;c.setStrokeColor(INK);c.setLineWidth(.8)
        if r['hairpin']=='cresc':c.line(a,v,b,v+5);c.line(a,v,b,v-5)
        else:c.line(a,v+5,b,v);c.line(a,v-5,b,v)
    if r.get('intervals'):
        for i,v in enumerate(r['intervals']):
            if i+1>=len(positions):break
            a=positions[i][0]+8;b=positions[i+1][0];by=min(yy-16,min(z[1] for z in positions)-12)
            c.setStrokeColor(GREEN);c.setLineWidth(.7)
            if v=='S':curve(a,by,b,by,5)
            else:c.line(a,by+3,a,by);c.line(a,by,b,by);c.line(b,by,b,by+3)
            label(v,(a+b)/2,by-12,7,GREEN,True,True)
    if r.get('tuplet'):
        a=positions[0][0];b=positions[-1][0]+8;by=yy+sp*4+12;mid=(a+b)/2
        c.setStrokeColor(INK);c.line(a,by-5,a,by);c.line(a,by,mid-16,by);c.line(mid+16,by,b,by);c.line(b,by,b,by-5);label(r['tuplet'],mid,by-3,9,INK,True,True)
    if r.get('caption'):label(r['caption'],M,yy-43,8,GRAY)

def arrow(a,b,color=ORANGE):
    x,y=a;u,v=b;c.setStrokeColor(color);c.setFillColor(color);c.setLineWidth(2);c.line(x,y,u,v)
    ang=math.atan2(v-y,u-x);p=c.beginPath();p.moveTo(u,v);p.lineTo(u-9*math.cos(ang-.4),v-9*math.sin(ang-.4));p.lineTo(u-9*math.cos(ang+.4),v-9*math.sin(ang+.4));p.close();c.drawPath(p,fill=1,stroke=0)

def hand(x,y,s=.65):
    # Original vector outline of a conducting hand holding a baton.
    c.saveState();c.translate(x,y);c.scale(s,s);c.setStrokeColor(GREEN);c.setLineWidth(1.5);c.setFillColor(PALE)
    p=c.beginPath();p.moveTo(-12,-18);p.lineTo(-15,0);p.curveTo(-28,10,-24,20,-18,16);p.lineTo(-10,9);p.lineTo(-9,33);p.curveTo(-9,41,-3,41,-3,33);p.lineTo(-2,14);p.lineTo(1,38);p.curveTo(2,44,8,43,8,36);p.lineTo(7,13);p.lineTo(12,32);p.curveTo(15,38,20,34,17,27);p.lineTo(12,9);p.lineTo(19,23);p.curveTo(23,27,27,23,23,15);p.lineTo(15,-9);p.lineTo(10,-18);p.close();c.drawPath(p,fill=1,stroke=1)
    c.setLineWidth(2);c.line(2,8,41,60);c.restoreState()

def diagram(b,y):
    kind=b['kind'];h=b.get('height',160);top=y
    if kind=='score':
        for i,r in enumerate(b['rows']):score_row(r,top-i*b.get('rowHeight',120))
    elif kind=='staffmap':
        yy=top-105;staff(M+30,yy,CW-60,'G',14)
        for i in range(5):
            xx=M+125+i*55;c.setFillColor(white);c.circle(xx,yy+i*14,7,fill=1,stroke=0);label(str(i+1),xx,yy+i*14-3,10,ORANGE,True,True)
        for i in range(4):label(str(i+1),M+154+i*55,yy+(i+.5)*14-3,9,GREEN,True,True)
        label('Naranja: líneas. Verde: espacios. Numeración de abajo hacia arriba.',M,yy-27,9)
    elif kind=='pyramid':
        for r in range(5):
            n=2**r;ny=top-35-r*72
            for i in range(n):
                xx=M+25+(i+.5)*(CW-50)/n;note('A4',xx-4,ny-12,dur=n,space=6)
                if r<4:
                    for child in (2*i,2*i+1):
                        cx=M+25+(child+.5)*(CW-50)/(2*n);c.setStrokeColor(GREEN);c.setLineWidth(.65);c.line(xx,ny-13,cx,ny-44)
            label(f'{n}',M,ny,10,ORANGE,True)
        label('Cada rama divide una duración en dos partes iguales.',M,top-h+4,10,GREEN)
    elif kind=='conduct':
        count=b['count'];cx=M+CW/2;cy=top-125
        coords={2:[(cx,cy-60),(cx,cy+65)],3:[(cx,cy-60),(cx+100,cy-5),(cx,cy+65)],4:[(cx,cy-60),(cx-105,cy-5),(cx+105,cy-5),(cx,cy+65)]}[count]
        start=(cx,cy+40)
        for i,(xx,yy) in enumerate(coords):
            # Offset the final ascent slightly so the up and down trajectories remain visible.
            a=start if i==0 else coords[i-1];bpos=(xx-9 if i==count-1 else xx,yy);ang=math.atan2(bpos[1]-a[1],bpos[0]-a[0]);arrow((a[0]+14*math.cos(ang),a[1]+14*math.sin(ang)),(bpos[0]-16*math.cos(ang),bpos[1]-16*math.sin(ang)))
            c.setFillColor(GREEN);c.circle(xx,yy,12,fill=1,stroke=0);label(str(i+1),xx,yy-4,11,white,True,True)
        hand(cx+145,cy+15);label('Mano derecha: vista de quien dirige',M+CW/2,top-h+17,9,GRAY,center=True)
    elif kind=='keys':
        for i,r in enumerate(b['rows']):
            yy=top-70-i*85;label(r['title'],M,yy+51,9,GREEN,True);staff(M,yy,CW,'G',8);key_draw(r['key'],M+40,yy,'G',8);note(r['tonic'],M+180,yy,dur=1,space=8,acc=False);label(r.get('caption',''),M+220,yy+12,9)
    elif kind=='grand':
        sy=top-64;fy=sy-107;staff(M+20,sy,CW-20,'G',8);staff(M+20,fy,CW-20,'F',8)
        c.setStrokeColor(INK);c.setLineWidth(1);c.line(M+20,fy,M+20,sy+32)
        p=c.beginPath();xx=M+12;mid=(fy+sy+32)/2;p.moveTo(xx,sy+36);p.curveTo(xx-22,sy+24,xx+4,mid+15,xx-14,mid);p.curveTo(xx+4,mid-15,xx-22,fy+10,xx,fy-4);c.drawPath(p)
        upper=b['upper'];lower=b['lower'];dx=(CW-95)/len(upper)
        for i,(a,z) in enumerate(zip(upper,lower)):
            xx=M+72+i*dx;note(a,xx,sy,'G',b.get('dur',1),8);note(z,xx,fy,'F',b.get('dur',1),8)
            if b.get('bars'):c.line(xx+dx-10,fy,xx+dx-10,sy+32)
        if b.get('meter'):
            for yy in (sy,fy):label('4',M+52,yy+19,12,INK,True);label('4',M+52,yy+3,12,INK,True)
    elif kind=='navigation':
        mode=b['mode'];yy=top-80;staff(M,yy,CW,'G',8);start=M+55;bw=(CW-65)/4
        for i in range(4):
            xx=start+i*bw;note(['C4','D4','E4','C4'][i],xx+20,yy,dur=1,space=8);label(str(i+1),xx+25,yy-22,8,GRAY)
            c.setStrokeColor(INK);c.setLineWidth(.7);c.line(xx+bw,yy,xx+bw,yy+32)
        if mode=='bars':
            for i in (1,2,3):
                xx=start+(i+1)*bw;c.setLineWidth(.7);c.line(xx-5,yy,xx-5,yy+32)
                if i>=2:c.setLineWidth(2);c.line(xx,yy,xx,yy+32)
                if i==3:
                    for dy in (12,20):c.setFillColor(INK);c.circle(xx-11,yy+dy,1.5,fill=1,stroke=0)
            label('Simple',start+40,yy+51,9);label('Doble',start+bw+30,yy+51,9);label('Final',start+2*bw+40,yy+51,9);label('Repetición',start+3*bw+20,yy+51,9)
        elif mode=='endings':
            for bi,txt in [(2,'1.'),(3,'2.')]:
                xx=start+bi*bw;c.setLineWidth(.8);c.line(xx,yy+47,xx,yy+61);c.line(xx,yy+61,xx+bw,yy+61);label(txt,xx+6,yy+49,9)
            c.setLineWidth(2);c.line(start,yy,start,yy+32);c.setLineWidth(.7);c.line(start+5,yy,start+5,yy+32)
            for dy in (12,20):c.setFillColor(INK);c.circle(start+11,yy+dy,1.5,fill=1,stroke=0)
            xx=start+3*bw;c.setLineWidth(.7);c.line(xx-4,yy,xx-4,yy+32);c.setLineWidth(2);c.line(xx,yy,xx,yy+32)
            for dy in (12,20):c.circle(xx-10,yy+dy,1.5,fill=1,stroke=0)
        else:
            if mode.startswith('DS'):glyph(0xe047,start+12,yy+51,26)
            if 'Coda' in mode:
                glyph(0xe048,start+bw+64,yy+54,23);label('a Coda',start+bw+13,yy+52,8);glyph(0xe048,start+3*bw+15,yy+54,23)
            else:label('Fine',start+bw+25,yy+53,9)
            label(mode.replace('DS','D.S.').replace('DC','D.C.').replace('Fine',' al Fine').replace('Coda',' al Coda'),start+(3 if 'Fine' in mode else 2)*bw+8,yy-39,9,GREEN,True)
    elif kind=='blank':
        for i in range(b.get('count',2)):
            yy=top-60-i*90;staff(M,yy,CW,b.get('clef','G'),8)
            for j in range(1,5):c.line(M+j*CW/4,yy,M+j*CW/4,yy+32)
    else:return OLD_DIAGRAM(b,y)
    return y-h-12

for idx,page in enumerate(DATA['pages']):
    n=idx+1;c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
    if page.get('cover'):
        c.setFillColor(GREEN);c.rect(0,0,W,H,fill=1,stroke=0)
        label('LATIN MUSIC MASTERY',M,H-78,13,white,True)
        label('SOLFEO',M,H-240,54,white,True);label('APLICADO',M,H-302,54,white,True)
        label('Lectura y comprensión',M,H-365,23,white);label('del lenguaje musical',M,H-397,23,white)
        for i in range(5):c.setStrokeColor(HexColor('#a2baab'));c.setLineWidth(.5);c.line(M,245+i*13,W-M,245+i*13)
        for i,j in enumerate([0,1,2,3,4,5,6,7]):
            c.setFillColor(HexColor('#ffb976'));c.ellipse(M+35+i*55,249+j*6.5,M+46+i*55,256+j*6.5,fill=1,stroke=0)
        label('MANUAL DE ESTUDIO',M,151,12,white,True)
        label('Teoría · lectura · escritura · entonación',M,124,11,white)
        label('Dirección pedagógica: Raffy Pérez',M,82,10,white)
        label('Edición de trabajo 0.2 · Octubre de 2026',M,61,9,HexColor('#c9ddd1'))
    else:
        label('LMM  /  SOLFEO APLICADO',M,H-32,8,GREEN,True);label(page.get('section','SOLFEO APLICADO').upper(),M,H-65,8,ORANGE,True)
        title=Paragraph(escape(page['title']),ParagraphStyle('title',fontName='Bold',fontSize=24,leading=28,textColor=INK));_,th=title.wrap(CW,150);title.drawOn(c,M,H-83-th);y=H-100-th
        c.bookmarkPage(page['id']);c.addOutlineEntry(page['title'],page['id'],level=0,closed=False)
        for b in page['blocks']:
            y=block(b,y)
            if y<63:raise RuntimeError(f'Overflow page {n}: {page["title"]} y={y:.1f} block={b.get("kind",b.get("text",""))[:40]}')
        c.setStrokeColor(LINE);c.line(M,48,W-M,48);label('Latin Music Mastery · Solfeo Aplicado',M,32,8,GRAY);label(str(n),W-M-15,32,9,GREEN,True)
    c.showPage()
c.setTitle('Solfeo Aplicado - Manual de estudio');c.setAuthor('Latin Music Mastery');c.setSubject('Lectura, escritura y teoría musical. Edición de trabajo 0.2.');c.save();print(f'{OUT}: {len(DATA["pages"])} páginas')

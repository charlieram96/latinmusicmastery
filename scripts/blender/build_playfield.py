"""Original Blender notes, walnut runway, illuminated entrance and lounge furniture.

Coordinates supplied to helpers use Three.js Y-up; the editable scene uses Z-up.
Exported board and lounge roots stay at the origin. Note components each have a
centered local pivot, allowing the browser to keep instancing them at audio time.
"""
import bpy
import bmesh
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art/playsense'
OUT = ROOT / 'public/playsense/models'
TEX = ART / 'playfield-textures'
TEX.mkdir(exist_ok=True)
old = bpy.data.scenes.get('Afterhours Playfield')
if old:
    for ob in list(old.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new('Afterhours Playfield')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('PlaySense | Authored playfield')
scene.collection.children.link(collection)
roots = []

def xyz(p): return (p[0], -p[2], p[1])

def root(name):
    ob = bpy.data.objects.new(name, None)
    collection.objects.link(ob); roots.append(ob)
    return ob

def link(ob, name, material, parent):
    ob.name = name
    for col in list(ob.users_collection): col.objects.unlink(ob)
    collection.objects.link(ob)
    if material: ob.data.materials.append(material)
    ob.parent = parent
    return ob

def material(name, color, metal=0, rough=.5, emission=0):
    m = bpy.data.materials.new('PS | '+name); m.use_nodes=True; m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1)
        p.inputs['Emission Strength'].default_value=emission
    return m

def image(name, pixels, noncolor=False):
    h,w=pixels.shape[:2]
    im=bpy.data.images.new('PF '+name,width=w,height=h,alpha=True)
    im.colorspace_settings.name='Non-Color' if noncolor else 'sRGB'
    rgba=np.ones((h,w,4),dtype=np.float32);rgba[:,:,:3]=np.clip(pixels,0,1)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw=str(TEX/(name+'.png'));im.file_format='PNG';im.save();im.pack()
    return im

def textured(name, color, kind, rough):
    size=1024 if kind=='wood' else 512
    y,x=np.mgrid[0:size,0:size].astype(np.float32)/size
    rng=np.random.default_rng(713);noise=rng.random((size,size),dtype=np.float32)-.5
    if kind=='wood':
        grain=x+np.sin(y*8+x*13)*.012+np.sin(y*21)*.002
        h=np.sin(grain*380)*.12+np.sin(grain*1290)*.025+noise*.025
        shade=1+h*.5+np.sin(x*28+y*5)*.045
    elif kind=='cloth':
        h=np.sin(x*math.pi*220)*np.sin(y*math.pi*220)*.045+noise*.04
        shade=1+h*.45+np.sin(x*14+y*9)*.018
    elif kind=='metal':
        h=np.sin(y*math.pi*680)*.03+noise*.015
        shade=1+h*.45
    else:
        h=noise*.013+np.sin(x*8)*np.sin(y*7)*.012
        shade=.93+.07*np.cos(x*math.pi*2)*np.cos(y*math.pi*2)+noise*.01
    m=material(name,color,.8 if kind=='metal' else 0,rough)
    nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
    color_im=image(name+' color',np.array(color)[None,None,:]*shade[:,:,None])
    dy,dx=np.gradient(h);v=np.stack([-dx*2,-dy*2,np.ones_like(h)],axis=-1);v/=np.linalg.norm(v,axis=-1,keepdims=True)
    normal_im=image(name+' normal',v*.5+.5,True)
    rough_im=image(name+' roughness',np.repeat(np.clip(rough+noise*.04,0,1)[:,:,None],3,axis=2),True)
    for im,socket in [(color_im,'Base Color'),(rough_im,'Roughness')]:
        n=nodes.new('ShaderNodeTexImage');n.image=im;links.new(n.outputs['Color'],p.inputs[socket])
    n=nodes.new('ShaderNodeTexImage');n.image=normal_im;normal=nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value=.3
    links.new(n.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
    if kind in ['wood','resin']:
        p.inputs['Coat Weight'].default_value=.32 if kind=='wood' else .7
        p.inputs['Coat Roughness'].default_value=.25 if kind=='wood' else .12
    return m

def bevel(ob, width, segments=3):
    if width:
        mod=ob.modifiers.new('Crafted rounded edge','BEVEL');mod.width=width;mod.segments=segments
        normal=ob.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');normal.keep_sharp=True
    return ob

def box(name, pos, dims, mat, parent, edge=.03):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(pos))
    ob=link(bpy.context.object,name,mat,parent);ob.scale=(dims[0],dims[2],dims[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return bevel(ob,edge)

def tube(name, points, radius, mat, parent):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=4
    curve.bevel_depth=radius;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,co in zip(spline.points,points):p.co=(*xyz(co),1)
    ob=bpy.data.objects.new(name,curve);collection.objects.link(ob);ob.parent=parent;curve.materials.append(mat)
    return ob

def cylinder(name,pos,r,depth,mat,parent,vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=xyz(pos))
    ob=link(bpy.context.object,name,mat,parent);bevel(ob,.008,2)
    for face in ob.data.polygons:face.use_smooth=True
    return ob

def text(name, body, size, pos, mat, parent):
    curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.align_x='CENTER';curve.align_y='CENTER'
    curve.size=size;curve.extrude=.002;curve.bevel_depth=.001
    ob=bpy.data.objects.new(name,curve);collection.objects.link(ob);ob.parent=parent;ob.location=xyz(pos)
    ob.rotation_euler=(math.pi/2,0,0);curve.materials.append(mat)
    return ob

walnut=textured('Oiled walnut',(.31,.16,.079),'wood',.38)
leather=textured('Deep olive woven deck',(.075,.106,.091),'cloth',.88)
brass=textured('Satin champagne brass',(.57,.42,.24),'metal',.3)
dark=material('Soft charcoal',(.016,.023,.022),.15,.56)
ivory=material('Warm porcelain',(.82,.69,.46),.12,.35)
light=material('Entrance warm light',(.95,.58,.24),.15,.3,2.1)
seam=material('Walnut edge piping',(.11,.052,.023),0,.58)
board=root('board')
box('Floating walnut chassis',(0,-.56,-10.7),(11.45,.7,30),walnut,board,.22)
box('Recessed woven playing bed',(0,-.235,-10.7),(10.55,.14,29.55),leather,board,.12)
box('Lower black isolation reveal',(0,-.94,-10.7),(11.15,.08,29.75),dark,board,.07)
for side in [-1,1]:
    box('Broad sculpted wood cheek',(side*5.52,-.24,-10.7),(.4,.43,30.1),walnut,board,.14)
    box('Inlaid brass edge',(side*5.29,-.125,-10.7),(.035,.035,29.6),brass,board,.014)
    box('Warm rail diffuser',(side*5.36,-.16,-10.7),(.028,.026,29.45),light,board,.01)
    box('Side brass band',(side*5.73,-.53,-10.7),(.027,.08,29.6),brass,board,.012)
    for i in range(22):
        box('Side ventilation notch',(side*5.739,-.64,2.6-i*1.25),(.015,.12,.48),dark,board,.025)
    for z in [3.6,-24.8]:
        box('Machined corner protector',(side*5.5,-.255,z),(.46,.1,.65),brass,board,.09)
        cylinder('Recessed corner screw',(side*5.5,-.195,z),.06,.014,dark,board,16)
    # Thin stitching marks around the fabric bed. They stop short of the playable lanes.
    for i in range(100):
        box('Deck saddle stitch',(side*5.16,-.154,3.4-i*.285),(.018,.009,.10),ivory,board,.003)
    for z in [-19,-1]:
        box('Tapered trestle leg',(side*4.85,-1.93,z),(.25,2.12,.38),walnut,board,.07)
        box('Brass trestle shoe',(side*4.85,-3.02,z),(.36,.22,.65),brass,board,.04)
box('Player end walnut apron',(0,-.49,4.15),(11.35,.53,.33),walnut,board,.1)
box('Player end satin brass accent',(0,-.4,4.328),(4.4,.075,.012),brass,board,.015)

# A real casement window with a miniature exterior beyond it replaces the dark alcove.
entrance=root('entrance')
paint=material('Window aged celadon',(.23,.36,.31),0,.58)
reveal=material('Window warm plaster',(.57,.49,.35),0,.88)
curtain=textured('Window linen',(.72,.66,.52),'cloth',.94)
roof=material('Dusk terracotta roofs',(.34,.15,.095),0,.82)
stucco=[material('Dusk stucco ochre',(.48,.33,.18),0,.9),material('Dusk stucco sage',(.26,.37,.29),0,.9),material('Dusk stucco rose',(.46,.27,.20),0,.9)]
night=material('Evening foliage',(.027,.085,.069),0,.94)
window_light=material('Distant amber windows',(.96,.55,.22),0,.55,.7)
# Deep jambs and a broad sill connect the window to the room and mask the panorama edges.
for side in [-1,1]:
    box('Deep window jamb',(side*6.08,2.78,-27.8),(.25,6.15,4.6),reveal,entrance,.05)
    box('Painted window surround',(side*6.12,2.78,-25.48),(.43,6.25,.35),paint,entrance,.075)
    box('Slim walnut inner frame',(side*5.89,2.77,-25.30),(.1,5.95,.12),walnut,entrance,.025)
    box('Outside louver housing',(side*6.65,2.75,-25.75),(.65,5.95,.2),paint,entrance,.05)
    for j in range(19):box('Painted outer louver',(side*6.65,.03+j*.30,-25.58),(.62,.07,.16),paint,entrance,.02)
box('Window lintel',(0,5.93,-25.5),(12.62,.36,.48),paint,entrance,.07)
box('Window head reveal',(0,5.99,-27.8),(12.35,.25,4.6),reveal,entrance,.035)
box('Rounded walnut sill',(0,-.12,-25.8),(12.95,.25,1.4),walnut,entrance,.11)
box('Fine brass sill inlay',(0,.013,-25.35),(12.25,.013,.026),brass,entrance,.005)
# Three clear views through slender mullions, with a row of transom lights above.
for x in [-1.97,1.97]:
    box('Window slender mullion',(x,2.85,-25.4),(.09,5.8,.18),paint,entrance,.02)
    box('Mullion champagne edge',(x+.045,2.85,-25.285),(.016,5.65,.024),brass,entrance,.005)
box('Upper transom rail',(0,4.75,-25.39),(11.88,.09,.19),paint,entrance,.02)
for x in [-3.94,0,3.94]:box('Transom divider',(x,5.27,-25.4),(.065,1.0,.16),paint,entrance,.018)
for x in [-1.75,1.75]:
    box('Casement latch',(x,2.5,-25.19),(.055,.3,.08),brass,entrance,.02)
# UV-mapped dusk sky, packed into the GLB. The foreground view is actual layered geometry.
y,x=np.mgrid[0:512,0:1024].astype(np.float32);t=y/511
bottom=np.array([.49,.30,.21]);horizon=np.array([.72,.43,.29]);upper=np.array([.17,.32,.35]);top=np.array([.055,.16,.23])
colors=np.zeros((512,1024,3),dtype=np.float32)
for channel in range(3):
    colors[:,:,channel]=np.interp(t,[0,.3,.64,1],[bottom[channel],horizon[channel],upper[channel],top[channel]])
colors+=np.exp(-((x/1023-.22)**2+(t-.26)**2)/.07)[:,:,None]*np.array([.1,.055,.022])[None,None,:]
sky_image=image('Twilight beyond the studio',colors)
sky=material('Window dusk sky',(1,1,1),0,1)
nodes=sky.node_tree.nodes;links=sky.node_tree.links;shader=nodes.get('Principled BSDF')
texture=nodes.new('ShaderNodeTexImage');texture.image=sky_image
links.new(texture.outputs['Color'],shader.inputs['Base Color']);links.new(texture.outputs['Color'],shader.inputs['Emission Color']);shader.inputs['Emission Strength'].default_value=.8
sky_vertices=[xyz((-6.65,-.95,-30.18)),xyz((6.65,-.95,-30.18)),xyz((6.65,6.12,-30.18)),xyz((-6.65,6.12,-30.18))]
me=bpy.data.meshes.new('Window sky plane');me.from_pydata(sky_vertices,[],[(0,1,2,3)]);me.update();uv=me.uv_layers.new(name='Panorama')
for i,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=co
ob=bpy.data.objects.new('Window sky plane',me);collection.objects.link(ob);ob.parent=entrance;me.materials.append(sky)
# A quiet neighborhood at different depths: plaster walls, tiled roofs, balconies and warm windows.
for i in range(9):
    bx=-5.7+i*1.43;by=.36+(i*3%5)*.18;bz=-29.65+(i%3)*.39;width=1.38+(i%2)*.16
    box('Rooftop neighborhood',(bx,by/2+.08,bz),(width,by,.65),stucco[i%3],entrance,.035)
    box('Terracotta cornice',(bx,by+.1,bz),(width+.15,.13,.8),roof,entrance,.025)
    for j in range(9):
        tile=cylinder('Curved roof tile',(bx-width*.45+j*width*.112,by+.2,bz),.064,.78,roof,entrance,12)
        tile.rotation_euler.x=math.pi/2
    for wx in [-.32,.32]:
        box('Amber room beyond',(bx+wx,by*.5+.08,bz+.34),(.18,.24,.014),window_light,entrance,.018)
        box('Tiny balcony sill',(bx+wx,by*.5-.06,bz+.4),(.26,.025,.14),paint,entrance,.008)
    if i%3==0:
        tube('Rooftop aerial',[(bx,by+.23,bz),(bx,by+.76,bz)],.012,night,entrance)
        tube('Aerial crossbar',[(bx-.15,by+.62,bz),(bx+.15,by+.62,bz)],.009,night,entrance)
# Slim tropical palms silhouette against the colored sky.
for px,pz,height in [(-4.65,-28.5,3.65),(4.25,-28.8,2.95)]:
    tube('Palm trunk',[(px,.06,pz),(px+.06,height*.45,pz),(px+.16,height,pz-.08)],.055,roof,entrance)
    for i in range(9):
        angle=i*math.pi*2/9;length=1.0+(i%3)*.14
        verts=[]
        for j in range(10):
            t=j/9;reach=t*length;w=math.sin(t*math.pi)*.14
            center=(px+.16+math.cos(angle)*reach,height+math.sin(t*math.pi)*.24-t*.48,pz-.08+math.sin(angle)*reach*.48)
            for side in [-1,1]:verts.append(xyz((center[0]-math.sin(angle)*w*side,center[1],center[2]+math.cos(angle)*w*side)))
        faces=[(j*2,j*2+1,j*2+3,j*2+2) for j in range(9)]
        me=bpy.data.meshes.new('Palm frond');me.from_pydata(verts,[],faces);me.update()
        ob=bpy.data.objects.new('Palm frond',me);collection.objects.link(ob);ob.parent=entrance;me.materials.append(night)
moon_mat=material('Evening moon',(.85,.82,.61),0,.9,1.1)
moon=cylinder('Moon beyond the window',(2.8,4.15,-30.07),.245,.012,moon_mat,entrance,64);moon.rotation_euler.x=math.pi/2
for sx,sy in [(-3.3,5.25),(-.65,5.55),(1.3,5.17),(4.3,5.3),(-4.8,4.65),(.8,4.42)]:
    box('First evening stars',(sx,sy,-30.04),(.022,.022,.013),moon_mat,entrance,.005)
# Gathered linen at the sides keeps the window soft and leaves the musical approach open.
tube('Curtain rod',[(-6.7,6.25,-25.08),(6.7,6.25,-25.08)],.04,brass,entrance)
for side in [-1,1]:
    verts=[];uvs=[];faces=[]
    for row in range(21):
        t=row/20;cy=6.15-t*6.05
        for col in range(25):
            u=col/24;gather=.73+.18*math.sin(t*math.pi)
            cx=side*(5.6+(u-.5)*gather+.16*math.sin(t*math.pi))
            cz=-25.1+math.sin(u*math.pi*10)*.10+math.sin(t*3)*.025
            verts.append(xyz((cx,cy,cz)));uvs.append((u,t))
    for row in range(20):
        for col in range(24):
            a=row*25+col;faces.append((a,a+1,a+26,a+25))
    me=bpy.data.meshes.new('Gathered linen curtain');me.from_pydata(verts,[],faces);me.update();uv=me.uv_layers.new(name='Linen weave')
    for face in me.polygons:
        face.use_smooth=True
        for li in face.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
    ob=bpy.data.objects.new('Gathered linen curtain',me);collection.objects.link(ob);ob.parent=entrance;me.materials.append(curtain)
    for j in range(7):
        cylinder('Curtain loop',(side*(5.6+(j-3)*.11),6.2,-25.1),.055,.022,brass,entrance,12).rotation_euler.x=math.pi/2

# Three centered components form one instanced note; every bevel is authored here.
note_body=root('note_body');note_face=root('note_face');note_inlay=root('note_inlay')
def faceted(name,width,depth,levels,mat,parent):
    x=width/2;z=depth/2;c=min(.13,width*.18,depth*.22)
    outline=[(-x+c,-z),(x-c,-z),(x,-z+c),(x,z-c),(x-c,z),(-x+c,z),(-x,z-c),(-x,-z+c)]
    verts=[];faces=[]
    for y,scale in levels:
        verts += [xyz((a*scale,y,b*scale)) for a,b in outline]
    faces.append(tuple(range(7,-1,-1)))
    for layer in range(len(levels)-1):
        for i in range(8):faces.append((layer*8+i,layer*8+(i+1)%8,(layer+1)*8+(i+1)%8,(layer+1)*8+i))
    faces.append(tuple((len(levels)-1)*8+i for i in range(8)))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    uv=me.uv_layers.new(name='Hand mapped face')
    for face in me.polygons:
        for li in face.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co.x/width+.5,co.y/depth+.5)
    ob=bpy.data.objects.new(name,me);collection.objects.link(ob);ob.parent=parent;me.materials.append(mat)
    return bevel(ob,.008,2)
faceted('Note machined shell',1,.83,[(-.135,.89),(-.09,1),(.095,1),(.15,.9)],brass,note_body)
for side in [-1,1]:
    for z in [-.25,.25]:cylinder('Micro rivet',(side*.405,.126,z),.026,.023,brass,note_body,12)
    for z in [-.16,0,.16]:box('Side grip rib',(side*.488,-.016,z),(.035,.085,.035),brass,note_body,.01)
resin=textured('Pearlescent note enamel',(1,1,1),'resin',.22)
p=resin.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,1,1,1);p.inputs['Emission Strength'].default_value=.24
faceted('Faceted enamel insert',.78,.59,[(-.045,.95),(-.018,1),(.031,.97),(.072,.81)],resin,note_face)
glyph=material('Note luminous inlay',(.94,.94,.9),.15,.25,1.4)
for x in [-.22,.22]:
    tube('Sculpted leading arrow',[(x,0,-.008),(0,0,.13)],.018,glyph,note_inlay)
for x in [-.31,.31]:box('Etched side glint',(x,-.002,-.08),(.012,.014,.12),glyph,note_inlay,.006)

# Cozy furniture is also a real Blender mesh collection, with packed fabric textures.
lounge=root('lounge')
velvet=textured('Cinnamon boucle',(.53,.25,.115),'cloth',.95)
linen=textured('Oatmeal linen',(.72,.64,.48),'cloth',.93)
olive=textured('Olive cushion weave',(.25,.31,.20),'cloth',.91)
couch=bpy.data.objects.new('Lounge couch assembly',None);collection.objects.link(couch);couch.parent=lounge
couch.location=xyz((-9.2,-3.2,-13.7));couch.rotation_euler.z=-.18
box('Rounded upholstered sofa base',(0,.58,0),(5.4,.85,2.1),velvet,couch,.28)
box('Soft sofa back',(0,1.64,-.82),(5.3,1.9,.42),velvet,couch,.21)
for side in [-1,1]:
    box('Deep seat cushion',(side*1.17,1.07,.12),(2.17,.4,1.62),velvet,couch,.19)
    box('Cushioned rolled arm',(side*2.49,1.19,0),(.48,1.4,2.07),velvet,couch,.22)
    box('Loose woven pillow',(side*1.64,1.68,-.38),(.94,.89,.3),linen if side<0 else olive,couch,.15)
    for z in [-.72,.72]:box('Walnut sofa foot',(side*2.1,.13,z),(.15,.28,.22),walnut,couch,.03)
    tube('Seat tailored seam',[(side*1.17-1,.99,.95),(side*1.17+1,.99,.95)],.012,ivory,couch)
table=cylinder('Round side table',(-12.65,-1.76,-12),.68,.11,walnut,lounge,64)
cylinder('Table stem',(-12.65,-2.42,-12),.045,1.3,brass,lounge)
cylinder('Table foot',(-12.65,-3.13,-12),.4,.09,dark,lounge)
cylinder('Ceramic coffee cup',(-12.7,-1.55,-11.96),.12,.25,ivory,lounge)
cylinder('Coffee surface',(-12.7,-1.422,-11.96),.10,.006,seam,lounge)
box('Music book',(-12.38,-1.65,-12.17),(.34,.07,.48),olive,lounge,.02)

def pendant(x,y,z):
    tube('Pendant suspension',[(x,9,z),(x,y+.9,z)],.023,dark,lounge)
    # Individual woven ribs create real gaps and a soft double-bell silhouette.
    for i in range(40):
        a=i*math.pi*2/40
        points=[]
        for j in range(13):
            t=j/12;r=.5+.84*math.sin(t*math.pi*.77)
            points.append((x+math.cos(a)*r,y+.83-t*1.7,z+math.sin(a)*r))
        tube('Woven pendant cane',points,.026,linen,lounge)
    for j in [0,3,7,11,12]:
        t=j/12;r=.5+.84*math.sin(t*math.pi*.77)
        tube('Rattan shade binding',[(x+math.cos(a*math.pi/32)*r,y+.83-t*1.7,z+math.sin(a*math.pi/32)*r) for a in range(65)],.032,walnut,lounge)
    cylinder('Linen light diffuser',(x,y-.18,z),.7,.035,light,lounge,48)
pendant(-8.8,5.1,-12)
pendant(8.9,5.25,-12.8)

# Apply modifiers and merge by material within each named master. This keeps the
# editable authored masters compact and maps the note parts to one draw each.
for master in roots:
    children=[ob for ob in master.children_recursive if ob.type in ['MESH','CURVE','FONT']]
    for ob in children:
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
        bpy.ops.object.convert(target='MESH')
        world=ob.matrix_world.copy();ob.parent=master;ob.matrix_world=world
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    by_material={}
    for ob in children:
        if ob.data.materials:by_material.setdefault(ob.data.materials[0],[]).append(ob.name)
    for mat,names in by_material.items():
        matches=[bpy.data.objects[name] for name in names if name in bpy.data.objects]
        if not matches:continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in matches:ob.select_set(True)
        bpy.context.view_layer.objects.active=matches[0]
        bpy.ops.object.join();bpy.context.object.name=master.name+' | '+mat.name
    for ob in list(master.children_recursive):
        if ob.type=='EMPTY':bpy.data.objects.remove(ob,do_unlink=True)

bpy.ops.object.select_all(action='DESELECT')
for master in roots:
    master.select_set(True)
    for ob in master.children_recursive:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'afterhours-playfield.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_extras=True,
    export_image_format='WEBP',export_image_quality=86,export_image_webp_fallback=False,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)

# Review composition: a close-up of the note family with the custom board behind.
for master in [note_body,note_face,note_inlay]:
    for ob in master.children_recursive:ob.hide_render=True
for x,color in [(-2.9,(.88,.53,.19)),(0,(.24,.68,.58)),(2.9,(.86,.32,.19))]:
    for master,y in [(note_body,.22),(note_face,.66),(note_inlay,.87)]:
        for source in master.children_recursive:
            ob=source.copy();ob.data=source.data.copy();ob.parent=None;scene.collection.objects.link(ob)
            ob.hide_render=False;ob.location=xyz((x,y,1.25));ob.scale=(2.5,2.5,2.5)
            if master==note_face:
                m=source.data.materials[0].copy();p=m.node_tree.nodes.get('Principled BSDF')
                p.inputs['Base Color'].default_value=(*color,1);p.inputs['Emission Color'].default_value=(*color,1)
                # Review tint; the web applies exactly this through instance colors.
                for edge in list(m.node_tree.links):
                    if edge.to_socket==p.inputs['Base Color']:m.node_tree.links.remove(edge)
                ob.data.materials.clear();ob.data.materials.append(m)
world=bpy.data.worlds.new('Playfield review ambience');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.095,.074,.049,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.38;scene.world=world
def area(name,pos,power,color,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=xyz(pos)
    ob.rotation_euler=(Vector(xyz(target))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Warm softbox',(-7,12,4),2100,(1,.75,.46),9,(0,0,-4))
area('Cream fill',(8,9,-10),1800,(.77,.9,1),8,(0,0,-9))
area('Entrance glow',(0,5,-25),900,(1,.56,.27),6,(0,0,-20))
camera_data=bpy.data.cameras.new('Playfield review camera');camera=bpy.data.objects.new('Playfield review camera',camera_data)
scene.collection.objects.link(camera);camera.location=xyz((15,12,18));camera.rotation_euler=(Vector(xyz((0,.1,-9)))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.lens=43;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1500;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ART/'afterhours-playfield.png')
scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'afterhours-playfield.blend'),compress=True)
print('PLAYFIELD_READY',str(OUT/'afterhours-playfield.glb'),(OUT/'afterhours-playfield.glb').stat().st_size)

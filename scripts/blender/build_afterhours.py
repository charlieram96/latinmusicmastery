"""Author PlaySense's Afterhours instrument collection in Blender.

Run via Blender MCP's execute_blender_code. Units and pivots match StageRenderer:
each instrument's playing surface is at Z=0; glTF export converts Z-up to Y-up.
All meshes, markings, and image textures are created here; no stock assets.
"""
import bpy
import math
import numpy as np
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art/playsense'
OUT = ROOT / 'public/playsense/models'
TEX = ART / 'textures'
TEX.mkdir(exist_ok=True)

# A separate authored scene protects any other open Blender scene.
old = bpy.data.scenes.get('Afterhours Instruments')
if old:
    for ob in list(old.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new('Afterhours Instruments')
bpy.context.window.scene = scene
assets = bpy.data.collections.new('PlaySense | Authored instruments')
scene.collection.children.link(assets)
roots = []

def image(name, data, noncolor=False):
    h,w = data.shape[:2]
    im = bpy.data.images.new(name,width=w,height=h,alpha=True)
    im.colorspace_settings.name = 'Non-Color' if noncolor else 'sRGB'
    rgba = np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3] = np.clip(data,0,1)
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = str(TEX / (name+'.png')); im.file_format='PNG'; im.save(); im.pack()
    return im

def normal_from_height(h, strength):
    dy,dx=np.gradient(h)
    v=np.stack([-dx*strength,-dy*strength,np.ones_like(h)],axis=-1)
    v/=np.linalg.norm(v,axis=-1,keepdims=True)
    return v*.5+.5

def mat(name,color,metal=0,rough=.4):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m

def textured_material(name,base,kind='wood'):
    size=1024
    y,x=np.mgrid[0:size,0:size].astype(np.float32)/size
    rng=np.random.default_rng(829 if kind=='wood' else 323)
    noise=rng.random((size,size),dtype=np.float32)-.5
    if kind=='wood':
        warp=x+np.sin(y*6.28+x*8)*.018+np.sin(y*15-x*11)*.006
        grain=np.sin(warp*math.pi*210 + np.sin(warp*55)*2)
        fine=np.sin(warp*math.pi*713+y*2)
        figure=np.sin(x*31+y*3)*np.sin(y*9+x*4)
        pores=np.maximum(0,np.sin(warp*1024+np.sin(y*120)*.4))**22
        shade=1+grain*.07+fine*.025+figure*.045+noise*.035-pores*.045
        # Slight stave-to-stave stain variation is in the painted color map.
        shade*=1+np.sin(np.floor(x*24)*4.72)*.045
        colors=np.array(base)[None,None,:]*shade[:,:,None]
        height=grain*.13+fine*.025+noise*.017
        rough=np.clip(.32+pores*.12+noise*.035,.24,.5)
        m=mat(name,base,0,.34)
        m.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.28
        m.node_tree.nodes.get('Principled BSDF').inputs['Coat Roughness'].default_value=.26
    else:
        radius=np.sqrt((x-.5)**2+(y-.5)**2)*2
        mottling=np.sin(x*19+y*9)*np.cos(y*25-x*4)*.035+np.sin(x*51-y*33)*.012
        wear=np.exp(-((x-.44)**2+(y-.52)**2)/.038)*.025
        edge=np.clip((radius-.75)/.3,0,1)*.12
        shade=1+mottling+noise*.035-wear-edge
        colors=np.array(base)[None,None,:]*shade[:,:,None]
        height=noise*.03+np.sin(x*400)*.012+np.cos(y*410)*.012
        rough=np.full((size,size),.78)+noise*.06
        m=mat(name,base,0,.78)
    nodes=m.node_tree.nodes; links=m.node_tree.links;p=nodes.get('Principled BSDF')
    color_im=image(name+' color',colors)
    normal_im=image(name+' normal',normal_from_height(height,2.5),True)
    rough_im=image(name+' roughness',np.repeat(rough[:,:,None],3,axis=2),True)
    for im,socket in [(color_im,'Base Color'),(rough_im,'Roughness')]:
        n=nodes.new('ShaderNodeTexImage');n.image=im;links.new(n.outputs['Color'],p.inputs[socket])
    n=nodes.new('ShaderNodeTexImage');n.image=normal_im
    norm=nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.45
    links.new(n.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs['Normal'],p.inputs['Normal'])
    return m

brass=mat('Satin champagne hardware',(.43,.33,.19),.87,.26)
chrome=mat('Brushed nickel',(.56,.59,.57),.94,.24)
dark=mat('Charcoal rubber',(.016,.022,.022),0,.71)
inlay=mat('Ivory enamel',(.79,.73,.56),.1,.42)
woods={
 'quinto':textured_material('Quinto | smoked walnut',(.29,.145,.064)),
 'conga':textured_material('Conga | honey oak',(.49,.258,.104)),
 'tumba':textured_material('Tumba | oxblood mahogany',(.31,.096,.061)),
}
skin=textured_material('Natural rawhide',(.77,.694,.531),'skin')
white=mat('Coated timbale head',(.67,.69,.66),0,.74)

def add_object(name,geometry,material,parent=None):
    ob=bpy.data.objects.new(name,geometry);assets.objects.link(ob)
    if material:ob.data.materials.append(material)
    if parent:ob.parent=parent
    return ob

def primitive_link(ob,name,material,parent):
    ob.name=name
    for col in list(ob.users_collection): col.objects.unlink(ob)
    assets.objects.link(ob)
    ob.data.materials.append(material);ob.parent=parent
    return ob

def smooth(ob):
    for p in ob.data.polygons:p.use_smooth=True
    return ob

def bevel(ob,width=.01,segments=3):
    mod=ob.modifiers.new('Rounded machined edge','BEVEL');mod.width=width;mod.segments=segments
    return ob

def box(name,location,scale,material,parent,edge=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    ob=primitive_link(bpy.context.object,name,material,parent);ob.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if edge:bevel(ob,edge)
    return ob

def cylinder(name,r,depth,location,material,parent,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=location)
    ob=primitive_link(bpy.context.object,name,material,parent);bevel(ob,.006,2)
    return smooth(ob)

def ring(name,r,tube,z,material,parent):
    bpy.ops.mesh.primitive_torus_add(major_segments=96,minor_segments=10,location=(0,0,z),major_radius=r,minor_radius=tube)
    return smooth(primitive_link(bpy.context.object,name,material,parent))

def tube(name,points,r,material,parent):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=12;curve.bevel_depth=r;curve.bevel_resolution=3
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    return add_object(name,curve,material,parent)

def text(name,body,size,location,material,parent,rotation=(math.pi/2,0,0)):
    curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.extrude=.001;curve.bevel_depth=.0006
    ob=add_object(name,curve,material,parent);ob.location=location;ob.rotation_euler=rotation
    return ob

def empty(name):
    ob=bpy.data.objects.new(name,None);assets.objects.link(ob);roots.append(ob);return ob

def create_conga(name,radius,height):
    root=empty(name)
    def radius_at(t):return radius*(.98+.18*math.sin(math.pi*t)-.34*t)
    for stave in range(24):
        vertices=[];faces=[];uvs=[]
        nrow=24;ncol=5
        for layer in range(2):
            for row in range(nrow+1):
                t=row/nrow
                r=radius_at(t)-(0.025 if layer else 0)
                z=-.055-t*(height-.1)
                for col in range(ncol+1):
                    theta=2*math.pi*(stave+(col/ncol)*.987+.0065)/24
                    vertices.append((r*math.cos(theta),r*math.sin(theta),z))
                    uvs.append(((stave+col/ncol)/24,1-t))
        stride=ncol+1;layer_count=(nrow+1)*stride
        for row in range(nrow):
            for col in range(ncol):
                a=row*stride+col
                faces.append((a,a+stride,a+stride+1,a+1))
                a+=layer_count;faces.append((a,a+1,a+stride+1,a+stride))
        for row in range(nrow):
            for col in [0,ncol]:
                a=row*stride+col;faces.append((a,a+layer_count,a+stride+layer_count,a+stride))
        for row in [0,nrow]:
            for col in range(ncol):
                a=row*stride+col;faces.append((a,a+1,a+1+layer_count,a+layer_count))
        mesh=bpy.data.meshes.new(name+' stave');mesh.from_pydata(vertices,[],faces);mesh.update()
        uv=mesh.uv_layers.new(name='Wood grain')
        for poly in mesh.polygons:
            for index in poly.loop_indices:uv.data[index].uv=uvs[mesh.loops[index].vertex_index]
        ob=add_object('Stave %02d'%(stave+1),mesh,woods[name],root);smooth(ob);bevel(ob,.0017,2)
    # A slightly crowned playing surface, with a tensioned skin and rolled flesh hoop.
    vertices=[(0,0,.018)];uvs=[(.5,.5)];faces=[]
    for j in range(1,10):
        r=radius*.936*j/9
        for i in range(96):
            a=i/96*math.pi*2;vertices.append((r*math.cos(a),r*math.sin(a),.018*(1-(j/9)**2)))
            uvs.append((.5+math.cos(a)*j/18,.5+math.sin(a)*j/18))
    for i in range(96):faces.append((0,1+i,1+(i+1)%96))
    for j in range(8):
        for i in range(96):
            a=1+j*96+i;b=1+j*96+(i+1)%96;faces.append((a,a+96,b+96,b))
    mesh=bpy.data.meshes.new('Tensioned rawhide');mesh.from_pydata(vertices,[],faces);mesh.update();uv=mesh.uv_layers.new(name='Hide surface')
    for poly in mesh.polygons:
        for i in poly.loop_indices:uv.data[i].uv=uvs[mesh.loops[i].vertex_index]
    smooth(add_object('Natural skin',mesh,skin,root))
    ring('Rolled rawhide edge',radius*.945,.016,-.005,skin,root)
    ring('Upper comfort crown',radius*1.005,.028,-.04,brass,root)
    ring('Lower crown bead',radius*1.014,.016,-.105,brass,root)
    ring('Dark isolation gasket',radius*.983,.012,-.018,dark,root)
    ring('Rubber foot',radius_at(1)*1.027,.028,-height+.035,dark,root)
    ring('Heel metal binding',radius_at(.96)*1.014,.012,-height+.1,brass,root)
    ring('Lower wood inlay',radius_at(.91)+.002,.004,-.055-.91*(height-.1),inlay,root)
    # Forged lugs with hooked tuning rods, washers, hex nuts and fine threads.
    for i in range(8):
        angle=(i+.5)/8*2*math.pi;co=math.cos(angle);si=math.sin(angle)
        lug=bpy.data.objects.new('Tuning assembly %d'%i,None);assets.objects.link(lug);lug.parent=root;lug.location=(co*radius*1.013,si*radius*1.013,-.24);lug.rotation_euler[2]=angle-math.pi/2
        box('Rubber lug seat',(0,0,0),(.114,.028,.2),dark,lug,.025)
        box('Forged lug',(0,.025,0),(.097,.057,.174),brass,lug,.03)
        tube('Bent tension hook',[(0,.016,.193),(0,.075,.17),(0,.078,.1),(0,.078,-.225)],.014,chrome,lug)
        cylinder('Tuning nut',.031,.05,(0,.078,-.218),brass,lug,6)
        cylinder('Nut washer',.039,.012,(0,.078,-.184),chrome,lug,32)
        for t in range(7):
            thread=ring('Exposed screw thread',.017,.002,-.115-t*.008,chrome,lug);thread.location.y=.078
        for z in [-.052,.052]:
            bolt=cylinder('Lug fastening',.014,.012,(0,.058,z),chrome,lug,6);bolt.rotation_euler[0]=math.pi/2
    # One restrained maker's medallion, with legible enamel engraving.
    front=-radius_at(.34)-.012
    plaque=box('Maker medallion',(0,front,-.57),(.19,.025,.245),brass,root,.04)
    box('Enamel medallion',(0,front-.016,-.57),(.153,.013,.203),dark,root,.031)
    text('PS monogram','PS',.08,(0,front-.027,-.56),inlay,root)
    text('Series mark','AFTERHOURS',.026,(0,front-.028,-.625),inlay,root)
    text('Head maker stamp','P L A Y S E N S E',.035,(0,radius*.64,.005),brass,root,rotation=(0,0,math.pi))
    return root

create_conga('quinto',.62,1.54)
create_conga('conga',.668,1.6)
create_conga('tumba',.716,1.66)

# Timbale shells use rolled steel with tension hardware and a coated head.
for name,r in [('timbale_macho',.62),('timbale_hembra',.7)]:
    root=empty(name)
    cylinder('Brushed steel shell',r,.46,(0,0,-.24),chrome,root,96)
    cylinder('Coated head',r*.972,.024,(0,0,.005),white,root,96)
    for z in [-.01,-.46]:ring('Rolled steel edge',r+.006,.022,z,chrome,root)
    ring('Head gasket',r*.98,.008,.021,dark,root)
    for i in range(10):
        a=i*math.pi/5;x=math.cos(a)*(r+.014);y=math.sin(a)*(r+.014)
        tube('Tension rod',[(x,y,-.06),(x*1.025,y*1.025,-.22),(x,y,-.39)],.013,chrome,root)
        nut=cylinder('Hex tension nut',.029,.045,(x,y,-.073),brass,root,6)
    box('Mounting bracket',(0,r+.05,-.3),(.24,.1,.2),dark,root,.027)
    text('Timbale mark','PLAYSENSE',.045,(0,-r-.009,-.23),inlay,root)

# Apply modifiers, convert lettering/curves and consolidate by material within each asset.
for root in roots:
    parts=list(root.children_recursive)
    meshes=[]
    for ob in parts:
        if ob.type in {'MESH','CURVE','FONT'}:
            bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
            bpy.ops.object.convert(target='MESH')
            world_matrix=ob.matrix_world.copy();ob.parent=None;ob.matrix_world=world_matrix;meshes.append(ob)
    # Keep transforms through the parenting conversion.
    for ob in meshes:ob.parent=root
    for ob in parts:
        if ob.type=='EMPTY':bpy.data.objects.remove(ob,do_unlink=True)
    materials={ob.data.materials[0] for ob in meshes if ob.data.materials}
    buckets={material:[ob for ob in meshes if ob.data.materials and ob.data.materials[0]==material] for material in materials}
    for material,selected in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for ob in selected:ob.select_set(True)
        bpy.context.view_layer.objects.active=selected[0]
        if len(selected)>1:bpy.ops.object.join()
        bpy.context.object.name=root.name+' | '+material.name
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

# Web asset has local pivots; the review scene below arranges the same masters.
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for ob in root.children_recursive:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'afterhours-instruments.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_extras=True,export_image_format='WEBP',export_image_quality=90,export_image_webp_fallback=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)

for i,root in enumerate(roots):
    if i<3:root.location=((i-1)*1.65,0,1.67)
    else:root.location=((i-3.5)*1.65,2.15,1.18)

# A presentation scene lets the editable file double as an asset review board.
studio=bpy.data.collections.new('Review lighting and backdrop');scene.collection.children.link(studio)
def relink(ob):
    for c in list(ob.users_collection):c.objects.unlink(ob)
    studio.objects.link(ob)
    return ob
bpy.ops.mesh.primitive_plane_add(size=200)
floor=relink(bpy.context.object);floor.name='Review ground';floor.data.materials.append(mat('Warm charcoal ground',(.025,.031,.029),.1,.38))
for name,position,energy,size,color in [
 ('Large warm softbox',(-3,-4,6),700,5,(1,.79,.53)),
 ('Cool edge',(4,1,5),950,4,(.58,.81,1)),
 ('Overhead ribbon',(-1,3,6),1000,3,(1,.88,.66)),
 ('Front fill',(0,-6,2.8),140,3,(1,.91,.79))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);studio.objects.link(ob);ob.location=position;ob.rotation_euler=(Vector((0,0,.8))-ob.location).to_track_quat('-Z','Y').to_euler()
world=bpy.data.worlds.new('Afterhours review world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.072,.09,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
camera_data=bpy.data.cameras.new('Asset review camera');camera=bpy.data.objects.new('Asset review camera',camera_data);studio.objects.link(camera)
camera.location=(5,-8,4.7);camera.rotation_euler=(Vector((0,.35,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=7.1;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ART/'afterhours-instruments.png')
scene.view_settings.view_transform='AgX'
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(ART/'afterhours-instruments.blend'),compress=True)
print('PLAYSENSE_ASSETS_EXPORTED',[(root.name,len(root.children_recursive)) for root in roots])
print('GLB_BYTES',(OUT/'afterhours-instruments.glb').stat().st_size)

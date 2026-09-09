import bpy
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
scene=bpy.data.scenes['Afterhours Instruments'];bpy.context.window.scene=scene
for name in ['quinto','conga','tumba']:
    root=scene.objects[name]
    low=min((ob.matrix_local @ Vector(corner)).z for ob in root.children_recursive if ob.type=='MESH' for corner in ob.bound_box)
    root.location.z=-low+.003
for name in ['timbale_macho','timbale_hembra']:
    root=scene.objects[name]
    low=min((ob.matrix_local @ Vector(corner)).z for ob in root.children_recursive if ob.type=='MESH' for corner in ob.bound_box)
    root.location.z=.5-low
    pedestal_name=name+' review plinth'
    if not scene.objects.get(pedestal_name):
        bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.79,depth=.5,location=(root.location.x,root.location.y,.25))
        ob=bpy.context.object;ob.name=pedestal_name
        ob.data.materials.append(bpy.data.materials.get('Warm charcoal ground'))
        bevel=ob.modifiers.new('Soft edge','BEVEL');bevel.width=.02;bevel.segments=3
scene.camera.location=(4.5,-8,4.7)
scene.camera.rotation_euler=(Vector((0,.35,1))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/playsense/afterhours-instruments.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('REVIEW_READY')

"""Export existing authored masters with local pivots and browser-friendly compression."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
scene=bpy.data.scenes['Afterhours Instruments'];bpy.context.window.scene=scene
names=['quinto','conga','tumba','timbale_macho','timbale_hembra']
roots=[scene.objects[name] for name in names]
transforms=[ob.matrix_world.copy() for ob in roots]
bpy.ops.object.select_all(action='DESELECT')
try:
    for root in roots:
        root.location=(0,0,0);root.select_set(True)
        for ob in root.children_recursive:
            if ob.type=='MESH':
                bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
                bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots:
        root.select_set(True)
        for ob in root.children_recursive:ob.select_set(True)
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/playsense/models/afterhours-instruments.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_extras=True,
        export_image_format='WEBP',export_image_quality=90,export_image_webp_fallback=False,
        export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)
finally:
    for root,transform in zip(roots,transforms):root.matrix_world=transform
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/playsense/afterhours-instruments.blend'),compress=True)
print('OPTIMIZED_GLB_BYTES',(ROOT/'public/playsense/models/afterhours-instruments.glb').stat().st_size)

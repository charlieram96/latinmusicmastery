"""Re-export just the six authored playfield masters, excluding all review scenes."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
scene=bpy.data.scenes['Afterhours Playfield'];bpy.context.window.scene=scene
bpy.ops.object.select_all(action='DESELECT')
for name in ['board','entrance','lounge','note_body','note_face','note_inlay']:
    ob=scene.objects[name];ob.select_set(True)
    for child in ob.children_recursive:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/playsense/models/afterhours-playfield.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_extras=True,
    export_image_format='WEBP',export_image_quality=86,export_image_webp_fallback=False,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)
print('PLAYFIELD_EXPORTED',(ROOT/'public/playsense/models/afterhours-playfield.glb').stat().st_size)

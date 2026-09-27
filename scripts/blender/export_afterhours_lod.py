"""Export the instrument collection with its heaviest hardware decimated for the web.

The conga lugs, hooks and rims are modelled for close-up renders (~190k triangles
per drum). From the game camera they cover a few hundred pixels, so this export
collapses those parts to roughly a quarter of their triangles. The editable
.blend is never saved: decimation happens on a throwaway copy of the scene data.

    /Applications/Blender.app/Contents/MacOS/Blender -b art/playsense/afterhours-instruments.blend \
      -P scripts/blender/export_afterhours_lod.py
    node scripts/blender/validate_asset.mjs
"""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# Target fraction of triangles kept, by material, for meshes above the threshold.
RATIOS = {'Brushed nickel': .22, 'Ivory enamel': .45, 'Satin champagne hardware': .45}
THRESHOLD = 12000

scene = bpy.data.scenes['Afterhours Instruments']
bpy.context.window.scene = scene
names = ['quinto', 'conga', 'tumba', 'timbale_macho', 'timbale_hembra']
roots = [scene.objects[name] for name in names]

before = after = 0
for root in roots:
    for ob in root.children_recursive:
        if ob.type != 'MESH' or not ob.data.materials:
            continue
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        before += tris
        material = ob.data.materials[0].name
        ratio = next((value for key, value in RATIOS.items() if material.startswith(key)), None)
        if ratio and tris > THRESHOLD:
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True); bpy.context.view_layer.objects.active = ob
            modifier = ob.modifiers.new('WebLOD', 'DECIMATE')
            modifier.decimate_type = 'COLLAPSE'; modifier.ratio = ratio; modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        after += sum(len(p.vertices) - 2 for p in ob.data.polygons)

for root in roots:
    root.location = (0, 0, 0)
    for ob in root.children_recursive:
        if ob.type == 'MESH':
            bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for ob in root.children_recursive:
        ob.select_set(True)
bpy.context.view_layer.update()
target = ROOT / 'public/playsense/models/afterhours-instruments.glb'
bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True, use_active_scene=True, export_apply=True, export_yup=True, export_extras=True,
    export_image_format='WEBP', export_image_quality=90, export_image_webp_fallback=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
print('LOD_TRIANGLES', before, '->', after)
print('OPTIMIZED_GLB_BYTES', target.stat().st_size)

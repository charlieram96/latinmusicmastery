"""Export the instrument collection with its heaviest hardware decimated for the web.

Also swaps in the high-detail conga skin (`art/playsense/textures/rawhide-hd color.png`):
normal and roughness maps are derived from it here and written beside it.

The conga lugs, hooks and rims are modelled for close-up renders (~190k triangles
per drum). From the game camera they cover a few hundred pixels, so this export
collapses those parts to roughly a quarter of their triangles. The editable
.blend is never saved: decimation happens on a throwaway copy of the scene data.

    /Applications/Blender.app/Contents/MacOS/Blender -b art/playsense/afterhours-instruments.blend \
      -P scripts/blender/export_afterhours_lod.py
    node scripts/blender/validate_asset.mjs
"""
import bpy
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# Target fraction of triangles kept, by material, for meshes above the threshold.
RATIOS = {'Brushed nickel': .22, 'Ivory enamel': .45, 'Satin champagne hardware': .45}
THRESHOLD = 12000

scene = bpy.data.scenes['Afterhours Instruments']
bpy.context.window.scene = scene
names = ['quinto', 'conga', 'tumba', 'timbale_macho', 'timbale_hembra']
roots = [scene.objects[name] for name in names]

def replace_skin():
    """Load the detailed rawhide and derive matching normal and roughness maps."""
    textures = ROOT / 'art/playsense/textures'
    source = bpy.data.images.load(str(textures / 'rawhide-hd color.png'))
    w, h = source.size
    rgba = np.array(source.pixels[:], dtype=np.float32).reshape(h, w, 4)
    luma = rgba[..., :3] @ np.array([.2126, .7152, .0722], dtype=np.float32)
    # Fine fibres only: remove the broad mottling before taking the slope.
    blur = luma.copy()
    for _ in range(6):
        blur = (blur + np.roll(blur, 1, 0) + np.roll(blur, -1, 0) + np.roll(blur, 1, 1) + np.roll(blur, -1, 1)) / 5
    detail = luma - blur
    dx = (np.roll(detail, -1, 1) - np.roll(detail, 1, 1)) * 5.5
    dy = (np.roll(detail, -1, 0) - np.roll(detail, 1, 0)) * 5.5
    normal = np.dstack([-dx, -dy, np.ones_like(dx)])
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    rough = np.clip(.7 - (luma - luma.mean()) * .9 - detail * 1.5, .45, .9)
    material = bpy.data.materials['Natural rawhide.001']
    for node in material.node_tree.nodes:
        if node.type != 'TEX_IMAGE':
            continue
        name = node.image.name
        image = node.image
        if image.size[0] != w:
            image.scale(w, h)
        if 'color' in name:
            data = rgba
        elif 'normal' in name:
            data = np.dstack([normal * .5 + .5, np.ones_like(dx)])
        else:
            data = np.dstack([rough, rough, rough, np.ones_like(rough)])
        image.pixels[:] = data.astype(np.float32).ravel()
        image.update(); image.pack()
        if 'color' not in name:
            copy = image.copy(); copy.filepath_raw = str(textures / f"rawhide-hd {'normal' if 'normal' in name else 'roughness'}.png")
            copy.file_format = 'PNG'; copy.save(); bpy.data.images.remove(copy)
    bpy.data.images.remove(source)

replace_skin()

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

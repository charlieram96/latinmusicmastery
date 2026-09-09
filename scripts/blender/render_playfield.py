"""Render the authored playfield review asynchronously so the MCP stays responsive."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
scene=bpy.data.scenes['Afterhours Playfield'];bpy.context.window.scene=scene
if not scene.objects.get('Playfield review ground'):
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-3.24))
    ob=bpy.context.object;ob.name='Playfield review ground'
    m=bpy.data.materials.new('Playfield review ground');m.diffuse_color=(.038,.045,.038,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.038,.045,.038,1);p.inputs['Roughness'].default_value=.84
    ob.data.materials.append(m)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/playsense/afterhours-playfield.blend'),compress=True)
def render_review():
    try:
        bpy.ops.render.render(write_still=True)
        Path('/tmp/playsense-playfield-render-status.txt').write_text('complete')
    except Exception as error:
        Path('/tmp/playsense-playfield-render-status.txt').write_text(str(error))
    return None
Path('/tmp/playsense-playfield-render-status.txt').write_text('rendering')
bpy.app.timers.register(render_review,first_interval=.5)
print('PLAYFIELD_RENDER_STARTED')

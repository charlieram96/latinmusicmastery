import bpy
scene=bpy.data.scenes['Afterhours Instruments']
bpy.context.window.scene=scene
bpy.ops.render.render(write_still=True)
print('PLAYSENSE_REVIEW_RENDER',scene.render.filepath)

"""Render a closer review of the entrance garden, areca rows and flower pergola."""
import bpy
from mathutils import Vector

scene=bpy.context.scene
camera=scene.camera
camera.location=(31,-61,39)
target=Vector((1,-22,1.7))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=70
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.render.resolution_x=1600
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.render.filepath=r'D:\AD_3D\preview\garden-pergola.png'
bpy.ops.render.render(write_still=True)

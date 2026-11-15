import bpy
from mathutils import Vector
s=bpy.context.scene;c=s.camera;c.data.type='PERSP';c.data.lens=23;c.location=(64,-27,3);c.rotation_euler=(Vector((64,-38,3))-c.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(64,-30,6));bpy.context.object.data.energy=1500;bpy.context.object.data.size=10
s.cycles.samples=12;s.render.resolution_x=1200;s.render.resolution_y=800;s.render.filepath=r'D:\AD_3D\preview\hall-celebration.png';bpy.ops.render.render(write_still=True)

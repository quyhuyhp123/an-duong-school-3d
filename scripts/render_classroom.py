import bpy,os
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=root+'/blender/an-duong-school.blend')
s=bpy.context.scene;cam=s.camera;cam.data.type='PERSP';cam.data.lens=21;cam.location=(0,39,1.8);cam.rotation_euler=(Vector((1,44,1.6))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(0,42,3.15));light=bpy.context.object;light.data.energy=220;light.data.shape='DISK';light.data.size=3.5
s.render.filepath=root+'/preview/classroom.png';bpy.ops.render.render(write_still=True)

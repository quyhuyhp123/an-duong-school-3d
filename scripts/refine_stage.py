import bpy, math, os
ROOT=r'D:\AD_3D'
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blender/an-duong-school.blend')
ob=bpy.data.objects['Campus_blue']
# The fascia is disconnected geometry inside the merged blue mesh.
import bmesh
bm=bmesh.new(); bm.from_mesh(ob.data)
verts=[v for v in bm.verts if abs((ob.matrix_world@v.co).y-26)<.18 and (ob.matrix_world@v.co).z>6.64]
bmesh.ops.delete(bm,geom=verts,context='VERTS'); bm.to_mesh(ob.data); bm.free()
outline=[(-8.7,6.55),(8.7,6.55)]+[(8.7*math.cos(math.pi*j/24),6.8+.9*math.sin(math.pi*j/24)) for j in range(25)]
verts=[(x,y,z) for y in [25.84,26.16] for x,z in outline]; n=len(outline)
faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
me=bpy.data.meshes.new('Filled blue fascia'); me.from_pydata(verts,[],faces); me.materials.append(bpy.data.materials['blue'])
obj=bpy.data.objects.new('Blue fascia',me); bpy.context.collection.objects.link(obj)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); obj.select_set(True); bpy.context.view_layer.objects.active=ob; bpy.ops.object.join()
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/an-duong-school.blend')
bpy.ops.export_scene.gltf(filepath=ROOT+'/models-src/an-duong-school.glb',export_format='GLB',export_cameras=False,export_lights=False)
s=bpy.context.scene; s.render.filepath=ROOT+'/preview/campus-overview.png'; bpy.ops.render.render(write_still=True)
from mathutils import Vector
cam=s.camera; cam.data.type='PERSP'; cam.data.lens=26; cam.location=(8,-15,2.7); cam.rotation_euler=(Vector((0,32,5))-cam.location).to_track_quat('-Z','Y').to_euler()
s.render.filepath=ROOT+'/preview/courtyard.png'; bpy.ops.render.render(write_still=True)

import bpy, math, os, random, json
from mathutils import Vector

ROOT = r'D:\AD_3D'
random.seed(12)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
M={}
def mat(name,color,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=.77; p.inputs['Metallic'].default_value=metal
    M[name]=m; return m
for n,c in {'wall':(.79,.61,.29),'cream':(.94,.85,.59),'trim':(.96,.92,.77),'roof':(.48,.15,.10),'window':(.075,.17,.19),'wood':(.26,.13,.065),'blue':(.035,.32,.66),'brick':(.52,.24,.17),'tile':(.57,.40,.33),'grout':(.67,.54,.43),'grass':(.26,.38,.10),'leaf':(.13,.29,.075),'leaflight':(.25,.42,.10),'trunk':(.36,.28,.17),'metal':(.31,.37,.35),'red':(.73,.035,.025),'gold':(.98,.73,.12),'black':(.045,.065,.055),'stone':(.66,.64,.55)}.items(): mat(n,c)
def cube(n,loc,size,m):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=n; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(M[m]); return o
def cyl(n,loc,r,depth,m,vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc); o=bpy.context.object; o.name=n; o.data.materials.append(M[m]); return o
def beam(n,a,b,r,m):
    d=Vector(b)-Vector(a); o=cyl(n,(Vector(a)+Vector(b))/2,r,d.length,m,8); o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def ball(n,loc,scale,m):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc); o=bpy.context.object; o.name=n; o.scale=scale; o.data.materials.append(M[m]); return o
fontpath='C:/Windows/Fonts/arialbd.ttf'
font=bpy.data.fonts.load(fontpath) if os.path.exists(fontpath) else None
def text(n,s,loc,size,m='gold'):
    cr=bpy.data.curves.new(n,'FONT'); cr.body=s; cr.align_x='CENTER'; cr.size=size; cr.extrude=.007
    if font: cr.font=font
    o=bpy.data.objects.new(n,cr); bpy.context.collection.objects.link(o); o.location=loc; o.rotation_euler=(math.pi/2,0,0); o.data.materials.append(M[m]); return o
def arch(n,x,y,z,width,height,depth,m):
    # Curved spandrel above each corridor opening.
    v=[]; f=[]; count=12
    for j in range(count+1):
        t=math.pi*j/count; px=x+width/2*math.cos(t); pz=z+height*math.sin(t)
        v.extend([(px,y-depth/2,pz),(px,y+depth/2,pz),(px,y-depth/2,z+height+.18),(px,y+depth/2,z+height+.18)])
    for j in range(count):
        a=j*4; b=a+4; f.extend([(a,b,b+2,a+2),(a+1,a+3,b+3,b+1),(a,a+1,b+1,b)])
    mesh=bpy.data.meshes.new(n); mesh.from_pydata(v,[],f); mesh.materials.append(M[m]); o=bpy.data.objects.new(n,mesh); bpy.context.collection.objects.link(o)

colliders=[]
def building(name,cx,cy,length,floors,angle=0,arched=True):
    before=set(bpy.data.objects)
    depth=8; h=3.6; bays=round(length/4.4); step=length/bays
    cube(name+' rooms',(0,2.2,floors*h/2),(length,3.6,floors*h),'wall')
    for floor in range(floors):
        z=floor*h
        cube('Corridor slab',(0,0,z+.12),(length+.6,8.6,.24),'trim')
        for j in range(bays+1):
            x=-length/2+j*step
            cube('Column',(x,-3.7,z+1.8),(.30,.40,h),'cream')
            cube('Column capital',(x,-3.7,z+3.12),(.49,.55,.18),'trim')
        for j in range(bays):
            x=-length/2+(j+.5)*step
            cube('Door frame',(x-.8,.35,z+1.45),(1.05,.17,2.65),'wood')
            cube('Door glass',(x-.8,.24,z+1.65),(.83,.05,1.98),'window')
            cube('Window frame',(x+.85,.34,z+1.9),(1.25,.16,1.65),'wood')
            cube('Window glass',(x+.85,.23,z+1.9),(1.08,.05,1.45),'window')
            for dx in [-.31,.31]: cube('Window bar',(x+.85+dx,.17,z+1.9),(.035,.035,1.45),'trim')
            if floor:
                cube('Balcony',(x,-3.7,z+.57),(step-.28,.20,.85),'cream')
                cube('Balcony cap',(x,-3.7,z+1.02),(step,.33,.11),'roof')
            if arched: arch('Corridor arch',x,-3.7,z+2.65,step-.28,.65,.42,'trim')
        cube('Floor cornice',(0,-3.77,z+3.45),(length+.5,.48,.2),'trim')
    cube('Roof cornice',(0,0,floors*h+.15),(length+.9,8.9,.35),'cream')
    if arched:
        for side in [-1,1]:
            o=cube('Terracotta roof',(0,side*2.3,floors*h+.65),(length+1,4.85,.16),'roof'); o.rotation_euler.x=-side*.17
    for o in set(bpy.data.objects)-before:
        p=o.location.copy(); o.location=(cx+p.x*math.cos(angle)-p.y*math.sin(angle),cy+p.x*math.sin(angle)+p.y*math.cos(angle),p.z); o.rotation_euler.z+=angle
    colliders.append({'position':[cx,floors*h/2, -cy],'size':[length,floors*h,8],'rotation':-angle})

cube('Foundation',(16,0,-.4),(120,112,.65),'grass')
cube('Courtyard',(0,4,-.08),(66,78,.18),'tile')
for x in range(-33,34,2): cube('Paving joint',(x,4,.018),(.018,78,.012),'grout')
for y in range(-35,44,2): cube('Paving joint',(0,y,.018),(66,.018,.012),'grout')
building('Main academic block',0,40,68,3)
building('West academic block',-36,12,48,3,math.pi/2)
building('East academic block',36,10,55,4,-math.pi/2,False)
text('School sign','TRƯỜNG THPT AN DƯƠNG',(0,35.83,9.7),.72,'blue')
text('Motto left','DẠY TỐT - HỌC TỐT',(-22,35.7,11.0),.42,'roof')
text('Motto right','TIÊN HỌC LỄ - HẬU HỌC VĂN',(21,35.7,11.0),.33,'roof')

# Blue ceremonial stage, the strongest landmark in the references.
cube('Stage plinth',(0,30,.48),(17,7,.96),'stone')
for j in range(3): cube('Stage step',(0,25.7+j*.42,.12+j*.13),(13,.85,.24+j*.26),'stone')
cube('Stage backdrop',(0,32.2,3.6),(15,.22,5.2),'brick')
cube('Red curtain',(-5.1,32.02,3.65),(4.3,.08,5.1),'red')
disc=cyl('Bronze drum emblem',(1.5,31.98,3.9),1.4,.10,'gold',48); disc.rotation_euler.x=math.pi/2
for x in [-8,8]: cyl('Blue stage pillar',(x,27.5,3.5),.36,6.2,'blue',16)
cube('Stage canopy',(0,29.4,6.75),(17.4,6.7,.28),'blue')
def stage_fascia():
    outline=[(-8.7,6.55),(8.7,6.55)]+[(8.7*math.cos(math.pi*j/24),6.8+.9*math.sin(math.pi*j/24)) for j in range(25)]
    verts=[(x,y,z) for y in [25.84,26.16] for x,z in outline]; n=len(outline)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new('Filled blue fascia'); me.from_pydata(verts,[],faces); me.materials.append(M['blue'])
    ob=bpy.data.objects.new('Blue curved fascia',me); bpy.context.collection.objects.link(ob)
stage_fascia()
text('Stage motto','HIỀN TÀI LÀ NGUYÊN KHÍ QUỐC GIA',(0,25.80,7.0),.39)
text('Stage title','KÝ ỨC SÂN TRƯỜNG',(1.5,31.79,1.6),.43,'cream')

def tree(x,y,palm=False):
    cyl('Tree planter',(x,y,.16),1.35,.32,'brick',16)
    cyl('Soil',(x,y,.33),1.16,.08,'grass',16)
    h=random.uniform(7.8,10) if palm else random.uniform(4.5,6.5)
    beam('Tree trunk',(x,y,.35),(x+.13,y,h),.13 if palm else .25,'trunk')
    if palm:
        for j in range(9):
            a=j*math.tau/9; tip=(x+3*math.cos(a),y+3*math.sin(a),h-.5)
            beam('Palm stem',(x,y,h),tip,.045,'leaf')
            o=ball('Palm frond',(x+1.65*math.cos(a),y+1.65*math.sin(a),h+.05),(2.0,.39,.25),'leaf'); o.rotation_euler.z=a
    else:
        for j in range(5):
            a=j*math.tau/5; ball('Tree crown',(x+1.1*math.cos(a),y+1.1*math.sin(a),h+random.random()),(2,1.9,1.8),'leaflight' if j%2 else 'leaf')
def bench(x,y,rot=0):
    before=set(bpy.data.objects)
    cube('Bench seat',(0,0,.58),(2.5,.65,.15),'stone')
    cube('Bench back',(0,.32,1.05),(2.5,.12,.85),'stone')
    for dx in [-.9,.9]: cube('Bench foot',(dx,0,.28),(.16,.55,.56),'stone')
    for o in set(bpy.data.objects)-before:
        p=o.location.copy(); o.location=(x+p.x*math.cos(rot)-p.y*math.sin(rot),y+p.x*math.sin(rot)+p.y*math.cos(rot),p.z); o.rotation_euler.z+=rot
for side in [-1,1]:
    for y in [-17,-5,8,20]:
        tree(side*27,y,palm=(side==-1)); bench(side*29,y+3,side*math.pi/2)

# Garden in the entrance half, visible in the overhead reference.
cube('Garden curb',(-8,-27,.17),(23,20,.34),'brick')
cube('Garden lawn',(-8,-27,.36),(22.4,19.4,.12),'grass')
for pos,sz in [((-8,-27,.45),(1.5,20,.08)),((-8,-27,.45),(23,1.5,.08))]: cube('Garden path',pos,sz,'tile')
cyl('Garden circle',(-8,-27,.48),3.3,.15,'brick',48)
cyl('Garden round bed',(-8,-27,.58),2.4,.12,'leaflight',32)
for x in [-16,0]:
    for y in [-34,-20]: tree(x,y,True)
for i in range(16):
    a=i*math.tau/16; ball('Garden shrub',(-8+6.8*math.cos(a),-27+6.4*math.sin(a),.85),(.7,.7,.55),'leaflight')
bench(-18,-27,-math.pi/2); bench(3,-27,math.pi/2)

# Gate: salmon piers, cream crossbeam and tiled roof.
for x in [-6.2,6.2]:
    cube('Gate pier',(x,-48,2.7),(.95,1.1,5.4),'brick')
    cube('Gate inset',(x,-48.58,2.7),(.62,.06,4.95),'cream')
cube('Gate lintel',(0,-48,5.5),(14.3,1.8,.65),'cream')
cube('Gate name board',(0,-49,5.51),(10,.09,.54),'window')
text('Gate school name','TRƯỜNG TRUNG HỌC PHỔ THÔNG AN DƯƠNG',(0,-49.08,5.36),.25,'gold')
for s in [-1,1]:
    roof=cube('Gate tiled roof',(0,-48+s*.7,6.03),(15,1.65,.18),'roof'); roof.rotation_euler.x=-s*.15
for x in range(-40,41,4):
    if abs(x)<8: continue
    cube('Boundary pier',(x,-48,1.5),(.35,.4,3),'cream')
    cube('Boundary wall',(x+1.8,-48,.8),(3.6,.3,1.6),'wall')
    for dx in [.4,1,1.6,2.2,2.8,3.4]: cube('Fence bar',(x+dx,-48,2.15),(.035,.05,1.1),'metal')
for x in [-4.5,4.5]:
    gate=cube('Open gate',(x,-45.8,1.5),(.1,4,3),'metal')
    for y in [-47.5,-46.8,-46.1,-45.4,-44.7]: cube('Gate iron bar',(x,y,2),(.13,.05,2),'black')

# Flagpole and a simple fabric flag.
cube('Flag base',(-12,24,.3),(2,2,.6),'stone')
cyl('Flagpole',(-12,24,5.8),.055,11,'metal',12)
cube('Vietnam flag',(-10.9,24,10.3),(2.2,.035,1.4),'red')
verts=[]
for i in range(10):
    a=math.pi/2+i*math.pi/5; r=.43 if i%2==0 else .18; verts.append((-10.9+r*math.cos(a),23.97,10.3+r*math.sin(a)))
me=bpy.data.meshes.new('Star'); me.from_pydata(verts,[],[tuple(range(10))]); me.materials.append(M['gold']); ob=bpy.data.objects.new('Flag star',me); bpy.context.collection.objects.link(ob)

# Pergola / swings and a bicycle shelter, approximate placement from reference views.
for x in [15,25]:
    for y in [-32,-22]: beam('Pergola post',(x,y,0),(x,y,3.5),.07,'metal')
for x in range(15,26,2): beam('Pergola roof',(x,-32,3.5),(x,-22,3.5),.045,'metal')
for y in [-32,-22]: beam('Pergola cross',(15,y,3.5),(25,y,3.5),.07,'metal')
for x in [18,22]:
    for dx in [-.9,.9]: beam('Swing chain',(x+dx,-26,3.5),(x+dx,-26,.7),.02,'metal')
    cube('Swing seat',(x,-26,.68),(2,.65,.12),'trim')
# Corrected campus extension from the user's annotated aerial photograph.
# Near-gate building sits clear of the front garden and the main entrance axis.
def pitched_block(name,cx,cy,width,depth,height):
    cube(name+' foundation',(cx,cy,.18),(width+.7,depth+.7,.36),'stone')
    cube(name+' walls',(cx,cy,height/2+.2),(width,depth,height),'trim')
    for side in [-1,1]:
        roof=cube(name+' pitched roof',(cx,cy+side*depth/4,height+.9),(width+1.2,depth/2+1,.18),'roof')
        roof.rotation_euler.x=-side*.24
    for x in range(int(cx-width/2+2),int(cx+width/2),3):
        for side in [-1,1]:
            cube(name+' window frame',(x,cy+side*(depth/2+.025),height*.55),(1.3,.1,1.8),'wood')
            cube(name+' window glass',(x,cy+side*(depth/2+.09),height*.55),(1.1,.04,1.6),'window')
    colliders.append({'position':[cx,height/2+.2,-cy],'size':[width,height,depth],'rotation':0})

pitched_block('Near gate building',-24,-42,25,9,4.4)
text('Near gate building label','NHÀ GẦN CỔNG',(-24,-46.62,3.75),.32,'roof')

# Lane behind the right classroom wing, opening east through the secondary gate.
cube('East access lane',(44,0,.025),(7,88,.1),'stone')
cube('Secondary entrance approach',(59,-19,.03),(30,7,.1),'stone')
for y0,y1 in [(-48,-23),( -15,48)]:
    cube('East perimeter wall',(75,(y0+y1)/2,1.1),(.35,y1-y0,2.2),'cream')
for y in [-23,-15]:
    cube('Secondary gate pier',(74.4,y,2.3),(1,1,4.6),'brick')
    cube('Secondary gate capital',(74.4,y,4.65),(1.4,1.4,.25),'cream')
cube('Secondary gate lintel',(74.4,-19,4.9),(1.1,9.5,.42),'cream')
label=text('Secondary gate sign','CỔNG PHỤ',(75.02,-19,4.8),.3,'blue'); label.rotation_euler.z=math.pi/2
for y in [-22.5,-15.5]:
    for x in [71.2,71.8,72.4,73,73.6]: cube('Open secondary gate bars',(x,y,1.6),(.045,.08,3.2),'metal')

# Bicycle parking to the right of the secondary entrance lane.
cube('Bicycle parking slab',(59,-34,.08),(23,20,.16),'stone')
for s in [-1,1]:
    roof=cube('Bicycle shelter roof',(59,-34+s*5,3.9),(24,10.5,.14),'metal'); roof.rotation_euler.x=-s*.12
for x in [48,59,70]:
    for y in [-43,-34,-25]: beam('Bicycle shelter post',(x,y,.16),(x,y,3.8),.085,'metal')
for x in range(49,71,2):
    for y in [-39,-30]:
        beam('Bicycle parking rack',(x,y,.2),(x,y,1),.035,'metal')
        beam('Bicycle rack top',(x,y,1),(x+.8,y,1),.035,'metal')
text('Bicycle shelter sign','NHÀ ĐỂ XE',(59,-44.3,3.2),.52,'blue')

# Multipurpose hall beyond the approach, behind the east academic block.
cube('Multipurpose hall plinth',(59,10,.2),(25,43,.4),'stone')
cube('Multipurpose hall walls',(59,10,3.7),(24,42,7),'trim')
for side in [-1,1]:
    roof=cube('Multipurpose hall metal roof',(59+side*6,10,8.1),(12.7,43.3,.18),'metal'); roof.rotation_euler.y=side*.20
for y in range(-7,31,5):
    for x in [46.94,71.06]:
        cube('Hall high window',(x,y,5),(.1,2.8,1.8),'window')
        cube('Hall wall pilaster',(x,y-1.8,3.7),(.25,.3,7),'cream')
cube('Hall entry',(59,-11.08,2.1),(4,.12,4),'blue')
text('Multipurpose hall sign','NHÀ ĐA NĂNG',(59,-11.18,5.5),.65,'blue')
colliders.append({'position':[59,3.7,-10],'size':[24,7,42],'rotation':0})
for y in [-6,8,23,38]: tree(43,y,False)

# Merge static meshes by material for a small GLB and fewer draw calls on the web.
for o in list(bpy.context.scene.objects):
    if o.type=='FONT':
        bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
for name,material in M.items():
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==material]
    if not objs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); objs[0].name='Campus_'+name

scene=bpy.context.scene
scene.world.color=(.6,.7,.8); scene.world.use_nodes=True
bg=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'); bg.inputs['Color'].default_value=(.67,.79,.92,1); bg.inputs['Strength'].default_value=.65
bpy.ops.object.light_add(type='SUN',location=(10,-20,40)); sun=bpy.context.object; sun.name='Afternoon sun'; sun.rotation_euler=(.4,-.5,-.5); sun.data.energy=2.5; sun.data.angle=.12
bpy.ops.object.camera_add(location=(112,-130,110)); cam=bpy.context.object; cam.rotation_euler=(Vector((14,0,2))-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=154; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=1600; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
os.makedirs(ROOT+'/public/models',exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/an-duong-school.blend')
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/an-duong-school.glb',export_format='GLB',use_selection=False,export_cameras=False,export_lights=False)
with open(ROOT+'/public/models/colliders.json','w',encoding='utf8') as f: json.dump(colliders,f)
scene.render.filepath=ROOT+'/preview/campus-overview.png'; bpy.ops.render.render(write_still=True)
cam.data.type='PERSP'; cam.data.lens=26; cam.location=(8,-15,2.7); cam.rotation_euler=(Vector((0,32,5))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=ROOT+'/preview/courtyard.png'; bpy.ops.render.render(write_still=True)
print('DONE: BLEND, GLB and two previews created')

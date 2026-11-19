import bpy, math, os, random, json, sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(12)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
M={}
def mat(name,color,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=.77; p.inputs['Metallic'].default_value=metal
    M[name]=m; return m
for n,c in {'wall':(.79,.61,.29),'cream':(.94,.85,.59),'trim':(.96,.92,.77),'roof':(.48,.15,.10),'window':(.075,.17,.19),'wood':(.26,.13,.065),'blue':(.035,.32,.66),'brick':(.52,.24,.17),'tile':(.57,.40,.33),'grout':(.67,.54,.43),'grass':(.26,.38,.10),'leaf':(.13,.29,.075),'leaflight':(.25,.42,.10),'trunk':(.36,.28,.17),'metal':(.31,.37,.35),'red':(.73,.035,.025),'gold':(.98,.73,.12),'black':(.045,.065,.055),'stone':(.66,.64,.55),'water':(.12,.49,.68),'rock':(.30,.32,.28),'flower':(.78,.035,.23),'court':(.47,.52,.49)}.items(): mat(n,c)
# kính cửa sổ 3 dãy chính: xanh nhạt, trong suốt (glTF alphaMode BLEND), bóng
mat('glass',(.72,.86,.92));_g=M['glass'];_gp=next(n for n in _g.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
_gp.inputs['Alpha'].default_value=.28;_gp.inputs['Roughness'].default_value=.05
for _attr,_val in [('surface_render_method','BLENDED'),('blend_method','BLEND')]:
    try:setattr(_g,_attr,_val)
    except Exception:pass
_g.use_backface_culling=False
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
    cr=bpy.data.curves.new(n,'FONT'); cr.body=s; cr.align_x='CENTER'; cr.size=size; cr.extrude=.003; cr.resolution_u=3
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
def old_building(name,cx,cy,length,floors,angle=0,arched=True):
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

exec(compile(open(os.path.join(ROOT,'scripts','interiors.py'),encoding='utf8').read(),'interiors.py','exec'))
cube('Foundation',(11,-7,-.3),(130,126,.6),'grass')   # x -54 → 76; z -56 → 70 (nới 14 m về phía nam cho đường & dãy quán trước cổng)
cube('Courtyard',(0,4,-.08),(66,78,.18),'tile')
for x in range(-33,34,2): cube('Paving joint',(x,4,.018),(.018,78,.012),'grout')
for y in range(-35,44,2): cube('Paving joint',(0,y,.018),(66,.018,.012),'grout')
building('A - Dãy chính',0,40,68,3)
# Dãy B sơn trắng: tường/cột (cream), vách trong (wall), sàn & gờ (trim) đổi sang tông trắng — chỉ riêng dãy B.
mat('bwhite',(.95,.95,.93));mat('bwall',(.9,.89,.86));mat('btrim',(.88,.88,.86))
mat('drumred',(.6,.04,.035));mat('drumskin',(.86,.8,.66))
_b_before=set(bpy.data.objects)
building('B - Dãy trái',-36,19,30,3,math.pi/2)
_remap={M['cream']:M['bwhite'],M['wall']:M['bwall'],M['trim']:M['btrim']};_white={}
for o in set(bpy.data.objects)-_b_before:
    if o.type!='MESH' or not any(m in _remap for m in o.data.materials):continue
    if o.data.name not in _white:
        d=o.data.copy()
        for i,m in enumerate(d.materials):
            if m in _remap:d.materials[i]=_remap[m]
        _white[o.data.name]=d
    o.data=_white[o.data.name]
building('C - Dãy phải',36,13,42,3,-math.pi/2,False)
for side in [-1,1]:
    # tầng 1: tấm nối rộng như cũ; tầng 2, 3: chỉ lấp đúng khe giữa đầu hành lang dãy cánh (y 34) và sàn dãy A (y 34.9),
    # từ mép ngoài hành lang cánh (|x| 30.85) tới đầu hồi dãy A (|x| 34) — không chìa gờ sàn ra ngoài lan can
    for floor in range(3):
        if floor==0:cube('Corner corridor connecting slab',(side*32,34.5,0),(4.3,5,.2),'trim',True)
        else:cube('Corner corridor connecting slab',(side*32.425,34.45,floor*3.6),(3.15,1.0,.2),'trim',True)
    # Nối lan can hành lang ở góc (tầng 2 & 3; tầng 1 để hở): lan can dãy A dừng ở |x| 29.5 (mép y 34.85),
    # lan can dãy cánh dừng ở y 34 (mép |x| 30.85) → thêm đoạn chữ L cùng kích thước để 2 lan can liền nhau.
    wing_m='bwhite' if side<0 else 'cream'
    for floor in [1,2]:
        z=floor*3.6
        cube('Corner balcony link',(side*30.22,34.85,z+.52),(1.44,.18,.85),'cream',True)   # dọc mép dãy A: |x| 29.5 → 30.94
        cube('Corner balcony link coping',(side*30.22,34.85,z+.99),(1.44,.3,.1),'brick')
        cube('Corner balcony link',(side*30.85,34.47,z+.52),(.18,.94,.85),wing_m,True)     # dọc mép dãy cánh: y 34 → 34.94
        cube('Corner balcony link coping',(side*30.85,34.47,z+.99),(.3,.94,.1),'brick')
        # phía trong góc, sát lớp học: lan can cuối hành lang dãy A (|x| 34, từ y 34.85) kéo xuống y 34, rồi rẽ sang
        # chạm tường lớp đầu dãy cánh (|x| 34.85) — trước đây hở 1 ô ~0.85 m nhìn thẳng xuống đất
        cube('Corner class-side railing',(side*34,34.47,z+.52),(.18,.94,.85),'cream',True)
        cube('Corner class-side railing coping',(side*34,34.47,z+.99),(.3,.94,.1),'brick')
        cube('Corner class-side railing',(side*34.42,34,z+.52),(.86,.18,.85),wing_m,True)
        cube('Corner class-side railing coping',(side*34.42,34,z+.99),(.86,.3,.1),'brick')

# Blue ceremonial stage, the strongest landmark in the references.
stage_objects_before=set(bpy.data.objects)
cube('Stage plinth',(0,30,.48),(17,7,.96),'stone')
for j in range(3): cube('Stage step',(0,25.7+j*.42,.12+j*.13),(13,.85,.24+j*.26),'stone')
cube('Stage backdrop',(0,32.2,3.6),(15,.22,5.2),'blue')
photo_panel('Stage real backdrop',(0,32.065,3.6),(14.9,5.18),(594,518,1500,900))
for x in [-8,8]:
    cyl('Blue stage pillar',(x,27.5,3.5),.36,6.2,'blue',24)
    cyl('Stage pillar base',(x,27.5,.45),.49,.22,'blue',24)
    for zz in [1.65,3.0,4.35,5.7]:cyl('Pillar silver band',(x,27.5,zz),.366,.028,'trim',24)
cube('Stage canopy',(0,29.4,6.75),(17.4,6.7,.28),'blue')
def stage_fascia():
    outline=[(-8.7,6.55),(8.7,6.55)]+[(8.7*math.cos(math.pi*j/24),6.8+.9*math.sin(math.pi*j/24)) for j in range(25)]
    verts=[(x,y,z) for y in [25.84,26.16] for x,z in outline]; n=len(outline)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new('Filled blue fascia'); me.from_pydata(verts,[],faces); me.materials.append(M['blue'])
    ob=bpy.data.objects.new('Blue curved fascia',me); bpy.context.collection.objects.link(ob)
stage_fascia()
for j in range(24):
    a=math.pi*j/24;b=math.pi*(j+1)/24
    beam('Stage curved blue rim',(8.7*math.cos(a),25.80,6.8+.9*math.sin(a)),(8.7*math.cos(b),25.80,6.8+.9*math.sin(b)),.045,'blue')
text('Stage motto','HIỀN TÀI LÀ NGUYÊN KHÍ QUỐC GIA',(0,25.62,6.96),.65)
for x in [-10.5,10.5]:
    cyl('Conifer planter',(x,31.2,.22),1.05,.44,'brick',20)
    cyl('Conifer trunk',(x,31.2,4.8),.13,9.2,'trunk',12)
    for j in range(7):
        bpy.ops.mesh.primitive_cone_add(vertices=14,radius1=1.4-j*.14,radius2=.08,depth=2.4,location=(x,31.2,3.6+j*.95))
        conifer=bpy.context.object;conifer.name='Layered conifer crown';conifer.data.materials.append(M['leaf'])
# The stage and school sign share the same central axis in the supplied photograph.
# Keep the two side approaches clear so the staircase is still reachable.

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
# Terrazzo-inspired palette from the supplied stone bench photograph.
mat('benchturquoise',(.18,.52,.58));mat('benchgold',(.77,.59,.28));mat('benchwhite',(.91,.92,.87))
for key in ['benchturquoise','benchgold','benchwhite']:
    material=M[key];nodes=material.node_tree.nodes;links=material.node_tree.links
    nodes.get('Principled BSDF').inputs['Base Color'].default_value=material.diffuse_color
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=190
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.48;ramp.color_ramp.elements[0].color=material.diffuse_color
    ramp.color_ramp.elements[1].position=.65;ramp.color_ramp.elements[1].color=(.97,.97,.91,1)
    links.new(noise.outputs['Fac'],ramp.inputs[0]);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.72
def bench(x,y,rot=0):
    before=set(bpy.data.objects)
    for xx,width,color in [(0,1.65,'benchturquoise'),(-1.05,.4,'benchgold'),(1.05,.4,'benchgold')]:
        cube('Bench seat',(xx,0,.58),(width,.65,.15),color)
        cube('Bench back',(xx,.32,1.05),(width,.12,.85),color)
    for xx in [-.845,.845]:
        cube('Bench white inlay',(xx,.32,1.05),(.045,.125,.85),'benchwhite')
        cube('Bench seat white inlay',(xx,0,.58),(.045,.65,.155),'benchwhite')
    for dx in [-.9,.9]: cube('Bench foot',(dx,0,.28),(.16,.55,.56),'benchwhite')
    for wording,z,size in [('TẬP THỂ LỚP 12A3',1.32,.13),('NIÊN KHÓA 2015–2018',1.09,.12),('KÍNH TẶNG',.87,.13)]:
        text('Stone bench dedication',wording,(0,.245,z),size,'benchwhite')
    cube('Bench collider',(0,.05,.74),(2.55,.8,1.48),'black',True)   # khối va chạm vô hình (mặt ngồi + lưng tựa) — không đi xuyên ghế
    seats.append({'id':f'bench-{len(seats)}','label':'ghế đá','position':[x,1.015,-y],'yaw':math.pi-rot,'exit':[x+math.sin(rot)*1.1,.98,-y+math.cos(rot)*1.1]})
    for o in set(bpy.data.objects)-before:
        p=o.location.copy(); o.location=(x+p.x*math.cos(rot)-p.y*math.sin(rot),y+p.x*math.sin(rot)+p.y*math.cos(rot),p.z); o.rotation_euler.z+=rot
for side in [-1,1]:
    for y in ([9,26] if side==-1 else [-17,-5,8,20]):
        # cây (34,-17) đẩy sang trái (three.js x 30.6, z 13.5) nhường chỗ cho nhà xe 1 tầng; bỏ ghế đá của cây này
        special=side==1 and y==-17
        tree(*((30.6,-13.5) if special else (side*27,y)))
        if not special:bench(side*30.25,18 if side==1 and y==8 else y+3,-side*math.pi/2)

# The garden now fills the space right up to the first areca planting strip.
garden_x,garden_y=-18,-20.6
_garden_before=set(bpy.data.objects)
cube('Garden curb',(garden_x,garden_y,.17),(27.6,24.8,.34),'brick')
cube('Garden lawn',(garden_x,garden_y,.36),(27,24.2,.12),'grass')
cube('Garden path',(garden_x,garden_y,.45),(1.5,24.8,.08),'tile')
cube('Garden cross path',(garden_x,garden_y,.45),(27.6,1.5,.08),'tile')
for x in [-25,-11]:
    for y in [-32,-27,-22,-17]: ball('Garden low shrub',(x,y,.75),(.75,.8,.65),'leaflight')
for x in [-29,-18,-7]:
    for y in [-33,-14]: ball('Garden shrub',(x,y,.85),(.7,.7,.55),'leaflight')
bench(30.25,-6,-math.pi/2)
cyl('Garden circular edging',(garden_x,garden_y,.5),2.9,.16,'brick',32)
cyl('Garden circular planting',(garden_x,garden_y,.61),2.55,.09,'grass',32)
for a in range(8):
    t=a*math.tau/8;ball('Garden flower mound',(garden_x+1.8*math.cos(t),garden_y+1.8*math.sin(t),.8),(.48,.48,.3),'leaflight')

# Four framed garden beds with red, pink and yellow flowering shrubs.
mat('gardenred',(.86,.04,.065));mat('gardenpink',(.98,.26,.53));mat('gardenyellow',(.98,.73,.06))
for ix,(x0,x1) in enumerate([(-30.8,-20.5),(-15.5,-5.2)]):
    for iy,(y0,y1) in enumerate([(-32,-23.1),(-18.1,-9.2)]):
        for yy in [y0,y1]:cube('Flower bed brick border',((x0+x1)/2,yy,.56),(x1-x0,.18,.22),'brick')
        for xx in [x0,x1]:cube('Flower bed brick border',(xx,(y0+y1)/2,.56),(.18,y1-y0,.22),'brick')
        for j in range(9):
            xx=x0+1+(j%3)*(x1-x0-2)/2;yy=y0+1+(j//3)*(y1-y0-2)/2
            ball('Flowering shrub foliage',(xx,yy,.9),(.65,.65,.48),'leaf')
            color=['gardenred','gardenpink','gardenyellow'][(j+ix+iy)%3]
            for k in range(8):
                a=k*math.tau/8
                ball('Garden colourful blossom',(xx+.44*math.cos(a),yy+.44*math.sin(a),1.16+(.1 if k%2 else 0)),(.16,.16,.13),color)
# Vườn hoa: cỏ & lối đi trước đây cao .42–.49 m nhưng không có va chạm → nhân vật đi ở mặt đất, lún chân.
# Hạ cả khu vườn .2 m (cỏ cao .22 m — bước lên được, autostep .27 m) rồi thêm va chạm cho bờ, cỏ, lối đi, bồn tròn, viền luống.
for o in set(bpy.data.objects)-_garden_before:
    if o.name.startswith(('Garden','Flower')):o.location.z-=.2
for o in [o for o in bpy.data.objects if o.name.startswith(('Garden curb','Garden lawn'))]:solids.append(o)   # bờ gạch đỉnh .14, cỏ đỉnh .22
for o in [o for o in bpy.data.objects if o.name.startswith(('Garden path','Garden cross path'))]:
    o.location.z=.24;o.scale.z=.04;solids.append(o)   # lối lát gạch .22 → .26, nhô 4 cm trên cỏ
for o in [o for o in bpy.data.objects if o.name.startswith('Flower bed brick border')]:
    o.location.z=.335;o.scale.z=.27;solids.append(o)  # viền luống chạm mặt cỏ (.2 → .47), bước qua được
for r,z,h in [(2.9,.30,.16),(2.55,.41,.09)]:      # bồn tròn giữa vườn: viền .38, cỏ trong bồn .455
    for w,d in [(2*r,.8*r),(1.6*r,1.6*r),(.8*r,2*r)]:cube('Planter support collider',(garden_x,garden_y,z),(w,d,h),'grass',True)
# Pave the marked entrance forecourt between the building and basketball court.
cube('Main gate tiled forecourt',(.5,-40.5,.025),(21,15,.08),'tile',True)
for xx in range(-10,12,2):cube('Forecourt paving joint',(xx,-40.5,.073),(.018,15,.012),'grout')
for yy in range(-48,-32,2):cube('Forecourt paving joint',(.5,yy,.073),(21,.018,.012),'grout')

# The two marked red strips are straight rows of slender, feather-leaved areca palms.
mat('palmtrunk',(.48,.49,.44));mat('palmrings',(.32,.35,.31));mat('palmdeep',(.045,.19,.055));mat('palmgreen',(.09,.28,.07))
areca_leaf_mesh=None
def areca_leaves():
    global areca_leaf_mesh
    if areca_leaf_mesh is not None:return areca_leaf_mesh
    verts=[];faces=[];indices=[]
    for layer,count in [(0,12),(1,11),(2,8)]:
        for j in range(count):
            angle=j*math.tau/count+layer*.43;ca,sa=math.cos(angle),math.sin(angle)
            length=2.45-layer*.32
            def p(t,side=0):
                r=t*length
                z=.35+layer*.24+(.9 if layer<2 else 1.7)*math.sin(t*math.pi*.8)-(1.8 if layer==0 else 1.05)*t*t
                return Vector((r*ca-side*sa,r*sa+side*ca,z))
            for k in range(1,20):
                t=k/21;center=p(t);span=(.22+.43*math.sin(t*math.pi))*(1-.3*t)
                for side in [-1,1]:
                    tip=p(min(1,t+.09),side*span);tip.z-=.18+.18*t
                    middle=center.lerp(tip,.5);middle.z+=.055
                    tangent=Vector((ca,sa,0))*(.04+.025*math.sin(t*math.pi))
                    base=len(verts);verts.extend([tuple(center),tuple(middle-tangent),tuple(tip),tuple(middle+tangent)])
                    faces.extend([(base,base+1,base+2,base+3),(base+3,base+2,base+1,base)]);indices.extend([j%2,j%2])
            for k in range(9):
                start=p(k/9);end=p((k+1)/9);axis=end-start
                side=Vector((-sa,ca,0))*.014;base=len(verts)
                verts.extend([tuple(start-side),tuple(start+side),tuple(end+side),tuple(end-side)])
                faces.append((base,base+1,base+2,base+3));indices.append(1)
    me=bpy.data.meshes.new('Dense arching pinnate palm crown');me.from_pydata(verts,[],faces)
    me.materials.append(M['palmdeep']);me.materials.append(M['palmgreen'])
    for polygon,index in zip(me.polygons,indices):polygon.material_index=index
    areca_leaf_mesh=me;return me
def areca(x,y):
    h=7.5
    for j in range(32):
        z=.32+(j+.5)*(h-.32)/32;r=.15-.035*j/32
        cyl('Grey segmented palm trunk',(x,y,z),r,(h-.32)/32,'palmtrunk',14)
        cyl('Palm leaf scar ring',(x,y,z-(h-.32)/64),r+.008,.025,'palmrings',14)
    cyl('Palm crownshaft',(x,y,h+.05),.17,.65,'palmgreen',14)
    crown=bpy.data.objects.new('Dense green palm fronds',areca_leaves());bpy.context.collection.objects.link(crown);crown.location=(x,y,h);crown.rotation_euler.z=(x+y)*.17
for row_x in [-3,5]:
    cube('Areca row edging',(row_x,-20.6,.12),(1.15,24.8,.24),'brick')
    cube('Areca row soil',(row_x,-20.6,.25),(.9,24.4,.06),'grass')
    for y in [-31.125,-23.75,-16.375,-9]:areca(row_x,y)

# Black slatted park benches: two in every palm interval, alternating direction.
def iron_bench(x,y,rot):
    before=set(bpy.data.objects)
    for yy in [-.24,-.08,.08,.24]:cube('Black bench seat slat',(0,yy,.57),(2.6,.115,.075),'black')
    for z in [.8,1.02,1.24]:cube('Black bench back slat',(0,.31,z),(2.6,.075,.14),'black')
    for dx in [-1.16,1.16]:
        for yy in [-.22,.25]:beam('Black bench curved leg',(dx,yy*1.4,.05),(dx,yy,.55),.055,'black')
        beam('Black bench back frame',(dx,.28,.4),(dx,.37,1.34),.05,'black')
        beam('Black bench arm',(dx,-.36,.86),(dx,.33,.94),.045,'black')
        for j in range(18):
            a=j*math.pi*1.7/18;b=(j+1)*math.pi*1.7/18
            beam('Black bench ornamental scroll',(dx,-.04+.22*math.cos(a),.7+.18*math.sin(a)),(dx,-.04+.22*math.cos(b),.7+.18*math.sin(b)),.018,'black')
    cube('Bench collider',(0,.03,.685),(2.7,.8,1.37),'black',True)   # khối va chạm vô hình cả ghế (kể cả tay vịn) — không đi xuyên ghế
    for ob in set(bpy.data.objects)-before:
        p=ob.location.copy();ob.location=(x+p.x*math.cos(rot)-p.y*math.sin(rot),y+p.x*math.sin(rot)+p.y*math.cos(rot),p.z+.28);ob.rotation_euler.z+=rot
    seats.append({'id':f'iron-{len(seats)}','label':'ghế băng','position':[x,1.25,-y],'yaw':rot,'exit':[x+math.sin(rot)*1.1,.98,-y+math.cos(rot)*1.1]})
ys=[-31.125,-23.75,-16.375,-9]
for row in [-3,5]:
    for i in range(3):
        midpoint=(ys[i]+ys[i+1])/2
        if i >= 1:
            midpoint -= .35  # Bring the middle pair closer to the next palm.
        for offset in [-1.55,1.55]:iron_bench(row,midpoint+offset,math.pi/2 if i%2==0 else -math.pi/2)

# Three large shade trees at the courtyard positions marked in the reference.
for x,y in [(-16,0),(16,1),(16,22),(-6.5,-38)]:
    cyl('Large shade tree planter',(x,y,.22),1.65,.44,'brick',24)
    cyl('Large shade tree soil',(x,y,.46),1.45,.08,'grass',24)
    beam('Large shade tree trunk',(x,y,.48),(x,y,5.8),.32,'trunk')
    for j in range(7):
        a=j*math.tau/7
        tip=(x+2*math.cos(a),y+2*math.sin(a),6.4+(j%2)*.4)
        beam('Large shade tree branch',(x,y,4.3),tip,.11,'trunk')
        ball('Large shade tree crown',tip,(2.35,2.2,1.9),'leaflight' if j%2 else 'leaf')
    ball('Large shade tree top',(x,y,7.6),(2.4,2.4,1.8),'leaf')

# Marked yellow area: the court meets the second planting strip without a broad empty band.
court_before=set(bpy.data.objects)
cube('Basketball court',(17.7,-28,.12),(23.6,24,.24),'court',True)
for x in [6.4,29]:cube('Basketball sideline',(x,-28,.09),(.09,23,.02),'trim')
for y in [-39.5,-28,-16.5]:cube('Basketball end and centre line',(17.7,y,.09),(22.6,.09,.02),'trim')
def court_arc(cx,cy,r,start,end,z=.105):
    for j in range(48):
        a=start+(end-start)*j/48;b=start+(end-start)*(j+1)/48
        beam('Basketball painted arc',(cx+r*math.cos(a),cy+r*math.sin(a),z),(cx+r*math.cos(b),cy+r*math.sin(b),z),.035,'trim')
court_arc(17.7,-28,2.4,0,math.tau)
for end,sign in [(-38.5,1),(-17.5,-1)]:
    cube('Basketball pole',(17.7,end-sign*.8,1.8),(.16,.16,3.6),'metal',True)
    cube('Basketball backboard',(17.7,end,3.45),(1.8,.12,1.05),'trim')
    cube('Backboard target',(17.7,end+sign*.075,3.45),(.65,.025,.45),'blue')
    court_arc(17.7,end+sign*.65,.35,0,math.tau,3.05)
    for j in range(8):
        a=j*math.tau/8
        beam('Basketball net',(17.7+.35*math.cos(a),end+sign*.65+.35*math.sin(a),3.05),(17.7+.19*math.cos(a),end+sign*.65+.19*math.sin(a),2.65),.012,'trim')
    for x in [14.8,20.6]:cube('Basketball key line',(x,end+sign*2.4,.105),(.07,4.8,.02),'trim')
    cube('Basketball free throw line',(17.7,end+sign*4.8,.105),(5.8,.07,.02),'trim')
    court_arc(17.7,end+sign*4.8,2.9,0,math.tau)

for ob in set(bpy.data.objects)-court_before:
    if ob.name!='Basketball court':ob.location.z+=.16

# Canteen in the red-marked strip between the court and the front boundary.
cube('Canteen floor',(20,-44,.13),(18,6,.26),'stone',True)
cube('Canteen back wall',(20,-46.9,1.65),(18,.18,3.3),'cream',True)
for x in [11,29]:cube('Canteen side wall',(x,-44,1.65),(.18,6,3.3),'cream',True)
cube('Canteen flat roof',(20,-44,3.48),(18.7,6.8,.18),'trim',True)
for x in [11,17,23,29]:cube('Canteen front post',(x,-41,1.65),(.16,.16,3.3),'cream',True)
cube('Canteen service counter',(16,-42,.7),(7,1,1.4),'wood',True)
cube('Canteen sign board',(20,-40.85,2.9),(13,.12,.7),'blue')
text('Canteen name','CĂNG TIN',(20,-40.95,2.65),.52,'trim')
for x in [23,26]:
    cube('Canteen table',(x,-44, .8),(1.6,1,.12),'wood',True)
    for y in [-45,-43]:cube('Canteen bench',(x,y,.48),(1.6,.45,.12),'wood',True)
places.append({'id':'canteen','label':'Căng tin','position':[25,.98,40]})

# Sân bóng chuyền ở bãi cỏ giữa sân bóng rổ và đường nội bộ phía đông (ô đỏ người dùng vẽ).
# Mép bắc/nam trùng mép sân bóng rổ (three.js z 16 → 40, Blender y -16 → -40), cùng mặt sân & độ cao 0.24.
# Mép tây x 30.1 chừa dải cho hàng cột đèn (x 29.7); mép đông x 40.3 sát đường nội bộ (x 40.5).
VB_CX,VB_W=35.2,10.2
# Mép bắc lùi về z 18 (chỉ còn 1 m sau vạch biên z 19) để đặt nhà xe 1 tầng; mép nam vẫn trùng sân bóng rổ (z 40).
cube('Volleyball court',(VB_CX,-29,.12),(VB_W,22,.24),'court',True)
for x in [VB_CX-4.5,VB_CX+4.5]:cube('Volleyball sideline',(x,-28,.25),(.06,18,.02),'trim')       # sân thi đấu 9 x 18 m
for y in [-19,-37,-28,-25,-31]:cube('Volleyball line',(VB_CX,y,.25),(9,.06,.02),'trim')          # biên ngang, giữa sân, vạch tấn công 3 m
for x in [VB_CX-4.85,VB_CX+4.85]:cyl('Volleyball post',(x,-28,1.37),.05,2.3,'metal',12)
cube('Volleyball net',(VB_CX,-28,1.98),(9.7,.02,1),'black')
for z in [1.49,2.47]:cube('Volleyball net band',(VB_CX,-28,z),(9.7,.04,.07),'trim')
places.append({'id':'volleyball','label':'Sân bóng chuyền','position':[VB_CX,1.25,19.2]})

# Nhà xe 1 tầng giữa đầu dãy C và sân bóng chuyền, kéo dài sang phải nối liền với nhà xe lớn (cột vàng x 43.9) thành một khối.
# three.js x 32.6 → 43.8, z 11.8 → 17.6. Mái trắng, cột & dầm vàng như nhà xe lớn.
# Lan can sắt 3 thanh ngang (kiểu lan can hành lang) bao 3 phía khu để xe (x 32.6 → 40.3); đoạn nối sang nhà xe lớn để trống
# làm lối xe ra vào đường nội bộ. Ô đỗ & xe đạp điện vẽ trong game (src/bikes.js) để người chơi lấy xe / đỗ xe bằng phím F.
mat('roofwhite',(.93,.94,.95))
BS_X0,BS_X1,BS_BAY_X1,BS_CY,BS_D=32.6,43.8,40.3,-14.7,5.8
BS_CX,BS_W=(BS_X0+BS_X1)/2,BS_X1-BS_X0
cube('Small bike shed slab',(BS_CX,BS_CY,.06),(BS_W,BS_D,.12),'stone',True)
north,south=BS_CY+BS_D/2-.15,BS_CY-BS_D/2+.15   # Blender y của hai mép (three.js z 11.95 và 17.45)
for x in [BS_X0+.15,(BS_X0+BS_BAY_X1)/2,BS_BAY_X1-.1]:
    for y in [north,south]:cube('Small bike shed column',(x,y,1.52),(.18,.18,2.8),'wall',True)
for y in [north,south]:cube('Small bike shed beam',(BS_CX,y,2.86),(BS_W,.16,.22),'wall')
shed_roof=cube('Small bike shed roof',(BS_CX,BS_CY,3.08),(BS_W+.4,BS_D+.8,.1),'roofwhite');shed_roof.rotation_euler.x=.06
# lan can: 3 thanh ngang + trụ đứng mỗi ~1.3 m; khung va chạm mỏng (xoá khỏi mô hình sau khi xuất dữ liệu va chạm)
def railing(x0,y0,x1,y1):
    L=math.hypot(x1-x0,y1-y0);cx,cy=(x0+x1)/2,(y0+y1)/2;along_x=abs(x1-x0)>abs(y1-y0)
    for z in [.45,.75,1.05]:cube('Bike shed railing bar',(cx,cy,z),(L,.04,.04) if along_x else (.04,L,.04),'metal')
    n=max(1,int(L/1.3))
    for k in range(n+1):cube('Bike shed railing post',(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n,.6),(.05,.05,1.1),'metal')
    cube('Bike shed railing collider',(cx,cy,.6),(L,.08,1.2) if along_x else (.08,L,1.2),'metal',True)
for y in [north,south]:railing(BS_X0+.15,y,BS_BAY_X1-.1,y)
railing(BS_X0+.15,north,BS_X0+.15,south)
for y0,y1 in [(north,BS_CY+.75),(BS_CY-.75,south)]:railing(BS_BAY_X1-.05,y0,BS_BAY_X1-.05,y1)  # chắn đầu hai hàng xe phía lối nối, chừa lối giữa 1.5 m
places.append({'id':'ebike-shed','label':'Nhà xe đạp điện','position':[38.5,1.1,14.7]}) # giữa lối đi hai hàng ô

# Phòng photo: rộng bằng căng tin (6 m), dài bằng 1/3 căng tin (18 / 3 = 6 m), cùng hàng ngay bên phải căng tin,
# sát tường trước, cửa quay về phía sân bóng chuyền. Three.js x 30.5 → 36.5, z 41 → 47.
PH_CX=33.5
cube('Photo room floor',(PH_CX,-44,.13),(6,6,.26),'stone',True)
cube('Photo room back wall',(PH_CX,-46.9,1.65),(6,.18,3.3),'cream',True)
for x in [PH_CX-3,PH_CX+3]:cube('Photo room side wall',(x,-44,1.65),(.18,6,3.3),'cream',True)
for x in [PH_CX-1.85,PH_CX+1.85]:cube('Photo room front wall',(x,-41,1.65),(2.3,.18,3.3),'cream',True)   # chừa cửa 1.4 m ở giữa
cube('Photo room door head',(PH_CX,-41,2.85),(1.4,.18,.9),'cream',True)
cube('Photo room window',(PH_CX-1.85,-41.1,1.9),(1.4,.05,1),'window')
cube('Photo room window frame',(PH_CX-1.85,-41.12,1.9),(1.55,.03,1.15),'wood')
cube('Photo room flat roof',(PH_CX,-44,3.48),(6.7,6.8,.18),'trim',True)
cube('Photo room sign board',(PH_CX,-40.84,2.95),(4.6,.12,.62),'blue')
sign=text('Photo room name','PHÒNG PHOTO',(PH_CX,-40.76,2.8),.42,'trim');sign.rotation_euler.z=math.pi  # quay chữ ra phía sân (đọc được từ phía bắc)
cube('Photocopier body',(PH_CX-1.5,-45.9,.55),(1.1,.75,.9),'trim',True)
cube('Photocopier lid',(PH_CX-1.5,-45.9,1.05),(1.1,.75,.1),'black')
cube('Photo counter',(PH_CX+1.1,-42.6,.6),(2.4,.7,1.2),'wood',True)
cube('Paper shelf',(PH_CX+2.45,-45.4,1.1),(.6,2,2),'wood',True)
for j in range(3):cube('Paper stack',(PH_CX+2.4,-45.4,.55+j*.6),(.45,1.6,.25),'trim')
places.append({'id':'photo','label':'Phòng photo','position':[PH_CX,.98,39.3]})

# Blue-marked area: flower-covered pergola with two usable swing seats.
pergola_before=set(bpy.data.objects)
for x in [12,28]:
    for y in [-14.5,-6.5]:cube('Bougainvillea pergola post',(x,y,1.9),(.13,.13,3.8),'benchwhite',True)
for y in [-14.5,-10.5,-6.5]:beam('Pergola crossbeam',(12,y,3.75),(28,y,3.75),.07,'benchwhite')
for x in range(12,29,2):beam('Pergola roof slat',(x,-14.5,3.78),(x,-6.5,3.78),.043,'benchwhite')
for x in [16.5,23.5]:
    for dx in [-1.35,1.35]:
        for sy in [-1,1]:beam('White swing A-frame',(x+dx,-10.5+sy*1.1,.08),(x+dx,-10.5,2.95),.075,'benchwhite')
        beam('White swing lower brace',(x+dx,-11.2,.9),(x+dx,-9.8,.9),.055,'benchwhite')
    beam('White swing top bar',(x-1.55,-10.5,2.95),(x+1.55,-10.5,2.95),.08,'benchwhite')
    for sy in [-1,1]:
        roof=cube('White swing canopy',(x,-10.5+sy*.52,3.12),(3.3,1.2,.09),'benchwhite');roof.rotation_euler.x=-sy*.12
    for dx in [-.85,.85]:
        for yy in [-10.75,-10.25]:beam('Swing hanging chain',(x+dx,-10.5,2.88),(x+dx,yy,.78),.017,'metal')
        cube('White swing armrest',(x+dx,-10.5,1.05),(.09,.8,.08),'benchwhite')
        cube('White swing arm support',(x+dx,-10.7,.88),(.07,.07,.34),'benchwhite')
    for yy in [-10.75,-10.5,-10.25]:cube('White swing seat slat',(x,yy,.7),(2,.19,.14),'benchwhite',True)
    for j in range(9):
        back=cube('White swing back slat',(x-.9+j*.225,-10.17,1.07),(.17,.09,.68),'benchwhite');back.rotation_euler.x=-.12
    cube('White swing back top rail',(x,-10.14,1.42),(2.2,.12,.12),'benchwhite')
# Fine branches and three papery bracts replace the coarse flower balls.
mat('flowerwhite',(.98,.9,.94));mat('flowerpink',(.92,.22,.51))
petals={}
for material in ['flowerwhite','flowerpink','leaf']:
    mesh=bpy.data.meshes.new('Papery petal '+material)
    mesh.from_pydata([(0,0,0),(-.09,.09,.025),(0,.22,.065),(.09,.09,.025)],[],[(0,1,2,3),(3,2,1,0)])
    mesh.materials.append(M[material]);petals[material]=mesh
for i in range(650):
    x=random.uniform(11.8,28.2);y=random.uniform(-14.6,-6.4);z=3.85+random.uniform(-.12,.55)
    if i%7==0:beam('Bougainvillea slender branch',(x,y,3.78),(x+.45,y+.35,z+.2),.016,'wood')
    for j in range(3):
        material='flowerwhite' if i%3==0 else 'flowerpink'
        ob=bpy.data.objects.new('Papery bougainvillea bract',petals[material]);bpy.context.collection.objects.link(ob)
        ob.location=(x,y,z);ob.rotation_euler=(random.uniform(-.7,.7),random.uniform(-.7,.7),j*math.tau/3+i);ob.scale=(1.3,1.3,1.3)
    ob=bpy.data.objects.new('Bougainvillea pointed leaf',petals['leaf']);bpy.context.collection.objects.link(ob);ob.location=(x+.18,y,z-.13);ob.rotation_euler=(.3,.4,i)
for x in [12,28]:
    for y in [-14.5,-6.5]:
        for j in range(8):beam('Climbing woody vine',(x+.13*math.sin(j),y,j*.48),(x+.13*math.sin(j+1),y,(j+1)*.48),.035,'wood')
# A terracotta planter at the front-left post roots the flowering canopy.
cyl('Bougainvillea planter',(12,-14.5,.42),.65,.84,'brick',24)
cyl('Bougainvillea planter rim',(12,-14.5,.83),.7,.12,'brick',24)
cyl('Bougainvillea planter soil',(12,-14.5,.89),.57,.04,'grass',24)
for j in range(12):
    z=.9+j*.26;xx=12+.13*math.sin(j*.8)
    beam('Planter climbing trunk',(xx,-14.5,z),(12+.13*math.sin((j+1)*.8),-14.5,z+.26),.065,'wood')
    for side in [-1,1]:
        ob=bpy.data.objects.new('Climbing planter leaves',petals['leaf']);bpy.context.collection.objects.link(ob);ob.location=(xx+side*.15,-14.5,z+.15);ob.rotation_euler=(.4,side*.7,j)
        if j>3:
            for k in range(3):
                ob=bpy.data.objects.new('Climbing planter flowers',petals['flowerpink']);bpy.context.collection.objects.link(ob);ob.location=(xx+side*.23,-14.5,z+.2);ob.rotation_euler=(.3,.5,k*math.tau/3)
# Shorten the pavilion to meet the front edge of the right wing.
for ob in set(bpy.data.objects)-pergola_before:
    ob.location.y=-16+(ob.location.y+16)*.8;ob.scale.y*=.8;ob.location.z+=.16
cube('Continuous grey sports and pergola platform',(17.7,-12.1,.12),(23.6,7.8,.24),'court',True)
places.append({'id':'pergola','label':'Giàn hoa giấy · Xích đu','position':[20,.98,11]})

# A small one-storey water house occupies the space left by the shortened wing.
water_before=set(bpy.data.objects)
cube('Water house floor',(-36,-4,.13),(10,8,.26),'stone',True)
cube('Water house west wall',(-41,-4,1.65),(.2,8,3.3),'cream',True)
for y in [-7.55,-.45]:cube('Water house side wall',(-36,y,1.65),(10,.2,3.3),'cream',True)
for y in [-6.45,-1.55]:cube('Water house entry pier',(-31,y,1.65),(.2,3.1,3.3),'cream',True)
cube('Water house door head',(-31,-4,2.95),(.2,1.85,.7),'cream',True)
cube('Water house flat roof',(-36,-4,3.48),(10.5,8.5,.18),'trim',True)
for y in [-6.45,-1.55]:cube('Water house roof edge',(-30.7,y,3.65),(.18,3.1,.35),'brick')
cube('Water dispenser counter',(-38,-4,.65),(1.2,3.8,1.1),'tile',True)
for y in [-5.2,-4,-2.8]:
    cyl('Water tap',(-37.25,y,1.15),.085,.18,'metal',12)
    cyl('Water basin',(-36.55,y,.55),.38,.12,'water',16)
# Thu nhỏ nhà nước (60% mặt bằng, 85% chiều cao) rồi đặt tâm tại WATER_CENTER (toạ độ Blender; three.js z = -y).
# Vị trí theo ô người dùng khoanh: giữa đầu dãy B và hòn non bộ, phía trước vườn (three.js x -32.7, z 2.2).
# Cửa vẫn quay ra sân (phía +x).
WATER_SCALE,WATER_HEIGHT,WATER_CENTER=.6,.85,(-32.7,-2.2)
for ob in set(bpy.data.objects)-water_before:
    ob.location.x=WATER_CENTER[0]+(ob.location.x+36)*WATER_SCALE;ob.scale.x*=WATER_SCALE
    ob.location.y=WATER_CENTER[1]+(ob.location.y+4)*WATER_SCALE;ob.scale.y*=WATER_SCALE
    ob.location.z*=WATER_HEIGHT;ob.scale.z*=WATER_HEIGHT
# Paved strip between the entrance building and the garden, matching courtyard joints.
cube('Garden entrance tiled walkway',(-18,-34.5,.025),(28,3,.08),'tile',True)
for x in range(-32,-3,2):cube('Walkway grout',(x,-34.5,.073),(.018,3,.012),'grout')
for y in [-36,-34,-33]:cube('Walkway transverse grout',(-18,y,.073),(28,.018,.012),'grout')
places.append({'id':'water-house','label':'Nhà lấy nước','position':[-27.9,.98,2.2]}) # trước cửa nhà nước

# Hòn non bộ (làm lại): hồ bo tròn 2 đầu dài ~12 m, song song mặt tiền dãy B, tâm thẳng cầu thang giữa dãy B (y 19).
#  - 3 cụm núi đá vôi nhiều tầng đặt đối xứng dọc trục hồ (cụm chính cao ở giữa, 2 cụm nhỏ 2 bên); chỉ có rêu xanh & cây nhỏ.
#  - Mặt nước bán trong suốt trên đáy hồ sẫm màu: đàn cá koi (src/PondFish.jsx) bơi vòng quanh các cụm đá, nhìn thấy qua mặt nước.
#  - Va chạm: khối vô hình ôm theo bờ hồ (xoá khỏi mô hình hiển thị) — không lội xuống nước.
PX,PY0,PY1=-21.5,16.0,22.0         # tâm x; tâm 2 đầu tròn (nam, bắc) — hồ từ y 13 tới y 25 (khớp src/PondFish.jsx)
PW,PRIM=2.6,3.0                    # bán kính mặt nước, bán kính mép ngoài bờ
mat('pondfloor',(.06,.12,.11))
pw_=mat('pondwater',(.18,.45,.52));_pp=next(n for n in pw_.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
_pp.inputs['Alpha'].default_value=.58;_pp.inputs['Roughness'].default_value=.08
try:pw_.surface_render_method='BLENDED'
except Exception:pw_.blend_method='BLEND'
def stadium(r,n=14):
    pts=[(PX+r,PY0+(PY1-PY0)*k/6) for k in range(7)]
    pts+=[(PX+r*math.cos(math.pi*k/n),PY1+r*math.sin(math.pi*k/n)) for k in range(1,n)]
    pts+=[(PX-r,PY1-(PY1-PY0)*k/6) for k in range(7)]
    pts+=[(PX+r*math.cos(math.pi+math.pi*k/n),PY0+r*math.sin(math.pi+math.pi*k/n)) for k in range(1,n)]
    return pts
def disc(name,r,z,m):
    pts=stadium(r);me=bpy.data.meshes.new(name);me.from_pydata([(x,y,z) for x,y in pts],[],[tuple(range(len(pts)))]);me.materials.append(M[m])
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return o
def ring(name,r0,r1,z0,z1,m):
    i_,o_=stadium(r0),stadium(r1);n=len(i_);v=[(x,y,z0) for x,y in o_]+[(x,y,z1) for x,y in o_]+[(x,y,z0) for x,y in i_]+[(x,y,z1) for x,y in i_]
    f=[]
    for k in range(n):
        q=(k+1)%n;f+=[(k,q,n+q,n+k),(3*n+k,3*n+q,2*n+q,2*n+k),(n+k,n+q,3*n+q,3*n+k)]
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.materials.append(M[m]);o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return o
disc('Pond floor',PW,.08,'pondfloor')
ring('Pond rim wall',PW,PRIM,0,.5,'stone')
ring('Pond rim coping',PW-.06,PRIM+.08,.5,.6,'trim')
disc('Pond water',PW,.44,'pondwater')
_seed=[20111]
def rnd():
    _seed[0]=(_seed[0]*1103515245+12345)%2147483648;return _seed[0]/2147483648
def karst(name,x,y,r,h,m='rock',tiers=7,sides=9):
    """Núi đá vôi: các vòng mặt cắt nhỏ dần, lệch tâm ngẫu nhiên, mép lởm chởm."""
    v=[];f=[];cx,cy=x,y
    for t in range(tiers):
        fr=t/(tiers-1);rr=max(.03,r*(1-fr)**.8*(.85+.3*rnd()));cx+=(rnd()-.5)*.22*r;cy+=(rnd()-.5)*.22*r
        for k in range(sides):
            a=k*math.tau/sides+(rnd()-.5)*.35;j=.72+.5*rnd()
            v.append((cx+rr*j*math.cos(a),cy+rr*j*math.sin(a),.2+h*fr))
    for t in range(tiers-1):
        for k in range(sides):f.append((t*sides+k,t*sides+(k+1)%sides,(t+1)*sides+(k+1)%sides,(t+1)*sides+k))
    f.append(tuple(range(sides-1,-1,-1)));f.append(tuple(range((tiers-1)*sides,tiers*sides)))
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.materials.append(M[m]);o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
    return (cx,cy)
def bonsai(x,y,z,s=1):
    beam('Pond bonsai trunk',(x,y,z),(x+.08*s,y+.05*s,z+.38*s),.035*s,'trunk')
    for dx,dy,dz,rr in [(.12,.04,.4,.17),(-.06,.1,.34,.13),(.03,-.08,.46,.12)]:ball('Pond bonsai crown',(x+dx*s,y+dy*s,z+dz*s),(rr*s,rr*s,rr*.7*s),'leaf')
# 3 cụm đá đối xứng: (tâm y, [(dx, dy, bán kính, cao, màu)])
clusters=[(19.0,[(0,0,1.15,2.9,'rock'),(-.55,.75,.75,2.0,'stone'),(.6,-.7,.7,1.7,'rock'),(.5,.85,.5,1.2,'stone'),(-.6,-.8,.5,1.1,'stone')]),
          (16.4,[(0,0,.85,1.75,'rock'),(.45,.4,.5,1.15,'stone'),(-.45,-.35,.45,.95,'stone')]),
          (21.6,[(0,0,.85,1.75,'rock'),(-.45,-.4,.5,1.15,'stone'),(.45,.35,.45,.95,'stone')])]
for cyc,peaks in clusters:
    for i,(dx,dy,r,h,m) in enumerate(peaks):
        karst('Pond rock peak',PX+dx,cyc+dy,r,h,m)
        for k in range(2):ball('Pond moss',(PX+dx+(rnd()-.5)*r,cyc+dy+(rnd()-.5)*r,.35+h*(.25+.3*k)),(.16,.16,.08),'leaflight')
    bonsai(PX+.35,cyc-.2,.2+peaks[0][3]*.55,1.2 if cyc==19.0 else .9)
    bonsai(PX-.4,cyc+.3,.2+peaks[0][3]*.35,.7)   # thêm 1 cây nhỏ thấp phía bên kia
# va chạm vô hình ôm bờ hồ (cao 1.1 m: không nhảy xuống nước)
cube('Pond collider',(PX,(PY0+PY1)/2,.55),(2*PRIM,PY1-PY0,1.1),'stone',True)
for yc,sg in [(PY0,-1),(PY1,1)]:
    cube('Pond collider',(PX,yc+sg*PRIM*.45,.55),(2*PRIM*.92,PRIM*.9,1.1),'stone',True)
    cube('Pond collider',(PX,yc+sg*PRIM*.85,.55),(2*PRIM*.55,PRIM*.3,1.1),'stone',True)
places.append({'id':'fountain','label':'Hòn non bộ · Hồ cá','position':[-16.8,.98,-19]})

gate_before=set(bpy.data.objects)
# Main entrance reconstructed from the user's real gate photograph.
for x in [-8.5,-5,5,8.5]:
    height=5.9 if abs(x)==5 else 4.7
    cube('Gate pier',(x,-48,height/2),(.72,1.05,height),'brick')
    for dx in [-.39,.39]:cube('Gate cream pillar trim',(x+dx,-48,height/2),(.10,1.13,height),'cream')
    cube('Gate pillar cap',(x,-48,height+.08),(1,1.3,.18),'cream')
cube('Gate lintel',(0,-48,5.8),(12.2,2.9,.38),'cream')
cube('Gate name board',(0,-48.65,5.04),(9.3,.15,1.3),'blue')
text('Gate education authority','SỞ GIÁO DỤC VÀ ĐÀO TẠO HẢI PHÒNG',(0,-48.76,5.36),.18,'trim')
gate_title=text('Gate school name','TRƯỜNG TRUNG HỌC PHỔ THÔNG AN DƯƠNG',(0,-48.76,4.96),.37,'trim')
bpy.context.view_layer.update()
if gate_title.dimensions.x>9:gate_title.scale.x*=9/gate_title.dimensions.x
cube('Gate LED frame',(0,-48.8,4.35),(9.3,.2,.76),'trim')
cube('Gate dark LED panel',(0,-48.93,4.35),(9.05,.04,.6),'black')
for cx,width,z in [(0,13,6.05),(-7.4,5.1,4.95),(7.4,5.1,4.95)]:
    cube('Gate overhanging eave',(cx,-48,z),(width,3,.22),'cream')
    for side in [-1,1]:
        roof=cube('Gate red tiled hip roof',(cx,-48+side*.66,z+.24),(width-.2,1.45,.12),'roof');roof.rotation_euler.x=-side*.14
for x,color in [(-4.4,'gold'),(-2.2,'flowerpink'),(0,'red'),(2.2,'leaflight'),(4.4,'blue')]:
    beam('Gate festival flag pole',(x,-48,6.4),(x,-48,7.65),.022,'metal')
    cube('Gate festival pennant',(x+.15,-48,7.23),(.3,.035,.8),color)
# Pull only the right half inward and lift the roof tier.
for ob in set(bpy.data.objects)-gate_before:
    if ob.location.x>0:ob.location.x*=.86
    if any(t in ob.name for t in ['roof','eave','lintel','festival']):ob.location.z+=.35
# School information board in the marked patch, beside the entry axis.
notice_before=set(bpy.data.objects)
# Bảng tin: mặt bảng tỉ lệ 16:9 (4.7 × 2.64 m) để dán trọn ảnh bảng phấn "Tri ân" (src/GateBoard.jsx, public/boards/), không cắt mất chữ.
for x in [3.7,8.3]:cube('School information board post',(x,-42,2.05),(.13,.16,4.1),'metal',True)
cube('School information board frame',(6,-42,2.35),(5,.22,2.94),'cream',True)
cube('School information board face',(6,-42.14,2.35),(4.7,.06,2.64),'black')   # nền tối sau ảnh
cube('School notice board canopy',(6,-42,3.97),(5.5,.9,.14),'cream')
for ob in set(bpy.data.objects)-notice_before:
    px=ob.location.x-6;py=ob.location.y+42
    ob.location.x=5.75+py;ob.location.y=-37-px;ob.rotation_euler.z-=math.pi/2
places.append({'id':'information','label':'Bảng thông tin trường','position':[8,.98,37]})
# Phòng bảo vệ: khoảng trống phía trong cổng chính bên phải (giữa cánh cổng sắt x 4.5 và tường căng tin x 11), sát tường bao.
# three.js x 6.2 → 10.7, z 40.5 → 47.6 (kéo dài tới sát mép sân bóng rổ z 40). Cửa ra vào + cửa sổ kính lớn quay về lối cổng
# (phía tây), cửa sổ nhìn ra sân bóng rổ (phía bắc).
GR_X0,GR_X1,GR_Y0,GR_Y1,GR_H=6.2,10.7,-47.6,-40.5,2.8
GR_CX,GR_CY=(GR_X0+GR_X1)/2,(GR_Y0+GR_Y1)/2
cube('Guard room floor',(GR_CX,GR_CY,.08),(GR_X1-GR_X0,GR_Y1-GR_Y0,.16),'stone',True)
cube('Guard room back wall',(GR_CX,GR_Y0+.09,GR_H/2),(GR_X1-GR_X0,.18,GR_H),'cream',True)
cube('Guard room east wall',(GR_X1-.09,GR_CY,GR_H/2),(.18,GR_Y1-GR_Y0,GR_H),'cream',True)
# tường bắc (nhìn ra sân): chân tường + cửa sổ kính + phần trên
cube('Guard room north wall base',(GR_CX,GR_Y1-.09,.5),(GR_X1-GR_X0,.18,1.0),'cream',True)
cube('Guard room north wall top',(GR_CX,GR_Y1-.09,2.4),(GR_X1-GR_X0,.18,.8),'cream',True)
for x in [GR_X0+.45,GR_X1-.45]:cube('Guard room north wall pier',(x,GR_Y1-.09,1.5),(.9,.18,1.0),'cream',True)
cube('Guard room north window',(GR_CX,GR_Y1-.09,1.5),(GR_X1-GR_X0-1.8,.06,1.0),'window',True)
# tường tây (quay về lối cổng): cửa ra vào rộng 1 m ở phía nam, cửa sổ kính lớn phía bắc
DOOR_Y=-46.75
cube('Guard room west wall by door',(GR_X0+.09,(GR_Y0+DOOR_Y-.5)/2,GR_H/2),(.18,DOOR_Y-.5-GR_Y0,GR_H),'cream',True)
cube('Guard room west wall base',(GR_X0+.09,(DOOR_Y+.5+GR_Y1)/2,.5),(.18,GR_Y1-DOOR_Y-.5,1.0),'cream',True)
cube('Guard room west wall top',(GR_X0+.09,(DOOR_Y+.5+GR_Y1)/2,2.4),(.18,GR_Y1-DOOR_Y-.5,.8),'cream',True)
cube('Guard room west window',(GR_X0+.09,(DOOR_Y+.5+GR_Y1)/2,1.5),(.06,GR_Y1-DOOR_Y-.5,1.0),'window',True)
cube('Guard room door lintel',(GR_X0+.09,DOOR_Y,2.4),(.18,1.0,.8),'cream',True)
for y in [DOOR_Y-.5,DOOR_Y+.5]:cube('Guard room door frame',(GR_X0+.05,y,1.0),(.1,.08,2.0),'wood')
door=cube('Guard room door leaf',(GR_X0+.5,DOOR_Y-.45,1.0),(.05,.9,1.95),'wood');door.rotation_euler.z=math.radians(70)   # cánh cửa hé mở vào trong
# mái: tấm mái bằng + mái ngói đỏ 2 dốc (cùng kiểu cổng trường), biển tên trên cửa sổ phía cổng
cube('Guard room slab',(GR_CX,GR_CY,GR_H+.08),(GR_X1-GR_X0+.5,GR_Y1-GR_Y0+.5,.16),'trim',True)
for side in [-1,1]:
    # 2 mái dốc xuống về phía đông / tây, nóc ở giữa (rotation dương → đầu +x hạ xuống)
    r=cube('Guard room tiled roof',(GR_CX+side*(GR_X1-GR_X0)/4,GR_CY,GR_H+.42),((GR_X1-GR_X0)/2+.3,GR_Y1-GR_Y0+.7,.1),'roof');r.rotation_euler.y=side*.32
cube('Guard room sign board',(GR_X0-.02,(DOOR_Y+.5+GR_Y1)/2,2.42),(.05,2.0,.42),'blue')
sg=text('Guard room sign','PHÒNG BẢO VỆ',(GR_X0-.06,(DOOR_Y+.5+GR_Y1)/2,2.32),.22,'trim');sg.rotation_euler.z=-math.pi/2
# bên trong: bàn trực sát cửa sổ phía cổng, ghế, màn hình camera, tủ hồ sơ
cube('Guard room desk',(GR_X0+.55,-44.4,.78),(.7,2.2,.06),'wood',True)
cube('Guard room desk base',(GR_X0+.55,-44.4,.38),(.6,2.1,.76),'wood',True)
for y in [-44.0,-44.8]:
    cube('Guard room monitor',(GR_X0+.45,y,1.05),(.06,.5,.34),'black')
    cube('Guard room monitor screen',(GR_X0+.49,y,1.05),(.01,.44,.28),'blue')
cube('Guard room chair seat',(GR_X0+1.3,-44.4,.48),(.45,.45,.06),'blue',True)
cube('Guard room chair back',(GR_X0+1.5,-44.4,.78),(.05,.45,.55),'blue')
# góc nghỉ phía bắc: giường gấp + bàn nước
cube('Guard room cot',(GR_X1-.55,-42.5,.35),(.75,1.9,.12),'wood',True)
cube('Guard room cot mattress',(GR_X1-.55,-42.5,.45),(.7,1.85,.1),'blue')
cube('Guard room tea table',(GR_X0+1.4,-41.6,.45),(.8,.8,.06),'wood',True)
cube('Guard room cabinet',(GR_X1-.4,GR_Y1-.5,.7),(.5,.8,1.4),'trim',True)
places.append({'id':'guard-room','label':'Phòng bảo vệ','position':[5.4,.98,46.75]})
for x in range(-40,41,4):
    if abs(x)<8 or x==-8: continue
    if x<-36: continue  # góc tây trước nằm ngoài tường bao mới (tường tây đã lùi vào x = -36.25)
    cube('Boundary pier',(x,-48,1.5),(.35,.4,3),'cream')
    cube('Boundary wall',(x+1.8,-48,1.425),(3.6,.3,2.85),'wall')   # xây cao lên sát đỉnh cột (cột cao 3 m)

# Hai cánh cổng chính bằng song sắt sơn xanh rêu (theo ảnh cổng thật): chân cổng tấm kín, song thẳng có mũi giáo,
# dải hoa văn vòng tròn ngang thân, mép trên vồng cong lên dần về phía giữa cổng. Cánh đang mở, áp dọc hai bên lối vào
# (bản lề ở trụ cổng y -47.8, mép tự do y -43.8) → nhìn xuyên qua thấy sân trường & phòng bảo vệ.
mat('gategreen',(.07,.16,.12),.4)
GL0,GL1=-47.75,-43.85
def gate_top(t):return 2.55+.55*math.sin(t*math.pi/2)        # t: 0 ở bản lề → 1 ở mép giữa cổng
for x in [-4.5,4.5]:
    cube('Main gate leaf base panel',(x,(GL0+GL1)/2,.42),(.06,GL1-GL0,.7),'gategreen')
    for z in [.8,1.05,1.45]:cube('Main gate leaf rail',(x,(GL0+GL1)/2,z),(.07,GL1-GL0,.06),'gategreen')
    for y in [GL0,GL1]:cube('Main gate leaf stile',(x,y,gate_top(0 if y==GL0 else 1)/2),(.09,.09,gate_top(0 if y==GL0 else 1)),'gategreen')
    n=20
    for k in range(n+1):                                      # thanh cong ở mép trên (ghép từng đoạn ngắn)
        t0,t1=k/n,min(1,(k+1)/n)
        if k<n:beam('Main gate leaf top rail',(x,GL0+(GL1-GL0)*t0,gate_top(t0)),(x,GL0+(GL1-GL0)*t1,gate_top(t1)),.03,'gategreen')
    for k in range(1,n):                                      # song sắt + mũi giáo
        t=k/n;y=GL0+(GL1-GL0)*t;top=gate_top(t)
        cyl('Main gate leaf bar',(x,y,(.8+top)/2),.016,top-.8,'gategreen',6)
        bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.04,radius2=0,depth=.14,location=(x,y,top+.08));bpy.context.object.data.materials.append(M['gategreen'])
    for k in range(10):                                       # dải hoa văn vòng tròn giữa 2 thanh ngang
        y=GL0+(GL1-GL0)*(k+.5)/10
        bpy.ops.mesh.primitive_torus_add(major_radius=.15,minor_radius=.014,major_segments=14,minor_segments=4,location=(x,y,1.25),rotation=(0,math.pi/2,0))
        bpy.context.object.data.materials.append(M['gategreen'])

# Flagpole and a simple fabric flag.
cube('Flag base',(-12,24,.3),(2,2,.6),'stone')
cyl('Flagpole',(-12,24,5.8),.055,11,'metal',12)
cube('Vietnam flag',(-10.9,24,10.3),(2.2,.035,1.4),'red')
verts=[]
for i in range(10):
    a=math.pi/2+i*math.pi/5; r=.43 if i%2==0 else .18; verts.append((-10.9+r*math.cos(a),23.97,10.3+r*math.sin(a)))
me=bpy.data.meshes.new('Star'); me.from_pydata(verts,[],[tuple(range(10))]); me.materials.append(M['gold']); ob=bpy.data.objects.new('Flag star',me); bpy.context.collection.objects.link(ob)

# The previous pergola and swings have been replaced by the marked volleyball court.
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

house_before=set(bpy.data.objects)
building('D - Nhà gần cổng',-23,-41,26,2,math.pi)
for ob in set(bpy.data.objects)-house_before:ob.location.z+=.6
for room in rooms:
    if room['building'].startswith('D'):
        for key in ['door','inside','aisle']:room[key][1]+=.6
for route in stair_routes:
    if route['building'].startswith('D'):
        for point in route['path']:point[1]+=.6
for place in places:
    if place['id'].startswith('D'):
        for key in ['position','stairs','roof']:place[key][1]+=.6
        place['position']=[-21.35,1.58,36]
cube('Gate house raised plinth',(-23,-41,.25),(26,11,.5),'stone',True)
# (bỏ 4 bậc đá + chiếu nhỏ lên nền nhà gần cổng theo yêu cầu — nền cao 0,5 m, vẫn nhảy lên được)
# (bỏ khung cửa gỗ đứng lẻ ở lối lên tầng trệt nhà gần cổng — tường cũ đã đổi, khung còn trơ giữa sân)

# Lane behind the right classroom wing, opening east through the secondary gate.
cube('East access lane',(44,0,.025),(7,88,.1),'stone')
cube('Secondary entrance approach',(49,-44,.03),(7,12,.1),'stone')
# Tường đông chỉ còn đoạn cạnh nhà đa năng (three.js z 14 → 50); phía bắc đã lùi vào sát nhà xe (xem tường bao cuối file)
cube('East perimeter wall',(75,-31,1.425),(.35,34,2.85),'cream')   # z 14 → 48: dừng đúng góc tường trước (trước đây thò ra ngoài 2 m)
for x in [46,52]:
    cube('Secondary gate pier',(x,-48,2.3),(1,1,4.6),'brick')
    cube('Secondary gate capital',(x,-48,4.65),(1.4,1.4,.25),'cream')
cube('Secondary gate lintel',(49,-48,4.9),(7.5,1.1,.42),'cream')
text('Secondary gate sign','CỔNG PHỤ',(49,-48.62,4.7),.35,'blue')
# Hai cánh cổng sắt (khung + song thẳng + mũi giáo mạ vàng) mở vào trong, áp sát mặt trong hai trụ cổng.
for x in [46.58,51.42]:
    y0,y1=-47.45,-45.05   # cánh dài 2.4 m, bản lề ở trụ (Blender y -47.45 = three.js z 47.45)
    for z in [.18,1.0,2.15]:cube('Secondary gate leaf rail',(x,(y0+y1)/2,z),(.07,y1-y0,.08),'black')
    for y in [y0,y1]:cube('Secondary gate leaf stile',(x,y,1.2),(.09,.09,2.4),'black')
    n=12
    for k in range(1,n):
        y=y0+(y1-y0)*k/n;cyl('Secondary gate leaf bar',(x,y,1.25),.018,2.1,'black',8)
        bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.045,radius2=0,depth=.16,location=(x,y,2.38));bpy.context.object.data.materials.append(M['gold'])
    for k in range(4):ball('Secondary gate leaf ornament',(x,y0+(y1-y0)*(k+.5)/4,1.58),(.04,.22,.22),'gold')
for x in [46,52]:ball('Secondary gate pier lamp',(x,-48,5.02),(.22,.22,.22),'trim')
cube('Secondary gate sign plate',(49,-48.56,4.72),(3.3,.06,.62),'cream')
# Hai cây bóng mát to hai bên cổng phụ, sát tường trước (three.js: trái x 43 z 46.3; phải x 56 z 47 — dải 1.8 m
# giữa nhà đa năng và tường nên bồn cây nhỏ hơn, tán vẫn to và vươn qua tường)
# cây bên phải: thân ngả ra ngoài tường, tâm tán ở (54.2, z 49.3), tán thu nhỏ theo hướng bắc → không lấn vào nhà đa năng
for x,y,pr,cx,cy,spread,crown in [(43,-46.3,1.2,43,-46.3,1.8,(2.1,2.0,1.7)),(56,-47,.78,54.2,-49.3,1.5,(1.8,1.45,1.6))]:
    cyl('Gate shade tree planter',(x,y,.22),pr,.44,'brick',20)
    cyl('Gate shade tree soil',(x,y,.46),pr-.15,.08,'grass',20)
    beam('Gate shade tree trunk',(x,y,.48),(cx,cy,5.4),.28,'trunk')
    for j in range(7):
        a=j*math.tau/7;tip=(cx+spread*math.cos(a),cy+spread*math.sin(a),5.9+(j%2)*.4)
        beam('Gate shade tree branch',((x+cx*3)/4,(y+cy*3)/4,4.0),tip,.1,'trunk')
        ball('Gate shade tree crown',tip,crown,'leaflight' if j%2 else 'leaf')
    ball('Gate shade tree top',(cx,cy,7.1),(crown[0]+.1,crown[1]+.2,1.7),'leaf')

parking_before=set(bpy.data.objects)
# Long open steel parking shelter, with a proper pitched roof and exposed trusses.
cube('Bicycle parking slab',(59,-32,.08),(23,22,.16),'stone')
for side in [-1,1]:
    roof=cube('Bicycle corrugated roof',(59+side*5.85,-32,4.7),(12.2,23,.12),'metal')
    roof.rotation_euler.y=side*.19
    for yy in range(-43,-20):
        beam('Roof corrugation',(59,yy,5.85),(59+side*12,yy,3.55),.018,'stone')
for y in [-43,-37.5,-32,-26.5,-21]:
    for x in [47.5,70.5]:cube('Parking steel column',(x,y,1.85),(.13,.13,3.7),'metal',True)
    beam('Parking truss bottom',(47.5,y,3.7),(70.5,y,3.7),.06,'metal')
    for side in [-1,1]:
        beam('Parking truss top',(59,y,5.85),(59+side*11.5,y,3.7),.06,'metal')
        for dx in [3.8,7.6]:
            beam('Parking truss diagonal',(59+side*dx,y,3.7),(59+side*(dx-3.8),y,5.85-(dx-3.8)*.187),.04,'metal')
    beam('Parking king post',(59,y,3.7),(59,y,5.85),.045,'metal')
for x in [47.5,59,70.5]:beam('Parking longitudinal purlin',(x,-43,5.85 if x==59 else 3.7),(x,-21,5.85 if x==59 else 3.7),.055,'metal')
for x in [49,52,66,69]:
    for y in [-40,-36,-32,-28,-24]:beam('Parking rack',(x,y,.2),(x+.7,y,.75),.03,'metal')
text('Bicycle shelter sign','NHÀ ĐỂ XE',(59,-43.15,3.45),.55,'blue')

# Rebuild cleanly in final coordinates: no transformed beams projecting beyond the roof.
for ob in set(bpy.data.objects)-parking_before:
    if ob in solids:solids.remove(ob)
    bpy.data.objects.remove(ob,do_unlink=True)
cube('Parking yellow lower deck',(48.5,9,.08),(9.2,54,.18),'cream',True)
cube('Parking yellow deck',(47.075,9,3.25),(6.35,54,.18),'cream',True)
# Close the unused upper-floor strip beyond the ramp arrival.
cube('Parking closed upper side strip',(51.675,20,3.25),(2.85,32,.18),'cream',True)
cube('Parking wide ramp apron',(51.6,-21,.08),(3.2,4,.18),'cream',True)
# A dedicated ramp lane on the right keeps the upper floor opening clear.
for y in [-18,-9,0,9,18,27,36]:
    for x in [43.9,53.1]:cube('Parking yellow column',(x,y,3.4),(.18,.18,6.8),'wall',True)
for side in [-1,1]:
    roof=cube('Parking tidy roof',(48.5+side*2.4,9,7.35),(5,55,.12),'cream');roof.rotation_euler.y=side*.13
for y in [-18,-9,0,9,18,27,36]:
    beam('Parking restrained roof truss',(43.9,y,7),(53.1,y,7),.045,'metal')
# Lan can bê tông tầng 2 (thay lan can sắt vàng), màu kem như tường dãy C bên cạnh
for x in [43.9,53.1]:cube('Parking concrete parapet',(x,9,3.84),(.18,54,1.0),'cream',True)
cube('Parking south end parapet',(48.5,-18,3.84),(9.4,.2,1),'cream',True)
cube('Parking north end parapet',(48.5,36,3.84),(9.2,.18,1),'cream',True)
for y0,y1 in [(-18,4)]:cube('Parking inner parapet',(50.18,(y0+y1)/2,3.84),(.16,y1-y0,1.0),'cream',True)  # mép sàn phía trên đường dốc
cube('Parking upper landing',(51.65,9,3.25),(2.9,10,.18),'cream',True)
ramp=cube('Parking continuous yellow ramp',(51.6,-8,1.64),(2.8,24.23,.18),'wall',True)
ramp.rotation_euler.x=math.atan2(3.3,24)
for x in [50.13,53.08]:  # thành bê tông hai bên đường dốc (thay tay vịn sắt dốc lên)
    w=cube('Parking ramp parapet',(x,-8,2.19),(.14,24.23,1.0),'cream',True);w.rotation_euler.x=math.atan2(3.3,24)
# 1. rào chắn dọc mép tây tầng 1 nhà xe chính (từ đầu bắc tới chỗ nối với nhà xe nhỏ)
railing(43.98,36,43.98,-11.8)
# Straight access paving centered on the secondary gate and parking entrance.
for ob in list(bpy.data.objects):
    if ob.name.startswith(('East access lane','Secondary entrance approach')):
        if ob in solids:solids.remove(ob)
        bpy.data.objects.remove(ob,do_unlink=True)
cube('Aligned parking approach',(49,-32,.025),(7,32,.1),'stone',True)

hall_before=set(bpy.data.objects)
# Multipurpose hall beyond the approach, behind the east academic block.
cube('Multipurpose hall plinth',(59,10,.04),(24,42,.12),'stone',True)
cube('Hall east wall',(71,10,3.5),(.2,42,7),'trim',True)
for y in [-2.5,22.5]:cube('Hall left wall',(47,y,3.5),(.2,17,7),'trim',True)
cube('Hall left doorway lintel',(47,10,5.25),(.2,8,3.5),'trim',True)
# tường đầu bắc có cửa đi ra phía sau (rộng 2.4 m sau khi co theo trục x 0.91 → 2.64 trước khi co), cao 2.6 m
for x0,x1 in [(47,57.68),(60.32,71)]:cube('Hall rear wall',((x0+x1)/2,31,3.5),(x1-x0,.2,7),'trim',True)
cube('Hall rear door lintel',(59,31,4.8),(2.64,.2,4.4),'trim',True)
cube('Hall closed front wall',(59,-11,3.5),(24,.2,7),'trim',True)
cube('Hall flat roof',(59,10,7.1),(24.5,42.5,.2),'cream',True)
cube('Hall east parapet',(71.2,10,7.7),(.15,42.5,1),'cream',True)
for y in [-11.2,31.2]:cube('Hall end parapet',(59,y,7.7),(24.5,.15,1),'cream',True)
cube('Hall west parapet',(46.8,10,7.7),(.15,42,1),'cream',True)
for y in range(-7,31,5):
    for x in [46.94,71.06]:
        west=x<50
        if not(west and 5<y<15):cube('Hall high window',(x,y,5),(.1,2.8,1.8),'window')       # không đặt cửa sổ trên khung cửa tây
        if not(west and 5<y-1.8<15):cube('Hall wall pilaster',(x,y-1.8,3.7),(.25,.3,7),'cream')  # bỏ trụ đứng chắn giữa cửa
for x in [51,67]:cube('Court sideline',(x,10,.115),(.05,28,.015),'trim')
for y in [-4,10,24]:cube('Court line',(59,y,.115),(16,.05,.015),'trim')
for ob in set(bpy.data.objects)-hall_before:
    # three.js x 54.6 → 74.4 (tường đông x 75): tường tây lùi vào 2 m, chừa lối lên đường dốc tầng 2 nhà xe (thành dốc x 53.15)
    ob.location.x=64.5+(ob.location.x-59)*.825;ob.scale.x*=.825
    ob.location.y=-33.55+(ob.location.y-10)*.5976;ob.scale.y*=.5976   # z 21 → 46.1: đầu bắc không lấn chân đường dốc nhà xe (z 20.1); đầu nam chừa dải trồng cây
# Left-hand entrance, with broad low steps and an open door.
for j in range(3):cube('Hall entrance step',(52.7+j*.6,-33.55,.075+j*.075),(1.2,5,.15+j*.15),'stone',True)
cube('Hall inner entry landing',(55.2,-33.55,.225),(1.3,5,.45),'stone',True)
cube('Hall inner threshold step',(56.25,-33.55,.1),(.9,5,.2),'stone',True)
# Cửa chính: khung cửa, mái hiên trên 2 cột, biển tên trên mặt mái hiên, 2 cánh cửa kính mở vào trong
HC=-33.55  # tâm cửa (Blender y); khoảng mở three.js z 31.2 → 35.9
for y in [HC-2.38,HC+2.38]:cube('Hall entrance jamb',(54.6,y,1.78),(.42,.3,3.56),'cream')
cube('Hall entrance head',(54.6,HC,3.62),(.42,5.06,.3),'cream')
cube('Hall entrance canopy',(53.45,HC,3.92),(2.5,5.6,.22),'cream',True)
cube('Hall entrance canopy fascia',(52.25,HC,3.92),(.12,5.6,.48),'blue')
for y in [HC-2.55,HC+2.55]:cyl('Hall entrance canopy column',(52.45,y,1.9),.11,3.8,'trim',14)
label=text('Hall left entrance sign','NHÀ ĐA NĂNG',(52.17,HC,3.8),.38,'trim');label.rotation_euler.z=-math.pi/2
for y,sgn in [(HC-2.2,1),(HC+2.2,-1)]:  # cánh cửa kính mở vào trong, áp sát hai bên
    cube('Hall glass door frame',(55.55,y,1.5),(1.15,.08,2.9),'black')
    cube('Hall glass door pane',(55.55,y+sgn*.01,1.55),(.95,.06,2.55),'window')
    cube('Hall glass door handle',(56.0,y+sgn*.06,1.1),(.04,.04,.5),'gold')
# Interior stage at the far end, with walkable steps and a central aisle.
# Stage at the opposite end, facing north into the hall.
cube('Hall high stage',(64,-42.4,.6),(15,5.5,1.2),'wood',True)
for x in [57.7,70.3]:
    for j in range(6):cube('Hall side stage stair',(x,-37.6-j*.4,.1+j*.1),(1.7,.75,.2+j*.2),'stone',True)
cube('Hall LED surround',(64,-45.0,3.3),(11,.18,3.7),'black')
cube('Hall LED screen',(64,-44.87,3.3),(10.5,.05,3.25),'blue')
for line,z in [('CHÚC MỪNG NGÀY',4),('NHÀ GIÁO VIỆT NAM',3.3),('20/11/2026',2.55)]:
    ob=text('LED celebration',line,(64,-44.78,z),.48,'gold');ob.rotation_euler=(math.pi/2,0,math.pi)
for x in [56.8,71.2]:
    for j in range(8):cyl('Hall folded velvet curtain',(x+(j-3.5)*.14,-44.4,3),.14,4.5,'red',12)
# Stylised bronze portrait bust, standing on a ceremonial pedestal.
cube('Ho Chi Minh bust pedestal',(69.5,-43.6,1.8),(1.1,1,1.2),'brick',True)
ball('Bronze bust shoulders',(69.5,-43.6,2.65),(.52,.25,.38),'gold')
ball('Bronze portrait head',(69.5,-43.6,3.15),(.23,.22,.32),'gold')
ball('Bronze beard',(69.5,-43.38,2.95),(.13,.1,.22),'gold')
# Open door leaves on either side of the left entrance.
# Khán đài (tầng lửng) đầu bắc nhà đa năng — three.js x 54.7 → 74.3, z 21 → 24.5, mặt sàn cao 2.8 m.
# Hai cầu thang sát tường tây & đông đi từ z 29 lên tới mép khán đài; lan can dọc mép khán đài & cầu thang;
# cột đỡ phía trước; dưới khán đài là cửa đi ra phía sau (đã mở ở tường đầu bắc).
GY0,GY1,GTOP=-21,-24.5,2.8
cube('Hall gallery floor',(64.5,(GY0+GY1)/2,GTOP-.1),(19.6,GY0-GY1,.2),'wood',True)
cube('Hall gallery fascia',(64.5,GY1,GTOP-.25),(19.6,.08,.5),'cream')
for x in [59.5,69.5]:cube('Hall gallery column',(x,GY1+.15,(GTOP-.2)/2),(.28,.28,GTOP-.2),'cream',True)
STEPS=14
for sx in [55.35,73.35]:  # cầu thang: 14 bậc cao 0.2 m, sâu 0.32 m, rộng 1.2 m
    for j in range(STEPS):
        h=(j+1)*GTOP/STEPS;y=-29+j*.32+.16
        cube('Hall gallery stair',(sx,y,h/2),(1.2,.32,h),'stone',True)
def gallery_rail(x0,y0,z0,x1,y1,z1,solid=False):
    for dz in [.5,1.0]:beam('Hall gallery rail',(x0,y0,z0+dz),(x1,y1,z1+dz),.03,'metal')
    L=math.dist((x0,y0),(x1,y1));n=max(1,int(L/1.1))
    for k in range(n+1):
        t=k/n;x,y,z=x0+(x1-x0)*t,y0+(y1-y0)*t,z0+(z1-z0)*t;cube('Hall gallery rail post',(x,y,z+.5),(.05,.05,1.0),'metal')
    if solid:cube('Hall gallery rail collider',((x0+x1)/2,(y0+y1)/2,z0+.55),(abs(x1-x0)+.06,abs(y1-y0)+.06,1.1),'metal',True)
gallery_rail(56.05,GY1,GTOP,72.65,GY1,GTOP,True)          # mép trước khán đài (chừa đầu cầu thang hai bên)
for x in [56.0,72.7]:gallery_rail(x,-29,0,x,GY1,GTOP)     # tay vịn dọc cầu thang (phía trong nhà)
for row,y in enumerate([-22.2,-23.5]):                    # 2 hàng ghế trên khán đài
    for x0 in [57.2,62.5,67.8]:
        cube('Hall gallery seat',(x0+1.5,y,GTOP+.42),(3,.5,.12),'wood',True)
        cube('Hall gallery seat back',(x0+1.5,y+.25,GTOP+.75),(3,.08,.6),'wood')
for x in [64.5-1.17,64.5+1.17]:cube('Hall rear door jamb',(x,-21,1.3),(.16,.3,2.6),'cream')  # khung cửa sau (để trống lối đi)
cube('Hall rear door head',(64.5,-21,2.5),(2.5,.3,.16),'cream')
places.extend([{'id':'hall','label':'Nhà đa năng','position':[51.2,.98,33.55],'inside':[58,.98,33.55],'roof':[64.5,8.18,33.55]},{'id':'side-gate','label':'Cổng phụ','position':[49,.98,46]},{'id':'bikes','label':'Nhà để xe','position':[48.5,.98,20]}])


# Two compact washroom blocks at the marked rear corners.
# Mỗi khối chia đôi: NAM (bên trái) / NỮ (bên phải), mỗi bên một cửa riêng sát vách giữa.
# Bên trong: buồng vệ sinh dọc tường sau (vách ngăn, cánh cửa hé mở, bồn cầu sứ), bàn rửa tay + gương dọc tường bên;
# bên nam thêm bồn tiểu gắn vách giữa. (Toạ độ Blender: mặt trước có cửa ở y nhỏ = phía nam trong three.js.)
mat('porcelain',(.95,.96,.97));mat('mirror',(.72,.8,.86),.9)
WC_FLOOR=.2
STALL_WIDTH,STALL_DEPTH,STALL_DOOR=1.8,2.2,1.0
def toilet_stall(name,cx_,y0,y1):
    for px in [cx_-STALL_WIDTH/2,cx_+STALL_WIDTH/2]:cube(name+' stall panel',(px,(y0+y1)/2,WC_FLOOR+1.15),(.05,y1-y0,2.0),'trim',True)
    jamb=(STALL_WIDTH-STALL_DOOR)/2
    for sx in [-1,1]:cube(name+' stall front',(cx_+sx*(STALL_DOOR/2+jamb/2),y0,WC_FLOOR+1.15),(jamb,.05,2.0),'trim',True)
    th=math.radians(85);hx=cx_-STALL_DOOR/2
    door=cube(name+' stall door',(hx+STALL_DOOR/2*math.cos(th),y0+STALL_DOOR/2*math.sin(th),WC_FLOOR+1.1),(STALL_DOOR,.04,1.85),'wood');door.rotation_euler.z=th
    ty=y1-.7
    cube(name+' toilet base',(cx_,ty,WC_FLOOR+.22),(.46,.62,.44),'porcelain',True)
    cube(name+' toilet seat',(cx_,ty,WC_FLOOR+.46),(.5,.64,.06),'porcelain')
    cube(name+' toilet tank',(cx_,y1-.19,WC_FLOOR+.67),(.5,.2,.46),'porcelain')
    cube(name+' flush button',(cx_,y1-.19,WC_FLOOR+.91),(.08,.06,.02),'metal')
    # Avatar seated hip = body origin - .39, matching the porcelain seat top.
    seats.append({'id':'toilet-'+str(len(seats)),'label':'bồn cầu','kind':'toilet','position':[cx_,WC_FLOOR+.49+.39,-ty],'yaw':0,'exit':[cx_,WC_FLOOR+.85,-(y0-.65)]})

def sink_counter(name,wall_x,inward,y_c,n):  # bàn rửa tay dọc tường bên, n chậu, gương phía trên
    L=.9*n+.4;cx_=wall_x+inward*.3
    cube(name+' vanity cabinet',(cx_,y_c,WC_FLOOR+.4),(.5,L,.8),'wood',True)
    cube(name+' vanity top',(cx_,y_c,WC_FLOOR+.83),(.58,L+.04,.06),'porcelain')
    cube(name+' mirror',(wall_x+inward*.02,y_c,WC_FLOOR+1.65),(.03,L-.1,.95),'mirror')
    cube(name+' mirror frame',(wall_x+inward*.01,y_c,WC_FLOOR+1.65),(.02,L,1.05),'black')
    for k in range(n):
        y=y_c-L/2+.2+.45+k*.9
        cyl(name+' basin',(cx_+inward*.03,y,WC_FLOOR+.86),.19,.1,'porcelain',18)
        cyl(name+' faucet',(wall_x+inward*.12,y,WC_FLOOR+.98),.025,.2,'metal',8)
        cube(name+' faucet spout',(wall_x+inward*.18,y,WC_FLOOR+1.07),(.12,.03,.03),'metal')
# nhà vệ sinh trái đặt ở dải mở rộng phía tây (cạnh dãy B), xoay 90° để cửa quay về lối đi phía đông
for cx,cy,w,d,key,label,rot in [(-49.2,29,7.8,7,'WC TRÁI','Nhà vệ sinh nam – nữ (cạnh dãy B)',math.pi/2),(44,45,15.2,7,'WC PHẢI','Nhà vệ sinh nam – nữ (sau dãy A, phải)',0)]:
    wc_before=set(bpy.data.objects);wc_seat_start=len(seats)
    yf,yb=cy-d/2,cy+d/2
    cube(key+' floor',(cx,cy,.1),(w,d,.2),'stone',True)
    cube(key+' rear',(cx,yb,1.6),(w,.18,3.2),'cream',True)
    for xx in [cx-w/2,cx+w/2]:cube(key+' side',(xx,cy,1.6),(.18,d,3.2),'cream',True)
    cube(key+' gender partition',(cx,cy,1.6),(.12,d,3.2),'cream',True)   # vách giữa NAM | NỮ
    # mặt trước: 2 cửa rộng ~1.1 m sát vách giữa (NAM bên trái, NỮ bên phải), lanh tô phía trên
    for a,b in [(cx-w/2,cx-1.15),(cx+1.15,cx+w/2)]:cube(key+' entry wall',((a+b)/2,yf,1.6),(b-a,.18,3.2),'wall',True)
    for sx in [-1,1]:cube(key+' door head',(cx+sx*.6,yf,2.85),(1.1,.18,.7),'wall',True)
    cube(key+' roof',(cx,cy,3.35),(w+.4,d+.4,.18),'trim',True)
    for sx,word,m in [(-1,'NAM','blue'),(1,'NỮ','flower')]:
        cube(key+' sign plate',(cx+sx*.6,yf-.11,2.86),(.9,.04,.42),'trim')
        text(key+' sign '+word,word,(cx+sx*.6,yf-.14,2.76),.3,m)
    half=w/2;n=max(1,int((half-.18)//STALL_WIDTH))   # số buồng mỗi bên
    for sx in [-1,1]:   # -1 = NAM, +1 = NỮ
        outer=cx+sx*(w/2-.09)            # mặt trong tường bên
        for i in range(n):toilet_stall(key+(' nam' if sx<0 else ' nu'),outer-sx*(STALL_WIDTH/2+i*STALL_WIDTH),yb-.09-STALL_DEPTH,yb-.09)
        sinks=1 if w<8 else 2
        sink_counter(key+(' nam' if sx<0 else ' nu'),outer,-sx,yf+.35+(.9*sinks+.4)/2,sinks)
        if sx<0:   # bồn tiểu nam gắn vách giữa (mặt phía nam)
            for k in range(1 if w<8 else 2):
                y=yf+1.6+k*.85
                cube(key+' urinal',(cx-.06-.17,y,WC_FLOOR+.85),(.3,.38,.62),'porcelain',True)
                cube(key+' urinal divider',(cx-.06-.25,y+.43,WC_FLOOR+1.1),(.45,.04,.9),'trim')
    if rot:  # xoay cả khối quanh tâm (cx, cy)
        cr,sr=math.cos(rot),math.sin(rot)
        for ob in set(bpy.data.objects)-wc_before:
            dx,dy=ob.location.x-cx,ob.location.y-cy
            ob.location.x,ob.location.y=cx+dx*cr-dy*sr,cy+dx*sr+dy*cr;ob.rotation_euler.z+=rot
    if rot:
        cr,sr=math.cos(rot),math.sin(rot)
        for seat in seats[wc_seat_start:]:
            for field in ['position','exit']:
                x,h,z=seat[field];dx,dy=x-cx,-z-cy
                seat[field]=[cx+dx*cr-dy*sr,h,-(cy+dx*sr+dy*cr)]
            seat['yaw']+=rot
    ox,oy=(d/2+2)*math.sin(rot),-(d/2+2)*math.cos(rot)   # điểm đứng trước cửa
    places.append({'id':key,'label':label,'position':[cx+ox,.98,-(cy+oy)]})
for y in []:  # 2 chậu thông cũ (54,-42),(54,-21) nằm trong phần nhà đa năng mở rộng → bỏ
    cyl('Potted conifer pot',(54,y,.38),.48,.76,'brick',16)
    for j in range(4):
        bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.65-j*.11,radius2=.04,depth=1.1,location=(54,y,1.2+j*.48))
        bpy.context.object.data.materials.append(M['leaf'])

# Three trees and alternating lamps along the opposite roadside strip.
for y in [-22,-31,-40]:
    cyl('Opposite roadside conifer planter',(43,y,.3),.65,.6,'brick',20)
    cyl('Opposite roadside conifer trunk',(43,y,1),.11,1.5,'trunk',12)
    for j in range(6):
        bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=1.05-j*.14,radius2=.04,depth=1.6,location=(43,y,1.55+j*.57))
        ob=bpy.context.object;ob.name='Opposite roadside pine crown';ob.data.materials.append(M['leaf'])


# ===================== Dải mở rộng phía tây (dọc mặt tây dãy B, three.js x -53 → -42, z -51 → -0.55) =====================
# Bắc → nam: vườn STEM (nhà kính) · nhà vệ sinh (đã chuyển sang, xem vòng lặp nhà vệ sinh) · cây nhỏ · nhà kho.
# Lối đi lát gạch dọc phía đông (sát dãy B) và toàn bộ phần còn lại; góc tây bắc (chỗ nhà vệ sinh cũ) cũng lát gạch.
cube('West annex paving',(-47.5,25.78,-.08),(11,50.45,.18),'tile',True)
cube('Northwest corner paving',(-38.5,42.55,-.08),(9,16.9,.18),'tile',True)
# Match the courtyard's two-metre square tiles, joint width and elevation.
for x in range(-53,-41,2):cube('West annex longitudinal grout',(x,25.78,.018),(.018,50.45,.012),'grout')
for y in range(1,51,2):cube('West annex transverse grout',(-47.5,y,.018),(11,.018,.012),'grout')
for x in range(-43,-33,2):cube('Northwest corner longitudinal grout',(x,42.55,.018),(.018,16.9,.012),'grout')
for y in range(35,51,2):cube('Northwest corner transverse grout',(-38.5,y,.018),(9,.018,.012),'grout')
def small_tree(name,x,y):
    k=1.6   # to hơn trước ~1.6 lần
    cyl(name+' planter',(x,y,.22),.6*k,.44,'brick',18);cyl(name+' soil',(x,y,.45),.5*k,.05,'grass',18)
    beam(name+' trunk',(x,y,.44),(x,y,2.3*k),.11*k,'trunk')
    for dx,dy,dz,r in [(0,0,2.9,1.0),(.45,.2,2.5,.75),(-.4,-.3,2.55,.7),(.1,-.45,3.3,.6)]:ball(name+' crown',(x+dx*k,y+dy*k,dz*k),(r*k,r*k,r*k*.9),'leaf' if r>.7 else 'leaflight')
small_tree('Small tree between washroom and store',-49.3,20.5)
small_tree('Small tree northwest corner',-38.5,46.2)

# ---------- Vườn STEM: nhà kính khung trắng, kính trong; luống trồng, bàn nghiên cứu, kệ thuỷ canh; hồng leo bên cửa ----------
g=bpy.data.materials.new('glass');g.use_nodes=True;pg=next(n for n in g.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
pg.inputs['Base Color'].default_value=(.78,.92,.96,1);pg.inputs['Alpha'].default_value=.26;pg.inputs['Roughness'].default_value=.05
try:g.surface_render_method='BLENDED'
except Exception:g.blend_method='BLEND'
M['glass']=g;mat('rosepink',(.95,.45,.62));mat('soil',(.25,.16,.09));mat('tomato',(.86,.16,.08))
GX0,GX1,GY0,GY1,GH,GR=-52.6,-44.4,34.6,50.6,2.8,4.6   # to hơn: 8.2 x 16 m (three.js x -52.6 → -44.4, z -50.6 → -34.6)   # Blender: x, y (three.js z = -y), cao tường, cao nóc
GCX,GCY=(GX0+GX1)/2,(GY0+GY1)/2;DOOR_Y,DOOR_W=42.6,1.8
cube('Greenhouse floor',(GCX,GCY,.03),(GX1-GX0,GY1-GY0,.06),'stone',True)
def glass_run(x0,y0,x1,y1):  # tường kính: bệ gạch thấp + kính + trụ khung trắng
    L=math.dist((x0,y0),(x1,y1));cx_,cy_=(x0+x1)/2,(y0+y1)/2;ax=abs(x1-x0)>abs(y1-y0)
    cube('Greenhouse curb',(cx_,cy_,.22),(L,.18,.44) if ax else (.18,L,.44),'brick',True)
    cube('Greenhouse glass',(cx_,cy_,.44+(GH-.44)/2),(L,.04,GH-.44) if ax else (.04,L,GH-.44),'glass',True)
    n=max(1,round(L/1.6))
    for k in range(n+1):cube('Greenhouse frame post',(x0+(x1-x0)*k/n,y0+(y1-y0)*k/n,GH/2),(.07,.07,GH),'trim')
    cube('Greenhouse frame rail',(cx_,cy_,GH),(L,.08,.08) if ax else (.08,L,.08),'trim')
glass_run(GX0,GY0,GX1,GY0);glass_run(GX0,GY1,GX1,GY1);glass_run(GX0,GY0,GX0,GY1)
glass_run(GX1,GY0,GX1,DOOR_Y-DOOR_W/2);glass_run(GX1,DOOR_Y+DOOR_W/2,GX1,GY1)      # mặt đông chừa cửa
cube('Greenhouse door head',(GX1,DOOR_Y,GH-.15),(.1,DOOR_W,.3),'trim')
for sy in [-1,1]:  # hai cánh cửa kính mở ra ngoài
    dr=cube('Greenhouse door leaf',(GX1+.38,DOOR_Y+sy*(DOOR_W/2+.02),1.15),(.75,.04,2.1),'glass');dr.rotation_euler.z=sy*.35
# mái kính 2 mái, nóc chạy dọc theo chiều dài
half=(GX1-GX0)/2;slope=math.atan2(GR-GH,half);rl=math.hypot(half,GR-GH)
for sx in [-1,1]:
    r=cube('Greenhouse roof glass',(GCX+sx*half/2,GCY,(GH+GR)/2),(rl,GY1-GY0,.04),'glass');r.rotation_euler.y=sx*slope   # cùng chiều với mái nhà xe: nửa phía +x dốc xuống về +x
    for k in range(9):
        y=GY0+(GY1-GY0)*k/8;beam('Greenhouse rafter',(GCX+sx*half,y,GH),(GCX,y,GR),.035,'trim')
beam('Greenhouse ridge',(GCX,GY0,GR),(GCX,GY1,GR),.05,'trim')
for y in [GY0,GY1]:  # đầu hồi kính hình tam giác (khung)
    for sx in [-1,1]:beam('Greenhouse gable edge',(GCX+sx*half,y,GH),(GCX,y,GR),.04,'trim')
# luống trồng nâng (3 dãy dọc), rau xanh + cà chua chín
for bx,(by0,by1) in [(bx,seg) for bx in [GX0+1.3,GCX,GX1-1.8] for seg in [(GY0+1.2,DOOR_Y-.9),(DOOR_Y+.9,GY1-1.2)]]:  # chừa lối ngang 1.8 m thẳng từ cửa vào
    cube('Greenhouse raised bed',(bx,(by0+by1)/2,.25),(1.15,by1-by0,.5),'wood',True)
    cube('Greenhouse bed soil',(bx,(by0+by1)/2,.51),(1.05,by1-by0-.1,.04),'soil')
    n=int((by1-by0)/.65)
    for k in range(n):
        y=by0+.35+k*.65   # cây trong luống to hơn ~1.4 lần
        ball('Greenhouse plant',(bx-.28,y,.78),(.29,.29,.27),'leaflight' if k%2 else 'leaf')
        ball('Greenhouse plant',(bx+.28,y+.3,.8),(.26,.26,.29),'leaf' if k%2 else 'leaflight')
        if k%3==0:ball('Greenhouse tomato',(bx,y+.12,1.02),(.1,.1,.1),'tomato')
        if k%3==1:beam('Greenhouse stake',(bx,y,.52),(bx,y,1.6),.016,'wood')
# Biển "Giáo viên hướng dẫn: Bùi Thị Nga" gắn mặt ngoài vách kính phía đông (bên trái cửa, giữa 2 trụ khung y 38.15–39.93),
# quay ra phía người đi tới (hướng +x). Nền trắng viền xanh lá; chữ quá dài tự thu nhỏ cho vừa biển.
SIGN_Y,SIGN_Z,SIGN_W=39.04,1.62,1.55
cube('Greenhouse mentor sign frame',(GX1+.07,SIGN_Y,SIGN_Z),(.04,SIGN_W+.1,.92),'leaf')
cube('Greenhouse mentor sign board',(GX1+.1,SIGN_Y,SIGN_Z),(.03,SIGN_W,.82),'benchwhite')
for wording,dz,size,m in [('GIÁO VIÊN HƯỚNG DẪN',.17,.12,'brick'),('Bùi Thị Nga',-.13,.2,'leaf')]:
    label=text('Greenhouse mentor sign text',wording,(GX1+.12,SIGN_Y,SIGN_Z+dz),size,m);label.rotation_euler.z=math.pi/2
    bpy.context.view_layer.update()
    if label.dimensions.x>SIGN_W-.16:label.scale.x*=(SIGN_W-.16)/label.dimensions.x
# góc nghiên cứu: bàn làm việc với khay cây con, kệ thuỷ canh nhiều tầng, bồn nước
cube('Greenhouse workbench',(GX1-.6,GY0+.7,.82),(1.0,1.6,.06),'wood',True)
for dx,dy in [(-.4,-.7),(.4,-.7),(-.4,.7),(.4,.7)]:cube('Greenhouse bench leg',(GX1-.6+dx,GY0+.7+dy,.4),(.05,.05,.8),'metal')
for k in range(4):
    cyl('Greenhouse seedling pot',(GX1-.75+(k%2)*.3,GY0+.25+(k//2)*.45,.92),.11,.16,'brick',10)
    ball('Greenhouse seedling',(GX1-.75+(k%2)*.3,GY0+.25+(k//2)*.45,1.05),(.1,.1,.08),'leaflight')
for lvl in range(3):
    z=.45+lvl*.6
    cube('Hydroponic shelf',(GX0+.45,GY1-1.2,z),(.5,1.8,.04),'metal')
    beam('Hydroponic pipe',(GX0+.45,GY1-2.05,z+.08),(GX0+.45,GY1-.35,z+.08),.05,'trim')
    for k in range(6):ball('Hydroponic lettuce',(GX0+.45,GY1-1.95+k*.32,z+.18),(.11,.11,.08),'leaflight')
for y in [GY1-2.1,GY1-.3]:cube('Hydroponic frame',(GX0+.45,y,1.0),(.05,.05,2.0),'metal')
cyl('Greenhouse water tank',(GX0+.5,GY0+.6,.5),.38,1.0,'blue',16)
# biển tên trên mặt đông (quay ra lối đi)
cube('Greenhouse sign board',(GX1+.06,DOOR_Y,GH+.42),(.06,2.6,.5),'trim')
sg=text('Greenhouse sign','VƯỜN STEM',(GX1+.1,DOOR_Y,GH+.3),.34,'blue');sg.rotation_euler.z=math.pi/2
# hoa hồng leo trên kính hai bên cửa (dây leo zíc zắc + bông hồng đỏ / hồng phấn)
for sy in [-1,1]:
    y0=DOOR_Y+sy*(DOOR_W/2+.25)
    pts=[(GX1+.06,y0+sy*(.35*(k%2)),.2+k*.32) for k in range(8)]
    for a,b in zip(pts,pts[1:]):beam('Climbing rose vine',a,b,.02,'leaf')
    for k,(x,y,z) in enumerate(pts):
        ball('Climbing rose leaves',(x+.04,y,z),(.12,.16,.12),'leaflight')
        if k%2==0 or k>4:ball('Climbing rose bloom',(x+.08,y+sy*.08,z+.08),(.07,.07,.07),'flower' if k%3 else 'rosepink')

# ---------- Nhà kho 1 tầng: tường vàng như dãy B, mái ngói đỏ 2 mái; cửa cuốn quay về tường bao sau nhà nước (phía nam) ----------
KX0,KX1,KY0,KY1,KH,KR=-52.6,-45.0,4.5,16.5,3.4,1.4   # to hơn: 7.6 x 12 m (three.js x -52.6 → -45, z -16.5 → -4.5), mái cao 1.4 m   # Blender; mặt nam (có cửa) ở y = KY0 (three.js z -6)
KCX,KCY=(KX0+KX1)/2,(KY0+KY1)/2
cube('Store floor',(KCX,KCY,.08),(KX1-KX0,KY1-KY0,.16),'stone',True)
cube('Store back wall',(KCX,KY1,KH/2),(KX1-KX0,.2,KH),'wall',True)
for x in [KX0,KX1]:cube('Store side wall',(x,KCY,KH/2),(.2,KY1-KY0,KH),'wall',True)
for a,b in [(KX0,KCX-1.1),(KCX+1.1,KX1)]:cube('Store front wall',((a+b)/2,KY0,KH/2),(b-a,.2,KH),'wall',True)
cube('Store door head',(KCX,KY0,KH-.3),(2.2,.2,.6),'wall',True)
cube('Store roller shutter box',(KCX,KY0-.12,KH-.45),(2.4,.25,.32),'metal')     # cửa cuốn đang cuộn lên
for x in [KCX-1.12,KCX+1.12]:cube('Store shutter rail',(x,KY0-.08,1.2),(.06,.08,2.4),'metal')
half=(KX1-KX0)/2;rs=math.atan2(KR,half)
for sx in [-1,1]:
    r=cube('Store tiled roof',(KCX+sx*half/2,KCY,KH+KR/2),(math.hypot(half,KR)+.35,KY1-KY0+.6,.14),'roof');r.rotation_euler.y=sx*rs
for y in [KY0,KY1]:
    me=bpy.data.meshes.new('Store gable');me.from_pydata([(KX0,y,KH),(KX1,y,KH),(KCX,y,KH+KR)],[],[(0,1,2)]);me.materials.append(M['wall'])
    ob=bpy.data.objects.new('Store gable',me);bpy.context.collection.objects.link(ob)
for y in [KY0+2.2,KY1-2.2]:
    cube('Store window',(KX0-.02,y,1.9),(.05,1.1,.8),'window');cube('Store window frame',(KX0-.03,y,1.9),(.04,1.25,.95),'wood')
sg=text('Store sign','NHÀ KHO',(KCX,KY0-.12,KH+.25),.32,'blue')
for k in range(4):   # kệ sắt + thùng đồ bên trong
    y=KY0+1.6+k*2.6
    cube('Store shelf',(KX0+.45,y,1.0),(.6,1.6,2.0),'metal',True)
    for lvl in range(3):cube('Store box',(KX0+.45,y,.35+lvl*.65),(.5,1.2,.4),'wood')
cube('Store crate stack',(KX1-.7,KY1-1.0,.45),(.9,1.2,.9),'wood',True)
for k in range(3):ball('Store ball',(KX1-.6,KY0+1.2+k*.35,.32),(.16,.16,.16),'flower' if k%2 else 'blue')
places.extend([{'id':'steam','label':'Vườn STEM','position':[-43.8,.98,-DOOR_Y]},{'id':'store','label':'Nhà kho','position':[KCX,.98,-KY0+2.2]}])

# Lát gạch 2 khoảng cỏ người dùng khoanh (mặt gạch cao bằng sân):
#  - góc đông bắc quanh nhà vệ sinh phải: three.js x 33 → 54.7 (tường bao), z -51 → -36 (tới đầu nhà xe chính)
#  - đầu nam dãy B, giữa dãy B và tường bao sau nhà nước: x -42 → -33, z -4.2 → -0.55
cube('North-east corner paving',(43.85,43.5,-.08),(21.7,15,.18),'tile',True)
for x in range(34,55,3):cube('North-east corner grout',(x,43.5,.016),(.018,15,.012),'grout')
cube('B south end paving',(-37.5,2.375,-.08),(9,3.65,.18),'tile',True)

# Campus edges extend to the new service area, with both entrances left open.
# Tường bao căn theo nét đỏ người dùng vẽ (toạ độ Blender; three.js z = -y):
#  - Tây: tường cũ x = -43 chỉ còn từ sau dãy A tới ngang mặt bắc nhà nước (z -0.55); một đoạn ngang nối vào góc nhà nước;
#    đoạn dọc mới x = -36.25 thẳng hàng mặt tây nhà nước & nhà gần cổng, chạy xuống tới tường trước. Dải cỏ phía tây vườn nằm ngoài.
#  - Đông: tường bắc chỉ tới x = 54.8; đoạn dọc mới x = 54.8 sát mép đông nhà xe (53.2) từ tường bắc xuống z = 14;
#    đoạn ngang z = 14 (cách nhà đa năng ~3 m) sang tường đông. Bãi cỏ phía đông nhà xe nằm ngoài.
cube('West perimeter',(-53,25.78,1),(.2,50.45,2),'cream',True)   # dời từ x -43 ra -53: dải mở rộng phía tây
cube('West perimeter link',(-44.63,.55,1),(16.95,.2,2),'cream',True)  # tường bao sau nhà nước, kéo dài tới x -53
cube('West perimeter inner',(-36.25,-23.73,1),(.2,48.55,2),'cream',True)
cube('North perimeter',(.9,51,1),(107.8,.2,2),'cream',True)
cube('East perimeter inner',(54.8,18.5,1),(.2,65,2),'cream',True)
cube('East perimeter link',(64.9,-14,1),(20.4,.2,2),'cream',True)
# Dải cỏ giữa tường tây mới (three.js x -36.15) và mép sân lát gạch (x -33) → lát gạch thành lối đi,
# từ sau góc nhà nước (z -0.45) tới chân nhà gần cổng (z 35.5). Mặt gạch cao bằng sân (0.01) để đi liền mạch.
cube('West strip paving',(-34.575,-17.525,-.08),(3.15,35.95,.18),'tile',True)
for y in range(0,36,2):cube('West strip grout',(-34.575,-y,.016),(3.15,.018,.012),'grout')
cube('West strip grout long',(-34.575,-17.525,.016),(.018,35.95,.012),'grout')
# tường trước hai bên cổng phụ, cao bằng hàng rào trước; đoạn đông dừng ở mặt tường đông (x 75.17), không thò ra ngoài góc
for x0,x1 in [(42,45.5),(52.5,75.17)]:cube('South safety edge',((x0+x1)/2,-48,1.425),(x1-x0,.2,2.85),'cream',True)
# Vỉa hè sát tường trường (three.js z 48.15 → 50.2), đường nhựa (z 50.2 → 56) có vạch kẻ giữa đứt quãng, vỉa hè lát gạch phía bên kia đường
# (z 56 → 58.2) trước dãy 3 quán (nhà quán vẽ trong game: src/Shops.jsx, mặt tiền z 58.2).
mat('asphalt',(.27,.28,.3));mat('roadline',(.95,.95,.9))
cube('School side sidewalk paving',(11,-49.175,.015),(130,2.05,.03),'tile',True)
cube('School side sidewalk kerb',(11,-50.2,.05),(130,.14,.1),'stone')
cube('Front street asphalt',(11,-53.1,.012),(130,5.8,.03),'asphalt',True)
for x in range(-52,76,4):cube('Front street centre line',(x+1,-53.1,.03),(2,.12,.01),'roadline')
cube('Opposite sidewalk paving',(11,-57.1,.015),(130,2.2,.03),'tile',True)
cube('Opposite sidewalk kerb',(11,-56.02,.05),(130,.14,.1),'stone')
# Tường bao khép kín khu đường trước cổng (nét đỏ người dùng vẽ): 2 đầu đường (x -36.25 và x 75.17) chặn từ tường trường
# xuống mép vỉa hè bên kia; dọc mép ngoài vỉa hè (z 58.35) nối vào 3 nhà quán (x 1 → 19.8, tường nhà quán chặn phần còn lại),
# bịt cả 2 khe giữa các nhà quán → nhân vật không ra ngoài được.
SB_Y=-58.35
for x in [-36.25,75.17]:cube('Street end wall',(x,-(48.15+SB_Y*-1)/2,1.1),(.2,abs(SB_Y)-48.15,2.2),'cream',True)
for x0,x1 in [(-36.35,1.0),(6.0,7.0),(12.0,13.6),(19.8,75.27)]:cube('Street outer wall',((x0+x1)/2,SB_Y,1.1),(x1-x0,.2,2.2),'cream',True)
for x in range(-32,76,4):
    if 0.5<x<20.3:continue
    cube('Street outer wall pier',(x,SB_Y,1.2),(.32,.32,2.4),'cream')
# Collision-only support under visible planter rims and soil, including round pots.
for pot in list(bpy.data.objects):
    if pot.type!='MESH' or not any(tag in pot.name.lower() for tag in ['planter','soil']):continue
    if not (0<pot.location.z<1.3) or abs(pot.scale.x-pot.scale.y)>.001:continue
    r=abs(pot.scale.x);height=abs(pot.scale.z)
    if r<.25 or r>3 or height>1.2:continue
    for w,d in [(2*r,.8*r),(1.6*r,1.6*r),(.8*r,2*r)]:
        cube('Planter support collider',tuple(pot.location),(w,d,height),'grass',True)
export_campus_data()
# khung va chạm của lan can nhà xe chỉ dùng cho dữ liệu va chạm, không đưa vào mô hình hiển thị
for ob in [o for o in bpy.data.objects if ('Stair top guard rail collider' in o.name or 'Stair rail collider' in o.name or o.name.startswith(('Pond collider','Bench collider','Lounge chair collider','School drum collider','Bike shed railing collider','Hall gallery rail collider','Planter support collider')))]:bpy.data.objects.remove(ob,do_unlink=True)

# Merge static meshes by material for a small GLB and fewer draw calls on the web.
fonts=[o for o in bpy.context.scene.objects if o.type=='FONT']
bpy.ops.object.select_all(action='DESELECT')
for o in fonts:o.select_set(True)
if fonts:
    bpy.context.view_layer.objects.active=fonts[0];bpy.ops.object.convert(target='MESH')
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
bpy.ops.export_scene.gltf(filepath=ROOT+'/models-src/an-duong-school.glb',export_format='GLB',use_selection=False,export_cameras=False,export_lights=False)
with open(ROOT+'/public/models/colliders.json','w',encoding='utf8') as f: json.dump(colliders,f)
if '--skip-previews' in sys.argv:
    print('DONE: BLEND, GLB and walkable collision data created',flush=True)
    sys.exit(0)
scene.render.filepath=ROOT+'/preview/campus-overview.png'; bpy.ops.render.render(write_still=True)
cam.data.type='PERSP'; cam.data.lens=26; cam.location=(8,-15,2.7); cam.rotation_euler=(Vector((0,32,5))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=ROOT+'/preview/courtyard.png'; bpy.ops.render.render(write_still=True)
cam.location=(0,-15,2.7);cam.data.lens=50;cam.rotation_euler=(Vector((0,30,5.1))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=ROOT+'/preview/stage-detail.png';bpy.ops.render.render(write_still=True)
cam.location=(21,19,4.3);cam.data.lens=26;cam.rotation_euler=(Vector((21,38,6.5))-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=ROOT+'/preview/stair-bay.png';bpy.ops.render.render(write_still=True)
cam.location=(0,39,1.8);cam.data.lens=21;cam.rotation_euler=(Vector((1,44,1.6))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(0,42,3.15));class_light=bpy.context.object;class_light.name='Classroom preview ceiling light';class_light.data.energy=220;class_light.data.shape='DISK';class_light.data.size=3.5
scene.render.filepath=ROOT+'/preview/classroom.png';bpy.ops.render.render(write_still=True)
print('DONE: BLEND, GLB, walkable collision data and three previews created')


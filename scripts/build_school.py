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
cube('Foundation',(16,0,-.3),(120,112,.6),'grass')
cube('Courtyard',(0,4,-.08),(66,78,.18),'tile')
for x in range(-33,34,2): cube('Paving joint',(x,4,.018),(.018,78,.012),'grout')
for y in range(-35,44,2): cube('Paving joint',(0,y,.018),(66,.018,.012),'grout')
building('A - Dãy chính',0,40,68,3)
building('B - Dãy trái',-36,19,30,3,math.pi/2)
building('C - Dãy phải',36,13,42,3,-math.pi/2,False)
for side in [-1,1]:
    for floor in range(3):cube('Corner corridor connecting slab',(side*32,34.5,floor*3.6),(4.3,5,.2),'trim',True)

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
    seats.append({'id':f'bench-{len(seats)}','label':'ghế đá','position':[x,1.015,-y],'yaw':math.pi-rot,'exit':[x+math.sin(rot)*1.1,.98,-y+math.cos(rot)*1.1]})
    for o in set(bpy.data.objects)-before:
        p=o.location.copy(); o.location=(x+p.x*math.cos(rot)-p.y*math.sin(rot),y+p.x*math.sin(rot)+p.y*math.cos(rot),p.z); o.rotation_euler.z+=rot
for side in [-1,1]:
    for y in ([9,26] if side==-1 else [-17,-5,8,20]):
        tree(side*27,y); bench(side*30.25,18 if side==1 and y==8 else y+3,-side*math.pi/2)

# The garden now fills the space right up to the first areca planting strip.
garden_x,garden_y=-18,-20.6
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
    for yy in [-.24,-.08,.08,.24]:cube('Black bench seat slat',(0,yy,.57),(2,.115,.075),'black')
    for z in [.8,1.02,1.24]:cube('Black bench back slat',(0,.31,z),(2,.075,.14),'black')
    for dx in [-.87,.87]:
        for yy in [-.22,.25]:beam('Black bench curved leg',(dx,yy*1.4,.05),(dx,yy,.55),.055,'black')
        beam('Black bench back frame',(dx,.28,.4),(dx,.37,1.34),.05,'black')
        beam('Black bench arm',(dx,-.36,.86),(dx,.33,.94),.045,'black')
        for j in range(18):
            a=j*math.pi*1.7/18;b=(j+1)*math.pi*1.7/18
            beam('Black bench ornamental scroll',(dx,-.04+.22*math.cos(a),.7+.18*math.sin(a)),(dx,-.04+.22*math.cos(b),.7+.18*math.sin(b)),.018,'black')
    for ob in set(bpy.data.objects)-before:
        p=ob.location.copy();ob.location=(x+p.x*math.cos(rot)-p.y*math.sin(rot),y+p.x*math.sin(rot)+p.y*math.cos(rot),p.z+.28);ob.rotation_euler.z+=rot
    seats.append({'id':f'iron-{len(seats)}','label':'ghế băng','position':[x,1.25,-y],'yaw':rot,'exit':[x+math.sin(rot)*1.1,.98,-y+math.cos(rot)*1.1]})
ys=[-31.125,-23.75,-16.375,-9]
for row in [-3,5]:
    for i in range(3):
        midpoint=(ys[i]+ys[i+1])/2
        for offset in [-1.15,1.15]:iron_bench(row,midpoint+offset,math.pi/2 if i%2==0 else -math.pi/2)

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
for ob in set(bpy.data.objects)-water_before:
    ob.location.x=-36+(ob.location.x+36)*.82;ob.scale.x*=.82
    ob.location.y=-4+(ob.location.y+4)*.82;ob.scale.y*=.82
# Paved strip between the entrance building and the garden, matching courtyard joints.
cube('Garden entrance tiled walkway',(-18,-34.5,.025),(28,3,.08),'tile',True)
for x in range(-32,-3,2):cube('Walkway grout',(x,-34.5,.073),(.018,3,.012),'grout')
for y in [-36,-34,-33]:cube('Walkway transverse grout',(-18,y,.073),(28,.018,.012),'grout')
places.append({'id':'water-house','label':'Nhà lấy nước','position':[-29,.98,4]})

# Rock garden and fountain stand in front of the remaining left classroom wing.
cyl('Fountain basin rim',(-23,14,.34),2.45,.68,'stone',32)
cyl('Fountain water',(-23,14,.7),2.17,.06,'water',32)
for dx,dy,r,h in [(-.75,-.25,.75,1.7),(.25,.35,.7,2.15),(.95,-.25,.55,1.35)]:
    cyl('Rock garden island',(-23+dx,14+dy,.85),r,.4,'rock',9)
    rock=bpy.data.objects.new('Rock garden peak',bpy.data.meshes.new('Rock garden peak mesh'));bpy.context.collection.objects.link(rock)
    verts=[(-r,-r,0),(r,-r,0),(r,r,0),(-r,r,0),(0,0,h)]
    rock.data.from_pydata([(vx-23+dx,vy+14+dy,vz+1) for vx,vy,vz in verts],[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)])
    rock.data.materials.append(M['rock'])
cyl('Fountain jet',(-23,14,1.95),.035,1.65,'water',10)
ball('Fountain spray',(-23,14,2.8),(.23,.23,.3),'water')
places.append({'id':'fountain','label':'Hòn non bộ · Đài phun nước','position':[-19,.98,-14]})

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
for x in [3.7,8.3]:cube('School information board post',(x,-42,1.65),(.13,.16,3.3),'metal',True)
cube('School information board frame',(6,-42,2.15),(5,.22,2.15),'cream',True)
cube('School information board face',(6,-42.14,2.15),(4.7,.06,1.9),'blue')
for wording,z,size in [('BẢNG THÔNG TIN',2.78,.31),('TRƯỜNG THPT AN DƯƠNG',2.35,.25),('THÔNG BÁO · HOẠT ĐỘNG NHÀ TRƯỜNG',1.92,.17),('HỌC TẬP · VĂN HÓA · THỂ THAO',1.52,.19)]:text('School notice board lettering',wording,(6,-42.19,z),size,'trim')
cube('School notice board canopy',(6,-42,3.37),(5.5,.9,.14),'cream')
for ob in set(bpy.data.objects)-notice_before:
    px=ob.location.x-6;py=ob.location.y+42
    ob.location.x=5.75+py;ob.location.y=-37-px;ob.rotation_euler.z-=math.pi/2
places.append({'id':'information','label':'Bảng thông tin trường','position':[8,.98,37]})
for x in range(-40,41,4):
    if abs(x)<8 or x==-8: continue
    cube('Boundary pier',(x,-48,1.5),(.35,.4,3),'cream')
    cube('Boundary wall',(x+1.8,-48,.8),(3.6,.3,1.6),'wall')

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
# Four low steps enter the raised ground floor from the right face.
for j in range(4):cube('Gate house ground entry step',(-7.5-j*.65,-36,.075+j*.075),(1.2,2,.15+j*.15),'stone',True)
cube('Gate house ground entrance landing',(-10.25,-36,.6),(1.4,2,.2),'trim',True)
for y in [-37,-35]:cube('Gate house ground door jamb',(-10.05,y,1.95),(.12,.12,2.7),'wood')
cube('Gate house ground door head',(-10.05,-36,3.3),(.12,2.1,.12),'wood')

# Lane behind the right classroom wing, opening east through the secondary gate.
cube('East access lane',(44,0,.025),(7,88,.1),'stone')
cube('Secondary entrance approach',(49,-44,.03),(7,12,.1),'stone')
cube('East perimeter wall',(75,0,1.1),(.35,100,2.2),'cream')
for x in [46,52]:
    cube('Secondary gate pier',(x,-48,2.3),(1,1,4.6),'brick')
    cube('Secondary gate capital',(x,-48,4.65),(1.4,1.4,.25),'cream')
cube('Secondary gate lintel',(49,-48,4.9),(7.5,1.1,.42),'cream')
text('Secondary gate sign','CỔNG PHỤ',(49,-48.62,4.7),.35,'blue')
for x in [46.5,51.5]:
    for y in [-47,-46,-45,-44]:cube('Open secondary gate bars',(x,y,1.6),(.08,.045,3.2),'metal')

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
for z in [.08,3.25]:
    cube('Parking yellow deck',(47.7,9,z),(7.6,54,.18),'cream',True)
# A dedicated ramp lane on the right keeps the upper floor opening clear.
for y in [-18,-9,0,9,18,27,36]:
    for x in [43.9,53.1]:cube('Parking yellow column',(x,y,3.4),(.18,.18,6.8),'wall',True)
for side in [-1,1]:
    roof=cube('Parking tidy roof',(48.5+side*2.4,9,7.35),(5,55,.12),'cream');roof.rotation_euler.y=side*.13
for y in [-18,-9,0,9,18,27,36]:
    beam('Parking restrained roof truss',(43.9,y,7),(53.1,y,7),.045,'metal')
for x in [43.9,53.1]:cube('Parking yellow railing',(x,9,3.95),(.12,54,1.1),'wall',True)
cube('Parking upper landing',(52.1,9,3.25),(2,10,.18),'cream',True)
ramp=cube('Parking continuous yellow ramp',(52.1,-8,1.64),(1.9,24.23,.18),'wall',True)
ramp.rotation_euler.x=math.atan2(3.3,24)
for x in [51.12,53.08]:beam('Parking ramp rail',(x,-20,1),(x,4,4.3),.04,'metal')
text('Parking entrance name','NHÀ ĐỂ XE 2 TẦNG',(48.5,-18.15,6.45),.38,'blue')
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
cube('Hall rear wall',(59,31,3.5),(24,.2,7),'trim',True)
cube('Hall closed front wall',(59,-11,3.5),(24,.2,7),'trim',True)
cube('Hall flat roof',(59,10,7.1),(24.5,42.5,.2),'cream',True)
cube('Hall east parapet',(71.2,10,7.7),(.15,42.5,1),'cream',True)
for y in [-11.2,31.2]:cube('Hall end parapet',(59,y,7.7),(24.5,.15,1),'cream',True)
cube('Hall west parapet',(46.8,10,7.7),(.15,42,1),'cream',True)
for y in range(-7,31,5):
    for x in [46.94,71.06]:
        cube('Hall high window',(x,y,5),(.1,2.8,1.8),'window')
        cube('Hall wall pilaster',(x,y-1.8,3.7),(.25,.3,7),'cream')
text('Multipurpose hall sign','NHÀ ĐA NĂNG',(59,-11.18,5.5),.65,'blue')
for x in [51,67]:cube('Court sideline',(x,10,.115),(.05,28,.015),'trim')
for y in [-4,10,24]:cube('Court line',(59,y,.115),(16,.05,.015),'trim')
for ob in set(bpy.data.objects)-hall_before:
    ob.location.x=64+(ob.location.x-59)*.75;ob.scale.x*=.75
    ob.location.y=-29+(ob.location.y-10)*.57;ob.scale.y*=.57
# Left-hand entrance, with broad low steps and an open door.
for j in range(3):cube('Hall entrance step',(53.1+j*.6,-29,.075+j*.075),(1.2,5,.15+j*.15),'stone',True)
cube('Hall inner entry landing',(55.6,-29,.225),(1.3,5,.45),'stone',True)
cube('Hall inner threshold step',(56.65,-29,.1),(.9,5,.2),'stone',True)
label=text('Hall left entrance sign','NHÀ ĐA NĂNG',(54.82,-29,4.2),.45,'blue');label.rotation_euler.z=-math.pi/2
# Interior stage at the far end, with walkable steps and a central aisle.
# Stage at the opposite end, facing north into the hall.
cube('Hall high stage',(64,-37.5,.6),(15,5.5,1.2),'wood',True)
for x in [57.7,70.3]:
    for j in range(6):cube('Hall side stage stair',(x,-32.7-j*.4,.1+j*.1),(1.7,.75,.2+j*.2),'stone',True)
cube('Hall LED surround',(64,-40.1,3.3),(11,.18,3.7),'black')
cube('Hall LED screen',(64,-39.97,3.3),(10.5,.05,3.25),'blue')
for line,z in [('CHÚC MỪNG NGÀY',4),('NHÀ GIÁO VIỆT NAM',3.3),('20/11/2026',2.55)]:
    ob=text('LED celebration',line,(64,-39.88,z),.48,'gold');ob.rotation_euler=(math.pi/2,0,math.pi)
for x in [56.8,71.2]:
    for j in range(8):cyl('Hall folded velvet curtain',(x+(j-3.5)*.14,-39.5,3),.14,4.5,'red',12)
# Stylised bronze portrait bust, standing on a ceremonial pedestal.
cube('Ho Chi Minh bust pedestal',(58.5,-38.7,1.8),(1.1,1,1.2),'brick',True)
ball('Bronze bust shoulders',(58.5,-38.7,2.65),(.52,.25,.38),'gold')
ball('Bronze portrait head',(58.5,-38.7,3.15),(.23,.22,.32),'gold')
ball('Bronze beard',(58.5,-38.48,2.95),(.13,.1,.22),'gold')
# Open door leaves on either side of the left entrance.
for y in [-30.9,-27.1]:cube('Hall open timber door',(55.8,y,1.65),(1.5,.09,3.1),'wood',True)
for x in [59,69]:
    for y in [-24,-21]:
        cube('Hall audience seat',(x,y,.5),(2,.6,.16),'wood',True)
        cube('Hall audience back',(x,y-.3,.9),(2,.12,.75),'wood',True)
places.extend([{'id':'hall','label':'Nhà đa năng','position':[52,.98,29],'inside':[58,.98,29],'roof':[64,8.18,29]},{'id':'side-gate','label':'Cổng phụ','position':[49,.98,46]},{'id':'bikes','label':'Nhà để xe','position':[48.5,.98,20]}])


# Two compact washroom blocks at the marked rear corners.
for cx,cy,w,d,label in [(-38,46,6,7,'WC TRÁI'),(44,45,12,7,'WC PHẢI')]:
    cube(label+' floor',(cx,cy,.1),(w,d,.2),'stone',True)
    cube(label+' rear',(cx,cy+d/2,1.6),(w,.18,3.2),'cream',True)
    for xx in [cx-w/2,cx+w/2]:cube(label+' side',(xx,cy,1.6),(.18,d,3.2),'cream',True)
    for xx in [cx-w/4-.45,cx+w/4+.45]:cube(label+' entry wall',(xx,cy-d/2,1.6),(w/2-.9,.18,3.2),'wall',True)
    cube(label+' roof',(cx,cy,3.35),(w+.4,d+.4,.18),'trim',True)
    text(label+' sign',label,(cx,cy-d/2-.12,2.65),.35,'blue')
    for xx in [cx-1.4,cx+1.4]:
        cube(label+' basin',(xx,cy+1,.75),(.65,.5,.2),'trim')
    places.append({'id':label,'label':label,'position':[cx,.98,-cy+d/2+2]})
for y in [-42,-35,-28,-21]:
    cyl('Potted conifer pot',(54,y,.38),.48,.76,'brick',16)
    for j in range(4):
        bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.65-j*.11,radius2=.04,depth=1.1,location=(54,y,1.2+j*.48))
        bpy.context.object.data.materials.append(M['leaf'])

# Campus edges extend to the new service area, with both entrances left open.
cube('West perimeter',(-43,0,1),(.2,100,2),'cream',True)
cube('North perimeter',(16,51,1),(118,.2,2),'cream',True)
for x,w in [(44,4),(64,24)]:cube('South safety edge',(x,-48,1),(w,.2,2),'cream',True)
export_campus_data()

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
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/an-duong-school.glb',export_format='GLB',use_selection=False,export_cameras=False,export_lights=False)
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


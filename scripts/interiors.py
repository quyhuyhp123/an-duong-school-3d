"""Shared geometry helpers and walkable teaching blocks, executed by build_school.py."""
from mathutils import Matrix
box_meshes={}; solids=[]; rooms=[]; stair_routes=[]; places=[]; seats=[]
primitive_meshes={}
def cyl(n,loc,r,depth,m,vertices=10):
    key=('cylinder',m,vertices)
    if key not in primitive_meshes:
        vs=[(math.cos(i*math.tau/vertices),math.sin(i*math.tau/vertices),z) for z in [-.5,.5] for i in range(vertices)]
        fs=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,2*vertices))]+[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
        me=bpy.data.meshes.new('Unit cylinder '+m);me.from_pydata(vs,[],fs);me.materials.append(M[m]);primitive_meshes[key]=me
    o=bpy.data.objects.new(n,primitive_meshes[key]);bpy.context.collection.objects.link(o);o.location=loc;o.scale=(r,r,depth);return o
def ball(n,loc,scale,m):
    key=('foliage',m)
    if key not in primitive_meshes:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1);o=bpy.context.object;me=o.data;me.materials.append(M[m]);primitive_meshes[key]=me;bpy.data.objects.remove(o,do_unlink=True)
    o=bpy.data.objects.new(n,primitive_meshes[key]);bpy.context.collection.objects.link(o);o.location=loc;o.scale=scale;return o
def cube(n,loc,size,m,solid=False):
    if m not in box_meshes:
        me=bpy.data.meshes.new('Unit box '+m)
        me.from_pydata([(-.5,-.5,-.5),(-.5,-.5,.5),(-.5,.5,-.5),(-.5,.5,.5),(.5,-.5,-.5),(.5,-.5,.5),(.5,.5,-.5),(.5,.5,.5)],[],[(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)])
        me.materials.append(M[m]);box_meshes[m]=me
    o=bpy.data.objects.new(n,box_meshes[m]);bpy.context.collection.objects.link(o);o.location=loc;o.scale=size
    if solid or n in ['Foundation','Courtyard','Stage plinth','Stage step','Stage backdrop','Flag base','Gate pier','Gate lintel','East access lane','Secondary entrance approach','Bicycle parking slab','Boundary wall','East perimeter wall','Secondary gate pier','Secondary gate lintel']:solids.append(o)
    return o
def wp(cx,cy,a,x,y,z):return [cx+x*math.cos(a)-y*math.sin(a),z,-(cy+x*math.sin(a)+y*math.cos(a))]
reference_photo=None
def photo_panel(name,center,size,crop):
    """Map an unchanged photograph onto a sign using crop UVs, preserving its real lettering."""
    global reference_photo
    if reference_photo is None:
        reference_photo=bpy.data.images.load(os.path.join(ROOT,'image','stage-detail.jpg'),check_existing=True);reference_photo.pack()
    x,y,z=center;w,h=size;left,top,right,bottom=crop;iw,ih=reference_photo.size
    me=bpy.data.meshes.new(name);me.from_pydata([(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),(x-w/2,y,z+h/2)],[],[(0,1,2,3)])
    uv=me.uv_layers.new(name='Reference photograph crop')
    corners=[(left/iw,1-bottom/ih),(right/iw,1-bottom/ih),(right/iw,1-top/ih),(left/iw,1-top/ih)]
    for loop in me.loops:uv.data[loop.index].uv=corners[loop.vertex_index]
    material=bpy.data.materials.new(name+' photograph');material.use_nodes=True
    p=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.95
    texture=material.node_tree.nodes.new('ShaderNodeTexImage');texture.image=reference_photo;material.node_tree.links.new(texture.outputs['Color'],p.inputs['Base Color'])
    material.node_tree.links.new(texture.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.18
    me.materials.append(material);o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return o
def curved_panel(n,x,y,z,w,h,m='cream'):
    outline=[(-w/2,0),(w/2,0)]+[(w/2*math.cos(math.pi*j/32),.16+h*math.sin(math.pi*j/32)) for j in range(33)]
    vs=[(x+px,y+dy,z+pz) for dy in [-.15,.15] for px,pz in outline];count=len(outline)
    fs=[tuple(range(count-1,-1,-1)),tuple(range(count,2*count))]+[(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.materials.append(M[m]);o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return o

def building(name,cx,cy,length,floors,angle=0,arched=True):
    before=set(bpy.data.objects);H=3.6;main=name.startswith('A');left=name.startswith('B');stairw=7.6 if main else 7;start=-length/2
    gate_house=name.startswith('D')
    centered=left or name.startswith('C') or gate_house
    sx=21 if main else (0 if centered else length/2-stairw/2)
    stair_left=sx-stairw/2;stair_right=sx+stairw/2
    segments=[(start,stair_left)]
    if main or centered:segments.append((stair_right,length/2))
    if main:segments=[(start,-24.8),(-17.2,stair_left),(stair_right,length/2)]
    layout=[]
    for lo,hi in segments:
        if gate_house:
            n=2  # Two classrooms on each side of the central stairwell.
        else:
            n=(2 if main and lo==stair_right else max(1,int((hi-lo)/5.5))) if main else round((hi-lo)/6)
        for j in range(n):layout.append((lo+(j+.5)*(hi-lo)/n,(hi-lo)/n))
    count=len(layout);front=-6.15 if main else -5.15
    for floor in range(floors+1):
        z=floor*H
        for lo,hi in ([(start,length/2)] if floor==floors else segments):cube(name+' room slab',((lo+hi)/2,.4,z),(hi-lo,11,.2),'trim',True)
        if floor==floors:
            for yy in [-5.15,5.75]:cube(name+' closed roof parapet',(0,yy,z+.52),(length,.18,1.05),'cream',True)
            for xx in [-length/2,length/2]:cube(name+' closed roof end',(xx,.3,z+.52),(.18,11.1,1.05),'cream',True)
            continue
        stair_before=set(bpy.data.objects)
        cube(name+' stair corridor',(sx,(front-2.7)/2,z),(stairw,-2.7-front,.2),'trim',True)
        cube(name+' stair front landing',(sx,-1.8 if main else -1.7,z),(stairw,1.8 if main else 1.4,.2),'trim',True)
        # Slab openings stay clear above both flights, including the roof.
        if floor<floors-1:
            cube(name+' half landing',(sx,4.55,z+1.8),(stairw,1.5,.2),'trim',True)
            for j in range(12):
                y=-1+(j+.5)*.4
                cube(name+' stair up',(sx-2,y,z+(j+1)*.15),(3,.415,.18),'stone',True)
                cube(name+' stair return',(sx+2,y,z+3.6-j*.15),(3,.415,.18),'stone',True)
            # Separate parallel rails on each flight; posts end at the actual treads.
            for dx,ascending in [(-.48,True),(.48,False)]:
                low=z+1.05 if ascending else z+4.65
                beam(name+' red stone stair handrail',(sx+dx,-1,low),(sx+dx,3.8,z+2.85),.065,'brick')
                beam(name+' red stone landing return',(sx+dx,3.8,z+2.85),(sx+dx,4.75,z+2.85),.065,'brick')
                for j in range(12):
                    yy=-1+(j+.5)*.4
                    tread=z+(j+1)*.15 if ascending else z+3.6-j*.15
                    top=low+(yy+1)*( .375 if ascending else -.375)
                    beam(name+' vertical stair baluster',(sx+dx,yy,tread+.06),(sx+dx,yy,top),.028,'trim')
            for dx in [-3.6,3.6]:cube(name+' stair wall lining',(sx+dx,1.9,z+1.8),(.2,6.1,3.4),'wall',True)
            stair_routes.append({'building':name,'floor':floor,'roof':False,'path':[wp(cx,cy,angle,sx-1.65,-2.1,z+.98),wp(cx,cy,angle,sx-1.65,4.35,z+2.78),wp(cx,cy,angle,sx+1.65,4.35,z+2.78),wp(cx,cy,angle,sx+1.65,-2.1,z+4.58)]})
        if main:
            for original in set(bpy.data.objects)-stair_before:
                clone=original.copy();clone.data=original.data;bpy.context.collection.objects.link(clone);clone.location.x-=42
                if original in solids:solids.append(clone)
            if floor<floors-1:
                source=stair_routes[-1]
                stair_routes.append({**source,'building':name+' · Cầu thang trái','path':[[p[0]-42,p[1],p[2]] for p in source['path']]})
        wallh=1.05 if floor==floors else 3.4
        cube(name+' rear wall',(0,5.75,z+wallh/2+.1),(length,.2,wallh),'cream',True)
        for side in [-1,1]:cube(name+' end wall',(side*length/2,2.5,z+wallh/2+.1),(.2,6.7,wallh),'cream',True)
        if True:
            for lo,hi in segments:
                if main:lo=max(lo,-29.5);hi=min(hi,29.5)
                cube(name+' balcony',((lo+hi)/2,-5.15,z+.52),(hi-lo,.18,.85),'cream',True)
                cube(name+' balcony coping',((lo+hi)/2,-5.15,z+.99),(hi-lo,.3,.1),'cream' if main and floor==floors else 'brick')
            if floor: cube(name+' stair bay balcony',(sx,front,z+.52),(stairw,.18,.85),'cream',True)
            if floor: cube(name+' stair bay coping',(sx,front,z+.99),(stairw,.3,.1),'cream' if main and floor==floors else 'brick')
            if main and floor:
                for xx in [stair_left,stair_right]:cube(name+' balcony widening return',(xx,-5.65,z+.52),(.16,1,.85),'cream',True)
        if floor==floors:
            continue
        for j,(x,w) in enumerate(layout):
            left=x-w/2;door=x-1.45;dw=1.25
            cube(name+' partition',(left,2.2,z+1.8),(.16,6.8,3.4),'wall',True)
            cube(name+' door lintel',(door,-1.15,z+3.05),(dw,.2,.7),'wall',True)
            a=left+.08;b=door-dw/2
            if b>a:cube(name+' door side',((a+b)/2,-1.15,z+1.75),(b-a,.2,3.3),'wall',True)
            a=door+dw/2;b=x+w/2;wx=(a+b)/2
            cube(name+' sill',((a+b)/2,-1.15,z+.5),(b-a,.2,.8),'wall',True)
            cube(name+' window head',((a+b)/2,-1.15,z+3.1),(b-a,.2,.55),'wall',True)
            for dx in [-dw/2,dw/2]:cube(name+' timber jamb',(door+dx,-1.25,z+1.4),(.065,.12,2.6),'wood')
            cube(name+' open timber door',(door-dw/2+.02,-.56,z+1.36),(.075,1.13,2.5),'wood')
            for aa,bb in [(a,wx-.9),(wx+.9,b)]:
                if bb>aa:cube(name+' window side pier',((aa+bb)/2,-1.15,z+1.94),(bb-aa,.2,1.8),'wall',True)
            cube(name+' window glass',(wx,-1.18,z+1.94),(1.7,.035,1.8),'window',True)
            for dx in [-.6,0,.6]:cube(name+' window grille',(wx+dx,-1.29,z+1.94),(.035,.035,1.8),'wood')
            for zz in [1.03,1.94,2.86]:cube(name+' window crossbar',(wx,-1.3,z+zz),(1.8,.05,.055),'wood')
            # Exterior rear windows and end-wall windows make the complete wings readable.
            cube(name+' rear window',(x,5.88,z+1.95),(1.65,.045,1.65),'window')
            for dx in [-.86,.86]:cube(name+' rear timber frame',(x+dx,5.92,z+1.95),(.06,.05,1.8),'wood')
            for zz in [1.08,2.82]:cube(name+' rear frame rail',(x,5.92,z+zz),(1.78,.05,.06),'wood')
            rid=f'{name[0]}{floor+1}{j+1:02}'
            text(name+' room plate',rid,(door,-1.31,z+2.8),.14,'blue')
            cube(name+' chalkboard',(x,5.52,z+1.8),(3.6,.06,1.35),'black')
            cube(name+' chalk ledge',(x,5.38,z+1.1),(3.7,.22,.06),'wood')
            # Leave a full-height aisle directly behind the door, not a desk edge.
            for dx in [-.3,1.55]:
                for yy in [.8,2.4,4]:
                    cube(name+' desk top',(x+dx,yy,z+.83),(1.4,.64,.09),'wood',True)
                    cube(name+' desk legs',(x+dx,yy,z+.45),(1.35,.12,.7),'metal')
                    cube(name+' desk bench',(x+dx,yy-.6,z+.48),(1.4,.35,.09),'wood')
            rooms.append({'id':rid,'building':name,'floor':floor+1,'door':wp(cx,cy,angle,door,-2,z+.98),'inside':wp(cx,cy,angle,door,-.15,z+.98),'aisle':wp(cx,cy,angle,door,4.5,z+.98)})
        for xx in [stair_left,stair_right]:cube(name+' stair room partition',(xx,2.2,z+1.8),(.16,6.8,3.4),'wall',True)
        for side in [-1,1]:
            for yy in [0,3.7]:cube(name+' end facade window',(side*(length/2+.12),yy,z+1.9),(.045,1.5,1.65),'window')
        column_positions=sorted({round(xx,6) for x,w in layout for xx in [x-w/2,x,x+w/2]})
        for xx in column_positions:
            cube(name+' column',(xx,-5.04,z+1.82),(.22,.28,3.42),'cream',True)
            cube(name+' capital',(xx,-5.04,z+3.1),(.38,.42,.16),'trim')
        for x,w in layout:
            for xx in [x-w/4,x+w/4]:arch(name+' arcade',xx,-5.04,z+2.72,w/2-.22,.48,.28,'trim')
        if main:
            for xx in [stair_left,stair_right]:
                cube(name+' widened stair column',(xx,front+.1,z+1.8),(.26,.32,3.4),'cream',True)
            arch(name+' widened stair arcade',sx,front+.1,z+2.72,stairw-.26,.48,.28,'trim')
        for lo,hi in segments:cube(name+' cornice',((lo+hi)/2,-5.07,z+3.43),(hi-lo,.4,.15),'trim')
        cube(name+' stair bay cornice',(sx,front+.08,z+3.43),(stairw,.4,.15),'trim')
    if name.startswith('A'):
        for x in [-21,21]:
            panel_y=front-.10
            curved_panel('Motto pediment',x,panel_y,floors*H+.3,19,2.45)
            for j in range(32):
                aa=math.pi*j/32;bb=math.pi*(j+1)/32
                beam('Cream curved pediment rim',(x+9.5*math.cos(aa),panel_y-.17,floors*H+.46+2.45*math.sin(aa)),(x+9.5*math.cos(bb),panel_y-.17,floors*H+.46+2.45*math.sin(bb)),.055,'trim')
            wording='TIÊN HỌC LỄ - HẬU HỌC VĂN' if x>0 else 'DẠY THẬT TỐT - HỌC THẬT TỐT'
            label=text('Right motto' if x>0 else 'Left motto',wording,(x,panel_y-.20,floors*H+1.48),.78,'brick')
            bpy.context.view_layer.update()
            if label.dimensions.x>14.5:label.scale.x*=14.5/label.dimensions.x
        photo_panel('School photographic sign',(0,-5.5,9.9),(15,1.95),(621,128,1470,247))
    if main:
        # Mirror the projecting balcony and arcade around the left staircase.
        for original in list(set(bpy.data.objects)-before):
            if any(tag in original.name for tag in ['stair bay balcony','stair bay coping','widened stair column','widened stair arcade','stair bay cornice','balcony widening return']):
                clone=original.copy();clone.data=original.data;bpy.context.collection.objects.link(clone);clone.location.x-=42
                if original in solids:solids.append(clone)
        places.append({'id':name+' · Cầu thang trái','label':'Dãy chính · Cầu thang Dạy tốt – Học tốt','position':wp(cx,cy,angle,-22.65,-10,.98),'stairs':wp(cx,cy,angle,-22.65,-2,.98)})
    if main:
        # Bow the two projecting gallery bays towards the courtyard.
        for ob in set(bpy.data.objects)-before:
            if ob.type!='MESH' or ob.location.y>-4.7:continue
            if not any(tag in ob.name for tag in ['balcony','coping','widened stair','stair bay cornice','stair corridor']):continue
            ob.data=ob.data.copy()
            # Subdivide broad slabs so the front edge follows a continuous curve.
            import bmesh
            bm=bmesh.new();bm.from_mesh(ob.data)
            bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=16,use_grid_fill=True)
            bm.to_mesh(ob.data);bm.free()
            for vertex in ob.data.vertices:
                xx=ob.location.x+vertex.co.x*ob.scale.x
                yy=ob.location.y+vertex.co.y*ob.scale.y
                d=min(abs(xx-21),abs(xx+21))
                if d<5 and yy<-2.7:
                    vertex.co.y-=.9*max(0,1-(d/5)**2)/ob.scale.y
    for o in set(bpy.data.objects)-before:
        p=o.location.copy();o.location=(cx+p.x*math.cos(angle)-p.y*math.sin(angle),cy+p.x*math.sin(angle)+p.y*math.cos(angle),p.z);o.rotation_euler.z+=angle
    places.append({'id':name,'label':name,'position':wp(cx,cy,angle,sx-1.65,-10 if main else -7,.98),'roof':wp(cx,cy,angle,0,-3,floors*H+.98),'stairs':wp(cx,cy,angle,sx-1.65,-2,.98)})
    print(f'{name}: {count*floors} accessible rooms / stairs to roof',flush=True)

def export_campus_data():
    bpy.context.view_layer.update();C=Matrix(((1,0,0),(0,0,1),(0,-1,0)));boxes=[]
    for o in solids:
        p=o.matrix_world.translation;q=(C@o.matrix_world.to_quaternion().to_matrix()@C.inverted()).to_quaternion();s=o.dimensions
        # Scale is in the object's local frame; dimensions are world AABB after rotations.
        local=[abs(v) for v in o.scale]
        boxes.append({'name':o.name,'position':[p.x,p.z,-p.y],'halfExtents':[local[0]/2,local[2]/2,local[1]/2],'quaternion':[q.x,q.y,q.z,q.w]})
    with open(ROOT+'/public/models/campus-data.json','w',encoding='utf8') as f:json.dump({'version':2,'colliders':boxes,'rooms':rooms,'seats':seats,'stairs':stair_routes,'places':places,'spawn':[8,1,17]},f,ensure_ascii=False,separators=(',',':'))
    motto=bpy.data.objects['Right motto'];bounds=[motto.matrix_world@Vector(v) for v in motto.bound_box]
    clearance=min(v.z for v in bounds)-(3*3.6+.99+.05)
    assert clearance>.08,'Motto must be fully above roof coping'
    assert max(v.y for v in bounds)<40-6.4,'Motto must sit in front of the curved pediment'
    with open(ROOT+'/preview/facade-checks.json','w',encoding='utf8') as f:json.dump({'mottoClearanceAboveCoping':clearance,'mottoSize':.78,'mainStairCenterX':21,'mainStairCorridorDepth':3.45},f,indent=2)
    print(f'EXPORTED {len(boxes)} colliders, {len(rooms)} classroom doors, {len(stair_routes)} stair routes',flush=True)

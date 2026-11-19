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
        reference_photo=bpy.data.images.load(os.path.join(ROOT,'models-src','textures','stage-detail.jpg'),check_existing=True);reference_photo.pack()
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

def local_yaw(angle,dx,dy):
    """Hướng nhìn (dx, dy) trong hệ toạ độ dãy nhà → yaw ghế (three.js: atan2(x, z), như classroomLayout)."""
    X=dx*math.cos(angle)-dy*math.sin(angle);Y=dx*math.sin(angle)+dy*math.cos(angle);return math.atan2(X,-Y)
def teacher_lounge(name,cx,cy,angle,z,lo,hi):
    """Phòng nghỉ giáo viên (gộp 2 lớp tầng 1): bàn hội nghị dài gỗ + 14 ghế bọc nệm đỏ — ghế chỉ thầy cô ngồi được (teacher:True).
    Toạ độ theo hệ của dãy nhà (x dọc dãy, y từ tường trước -1.15 tới tường sau 5.65); building() xoay cả cụm ở cuối."""
    fl=z+.1;tx=(lo+hi)/2;ty=2.6;TL=min(7.0,hi-lo-4.2);TW=1.6;TH=.76
    cube(name+' lounge table top',(tx,ty,fl+TH-.03),(TL,TW,.06),'wood',True)
    cube(name+' lounge table edge',(tx,ty,fl+TH-.075),(TL-.1,TW-.1,.05),'drumred')
    for sx_ in [-1,1]:
        for sy in [-1,1]:cube(name+' lounge table leg',(tx+sx_*(TL/2-.25),ty+sy*(TW/2-.2),fl+(TH-.1)/2),(.09,.09,TH-.1),'wood')
    cube(name+' lounge table modesty panel',(tx,ty,fl+.45),(TL-.6,.04,.5),'wood')
    # giữa bàn: khăn trải dọc bàn, 2 lọ hoa
    cube(name+' lounge table runner',(tx,ty,fl+TH+.003),(TL-.6,.42,.006),'red')
    for k in [-1,1]:
        cyl(name+' lounge vase',(tx+k*TL/4,ty,fl+TH+.1),.08,.2,'blue',12)
        for i in range(7):
            a=i*2.4;d=.04 if i<3 else .09
            ball(name+' lounge vase flower',(tx+k*TL/4+math.cos(a)*d,ty+math.sin(a)*d,fl+TH+.26+(.04 if i<3 else 0)),(.05,.05,.05),'gold' if i%2 else 'flower')
    # (x, y, hướng nhìn dx, dy): 6 ghế mỗi bên dài, 1 ghế mỗi đầu bàn — tất cả quay vào bàn
    chairs=[(tx+(k-2.5)*1.05,ty+sy*(TW/2+.35),0,-sy) for sy in [-1,1] for k in range(6)]
    chairs+=[(tx+sx_*(TL/2+.45),ty,-sx_,0) for sx_ in [-1,1]]
    for k,(x,y,dx,dy) in enumerate(chairs):
        bx,by=-dx,-dy   # lưng ghế ở phía xa bàn
        cube(name+' lounge chair seat',(x,y,fl+.45),(.48,.48,.08),'drumred')
        cube(name+' lounge chair back',(x+bx*.22,y+by*.22,fl+.8),(.48 if dx==0 else .06,.06 if dx==0 else .48,.62),'drumred')
        cube(name+' lounge chair back rail',(x+bx*.22,y+by*.22,fl+1.12),(.5 if dx==0 else .07,.07 if dx==0 else .5,.04),'wood')
        for lx in [-.19,.19]:
            for ly in [-.19,.19]:cube(name+' lounge chair leg',(x+lx,y+ly,fl+.21),(.04,.04,.42),'wood')
        cube('Lounge chair collider',(x,y,fl+.25),(.46,.46,.5),'wood',True)
        seats.append({'id':f'lounge-{k}','label':'ghế phòng giáo viên','teacher':True,'position':wp(cx,cy,angle,x,y,fl+.45+.36),
                      'yaw':local_yaw(angle,dx,dy),'exit':wp(cx,cy,angle,x-dx*.8,y-dy*.8,z+.98)})
def school_drum(name,x,y,z,phi=0):
    """Trống trường (theo ảnh mẫu): tang trống đỏ, mặt da màu ngà viền vàng, đặt nghiêng trên giá gỗ sơn đỏ; dùi trống gác trên giá.
    phi: xoay cả trống quanh trục đứng (0 = trục trống dọc theo x của dãy nhà)."""
    drum_before=set(bpy.data.objects)
    fl=z+.1;R=.56;L=.74;tilt=.28;C=Vector((x,y,fl+1.22))
    u=Vector((math.cos(tilt),0,math.sin(tilt)))   # trục trống: dọc hành lang, ngẩng mặt trống lên một chút
    def along(n,off,r,depth,m,verts=28):
        o=cyl(n,tuple(C+u*off),r,depth,m,verts);o.rotation_euler=(0,math.pi/2-tilt,0);return o
    along(name+' drum barrel',0,R,L*.55,'red')
    for s_ in [-1,1]:
        along(name+' drum barrel',s_*L*.36,R*.94,L*.2,'red')
        along(name+' drum gold hoop',s_*(L/2-.005),R*.92,.05,'gold')
        along(name+' drum skin',s_*(L/2+.01),R*.86,.02,'drumskin')
        for i in range(14):   # đinh tán vàng quanh mặt trống
            a=i*math.tau/14;v=Vector((-math.sin(tilt)*math.cos(a),math.sin(a),math.cos(tilt)*math.cos(a)))
            ball(name+' drum stud',tuple(C+u*(s_*(L/2-.06))+v*R*.93),(.025,.025,.025),'gold')
    for s_ in [-1,1]:along(name+' drum gold band',s_*L*.18,R*1.005,.035,'gold')
    # giá trống: 4 chân, 2 thanh đỡ, giằng dưới, 2 thanh ngang
    for sx_ in [-1,1]:
        for sy in [-1,1]:cube(name+' drum stand leg',(x+sx_*.42,y+sy*.42,fl+.4),(.08,.08,.8),'drumred')
        cube(name+' drum stand cradle',(x+sx_*.32,y,fl+.78+sx_*.09),(.12,.95,.1),'drumred')
        cube(name+' drum stand brace',(x+sx_*.42,y,fl+.18),(.06,.84,.06),'drumred')
    for sy in [-1,1]:cube(name+' drum stand rail',(x,y+sy*.42,fl+.8),(.92,.07,.07),'drumred')
    beam(name+' drum stick',(x+.2,y+.46,fl+.84),(x-.25,y+.46,fl+.86),.022,'wood')
    cube('School drum collider',(x,y,fl+.85),(1.25,1.15,1.7),'wood',True)
    if phi:
        c_,s_=math.cos(phi),math.sin(phi)
        for o in set(bpy.data.objects)-drum_before:
            px,py=o.location.x-x,o.location.y-y
            o.location.x=x+px*c_-py*s_;o.location.y=y+px*s_+py*c_;o.rotation_euler.z+=phi

def computer_lab(name,cx,cy,angle,z,lo,hi):
    """Phòng tin học (gộp 2 lớp tầng trên cùng): 2 hàng máy tính quay về tường sau (bảng trắng), mỗi hàng 6 máy,
    mỗi máy một bàn riêng cách nhau 0.4 m; ghế xoay ngồi được (F). Lối đi: dải trước cửa, lối dọc bên trái, lối giữa 2 hàng."""
    fl=z+.1;DH=.75;DD=.62;N=6;P=1.45;W=1.05
    x0=hi-.35-N*P   # các dãy bàn sát tường hồi bên phải, chừa lối rộng bên trái cửa thứ nhất
    cube(name+' lab whiteboard',((lo+hi)/2+1,5.52,z+1.95),(3.4,.05,1.2),'drumskin')
    cube(name+' lab whiteboard frame',((lo+hi)/2+1,5.55,z+1.95),(3.5,.04,1.3),'metal')
    cube(name+' lab teacher desk',(lo+1.1,4.6,fl+DH/2),(1.4,.7,DH),'wood',True)
    cube(name+' lab teacher monitor',(lo+1.1,4.75,fl+DH+.2),(.5,.04,.32),'black')
    k=0
    for row,dy in enumerate([1.5,3.7]):
        for i in range(N):
            x=x0+(i+.5)*P
            cube(name+' lab desk top',(x,dy,fl+DH-.025),(W,DD,.05),'wood',True)
            cube(name+' lab desk body',(x,dy+.22,fl+(DH-.05)/2),(W,.06,DH-.05),'wood',True)   # tấm chắn sau, cũng là khung va chạm tới sàn
            for e in [-W/2,W/2]:cube(name+' lab desk side',(x+e,dy,fl+(DH-.05)/2),(.05,DD,DH-.05),'wood')
            cube(name+' lab monitor',(x,dy+.12,fl+DH+.24),(.52,.035,.32),'black')
            cube(name+' lab screen',(x,dy+.1,fl+DH+.245),(.47,.01,.27),'water')
            cube(name+' lab monitor stand',(x,dy+.15,fl+DH+.05),(.06,.05,.1),'metal')
            cube(name+' lab monitor foot',(x,dy+.13,fl+DH+.007),(.22,.14,.014),'metal')
            cube(name+' lab keyboard',(x,dy-.12,fl+DH+.012),(.42,.14,.02),'rock')
            cube(name+' lab mouse',(x+.3,dy-.12,fl+DH+.015),(.05,.08,.025),'rock')
            cube(name+' lab computer case',(x+.32,dy+.02,fl+.25),(.18,.42,.4),'black')
            cy_=dy-.62   # ghế xoay: mặt ngồi, lưng tựa, trụ, chân sao
            cube(name+' lab chair seat',(x,cy_,fl+.47),(.44,.42,.07),'blue')
            cube(name+' lab chair back',(x,cy_-.21,fl+.78),(.42,.05,.45),'blue')
            cyl(name+' lab chair post',(x,cy_,fl+.25),.025,.42,'metal',8)
            for a in range(5):
                t=a*math.tau/5;cube(name+' lab chair foot',(x+math.cos(t)*.14,cy_+math.sin(t)*.14,fl+.04),(.28,.035,.035),'metal').rotation_euler.z=t
            seats.append({'id':f'lab-{k}','label':'ghế phòng tin học','position':wp(cx,cy,angle,x,cy_,fl+.47+.36),
                          'yaw':local_yaw(angle,0,1),'exit':wp(cx,cy,angle,x,cy_-.45,z+.98)});k+=1

def building(name,cx,cy,length,floors,angle=0,arched=True):
    before=set(bpy.data.objects);H=3.6;main=name.startswith('A');glass=name[:1] in 'ABC'   # 3 dãy chính: cửa sổ kính trong suốt, khoét ô thật ở tường sau
    winmat='glass' if glass else 'window';left=name.startswith('B');stairw=7.6 if main else 7;start=-length/2
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
        if main:
            # Follow the curved parapet with coplanar floor/support strips. Their tops
            # stay at z+.1, exactly the same elevation as the adjacent room slabs.
            strips=32
            for j in range(strips):
                x0=stair_left+j*stairw/strips;x1=stair_left+(j+1)*stairw/strips
                def bowed_front(x):return front-.9*max(0,1-((x-sx)/5)**2)
                edge=min(bowed_front(x0),bowed_front(x1))-.025
                cube(name+' curved stair floor segment',((x0+x1)/2,(edge-2.7)/2,z),(x1-x0,-2.7-edge,.2),'trim',True)
        else:
            cube(name+' stair corridor',(sx,(front-2.7)/2,z),(stairw,-2.7-front,.2),'trim',True)
        # Close the former 30 cm joint without adding a raised patch over the floor.
        cube(name+' stair front landing',(sx,-1.8 if main else -1.85,z),(stairw,1.8 if main else 1.7,.2),'trim',True)
        # Slab openings stay clear above both flights, including the roof.
        if floor<floors-1:
            # chiếu nghỉ giữa tầng: kéo tới sát mặt trong tường sau (y 5.65), không còn khe 35 cm phía sau
            # bậc sâu 0.34 m (12 bậc → đợt thang dài 4.08 m, y -1 → 3.08) → chiếu nghỉ rộng 2.57 m (y 3.08 → 5.65, sát tường sau)
            TD=.34;LY=-1+12*TD
            cube(name+' half landing',(sx,(LY+5.65)/2,z+1.8),(stairw,5.65-LY,.2),'trim',True)
            # 2 đợt thang: từ giếng thang giữa (|x-sx| .5) tới sát mặt vách ngăn 2 bên (|x-sx| stairw/2-.08) — không hở cạnh tường
            inner=stairw/2-.08;fw=inner-.5;fc=(inner+.5)/2
            for j in range(12):
                y=-1+(j+.5)*TD
                cube(name+' stair up',(sx-fc,y,z+(j+1)*.15),(fw,TD+.015,.18),'stone',True)
                cube(name+' stair return',(sx+fc,y,z+3.6-j*.15),(fw,TD+.015,.18),'stone',True)
            # Separate parallel rails on each flight; posts end at the actual treads.
            for dx,ascending in [(-.48,True),(.48,False)]:
                low=z+1.05 if ascending else z+4.65
                beam(name+' red stone stair handrail',(sx+dx,-1,low),(sx+dx,LY,z+2.85),.065,'brick')
                for j in range(12):
                    yy=-1+(j+.5)*TD
                    tread=z+(j+1)*.15 if ascending else z+3.6-j*.15
                    top=low+(yy+1)*((1.8 if ascending else -1.8)/(LY+1))   # độ dốc tay vịn theo chiều dài đợt thang
                    beam(name+' vertical stair baluster',(sx+dx,yy,tread+.06),(sx+dx,yy,top),.028,'trim')
            # Close the two flight rails across the central gap, without projecting into the landing.
            beam(name+' central handrail connector',(sx-.48,LY,z+2.85),(sx+.48,LY,z+2.85),.065,'brick')
            beam(name+' central connector support',(sx,LY,z+1.9),(sx,LY,z+2.85),.028,'trim')
            # tay vịn chỉ là hình vẽ → thêm khung va chạm vô hình nghiêng theo dốc thang, chắn khe giữa 2 đợt thang (không lọt xuống)
            run=LY+1;slope=math.atan2(1.8,run);L=math.hypot(run,1.8)
            for dx,s in [(-.48,1),(.48,-1)]:
                low=z+1.05 if s>0 else z+4.65;high=z+2.85
                rc=cube(name+' Stair rail collider',(sx+dx,(LY-1)/2,(low+high)/2-.5),(.08,L,1.1),'trim',True);rc.rotation_euler.x=s*slope
            cube(name+' Stair rail collider landing',(sx,LY,z+2.35),(1.0,.08,1.1),'trim',True)   # mép chiếu nghỉ giữa 2 tay vịn
            # Chiếu tới mỗi tầng (y -1): tay vịn đợt vừa lên (x sx+.48) nối liền sang tay vịn đợt đi tiếp (x sx-.48) — không còn đứt quãng.
            if floor>0:
                beam(name+' floor landing handrail connector',(sx+.48,-1,z+1.05),(sx-.48,-1,z+1.05),.065,'brick')
                beam(name+' floor landing connector support',(sx,-1,z+.1),(sx,-1,z+1.05),.028,'trim')
                cube(name+' Stair rail collider floor',(sx,-1,z+.6),(1.0,.08,1.1),'trim',True)   # chiếu tầng: chắn khe giữa 2 đợt thang
            stair_routes.append({'building':name,'floor':floor,'roof':False,'path':[wp(cx,cy,angle,sx-1.65,-2.1,z+.98),wp(cx,cy,angle,sx-1.65,4.35,z+2.78),wp(cx,cy,angle,sx+1.65,4.35,z+2.78),wp(cx,cy,angle,sx+1.65,-2.1,z+4.58)]})
        # (Bỏ 'stair wall lining' riêng: 2 bên giếng thang đã có vách ngăn lớp học ở mọi tầng — x stair_left / stair_right, dãy chính
        #  cầu thang trái: 'segment end partition' x -24.8 & vách lớp x -17.2 — cùng độ dày, cùng mặt phẳng với các vách khác.)
        if floor==floors-1 and floor>0:
            # Tầng trên cùng: giếng thang phía đợt đi lên để trống → lan can chắn dọc mép y -1, từ đầu tay vịn (x sx+.48)
            # tới tường lớp học (x sx-3.5); song đứng mỗi ~0.3 m; khung va chạm cao 1.1 m (xoá khỏi mô hình hiển thị sau khi xuất).
            x0,x1=stair_left+.08,sx+.48   # chạm đúng mặt vách ngăn lớp học
            beam(name+' top stair guard handrail',(x1,-1,z+1.05),(x0,-1,z+1.05),.065,'brick')
            beam(name+' top stair guard bottom rail',(x1,-1,z+.2),(x0,-1,z+.2),.03,'trim')
            n=int((x1-x0)/.3)
            for k in range(n+1):
                xx=x0+(x1-x0)*k/n;beam(name+' top stair guard baluster',(xx,-1,z+.2),(xx,-1,z+1.05),.028,'trim')
            cube(name+' Stair top guard rail collider',((x0+x1)/2,-1,z+.65),(x1-x0,.12,1.1),'trim',True)
        if main:
            for original in set(bpy.data.objects)-stair_before:
                clone=original.copy();clone.data=original.data;bpy.context.collection.objects.link(clone);clone.location.x-=42
                if original in solids:solids.append(clone)
            if floor<floors-1:
                source=stair_routes[-1]
                stair_routes.append({**source,'building':name+' · Cầu thang trái','path':[[p[0]-42,p[1],p[2]] for p in source['path']]})
        # tường sau / tường hồi cao liền từ sàn tầng này tới sàn tầng trên (z → z+3.6): giếng thang không có sàn che → trước đây hở 1 dải 20 cm giữa 2 tầng
        wallh,wallz=(1.05,z+.625) if floor==floors else (3.6,z+1.8)
        if glass and floor<floors:
            cur=-length/2
            for a,b in sorted((x-.85,x+.85) for x,w in layout):   # ô cửa sổ phía sau mỗi lớp: rộng 1.7 m, cao z+1.12 → z+2.78
                if a>cur:cube(name+' rear wall',((cur+a)/2,5.75,wallz),(a-cur,.2,wallh),'cream',True)
                cube(name+' rear wall sill',((a+b)/2,5.75,z+.56),(b-a,.2,1.12),'cream',True)
                cube(name+' rear wall head',((a+b)/2,5.75,z+3.19),(b-a,.2,.82),'cream',True)
                cur=b
            if cur<length/2:cube(name+' rear wall',((cur+length/2)/2,5.75,wallz),(length/2-cur,.2,wallh),'cream',True)
        else:cube(name+' rear wall',(0,5.75,wallz),(length,.2,wallh),'cream',True)
        for side in [-1,1]:cube(name+' end wall',(side*length/2,2.3,wallz),(.2,7.1,wallh),'cream',True)   # y -1.25 → 5.85: kín góc trước
        if floor:
            # Guard exposed corridor ends, while retaining the connections to the main wing.
            exposed=[-1] if name.startswith('B') else [1] if name.startswith('C') else [-1,1]
            for side in exposed:
                xx=side*length/2
                cube(name+' corridor end parapet',(xx,-3,z+.55),(.18,4.3,.9),'cream',True)
                cube(name+' corridor end coping',(xx,-3,z+1.04),(.28,4.45,.1),'brick')
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
            lounge=name.startswith('B') and floor in (0,floors-1) and j>=2   # B103 + B104 → phòng giáo viên; B303 + B304 → phòng tin học
            if not(lounge and j==3):cube(name+' partition',(left,2.275,z+1.8),(.16,6.95,3.6),'wall',True)   # y -1.2 → 5.75: kín khe ở góc sau
            cube(name+' door lintel',(door,-1.15,z+3.1),(dw,.2,.8),'wall',True)          # z+2.7 → 3.5 (sát trần)
            a=left+.08;b=door-dw/2
            if b>a:cube(name+' door side',((a+b)/2,-1.15,z+1.8),(b-a,.2,3.4),'wall',True)   # z+.1 → 3.5
            a=door+dw/2;b=x+w/2;wx=(a+b)/2
            cube(name+' sill',((a+b)/2,-1.15,z+.57),(b-a,.2,.94),'wall',True)           # z+.1 → 1.04: kín khe dưới cửa sổ
            cube(name+' window head',((a+b)/2,-1.15,z+3.16),(b-a,.2,.68),'wall',True)   # z+2.82 → 3.5 (sát trần)
            for dx in [-dw/2,dw/2]:cube(name+' timber jamb',(door+dx,-1.25,z+1.4),(.065,.12,2.6),'wood')
            cube(name+' open timber door',(door-dw/2+.02,-.56,z+1.36),(.075,1.13,2.5),'wood')
            for aa,bb in [(a,wx-.9),(wx+.9,b)]:
                if bb>aa:cube(name+' window side pier',((aa+bb)/2,-1.15,z+1.94),(bb-aa,.2,1.8),'wall',True)
            cube(name+' window glass',(wx,-1.18,z+1.94),(1.8,.035,1.8),winmat,True)
            for dx in [-.6,0,.6]:cube(name+' window grille',(wx+dx,-1.29,z+1.94),(.035,.035,1.8),'wood')
            for zz in [1.03,1.94,2.86]:cube(name+' window crossbar',(wx,-1.3,z+zz),(1.8,.05,.055),'wood')
            # Exterior rear windows and end-wall windows make the complete wings readable.
            if glass:cube(name+' rear window',(x,5.75,z+1.95),(1.7,.04,1.66),'glass',True)   # kính lắp trong ô tường
            else:cube(name+' rear window',(x,5.88,z+1.95),(1.65,.045,1.65),'window')
            for dx in [-.86,.86]:cube(name+' rear timber frame',(x+dx,5.92,z+1.95),(.06,.05,1.8),'wood')
            for zz in [1.08,2.82]:cube(name+' rear frame rail',(x,5.92,z+zz),(1.78,.05,.06),'wood')
            rid=f'{name[0]}{floor+1}{j+1:02}'
            if lounge:
                gv=floor==0
                text(name+' room plate','PHÒNG GIÁO VIÊN' if gv else 'PHÒNG TIN HỌC',(door,-1.31,z+2.8),.11,'blue')
                rooms.append({'id':('GV-' if gv else 'TH-')+rid,'building':name,'floor':floor+1,'door':wp(cx,cy,angle,door,-2,z+.98),'inside':wp(cx,cy,angle,door,-.15,z+.98)})   # không có 'aisle' → không đặt bàn ghế lớp học
                continue
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
        if name.startswith('B') and floor==0:
            (x2,w2),(x3,w3)=layout[2],layout[3]
            teacher_lounge(name,cx,cy,angle,z,x2-w2/2,x3+w3/2)
            # trống trong gầm cầu thang: dưới đợt thang đi xuống (x sx+fc), phía đầu cao của đợt thang (gầm cao ~3 m);
            # xoay -90°: mặt trống quay ra hành lang / sân trường, ngẩng lên như ảnh mẫu
            school_drum(name,sx+(stairw/2-.08+.5)/2,.45,z,-math.pi/2)
        if name.startswith('B') and floor==floors-1:
            (x2,w2),(x3,w3)=layout[2],layout[3]
            computer_lab(name,cx,cy,angle,z,x2-w2/2,x3+w3/2)
        for xx in [stair_left,stair_right]:cube(name+' stair room partition',(xx,2.275,z+1.8),(.16,6.95,3.6),'wall',True)
        # 6. mép lớp cuối mỗi đoạn không giáp vách cầu thang / tường hồi (VD dãy chính, cạnh cầu thang trái x -24.8) → thêm vách
        for lo,hi in segments:
            if all(abs(hi-xx)>.05 for xx in [stair_left,stair_right,length/2]):cube(name+' segment end partition',(hi,2.275,z+1.8),(.16,6.95,3.6),'wall',True)
        for side in [-1,1]:
            for yy in [0,3.7]:cube(name+' end facade window',(side*(length/2+.12),yy,z+1.9),(.045,1.5,1.65),'window')
        column_positions=sorted({round(xx,6) for x,w in layout for xx in [x-w/2,x,x+w/2]})
        # Dãy A, tầng 2 & 3: đoạn mép hành lang không có ban công (|x| 29.5 → đầu hồi 34) là lối sang hành lang dãy cánh →
        # bỏ cột giữa đoạn này (|x| 31.7, đứng chắn lối đi) và thay 2 vòm nhỏ bằng 1 vòm liền. Tầng 1 giữ nguyên.
        open_bay=lambda xx:main and floor>0 and 29.5<abs(xx)<length/2-.05
        for xx in column_positions:
            if open_bay(xx):continue
            cube(name+' column',(xx,-5.04,z+1.82),(.22,.28,3.42),'cream',True)
            cube(name+' capital',(xx,-5.04,z+3.1),(.38,.42,.16),'trim')
        for x,w in layout:
            if open_bay(x):arch(name+' arcade',x,-5.04,z+2.72,w-.22,.48,.28,'trim');continue
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

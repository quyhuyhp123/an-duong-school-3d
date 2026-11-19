import RAPIER from '@dimforge/rapier3d-compat';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createController,moveCharacter,CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS} from '../src/character-controller.js';
await RAPIER.init();
const data=JSON.parse(readFileSync('public/models/campus-data.json','utf8'));
const world=new RAPIER.World({x:0,y:-16,z:0});world.timestep=1/60;
for(const c of data.colliders){const [x,y,z]=c.position,[qx,qy,qz,qw]=c.quaternion;world.createCollider(RAPIER.ColliderDesc.cuboid(...c.halfExtents).setTranslation(x,y,z).setRotation({x:qx,y:qy,z:qz,w:qw}));}
const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(8,1,17));
const collider=world.createCollider(RAPIER.ColliderDesc.capsule(CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS),body);
const controller=createController(world);let state={vertical:0,jumpHeld:false};const results=[];
function step(dir={x:0,z:0},jump=false){moveCharacter({body,collider,controller,state,direction:dir,speed:3.5,jump,dt:1/60});world.step();}
function set(p){body.setTranslation({x:p[0],y:p[1],z:p[2]},true);body.setNextKinematicTranslation({x:p[0],y:p[1],z:p[2]});state={vertical:0,jumpHeld:false};world.step();for(let i=0;i<30;i++)step();}
function go(target,name){
  for(let i=0;i<1200;i++){
    const p=body.translation(),dx=target[0]-p.x,dz=target[2]-p.z,d=Math.hypot(dx,dz);
    if(d<.09){for(let j=0;j<6;j++)step();return;}
    step({x:dx/d,z:dz/d});
    if(i===1199)throw Error(`${name}: blocked at ${JSON.stringify(p)}, goal ${target}`);
  }
}
function test(name,fn){try{fn();results.push({name,passed:true});console.log('PASS',name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL',name,e.message)}}
test('Main staircase sits under the right motto bay with a wider corridor',()=>{
  const route=data.stairs.find(s=>s.building.startsWith('A')&&s.floor===0);
  assert(Math.abs((route.path[0][0]+route.path[2][0])/2-21)<.01,'Main stairwell must be at x=21, away from the corner');
  const slabs=data.colliders.filter(c=>c.name.startsWith('A - ')&&c.name.includes('curved stair floor segment')&&c.position[0]>0&&Math.abs(c.position[1])<.01);
  assert(slabs.length>0,'Curved stair-bay floor supports must exist');
  assert(Math.min(...slabs.map(c=>c.halfExtents[2]*2))>=3.4,'The entire stair-bay corridor must be at least 3.4m deep');
});
test('Left wing is shortened and its staircase is centered',()=>{
  const route=data.stairs.find(s=>s.building.startsWith('B')&&s.floor===0);
  assert(Math.abs((route.path[0][2]+route.path[2][2])/2+19)<.1,'Left stairwell must be near the middle of the remaining wing');
  assert(data.rooms.filter(r=>r.building.startsWith('B')).length===12,'Only the retained left-wing classrooms should remain');
});
test('Gate house stairs are centered with two rooms on each side on both floors',()=>{
  const routes=data.stairs.filter(s=>s.building.startsWith('D'));
  assert(routes.length===1,'Two floors must be connected by one staircase');
  assert(Math.abs((routes[0].path[0][0]+routes[0].path[2][0])/2+23)<.01,'Stairs must be centered at x=-23');
  for(const floor of [1,2]){
    const rooms=data.rooms.filter(r=>r.building.startsWith('D')&&r.floor===floor);
    assert.equal(rooms.length,4);
    assert.equal(rooms.filter(r=>r.inside[0]<-26.5).length,2);
    assert.equal(rooms.filter(r=>r.inside[0]>-19.5).length,2);
  }
});
test('All classroom doors are enterable and can be exited',()=>{
  for(const r of data.rooms){set(r.door);go(r.inside,r.id+' enter');assert(Math.abs(body.translation().y-r.inside[1])<.35,r.id+' wrong floor');if(!/^(GV|TH)-/.test(r.id)){assert(r.aisle,'Classroom must have a clear route to the board');go(r.aisle,r.id+' classroom aisle');}   // GV-: phòng giáo viên, TH-: phòng tin học (không có bảng lớp)
 go(r.door,r.id+' exit');}
});
for(const place of data.places.filter(p=>data.stairs.some(s=>s.building===p.id))){
  test(place.label+' stairs to every occupied floor, then back down',()=>{
    const routes=data.stairs.filter(s=>s.building===place.id);set(place.position);go(routes[0].path[0],place.id+' enter stairwell');
    for(const s of routes){for(const p of s.path)go(p,place.id+' climb '+s.floor);assert(Math.abs(body.translation().y-s.path.at(-1)[1])<.35,`roof/floor elevation ${body.translation().y}`);}
    for(const s of [...routes].reverse()){for(const p of [...s.path].reverse())go(p,place.id+' descend '+s.floor);}
    assert(body.translation().y<(place.id.startsWith('D')?1.9:1.3),'Must return to ground level');
  });
}
// tay vịn cầu thang có khung va chạm: đứng giữa đợt thang bước ngang vào khe giữa 2 đợt thang → bị chặn, không lọt xuống
test('Every computer lab seat can be reached on foot',()=>{
  // dãy B: hệ toạ độ cục bộ (x dọc dãy, y sâu vào phòng) → three.js [-36-y, ., -(19+x)]
  for(const [room,prefix] of [['TH-B303','lab-']]){
    const r=data.rooms.find(r=>r.id===room);assert(r,room+' missing');
    const seats=data.seats.filter(s=>s.id.startsWith(prefix));assert(seats.length===12,prefix+' must have 12 seats');
    for(const s of seats){
      set(r.door);go(r.inside,room+' enter');
      const aisle=[s.exit[0],s.exit[1],-(19+5.3)];   // lối dọc bên trái cửa thứ nhất, cùng hàng với chỗ đứng của ghế
      go(aisle,s.id+' side aisle');go(s.exit,s.id+' seat exit');go(aisle,s.id+' back to aisle');go(r.inside,s.id+' leave');
    }
  }
});
test('School drum stands under the stairs and blocks walking',()=>{
  set([-36+2.5,.98,-(19+1.96)]);go([-36+1.1,.98,-(19+1.96)],'walk up to the drum');
  let blocked=false;try{go([-36-.45,.98,-(19+1.96)],'through drum');}catch{blocked=true;}
  assert(blocked,'Drum must have a collider');
});
test('Stair handrails cannot be walked through',()=>{
  for(const r of data.stairs){
    const [a,b,c]=r.path,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],side=[c[0]-b[0],0,c[2]-b[2]],L=Math.hypot(side[0],side[2]);
    const gap=[mid[0]+side[0]/L*1.65,mid[1],mid[2]+side[2]/L*1.65];   // tâm khe giữa 2 đợt thang
    set(mid);const y0=body.translation().y;let blocked=false;try{go(gap,r.building+' '+r.floor+' into stair gap')}catch{blocked=true}
    assert(blocked,r.building+' tầng '+r.floor+': tay vịn phải chặn');assert(body.translation().y>y0-.5,r.building+' tầng '+r.floor+': không được rơi xuống khe');
  }
});
// tầng trên cùng: giếng thang phía đợt đi lên có lan can chắn → đi từ đầu cầu thang về phía giếng thang không bị rơi
test('Top-floor stairwells are guarded by a railing',()=>{
  const buildings=[...new Set(data.stairs.map(s=>s.building))];
  for(const b of buildings){
    // path[0] = chân đợt đi lên (cục bộ x sx-1.65, y -2.1), path[1] = đầu đợt (y 4.35) → điểm y -0.5 nằm trong giếng thang, sau lan can
    const routes=data.stairs.filter(s=>s.building===b),last=routes.at(-1),top=last.path.at(-1),a=last.path[0],o=last.path[1],t=1.6/6.45;
    const landing=[a[0],top[1],a[2]],inside=[a[0]+(o[0]-a[0])*t,top[1],a[2]+(o[2]-a[2])*t];
    set(top);go(landing,b+' along top landing');let blocked=false;try{go(inside,b+' walk into stairwell')}catch{blocked=true}
    assert(blocked,b+': lan can phải chặn lối vào giếng thang');assert(Math.abs(body.translation().y-top[1])<.4,b+': không được rơi xuống giếng thang');
  }
});
test('Both corner corridors connect at all three floors',()=>{
  for(const side of [-1,1])for(let floor=0;floor<3;floor++){
    const h=.98+floor*3.6;
    set([side*32,h,-30]);go([side*32,h,-36.5],'corner approach');go([side*28,h,-36.5],'corner connection');
    assert(Math.abs(body.translation().y-h)<.35,'Corner floor must remain continuous');
  }
});
// nhà đa năng mở rộng tới tường bao: nhà z 21 → 46.1, cửa tây ở z 33.55, sân khấu trong nhà ở đầu nam (z 39.7 → 45.1)
test('Multipurpose hall doorway and interior',()=>{set([51.5,1,33.55]);go([59,.98,33.55],'hall enter');go([64,.98,33.55],'hall interior');go([57.7,.98,36.4],'stage side approach');go([57.7,2.18,41.9],'hall stage');assert(body.translation().y>1.5,'Stage supports player');go([57.7,.98,36.4],'stage exit');go([64,.98,33.55],'hall aisle');go([49.5,.98,33.55],'hall exit')});
// khán đài đầu bắc: lên cầu thang tây (z 29 → 24.7) tới sàn cao 2.8 m; cửa sau dưới khán đài mở ra phía bắc
test('Hall gallery stairs and rear door',()=>{set([58,1,30]);go([55.35,.98,29.6],'west stair foot');go([55.35,3.7,24.9],'climb west stair');go([55.35,3.7,22.85],'onto gallery');go([60,3.7,22.85],'gallery walk (giữa hai hàng ghế)');assert(body.translation().y>3.2,'Gallery supports player');go([55.35,3.7,22.85],'back to stair head');go([55.35,3.7,24.9],'gallery to stair');go([55.35,.98,29.6],'descend');go([64.5,.98,22],'under gallery');go([64.5,.98,18.5],'out rear door');go([64.5,.98,22],'back in')});
// lối lên đường dốc tầng 2 nhà xe không bị nhà đa năng che: từ phía nam đi thẳng lên dốc
test('Parking ramp foot clear of hall',()=>{set([52.1,1,26]);go([52.1,.98,21],'approach ramp foot');go([52.1,3.6,-2],'climb ramp');assert(body.translation().y>3,'Reached upper deck')});
test('Guard room by the main gate is enterable',()=>{set([3.6,1,46.75]);go([5.6,.98,46.75],'to guard room door');go([7.6,1.14,46.75],'inside guard room');go([8.3,1.14,45.6],'by the desk')});
// khu đường trước cổng được khép tường: ra cổng chính đi trên đường được, nhưng không ra quá vỉa hè bên kia / 2 đầu đường
test('Front street is walled in',()=>{set([0,1,44]);go([0,.98,50],'out main gate');go([20,.98,53],'walk along street');go([25,.98,57.5],'onto far sidewalk');
 let blocked=false;try{go([25,.98,62],'past outer wall')}catch{blocked=true};assert(blocked&&body.translation().z<58.3,'Outer wall blocks the far side');
 set([-34,1,53]);blocked=false;try{go([-40,.98,53],'past west street end')}catch{blocked=true};assert(blocked&&body.translation().x>-36.3,'West street end is walled');
 set([73,1,53]);blocked=false;try{go([79,.98,53],'past east street end')}catch{blocked=true};assert(blocked&&body.translation().x<75.2,'East street end is walled')});
test('No stair routes lead onto roofs',()=>{assert(data.stairs.every(s=>!s.roof));assert(!data.colliders.some(c=>c.name.startsWith('Hall roof stair')))});
test('Parking second level is accessible',()=>{set([52.1,1,20.4]);go([52.1,4.28,-4.1],'parking stair');go([48.5,4.28,-11.45],'parking upper deck');assert(body.translation().y>4,'Upper parking floor');});
test('E-bike route: shed bays → connector → east lane → secondary gate and back',()=>{
  // giữa hai hàng ô trong nhà xe → ra lối nối phía đông (không lan can) → xuống đường nội bộ → bãi xe cổng phụ, rồi quay lại
  set([36,1.1,14.7]);go([42,.98,14.7],'shed aisle to connector');go([42.5,.98,30],'connector to east lane');go([46,.98,30],'around roadside planters');go([49,.98,42],'lane to secondary gate');
  go([46,.98,30],'back around roadside planters');go([42.5,.98,30],'back up the lane');go([42,.98,14.7],'into connector');go([36,1.1,14.7],'back to shed aisle');
});
// nhà vệ sinh sau dãy A (phải): cửa NAM x 42.85 → 43.94, cửa NỮ x 44.06 → 45.15, mặt trước z -42.5
test('Washroom: men and women doors lead inside',()=>{
  set([43.3,1,-40]);go([43.3,1.2,-44.6],'enter men');go([43.3,1.2,-40],'leave men');
  go([44.6,1.2,-40],'to women door');go([44.6,1.2,-44.6],'enter women');go([44.6,1.2,-40],'leave women');
});
// dải mở rộng phía tây (x -53 → -42): từ sân qua chỗ sau nhà nước → lối đi dọc dãy B → nhà kho, nhà vệ sinh, vườn STEAM
test('West annex: store, washroom and STEAM greenhouse are reachable',()=>{
  set([-31,1,-2]);go([-44,.98,-2],'into west annex');
  go([-48.8,.98,-2.6],'store front');go([-48.8,1.1,-10],'inside store');go([-48.8,.98,-2.6],'leave store');
  go([-43.4,.98,-2.6],'annex walkway');go([-43.4,.98,-28.4],'walk north');go([-48.5,1.2,-28.4],'enter men washroom');go([-43.4,.98,-28.4],'leave washroom');
  go([-43.2,.98,-42.6],'to greenhouse');go([-48.5,1.0,-42.6],'inside STEAM greenhouse');go([-43.2,.98,-42.6],'leave greenhouse');
});
test('Secondary gate approach is passable',()=>{set([49,1,51]);go([49,1,44],'secondary gate')});
test('Water house doorway and volleyball court are reachable',()=>{
  // cửa nhà nước quay ra sân (phía +x), tâm z = 2.2 — đi thẳng qua cửa vào trong rồi ra lại
  set([-27.5,1,2.2]);go([-33,.98,2.2],'enter water house');go([-27.5,.98,2.2],'exit water house');
  set([8,1,28]);go([20,.98,28],'volleyball court');
});
test('The garden and flower pergola remain walkable',()=>{
  set([0,1,42]);go([0,.98,34],'from gate');go([-18,.98,32],'garden entry');go([-18,.98,20],'garden path');
  set([20,1,20]);go([20,.98,11],'flower pergola and swings');
});
test('Stone and iron benches cannot be walked through, seats stay usable',()=>{
  const benches=data.seats.filter(s=>/^(bench|iron)-/.test(s.id));assert(benches.length>=18,'benches missing');
  for(const s of benches){
    const [ex,,ez]=s.exit,[sx,,sz]=s.position,dx=sx-ex,dz=sz-ez,L=Math.hypot(dx,dz);
    set(s.exit);const start=body.translation();
    assert(Math.hypot(start.x-ex,start.z-ez)<.3,s.id+' exit point is blocked');   // chỗ đứng dậy còn trống
    let passed=false;try{go([sx+dx/L*1.2,.98,sz+dz/L*1.2],s.id+' through');passed=true;}catch{}
    assert(!passed,s.id+' can be walked through');
  }
});
test('Garden lawn, paths and flower beds hold the feet up (no sinking)',()=>{
  // mặt sân: tâm thân y≈.91; cỏ cao .22 m → y≈1.1; cỏ bồn tròn .455 m → y≈1.35
  set([0,1,42]);go([0,.98,34],'from gate');go([-18,.98,32.6],'garden entry');go([-27,.98,32.6],'garden south strip');go([-27,.98,27.5],'over the flower bed border');go([-27,.98,20.6],'garden lawn');
  assert(body.translation().y>1.08,'feet sink into the lawn: y='+body.translation().y.toFixed(2));
  go([-18,.98,24.5],'onto the round bed edging');go([-18,.98,20.6],'round bed planting');
  assert(body.translation().y>1.3,'feet sink into the round bed: y='+body.translation().y.toFixed(2));
  go([-18,.98,12],'garden cross path');go([-18,.98,6],'leave the garden');
});
test('Jump works from an upper corridor',()=>{const r=data.rooms.find(r=>r.floor===2);set(r.door);const initial=body.translation().y;step({x:0,z:0},true);for(let i=0;i<10;i++)step();assert(body.translation().y>initial+.3,'Upper-floor jump');for(let i=0;i<120;i++)step();assert(Math.abs(body.translation().y-initial)<.1,'Land on the same floor');});
test('Tree planters support the feet instead of hiding the lower legs',()=>{
 const supports=data.colliders.filter(c=>c.name.startsWith('Planter support collider'));
 assert(supports.length>0,'planter supports exported');
 for(const c of supports.filter((_,i)=>i%3===0)){
  const [x,y,z]=c.position,top=y+c.halfExtents[1];set([x,top+1.1,z]);
  assert(body.translation().y-CHARACTER_HALF_HEIGHT-CHARACTER_RADIUS>=top-.025,`feet below planter at ${x},${z}`);
 }
});
test('Parking upper side strip is filled and widened ramp has useful clearance',()=>{
 for(const z of [-30,-20,-12]){set([52,4.4,z]);assert(body.translation().y>4,'upper parking strip has no hole');}
 const ramp=data.colliders.find(c=>c.name==='Parking continuous yellow ramp');assert(ramp.halfExtents[0]>=1.399,'ramp widened to 2.8m');
});
writeFileSync('preview/traversal-results.json',JSON.stringify({rooms:data.rooms.length,colliders:data.colliders.length,results},null,2));
world.free();if(results.some(r=>!r.passed))process.exitCode=1;

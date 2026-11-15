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
  const slab=data.colliders.find(c=>c.name.startsWith('A - Dãy chính stair corridor'));
  assert(slab.halfExtents[2]*2>=3.4,'The stair-bay corridor must be widened to at least 3.4m');
});
test('Left wing is shortened and its staircase is centered',()=>{
  const route=data.stairs.find(s=>s.building.startsWith('B')&&s.floor===0);
  assert(Math.abs((route.path[0][2]+route.path[2][2])/2+19)<.1,'Left stairwell must be near the middle of the remaining wing');
  assert(data.rooms.filter(r=>r.building.startsWith('B')).length===12,'Only the retained left-wing classrooms should remain');
});
test('All classroom doors are enterable and can be exited',()=>{
  for(const r of data.rooms){set(r.door);go(r.inside,r.id+' enter');assert(Math.abs(body.translation().y-r.inside[1])<.35,r.id+' wrong floor');assert(r.aisle,'Classroom must have a clear route to the board');go(r.aisle,r.id+' classroom aisle');go(r.door,r.id+' exit');}
});
for(const place of data.places.filter(p=>data.stairs.some(s=>s.building===p.id))){
  test(place.label+' stairs to every occupied floor, then back down',()=>{
    const routes=data.stairs.filter(s=>s.building===place.id);set(place.position);go(routes[0].path[0],place.id+' enter stairwell');
    for(const s of routes){for(const p of s.path)go(p,place.id+' climb '+s.floor);assert(Math.abs(body.translation().y-s.path.at(-1)[1])<.35,`roof/floor elevation ${body.translation().y}`);}
    for(const s of [...routes].reverse()){for(const p of [...s.path].reverse())go(p,place.id+' descend '+s.floor);}
    assert(body.translation().y<(place.id.startsWith('D')?1.9:1.3),'Must return to ground level');
  });
}
test('Both corner corridors connect at all three floors',()=>{
  for(const side of [-1,1])for(let floor=0;floor<3;floor++){
    const h=.98+floor*3.6;
    set([side*32,h,-30]);go([side*32,h,-36.5],'corner approach');go([side*28,h,-36.5],'corner connection');
    assert(Math.abs(body.translation().y-h)<.35,'Corner floor must remain continuous');
  }
});
test('Multipurpose hall doorway and interior',()=>{set([52,1,29]);go([58,.98,29],'hall enter');go([64,.98,29],'hall interior');go([57.7,.98,30],'stage side approach');go([57.7,2.18,37],'hall stage');assert(body.translation().y>1.5,'Stage supports player');go([57.7,.98,30],'stage exit');go([64,.98,29],'hall aisle');go([52,.98,29],'hall exit')});
test('No stair routes lead onto roofs',()=>{assert(data.stairs.every(s=>!s.roof));assert(!data.colliders.some(c=>c.name.startsWith('Hall roof stair')))});
test('Parking second level is accessible',()=>{set([52.1,1,20.4]);go([52.1,4.28,-4.1],'parking stair');go([48.5,4.28,-11.45],'parking upper deck');assert(body.translation().y>4,'Upper parking floor');});
test('Secondary gate approach is passable',()=>{set([49,1,51]);go([49,1,44],'secondary gate')});
test('Water house doorway and volleyball court are reachable',()=>{
  set([-28,1,4]);go([-34,.98,4],'enter water house');go([-28,.98,4],'exit water house');
  set([8,1,28]);go([20,.98,28],'volleyball court');
});
test('The garden and flower pergola remain walkable',()=>{
  set([0,1,42]);go([0,.98,34],'from gate');go([-18,.98,32],'garden entry');go([-18,.98,20],'garden path');
  set([20,1,20]);go([20,.98,11],'flower pergola and swings');
});
test('Jump works from an upper corridor',()=>{const r=data.rooms.find(r=>r.floor===2);set(r.door);const initial=body.translation().y;step({x:0,z:0},true);for(let i=0;i<10;i++)step();assert(body.translation().y>initial+.3,'Upper-floor jump');for(let i=0;i<120;i++)step();assert(Math.abs(body.translation().y-initial)<.1,'Land on the same floor');});
writeFileSync('preview/traversal-results.json',JSON.stringify({rooms:data.rooms.length,colliders:data.colliders.length,results},null,2));
world.free();if(results.some(r=>!r.passed))process.exitCode=1;

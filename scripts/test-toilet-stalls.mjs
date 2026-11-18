import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import RAPIER from '@dimforge/rapier3d-compat';
import{createController,moveCharacter,CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS}from'../src/character-controller.js';
await RAPIER.init();const data=JSON.parse(readFileSync('public/models/campus-data.json','utf8')),seats=data.seats.filter(s=>s.kind==='toilet');
assert.equal(seats.length,12,'all original toilet stalls remain available');assert.equal(new Set(seats.map(s=>s.id)).size,12);
const world=new RAPIER.World({x:0,y:-16,z:0});world.timestep=1/60;
for(const c of data.colliders){const[x,y,z]=c.position,[qx,qy,qz,qw]=c.quaternion;world.createCollider(RAPIER.ColliderDesc.cuboid(...c.halfExtents).setTranslation(x,y,z).setRotation({x:qx,y:qy,z:qz,w:qw}));}
const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()),capsule=world.createCollider(RAPIER.ColliderDesc.capsule(CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS),body),controller=createController(world);let state;
function step(direction={x:0,z:0}){moveCharacter({body,collider:capsule,controller,state,direction,speed:3.5,jump:false,dt:world.timestep});world.step();}
for(const s of seats){
 const pos={x:s.exit[0],y:s.exit[1],z:s.exit[2]};body.setTranslation(pos,true);body.setNextKinematicTranslation(pos);state={vertical:0,jumpHeld:false};world.step();for(let i=0;i<20;i++)step();
 const goal={x:s.position[0]+Math.sin(s.yaw)*1.15,z:s.position[2]+Math.cos(s.yaw)*1.15};
 for(let i=0;i<240;i++){const p=body.translation(),dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);if(d<.09)break;step({x:dx/d,z:dz/d});}
 const at=body.translation();assert(Math.hypot(at.x-goal.x,at.z-goal.z)<.1,`stall doorway must be enterable: ${s.id}`);
 assert(Math.hypot(at.x-s.position[0],at.z-s.position[2])<2&&Math.abs(at.y-s.position[1])<1,'F interaction must be reachable from the floor');
 const anchor={x:s.position[0],y:s.position[1],z:s.position[2]};body.setTranslation(anchor,true);body.setNextKinematicTranslation(anchor);world.step();assert(Math.abs(body.translation().y-.39-.69)<.001,'seated hip matches toilet seat top');
 body.setTranslation(pos,true);body.setNextKinematicTranslation(pos);world.step();for(let i=0;i<20;i++)step();assert(Math.abs(body.translation().y-1.045)<.05,'standing exit must be on the washroom floor');
}
world.free();console.log('PASS all 12 enlarged stalls: door entry, F proximity, seat alignment, rotated west block, safe stand-up exits');

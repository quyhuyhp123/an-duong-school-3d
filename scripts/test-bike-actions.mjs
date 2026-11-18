import assert from 'node:assert/strict';
import {rearSeat} from '../src/bikePassenger.js';
import {bikeActions} from '../server/bikeActions.js';
const d={id:1,position:[0,1,0],yaw:0,mode:56},p={id:2,position:[1,1,0],mode:0},q={id:3,position:[1,1,0],mode:0};
const messages=[],players=new Map([[1,d],[2,p],[3,q]]);
const controls=bikeActions({players,send:(p,m)=>messages.push([p?.id,m]),setPos:(p,x,y,z,yaw,mode)=>Object.assign(p,{position:[x,y,z],yaw,mode})});
try{
 controls.handle(p,{type:'bike-join',driver:1});assert(!p.bikeDriver);
 controls.handle(q,{type:'bike-answer',passenger:2,accept:true});assert(!p.bikeDriver);
 controls.handle(d,{type:'bike-answer',passenger:2,accept:true});assert.equal(p.bikeDriver,1);
 await new Promise(r=>setTimeout(r,100));assert.equal(p.position[2],-.65);
 assert(messages.some(([,m])=>m.type==='bike-link'&&m.passenger===2&&m.driver===1));
 controls.sync(q);assert.deepEqual(messages.at(-1)[1].links,[[2,1]]);
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2-.01]){
  d.yaw=yaw;d.position=[12,2,8];await new Promise(r=>setTimeout(r,90));
  const seat=rearSeat({x:12,y:2,z:8,yaw});
  assert(Math.abs(p.position[0]-seat.x)<1e-8&&Math.abs(p.position[2]-seat.z)<1e-8);
  assert.equal(p.yaw,yaw,'passenger must face the same direction as driver');
 }
 // The rear passenger follows the whole airborne arc and stays attached after landing.
 for(const height of [1,1.45,1.8,2,1.8,1.45,1]){
  d.position=[12,height,8];d.mode=56|64;await new Promise(r=>setTimeout(r,90));
  assert(Math.abs(p.position[1]-(height-.05))<1e-8,'passenger must rise and land with bike');
  assert.equal(p.bikeDriver,d.id,'jump must not detach passenger');
 }
 controls.handle(q,{type:'bike-join',driver:1});assert(!q.bikeDriver);
 d.mode=0;await new Promise(r=>setTimeout(r,100));assert.equal(p.bikeDriver,null);
 assert(messages.some(([,m])=>m.type==='bike-exit'));
 console.log('PASS consent, wrong sender rejection, rear-seat follow, capacity and rider stop cleanup');
}finally{controls.close()}

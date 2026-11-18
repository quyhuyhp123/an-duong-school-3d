import assert from 'node:assert/strict';
import {pushMotion,sampleMotion,angleDelta,BUFFER_MS} from '../src/networkMotion.js';
import {rearSeat} from '../src/bikePassenger.js';
// 10 Hz packets with uneven arrival times; 60 Hz rendering must keep a steady speed.
const r={},packets=Array.from({length:51},(_,i)=>({at:i*100,arrival:i*100+[0,35,5,45,15][i%5],x:i*.8}));
let next=0,previous=null,steps=[];
for(let frame=0;frame<300;frame++){
 const now=frame*1000/60;
 while(next<packets.length&&packets[next].arrival<=now){const p=packets[next++];pushMotion(r,p.x,1,0,0,p.at);}
 sampleMotion(r,now);
 if(now>500&&previous!=null)steps.push(r.x-previous);
 if(now>500)assert(Math.abs(r.x-(now-BUFFER_MS)*.008)<1e-8,'packet jitter must not change rendered speed');
 const seat=rearSeat(r);if(r.x!=null)assert(Math.abs(Math.hypot(seat.x-r.x,seat.z-r.z)-.65)<1e-8);
 previous=r.x;
}
assert(Math.max(...steps)-Math.min(...steps)<1e-8,'no stop/go movement between packets');
const turn={};pushMotion(turn,0,1,0,Math.PI*2-.1,0);pushMotion(turn,0,1,0,.1,100);sampleMotion(turn,BUFFER_MS+50);
assert(Math.abs(angleDelta(0,turn.yaw))<1e-8,'turn across zero must take the short path');
const stopped={};pushMotion(stopped,0,1,0,0,0);pushMotion(stopped,.8,1,0,0,100);sampleMotion(stopped,2000);assert.equal(stopped.x,.8);
pushMotion(stopped,1.6,1,0,0,2100);sampleMotion(stopped,2150);assert.equal(stopped.x,.8,'resume after delta suppression must not slide across the idle interval');
pushMotion(stopped,30,1,0,0,2200);assert.equal(stopped.x,30,'teleports must snap instead of sweeping through buildings');
assert(r.samples.length<=16,'bounded history');
console.log('PASS 10 Hz jittered packets rendered at 60 FPS: steady speed, fixed rear seat, shortest turns, stop/resume, teleport, bounded history');

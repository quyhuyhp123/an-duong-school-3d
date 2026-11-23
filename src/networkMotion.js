import {BIKE_SPIN_SPEED,rearWheelSpinOffset} from './bikeWheelie.js';
// Render a short history instead of repeatedly chasing the newest 10 Hz packet.
export const BUFFER_MS=150;
const TAU=Math.PI*2;
export const angleDelta=(a,b)=>((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;
export function pushMotion(r,x,y,z,yaw,at,spinning=false){
 const samples=r.samples??(r.samples=[]),last=samples.at(-1);
 if(last&&Math.hypot(x-last.x,y-last.y,z-last.z)>6)samples.length=0;
 // A stationary player is delta-suppressed: don't interpolate across seconds of silence.
 if(last&&!last.spinning&&at-last.at>250)samples.push({...last,at:at-100});
 samples.push({x,y,z,yaw,at,spinning});if(samples.length>16)samples.splice(0,samples.length-16);
 r.tx=x;r.ty=y;r.tz=z;r.tyaw=yaw;
 if(samples.length===1){r.x=x;r.y=y;r.z=z;r.yaw=yaw;}
}
export function sampleMotion(r,now){
 const a=r.samples;if(!a?.length)return;
 const at=now-BUFFER_MS;
 while(a.length>2&&a[1].at<=at)a.shift();
 const p=a[0],q=a[1]??p,t=q.at===p.at?0:Math.max(0,Math.min(1,(at-p.at)/(q.at-p.at)));
 let turn=angleDelta(p.yaw,q.yaw);
 if(p.spinning&&q.spinning){
  const expected=BIKE_SPIN_SPEED*(q.at-p.at)/1000;
  turn+=TAU*Math.round((expected-turn)/TAU);
 }
 r.x=p.x+(q.x-p.x)*t;r.y=p.y+(q.y-p.y)*t;r.z=p.z+(q.z-p.z)*t;r.yaw=p.yaw+turn*t;
 if(q.spinning&&at>q.at){
  // A spin stays active until a snapshot explicitly clears it.
  const yaw=q.yaw+BIKE_SPIN_SPEED*((at-q.at)/1000);
  const offset=rearWheelSpinOffset(yaw,q.yaw);
  r.x=q.x+offset.x;r.z=q.z+offset.z;r.yaw=yaw;
 }
}

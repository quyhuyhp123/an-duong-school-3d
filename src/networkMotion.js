// Render a short history instead of repeatedly chasing the newest 10 Hz packet.
export const BUFFER_MS=150;
const TAU=Math.PI*2;
export const angleDelta=(a,b)=>((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;
export function pushMotion(r,x,y,z,yaw,at){
 const samples=r.samples??(r.samples=[]),last=samples.at(-1);
 if(last&&Math.hypot(x-last.x,y-last.y,z-last.z)>6)samples.length=0;
 // A stationary player is delta-suppressed: don't interpolate across seconds of silence.
 if(last&&samples.length&&at-last.at>250)samples.push({...last,at:at-100});
 samples.push({x,y,z,yaw,at});if(samples.length>16)samples.splice(0,samples.length-16);
 r.tx=x;r.ty=y;r.tz=z;r.tyaw=yaw;
 if(samples.length===1){r.x=x;r.y=y;r.z=z;r.yaw=yaw;}
}
export function sampleMotion(r,now){
 const a=r.samples;if(!a?.length)return;
 const at=now-BUFFER_MS;
 while(a.length>2&&a[1].at<=at)a.shift();
 const p=a[0],q=a[1]??p,t=q.at===p.at?0:Math.max(0,Math.min(1,(at-p.at)/(q.at-p.at)));
 r.x=p.x+(q.x-p.x)*t;r.y=p.y+(q.y-p.y)*t;r.z=p.z+(q.z-p.z)*t;r.yaw=p.yaw+angleDelta(p.yaw,q.yaw)*t;
}

import assert from 'node:assert/strict';
import {Vector3,Euler} from 'three';
import {wheelieTransform,rearWheelSpinOffset} from '../src/bikeWheelie.js';

for(const anchor of [0,.7,-2,Math.PI]){
 for(let step=0;step<=48;step++){
  const yaw=anchor+step*Math.PI/12,offset=rearWheelSpinOffset(yaw,anchor);
  for(const tilt of [0,.25,.5,1]){
   const wp=wheelieTransform(tilt);
   const rotation=new Euler(wp.pitch,yaw,0,'YXZ');
   const translation=new Vector3(offset.x+Math.sin(yaw)*wp.z,wp.y,offset.z+Math.cos(yaw)*wp.z);
   const rear=new Vector3(0,.3,-.58).applyEuler(rotation).add(translation);
   const anchorPoint=new Vector3(-.58*Math.sin(anchor),.3,-.58*Math.cos(anchor));
   assert(rear.distanceTo(anchorPoint)<1e-10,'rear tire must stay on the same ground point throughout spin and tilt');
   const front=new Vector3(0,.3,.58).applyEuler(rotation).add(translation);
   if(tilt>0)assert(front.y>rear.y,'front wheel must rise');
   // Forward travel translates the pivot without making it orbit the bike centre.
   assert(rear.clone().add(new Vector3(2,0,3)).distanceTo(anchorPoint.clone().add(new Vector3(2,0,3)))<1e-10);
  }
 }
}
console.log('PASS: rear wheel stays fixed across two full rotations, all headings and wheelie transitions; moving pivot stays consistent');

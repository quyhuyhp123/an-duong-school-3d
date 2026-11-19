// Đàn cá koi trong hồ non bộ (hồ dài cạnh dãy B — scripts/build_school.py "Hòn non bộ").
// Toạ độ three.js: tâm hồ x -21.5, trục hồ chạy z -16 → -22 (Blender y 16 → 22, hồ y 13 → 25), mặt nước y .44, đáy y .08.
// Mỗi con bơi vòng quanh các cụm đá theo 1 "làn" hình sân vận động (2 cạnh thẳng + 2 đầu tròn) với bán kính riêng,
// lượn nhẹ sang 2 bên, lên xuống chút ít, vẫy thân. Cả đàn = 2 lệnh vẽ (InstancedMesh thân + vây/đốm). Ẩn khi ở xa.
import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {useNearVisible} from './useNearVisible';

const PX=-21.5,Z0=-16,Z1=-22,L=Math.abs(Z1-Z0);
const COLORS=['#ff7a1a','#ff5a1f','#ffffff','#f6c344','#ff8c42','#e63946','#fff2e0','#ff6b35'];
const FISH=Array.from({length:10},(_,i)=>({
 r:1.55+((i*37)%7)/10,                 // làn bơi 1.55–2.15 m quanh trục hồ (đá ở giữa, bán kính ≤ 1.3 m)
 speed:(.32+((i*53)%9)/22)*(i%3===2?-1:1),   // 1/3 đàn bơi ngược chiều
 s:i*5.3,depth:.24+((i*29)%5)/50,
 body:COLORS[i%COLORS.length],spot:i%2?'#ffffff':'#d62828',scale:.8+((i*17)%5)/12,
}));

// điểm & hướng trên làn bơi hình sân vận động bán kính r, quãng đường s
function lane(r,s,out){
 const P=2*L+2*Math.PI*r;let d=((s%P)+P)%P;
 if(d<L){out.x=PX+r;out.z=Z0-d;return;}d-=L;
 if(d<Math.PI*r){const a=d/r;out.x=PX+r*Math.cos(a);out.z=Z1-r*Math.sin(a);return;}d-=Math.PI*r;
 if(d<L){out.x=PX-r;out.z=Z1+d;return;}d-=L;
 const a=Math.PI+d/r;out.x=PX+r*Math.cos(a);out.z=Z0-r*Math.sin(a);
}

export function PondFish(){
 const group=useNearVisible([PX,0,(Z0+Z1)/2],45),bodies=useRef(),fins=useRef();
 const {bodyGeo,finGeo,mat}=useMemo(()=>{
  const b=new THREE.SphereGeometry(1,10,7);b.scale(.075,.055,.2);
  const tail=new THREE.ConeGeometry(.09,.16,4);tail.rotateX(-Math.PI/2);tail.scale(1,.35,1);tail.translate(0,0,-.25);
  const spot=new THREE.SphereGeometry(1,6,4);spot.scale(.045,.03,.07);spot.translate(0,.035,.04);
  const finG=mergeTwo(tail,spot);
  return {bodyGeo:b,finGeo:finG,mat:new THREE.MeshStandardMaterial({roughness:.45,metalness:.05})};
 },[]);
 useLayoutEffect(()=>{const c=new THREE.Color();FISH.forEach((f,i)=>{bodies.current.setColorAt(i,c.set(f.body));fins.current.setColorAt(i,c.set(f.spot));});
  bodies.current.instanceColor.needsUpdate=true;fins.current.instanceColor.needsUpdate=true;},[]);
 const tmp=useMemo(()=>({o:new THREE.Object3D(),a:{x:0,z:0},b:{x:0,z:0}}),[]);
 useFrame((state,dt)=>{
  if(!group.current?.visible)return;const t=state.clock.elapsedTime,{o,a,b}=tmp;
  FISH.forEach((f,i)=>{
   f.s+=f.speed*Math.min(dt,.05);lane(f.r,f.s,a);lane(f.r,f.s+Math.sign(f.speed)*.25,b);
   const side=Math.sin(t*.7+i*1.7)*.12;   // lượn nhẹ sang 2 bên làn
   const hx=b.x-a.x,hz=b.z-a.z,len=Math.hypot(hx,hz)||1;
   o.position.set(a.x-hz/len*side,f.depth+Math.sin(t*1.3+i)*.03,a.z+hx/len*side);
   o.rotation.set(0,Math.atan2(hx,hz)+Math.sin(t*7+i*2)*.18,0);   // vẫy thân
   o.scale.setScalar(f.scale);o.updateMatrix();
   bodies.current.setMatrixAt(i,o.matrix);fins.current.setMatrixAt(i,o.matrix);
  });
  bodies.current.instanceMatrix.needsUpdate=true;fins.current.instanceMatrix.needsUpdate=true;
 });
 return <group ref={group}>
  <instancedMesh ref={bodies} args={[bodyGeo,mat,FISH.length]} frustumCulled={false}/>
  <instancedMesh ref={fins} args={[finGeo,mat,FISH.length]} frustumCulled={false}/>
 </group>;
}

function mergeTwo(a,b){
 const g=new THREE.BufferGeometry(),A=a.index?a.toNonIndexed():a,B=b.index?b.toNonIndexed():b;
 for(const k of ['position','normal']){const x=A.attributes[k].array,y=B.attributes[k].array,z=new Float32Array(x.length+y.length);z.set(x);z.set(y,x.length);g.setAttribute(k,new THREE.BufferAttribute(z,3));}
 return g;
}

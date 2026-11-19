// Mây trên trời: ~28 đám mây low-poly đặt ngẫu nhiên (cố định theo hạt giống) cao 45–80 m quanh trường,
// trôi rất chậm (cả lớp mây xoay quanh tâm trường). Ban đêm chuyển xám xanh theo độ tối của DayCycle.
// Cả bầu trời mây = 1 lệnh vẽ (InstancedMesh). Không chịu sương mù (fog) để mây xa vẫn rõ khi ngẩng camera lên.
import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {nightFactor} from './DayCycle';

const CENTER=[10,0,0];
function seeded(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const PUFFS=(()=>{const r=seeded(20112018),out=[];
 for(let c=0;c<28;c++){
  const ang=r()*Math.PI*2,dist=40+r()*190,h=45+r()*35,size=4+r()*6,n=4+Math.floor(r()*5),stretch=1.4+r()*1.2;
  const cx=CENTER[0]+Math.cos(ang)*dist,cz=CENTER[2]+Math.sin(ang)*dist,rot=r()*Math.PI;
  for(let k=0;k<n;k++){const along=(k/(n-1||1)-.5)*size*stretch,across=(r()-.5)*size*.6,ps=size*(.55+r()*.5)*(1-Math.abs(k/(n-1||1)-.5)*.6);
   out.push({x:cx+Math.cos(rot)*along-Math.sin(rot)*across,y:h+(r()-.3)*size*.25,z:cz+Math.sin(rot)*along+Math.cos(rot)*across,sx:ps*1.25,sy:ps*.62,sz:ps});}
 }
 return out;})();

export function Clouds(){
 const mesh=useRef(),layer=useRef(),last=useRef(-1);
 const {geo,mat,day,night}=useMemo(()=>({
  geo:new THREE.IcosahedronGeometry(1,1),
  mat:new THREE.MeshLambertMaterial({color:'#ffffff',emissive:'#9fb4c8',emissiveIntensity:.35,flatShading:true,fog:false}),
  day:new THREE.Color('#ffffff'),night:new THREE.Color('#3b4660'),
 }),[]);
 useLayoutEffect(()=>{const o=new THREE.Object3D();PUFFS.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.scale.set(p.sx,p.sy,p.sz);o.rotation.set(0,i*.7,0);o.updateMatrix();mesh.current.setMatrixAt(i,o.matrix);});
  mesh.current.instanceMatrix.needsUpdate=true;mesh.current.computeBoundingSphere();},[]);
 useFrame((state,dt)=>{
  if(layer.current)layer.current.rotation.y+=Math.min(dt,.05)*.0035;   // trôi chậm
  if(state.clock.elapsedTime-last.current<1&&last.current>=0)return;last.current=state.clock.elapsedTime;
  const n=nightFactor();mat.color.copy(day).lerp(night,n);mat.emissiveIntensity=.35*(1-n)+.05;
 });
 return <group ref={layer} position={[CENTER[0],0,CENTER[2]]}><group position={[-CENTER[0],0,-CENTER[2]]}>
  <instancedMesh ref={mesh} args={[geo,mat,PUFFS.length]}/>
 </group></group>;
}

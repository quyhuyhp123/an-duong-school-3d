// Xe đạp điện: mô hình xe, vạch kẻ ô đỗ, xe đỗ sẵn trong nhà xe & bãi xe cổng phụ.
// Mỗi chiếc xe là MỘT khối (gộp các bộ phận, màu theo đỉnh) → xe đỗ vẽ bằng InstancedMesh: vài lệnh vẽ cho cả bãi.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {BAYS,BAY_SIZE,bayHasBike,onBaysChange} from './bikes';
import {BikeFlames} from './BikeFlames';

const UP=new THREE.Vector3(0,1,0);
function paint(geo,color){
 const c=new THREE.Color(color),n=geo.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;}
 geo.setAttribute('color',new THREE.BufferAttribute(a,3));for(const k of Object.keys(geo.attributes))if(!['position','normal','color'].includes(k))geo.deleteAttribute(k);
 return geo.index?geo:geo;
}
const at=(geo,x,y,z)=>(geo.translate(x,y,z),geo);
function tube(a,b,r,color){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),g=new THREE.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP,d.normalize()));const m=A.add(B).multiplyScalar(.5);return paint(at(g,m.x,m.y,m.z),color);}
// Xe đạp điện dài ~1.65 m, gốc toạ độ ở mặt đất giữa hai bánh, đầu xe hướng +z
export function ebikeGeometry(frame='#d62828'){
 const parts=[];
 for(const z of [-.58,.58]){
  const w=new THREE.TorusGeometry(.3,.045,8,20);w.rotateY(Math.PI/2);parts.push(paint(at(w,0,.3,z),'#1b1b1b'));
  const hub=new THREE.CylinderGeometry(.06,.06,.1,10);hub.rotateZ(Math.PI/2);parts.push(paint(at(hub,0,.3,z),'#9aa0a6'));
  const fender=new THREE.TorusGeometry(.34,.02,4,12,Math.PI*.7);fender.rotateY(Math.PI/2);fender.rotateX(z>0?-.2:Math.PI*.3+.2);parts.push(paint(at(fender,0,.3,z),frame));
 }
 parts.push(tube([0,.3,-.58],[0,.72,-.12],.03,frame));            // càng sau
 parts.push(tube([0,.38,-.05],[0,.92,.42],.045,frame));           // khung chéo
 parts.push(tube([0,.3,.58],[0,.98,.44],.03,'#9aa0a6'));          // phuộc trước
 parts.push(tube([0,.72,-.12],[0,.86,-.15],.025,'#9aa0a6'));      // cọc yên
 parts.push(tube([-.28,1.04,.46],[.28,1.04,.46],.022,'#2a2a2a')); // ghi đông
 parts.push(tube([0,.95,.43],[0,1.04,.46],.025,'#2a2a2a'));
 const battery=new THREE.BoxGeometry(.16,.2,.46);battery.rotateX(-.75);parts.push(paint(at(battery,0,.62,.17),'#30343a'));
 parts.push(paint(at(new THREE.BoxGeometry(.2,.06,.3),0,.88,-.16),'#1b1b1b'));       // yên
 parts.push(paint(at(new THREE.BoxGeometry(.34,.2,.24),0,.9,.66),'#e8e8e8'));        // giỏ trước
 parts.push(paint(at(new THREE.BoxGeometry(.3,.04,.32),0,.62,-.5),'#2a2a2a'));       // baga sau
 const lamp=new THREE.SphereGeometry(.05,8,6);parts.push(paint(at(lamp,0,.96,.56),'#fff4c2'));
 return mergeGeometries(parts);
}
const FRAME_COLORS=['#d62828','#1d6fb8','#2bb673'];
let shared=null;
function bikeResources(){ // dùng chung cho mọi xe (đỗ & đang chạy)
 if(!shared)shared={geos:FRAME_COLORS.map(c=>ebikeGeometry(c)),mat:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.15})};
 return shared;
}
export const bikeColorOf=id=>FRAME_COLORS[[...id].reduce((a,c)=>a+c.charCodeAt(0),0)%FRAME_COLORS.length];

// Xe gắn dưới người đang đạp (của mình hoặc người khác)
export function RidingBike({color=FRAME_COLORS[0],fire=false}){
 const r=bikeResources();return <group><mesh geometry={r.geos[Math.max(0,FRAME_COLORS.indexOf(color))]} material={r.mat} castShadow/>{fire&&<BikeFlames/>}</group>;
}

// Vạch kẻ ô đỗ + xe đang đỗ (cập nhật khi người chơi lấy / đỗ xe)
export function ParkedBikes(){
 const r=bikeResources(),refs=useRef([]),[ver,setVer]=useState(0);
 useEffect(()=>onBaysChange(()=>setVer(v=>v+1)),[]);
 useEffect(()=>{
  const d=new THREE.Object3D(),counts=FRAME_COLORS.map(()=>0);
  for(const b of BAYS){if(!bayHasBike(b.id))continue;const k=FRAME_COLORS.indexOf(bikeColorOf(b.id)),m=refs.current[k];if(!m)continue;
   d.position.set(b.x,b.floorY,b.z);d.rotation.set(0,b.yaw,0);d.updateMatrix();m.setMatrixAt(counts[k]++,d.matrix);}
  refs.current.forEach((m,k)=>{if(!m)return;m.count=counts[k];m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();});
 },[ver]);
 // vạch trắng: 2 cạnh dọc mỗi ô + vạch ngang cuối ô (xoay theo hướng ô: nhà xe nhỏ ô dọc z, nhà xe chính ô dọc x)
 const lines=useMemo(()=>{const out=[];for(const b of BAYS){const y=b.floorY+.006,fx=Math.sin(b.yaw),fz=Math.cos(b.yaw),px=fz,pz=-fx;
  for(const s of [-1,1])out.push({x:b.x+px*s*BAY_SIZE.w/2,y,z:b.z+pz*s*BAY_SIZE.w/2,w:.05,d:BAY_SIZE.d,yaw:b.yaw});
  out.push({x:b.x-fx*BAY_SIZE.d/2,y,z:b.z-fz*BAY_SIZE.d/2,w:BAY_SIZE.w,d:.05,yaw:b.yaw});}return out;},[]);
 const lineRef=useRef();
 useEffect(()=>{const d=new THREE.Object3D();d.rotation.order='YXZ';lines.forEach((l,i)=>{d.position.set(l.x,l.y,l.z);d.rotation.set(-Math.PI/2,l.yaw,0);d.scale.set(l.w,l.d,1);d.updateMatrix();lineRef.current.setMatrixAt(i,d.matrix);});lineRef.current.instanceMatrix.needsUpdate=true;lineRef.current.computeBoundingSphere();},[lines]);
 return <group>
  {r.geos.map((g,k)=><instancedMesh key={k} ref={el=>refs.current[k]=el} args={[g,r.mat,BAYS.length]} castShadow/>)}
  <instancedMesh ref={lineRef} args={[undefined,undefined,lines.length]} receiveShadow><planeGeometry args={[1,1]}/><meshStandardMaterial color="#f4f4f0" roughness={.8}/></instancedMesh>
 </group>;
}

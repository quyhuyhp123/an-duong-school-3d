// Đèn ban đêm: cột đèn sân trường + ngẫu nhiên một số lớp học bật đèn (cửa sổ sáng vàng).
import React,{useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {RigidBody,CylinderCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {nightFactor} from './DayCycle';

// 6 cột đèn theo các điểm khoanh trên bản đồ (toạ độ x, z; mặt sân y ≈ 0)
export const LAMP_POSTS=[
 [-25,6],        // góc vườn, cạnh dãy B
 [-4.8,7.4],     // đầu lối đi từ cổng — bên trái hàng cau
 [6.8,7.4],      // đầu lối đi từ cổng — bên phải hàng cau
 [25.5,1.5],     // cạnh dãy C
 [25.8,-30.5],   // góc dãy A – dãy C
 [-19.5,-31],    // trước dãy A, bên trái sân khấu
];
const WARM='#ffd9a0';

function radialTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(64,64,0,64,64,64);
 gr.addColorStop(0,'rgba(255,220,160,1)');gr.addColorStop(.35,'rgba(255,210,140,.55)');gr.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

export function CourtyardLamps(){
 const lights=useRef([]),last=useRef(-1);
 const res=useMemo(()=>{
  const glow=radialTexture();
  return {glow,
   pole:new THREE.MeshStandardMaterial({color:'#1f2b26',metalness:.5,roughness:.45}),
   gold:new THREE.MeshStandardMaterial({color:'#b8913c',metalness:.7,roughness:.35}),
   bulb:new THREE.MeshStandardMaterial({color:'#fff6e0',emissive:WARM,emissiveIntensity:0,roughness:.2}),
   pool:new THREE.MeshBasicMaterial({map:glow,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),
   halo:new THREE.SpriteMaterial({map:glow,color:WARM,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),
  };
 },[]);
 useEffect(()=>()=>Object.values(res).forEach(v=>v.dispose?.()),[res]);
 // Cập nhật theo giờ (nửa giây/lần là đủ — trời tối dần rất chậm)
 useFrame(state=>{
  if(state.clock.elapsedTime-last.current<.5&&last.current>=0)return;last.current=state.clock.elapsedTime;
  const n=nightFactor();
  res.bulb.emissiveIntensity=2.4*n;res.pool.opacity=.55*n;res.halo.opacity=.85*n;
  lights.current.forEach(l=>{if(l)l.intensity=28*n;});
 });
 return <group>
  {LAMP_POSTS.map(([x,z],i)=><group key={i} position={[x,0,z]}>
   <mesh castShadow material={res.pole} position={[0,.25,0]}><cylinderGeometry args={[.2,.26,.5,10]}/></mesh>
   <mesh castShadow material={res.gold} position={[0,.52,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.17,.03,6,16]}/></mesh>
   <mesh castShadow material={res.pole} position={[0,2.3,0]}><cylinderGeometry args={[.06,.09,3.6,10]}/></mesh>
   <mesh castShadow material={res.pole} position={[0,3.95,0]}><boxGeometry args={[1.3,.06,.06]}/></mesh>
   {[-.62,.62].map(dx=><group key={dx} position={[dx,3.62,0]}>
    <mesh material={res.pole} position={[0,.27,0]}><cylinderGeometry args={[.015,.015,.22,6]}/></mesh>
    <mesh material={res.gold} position={[0,.15,0]}><coneGeometry args={[.17,.12,12]}/></mesh>
    <mesh material={res.bulb}><sphereGeometry args={[.17,16,12]}/></mesh>
    <sprite material={res.halo} scale={[1.3,1.3,1]}/>
   </group>)}
   <mesh material={res.bulb} position={[0,4.22,0]}><sphereGeometry args={[.15,14,10]}/></mesh>
   <mesh material={res.gold} position={[0,4.42,0]}><coneGeometry args={[.08,.2,10]}/></mesh>
   <sprite material={res.halo} position={[0,4.22,0]} scale={[1.1,1.1,1]}/>
   {/* vầng sáng loang trên mặt sân */}
   <mesh material={res.pool} position={[0,.045,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13,13]}/></mesh>
   <pointLight ref={el=>lights.current[i]=el} position={[0,3.7,0]} color={WARM} intensity={0} distance={16} decay={1.8}/>
  </group>)}
  {/* không đi xuyên cột đèn */}
  <RigidBody type="fixed" colliders={false}>{LAMP_POSTS.map(([x,z],i)=><CylinderCollider key={i} args={[1.2,.24]} position={[x,1.2,z]}/>)}</RigidBody>
 </group>;
}

// ---------- Lớp học bật đèn ----------
// Toàn bộ kính cửa sổ trong file GLB là MỘT khối ("Campus_window"). Khi tải, tách các tam giác theo phòng học gần nhất
// (campus-data.json → rooms) rồi chuyển kính của các phòng được chọn sang vật liệu phát sáng vàng ấm.
// Chọn phòng ngẫu nhiên theo NGÀY: mọi người thấy cùng các lớp sáng đèn, sang ngày hôm sau sẽ khác.
function seededRandom(seed){let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function useLitClassrooms(scene,rooms,share=.5){
 const mat=useMemo(()=>new THREE.MeshStandardMaterial({color:'#3b4a48',emissive:'#ffc874',emissiveIntensity:0,roughness:.25}),[]);
 const last=useRef(-1);
 useEffect(()=>{
  if(!scene||!rooms?.length)return;
  let win=null;scene.traverse(o=>{if(!win&&o.isMesh&&(/window/i.test(o.name)||/window/i.test(o.material?.name??'')))win=o;});
  if(!win||win.userData.litSplit)return;
  win.updateWorldMatrix(true,false);
  const g=win.geometry,pos=g.attributes.position,idx=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i);
  const d=new Date(),rand=seededRandom(d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate());
  const lit=new Set(rooms.filter(()=>rand()<share).map(r=>r.id));
  const v=new THREE.Vector3(),c=new THREE.Vector3(),keep=[],glow=[];
  for(let t=0;t<idx.length;t+=3){
   c.set(0,0,0);for(let k=0;k<3;k++)c.add(v.fromBufferAttribute(pos,idx[t+k]).applyMatrix4(win.matrixWorld));c.multiplyScalar(1/3);
   // phòng cùng tầng (cửa sổ cao ~1,9 m trên sàn) gần nhất theo mặt bằng, trong phạm vi 12 m
   let best=null,bd=144;
   for(const r of rooms){const dy=c.y-(r.inside[1]+1.9);if(Math.abs(dy)>1.5)continue;const dd=(c.x-r.inside[0])**2+(c.z-r.inside[2])**2;if(dd<bd){bd=dd;best=r;}}
   (best&&lit.has(best.id)?glow:keep).push(idx[t],idx[t+1],idx[t+2]);
  }
  if(!glow.length)return;
  g.setIndex(keep);
  const litGeo=new THREE.BufferGeometry();for(const [k,a] of Object.entries(g.attributes))litGeo.setAttribute(k,a);litGeo.setIndex(glow);
  const litMesh=new THREE.Mesh(litGeo,mat);litMesh.name='Lit classroom windows';
  litMesh.position.copy(win.position);litMesh.quaternion.copy(win.quaternion);litMesh.scale.copy(win.scale);
  win.parent.add(litMesh);win.userData.litSplit=true;
  console.info(`[đèn lớp] ${lit.size}/${rooms.length} phòng bật đèn tối nay, ${glow.length/3} tam giác kính sáng`);
 },[scene,rooms,share]);
 useFrame(state=>{if(state.clock.elapsedTime-last.current<.5&&last.current>=0)return;last.current=state.clock.elapsedTime;mat.emissiveIntensity=1.9*nightFactor();});
}

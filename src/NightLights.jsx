// Đèn ban đêm: cột đèn sân trường + ngẫu nhiên một số lớp học bật đèn (cửa sổ sáng vàng).
import React,{useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {RigidBody,CylinderCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {nightFactor} from './DayCycle';
import {IS_TOUCH} from './device';
import {useMergeStatic} from './mergeStatic';

// 6 cột đèn theo các điểm khoanh trên bản đồ (toạ độ x, z; mặt sân y ≈ 0)
export const LAMP_POSTS=[
 [-25,6],        // góc vườn, cạnh dãy B
 [-3,10.5,.28],  // trên bồn cau trái, đối xứng hàng phải
 [5,10.5,.28],   // trên bồn cau phải, đầu hàng
 [25.5,1.5],     // cạnh dãy C
 [25.8,-30.5],   // góc dãy A – dãy C
 [-28,-30.5],    // góc sân giữa dãy A và B, cách mép hành lang
 [-32,32],      // góc vườn cạnh nhà gần cổng
 [-3,20,.28],    // giữa hàng cau trái
 [5,20,.28],    // trên bồn cau phải, giữa hàng
 [-3,32,.28],    // cuối hàng cau trái, phía cổng
 [5,32,.28],    // trên bồn cau phải, cuối hàng
 [29.7,34],     // chỉ dịch đèn dưới, thẳng với đèn trên
 [54,10],       // đường từ nhà xe tới nhà đa năng
 // 2 cột đèn sát tường tây nhà đa năng (x 54.6), đối xứng qua cửa chính (z 33.55); xoay ngang dọc theo tường.
 // Mỗi cột có 2 chậu hoa to hai bên (src/FlowerPots.jsx → HALL_POTS).
 [53.9,29.3,0,Math.PI/2],
 [53.9,37.8,0,Math.PI/2],
 [29.7,17],     // giữ nguyên vị trí đèn trên
 [43,26.5],     // đèn xen giữa ba cây bên kia đường
 [43,35.5],
 // Lối đi phía tây: từ cửa vườn STEAM về nhà kho, đặt sát mép để chừa lối đi.
 [-42.4,-39,0,Math.PI/2],
 [-42.4,-22,0,Math.PI/2],
 [-42.4,-5,0,Math.PI/2],
];
// Hai bộ đèn treo dưới nóc nhà kính, chiếu xuống các luống cây và lối ngang.
const STEAM_LAMPS=[[-48.5,3.85,-38.2],[-48.5,3.85,-47]];
const WARM='#ffd9a0';
export function ParkingLights(){
 const refs=useRef([]),material=useMemo(()=>new THREE.MeshStandardMaterial({color:'#fff4d4',emissive:WARM,emissiveIntensity:0}),[]);
 useEffect(()=>()=>material.dispose(),[material]);
 useFrame(()=>{const n=nightFactor();material.emissiveIntensity=2*n;refs.current.forEach(l=>{if(l)l.intensity=22*n;});});
 const positions=[...[-28,-16,-4,8,16].flatMap(z=>[[47.5,2.9,z],[47.5,6.6,z]]),[36.5,2.7,14.7]];
 return <group>{positions.map(([x,y,z],i)=><group key={i} position={[x,y,z]}><mesh material={material}><boxGeometry args={[1.4,.08,.25]}/></mesh><pointLight ref={l=>refs.current[i]=l} position={[0,-.15,0]} color={WARM} intensity={0} distance={14} decay={1.7}/></group>)}</group>;
}
const GATE_LAMPS=[-7,-3.5,3.5,7].map(x=>[x,Math.abs(x)>5?4.7:5.55,47.8]);
// Mỗi đèn điểm làm MỌI bề mặt trong cảnh phải tính thêm ánh sáng (kể cả khi tắt) → chỉ giữ vài đèn thật, dời tới các
// cột đèn gần camera nhất (cập nhật 2 lần/giây). Cột ở xa vẫn sáng nhờ bóng đèn phát sáng + vầng sáng vẽ sẵn trên mặt sân.
const LIGHT_POOL=IS_TOUCH?2:4;
const LIGHT_SPOTS=[...LAMP_POSTS.map(([x,z,y=0])=>({x,y:y+3.7,z,k:28,d:16})),...GATE_LAMPS.map(([x,y,z])=>({x,y:y-.3,z,k:22,d:12})),...STEAM_LAMPS.map(([x,y,z])=>({x,y:y-.15,z,k:32,d:12}))];

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
  const n=nightFactor(),c=state.camera.position;
  res.bulb.emissiveIntensity=2.4*n;res.pool.opacity=.55*n;res.halo.opacity=.85*n;
  const near=n>.01?[...LIGHT_SPOTS].sort((a,b)=>((a.x-c.x)**2+(a.z-c.z)**2)-((b.x-c.x)**2+(b.z-c.z)**2)):[];
  lights.current.forEach((l,i)=>{if(!l)return;const s=near[i];if(s){l.position.set(s.x,s.y,s.z);l.distance=s.d;l.intensity=s.k*n;}else l.intensity=0;});
 });
 const lampsRef=useRef();useMergeStatic(lampsRef,'deep'); // ~290 mảnh → vài khối (cùng hình ảnh)
 return <group ref={lampsRef}>
  {LAMP_POSTS.map(([x,z,y=0,yaw=0],i)=><group key={i} position={[x,y,z]} rotation={[0,yaw,0]}>
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
   <mesh material={res.pool} position={[0,(x>=5.9&&x<=29.5&&z>=8.2&&z<=40)?.29:.095,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13,13]}/></mesh>
  </group>)}
  {GATE_LAMPS.map((p,i)=><group key={`gate-${i}`} position={p}>
   <mesh material={res.gold}><boxGeometry args={[.5,.12,.28]}/></mesh>
   <mesh material={res.bulb} position={[0,-.075,0]}><boxGeometry args={[.4,.035,.2]}/></mesh>
  </group>)}
  {STEAM_LAMPS.map(([x,y,z],i)=><group key={`steam-${i}`} position={[x,y,z]}>
   <mesh material={res.pole} position={[0,.34,0]}><cylinderGeometry args={[.015,.015,.68,6]}/></mesh>
   <mesh material={res.gold}><boxGeometry args={[1.8,.12,.24]}/></mesh>
   <mesh material={res.bulb} position={[0,-.075,0]}><boxGeometry args={[1.65,.035,.2]}/></mesh>
   <sprite material={res.halo} position={[0,-.1,0]} scale={[2.2,1,1]}/>
   <mesh material={res.pool} position={[0,.085-y,0]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[9,9]}/></mesh>
  </group>)}
  {Array.from({length:LIGHT_POOL},(_,i)=><pointLight key={'pool'+i} ref={el=>lights.current[i]=el} color={WARM} intensity={0} distance={16} decay={1.8}/>)}
  {/* không đi xuyên cột đèn */}
  <RigidBody type="fixed" colliders={false}>{LAMP_POSTS.map(([x,z,y=0],i)=><CylinderCollider key={i} args={[1.2,.24]} position={[x,1.2+y,z]}/>)}</RigidBody>
 </group>;
}

// ---------- Lớp học bật đèn ----------
// Kính cửa sổ trong file GLB gộp theo vật liệu: "glass" (kính trong suốt — 3 dãy chính A, B, C) và "window" (nhà gần cổng…).
// Khi tải, tách các tam giác theo phòng học gần nhất (campus-data.json → rooms) rồi chuyển kính của các phòng được chọn
// sang vật liệu phát sáng vàng ấm. Kính trong suốt: ban ngày ô được chọn vẫn trong như các ô khác, tối mới sáng & đục dần.
// Chọn phòng ngẫu nhiên theo NGÀY: mọi người thấy cùng các lớp sáng đèn, sang ngày hôm sau sẽ khác.
function seededRandom(seed){let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function useLitClassrooms(scene,rooms,share=.5){
 const mats=useMemo(()=>({
  window:new THREE.MeshStandardMaterial({color:'#3b4a48',emissive:'#fff8ee',emissiveIntensity:0,roughness:.25}),
  glass:new THREE.MeshStandardMaterial({color:'#b8dbe6',emissive:'#fff8ee',emissiveIntensity:0,roughness:.05,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}),
 }),[]);
 const last=useRef(-1);
 useEffect(()=>{
  if(!scene||!rooms?.length)return;
  const d=new Date(),rand=seededRandom(d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate());
  const lit=new Set(rooms.filter(()=>rand()<share).map(r=>r.id));
  const targets=[];scene.traverse(o=>{if(!o.isMesh||o.userData.litSplit)return;const n=o.material?.name??'';if(/^glass$/i.test(n))targets.push([o,'glass']);else if(/window/i.test(o.name)||/window/i.test(n))targets.push([o,'window']);});
  let total=0;
  const restore=[];
  for(const [win,kind] of targets){
   win.updateWorldMatrix(true,false);
   const g=win.geometry,pos=g.attributes.position,idx=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,i)=>i);
   const v=new THREE.Vector3(),c=new THREE.Vector3(),keep=[],glow=[];
   for(let t=0;t<idx.length;t+=3){
    c.set(0,0,0);for(let k=0;k<3;k++)c.add(v.fromBufferAttribute(pos,idx[t+k]).applyMatrix4(win.matrixWorld));c.multiplyScalar(1/3);
    // phòng cùng tầng (cửa sổ cao ~1,9 m trên sàn) gần nhất theo mặt bằng, trong phạm vi 12 m
    let best=null,bd=144;
    for(const r of rooms){const dy=c.y-(r.inside[1]+1.9);if(Math.abs(dy)>1.5)continue;const dd=(c.x-r.inside[0])**2+(c.z-r.inside[2])**2;if(dd<bd){bd=dd;best=r;}}
    (best&&lit.has(best.id)?glow:keep).push(idx[t],idx[t+1],idx[t+2]);
   }
   if(!glow.length)continue;
   if(!keep.length){
    // Ô kính sáng toàn bộ chỉ cần đổi vật liệu, vẫn dùng chung geometry gốc.
    const original=win.material;
    win.material=mats[kind];
    total+=glow.length/3;
    restore.push(()=>{win.material=original;});
    continue;
   }
   // Các ô kính dùng chung geometry trong GLB. Chỉ đổi geometry của ô đang xử lý.
   const unlitGeo=new THREE.BufferGeometry();for(const [k,a] of Object.entries(g.attributes))unlitGeo.setAttribute(k,a);unlitGeo.setIndex(keep);
   win.geometry=unlitGeo;
   const litGeo=new THREE.BufferGeometry();for(const [k,a] of Object.entries(g.attributes))litGeo.setAttribute(k,a);litGeo.setIndex(glow);
   const litMesh=new THREE.Mesh(litGeo,mats[kind]);litMesh.name='Lit classroom windows';litMesh.renderOrder=win.renderOrder;
   litMesh.position.copy(win.position);litMesh.quaternion.copy(win.quaternion);litMesh.scale.copy(win.scale);
   win.parent.add(litMesh);total+=glow.length/3;
   restore.push(()=>{litMesh.removeFromParent();win.geometry=g;unlitGeo.dispose();litGeo.dispose();});
  }
  if(total)console.info(`[đèn lớp] ${lit.size}/${rooms.length} phòng bật đèn tối nay, ${total} tam giác kính sáng`);
  return ()=>restore.forEach(fn=>fn());
 },[scene,rooms,share]);
 useFrame(state=>{if(state.clock.elapsedTime-last.current<.5&&last.current>=0)return;last.current=state.clock.elapsedTime;
  const n=nightFactor();mats.window.emissiveIntensity=1.9*n;mats.glass.emissiveIntensity=1.9*n;mats.glass.opacity=.28+.62*n;});
}

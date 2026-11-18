// Chậu hoa to trang trí: hai bên mỗi cột đèn cạnh cửa chính nhà đa năng (đèn ở z 29.3 và 37.8, sát tường x 54.6).
import React,{useMemo,useRef} from 'react';
import {RigidBody,CylinderCollider} from '@react-three/rapier';
import {useMergeStatic} from './mergeStatic';

export const HALL_POTS=[[53.9,28.3],[53.9,30.3],[53.9,36.8],[53.9,38.8]];
const FLOWER_COLORS=['#e8476a','#f7c948','#ff7aa8','#d92f3a','#fff1f4'];

function seeded(i){let s=(i+1)*9301;return()=>{s=(s*16807)%2147483647;return s/2147483647;};}

function Pot({seed}){
 const blooms=useMemo(()=>{const r=seeded(seed),out=[];for(let k=0;k<22;k++){const a=r()*Math.PI*2,d=Math.sqrt(r())*.48,h=1.15+r()*.38;out.push({p:[Math.cos(a)*d,h-(d*.35),Math.sin(a)*d],c:FLOWER_COLORS[Math.floor(r()*FLOWER_COLORS.length)],s:.07+r()*.05});}return out;},[seed]);
 return <group>
  {/* chậu gốm đỏ nâu loe miệng, có viền & đế */}
  <mesh castShadow receiveShadow position={[0,.42,0]}><cylinderGeometry args={[.5,.36,.8,20]}/><meshStandardMaterial color="#b4583a" roughness={.85}/></mesh>
  <mesh castShadow position={[0,.84,0]}><torusGeometry args={[.5,.05,8,24]} /><meshStandardMaterial color="#9c4a30"/></mesh>
  <mesh position={[0,.04,0]}><cylinderGeometry args={[.4,.42,.08,20]}/><meshStandardMaterial color="#7d3b26"/></mesh>
  <mesh position={[0,.82,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.47,20]}/><meshStandardMaterial color="#4a3324"/></mesh>
  {/* tán lá xanh */}
  {[[0,1.12,0,.42],[.22,1.02,.12,.3],[-.2,1.04,-.14,.3],[.06,1.3,-.05,.3]].map(([x,y,z,r],i)=><mesh key={i} castShadow position={[x,y,z]}><icosahedronGeometry args={[r,1]}/><meshStandardMaterial color={i%2?'#3f7d3a':'#4f9443'} flatShading/></mesh>)}
  {/* hoa nhiều màu rải trên tán */}
  {blooms.map((b,i)=><mesh key={i} position={b.p}><icosahedronGeometry args={[b.s,0]}/><meshStandardMaterial color={b.c} emissive={b.c} emissiveIntensity={.12} flatShading/></mesh>)}
 </group>;
}

export function FlowerPots(){
 const ref=useRef();useMergeStatic(ref,'deep'); // 4 chậu × ~30 bông → vài khối
 return <group ref={ref}>
  {HALL_POTS.map(([x,z],i)=><group key={i} position={[x,0,z]}><Pot seed={i}/></group>)}
  <RigidBody type="fixed" colliders={false}>{HALL_POTS.map(([x,z],i)=><CylinderCollider key={i} args={[.45,.5]} position={[x,.45,z]}/>)}</RigidBody>
 </group>;
}

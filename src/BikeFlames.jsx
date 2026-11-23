import React,{useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';

// Two small flame crowns attached to the bike, with no extra scene lights.
const COUNT=48;
export function BikeFlames(){
 const flames=useRef(),rings=useRef([]);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);
 const colors=useMemo(()=>['#0875ff','#14dbff','#b2faff'].map(c=>new THREE.Color(c)),[]);
 useFrame(({clock})=>{
  if(!flames.current)return;
  const t=clock.elapsedTime;
  for(let i=0;i<COUNT;i++){
   const wheel=i<COUNT/2?-.58:.58,j=i%(COUNT/2),a=j/(COUNT/2)*Math.PI*2;
   const flicker=.65+.2*Math.sin(t*13+i*2.7)+.15*Math.sin(t*23+i);
   const h=(.24+.18*(.5+.5*Math.sin(i*3.1)))*flicker;
   dummy.position.set(Math.sin(i*2.4)*.035,.3+Math.cos(a)*.3+h/2,wheel+Math.sin(a)*.3);
   dummy.rotation.set(Math.sin(t*5+i)*.18,0,Math.sin(t*7+i)*.2);
   dummy.scale.set(.065*flicker,h,.065*flicker);dummy.updateMatrix();
   flames.current.setMatrixAt(i,dummy.matrix);
  }
  flames.current.instanceMatrix.needsUpdate=true;
  for(const r of rings.current)if(r)r.material.opacity=.55+.12*Math.sin(t*15);
 });
 const init=mesh=>{flames.current=mesh;if(mesh){for(let i=0;i<COUNT;i++)mesh.setColorAt(i,colors[i%3]);mesh.instanceColor.needsUpdate=true;}};
 return <group name="bike-wheel-flames">
  <RiderLightning/>
  {[-.58,.58].map((z,i)=><mesh key={z} ref={el=>rings.current[i]=el} position={[0,.3,z]} rotation={[0,Math.PI/2,0]}>
   <torusGeometry args={[.32,.055,6,32]}/><meshBasicMaterial color="#118dff" transparent opacity={.65} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
  </mesh>)}
  <instancedMesh ref={init} args={[undefined,undefined,COUNT]} frustumCulled={false}>
   <coneGeometry args={[1,1,5]}/><meshBasicMaterial transparent opacity={.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
  </instancedMesh>
 </group>;
}

function RiderLightning(){
 const ref=useRef();
 const motion=useMemo(()=>({previous:new THREE.Vector3(),position:new THREE.Vector3(),ready:false,alpha:0}),[]);
 const vertices=useMemo(()=>new Float32Array(4*5*2*3),[]);
 useFrame(({clock},dt)=>{
  const lines=ref.current;
  if(!lines)return;
  lines.getWorldPosition(motion.position);
  const moving=motion.ready&&motion.position.distanceTo(motion.previous)>dt*.18;
  motion.previous.copy(motion.position);motion.ready=true;
  motion.alpha=THREE.MathUtils.damp(motion.alpha,moving?.7:0,12,dt);
  lines.material.opacity=motion.alpha;
  lines.visible=motion.alpha>.015;
  if(!lines.visible)return;
  const tick=Math.floor(clock.elapsedTime*16);
  let i=0;
  for(let bolt=0;bolt<4;bolt++){
   const head=bolt>=2,angle=tick*.4+bolt*Math.PI*.57;
   const radius=head?.27:.36,base=head?1.53:.85;
   const point=(k,write)=>{
    const a=angle+k*.24+Math.sin(tick+bolt*8+k*11)*.38;
    vertices[write]=Math.cos(a)*radius;
    vertices[write+1]=base+k*(head?.075:.13)+Math.sin(tick+k*9+bolt)*.065;
    vertices[write+2]=Math.sin(a)*radius-k*.045;
   };
   for(let k=0;k<5;k++){point(k,i);point(k+1,i+3);i+=6;}
  }
  lines.geometry.attributes.position.needsUpdate=true;
 });
 return <lineSegments ref={ref} frustumCulled={false} visible={false}>
  <bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices,3]}/></bufferGeometry>
  <lineBasicMaterial color="#70eaff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}/>
 </lineSegments>;
}

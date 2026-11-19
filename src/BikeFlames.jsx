import React,{useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';

// Two small flame crowns attached to the bike, with no extra scene lights.
const COUNT=48;
export function BikeFlames(){
 const flames=useRef(),rings=useRef([]);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);
 const colors=useMemo(()=>['#ff4308','#ff9b16','#ffe476'].map(c=>new THREE.Color(c)),[]);
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
  {[-.58,.58].map((z,i)=><mesh key={z} ref={el=>rings.current[i]=el} position={[0,.3,z]} rotation={[0,Math.PI/2,0]}>
   <torusGeometry args={[.32,.055,6,32]}/><meshBasicMaterial color="#ff760c" transparent opacity={.65} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
  </mesh>)}
  <instancedMesh ref={init} args={[undefined,undefined,COUNT]} frustumCulled={false}>
   <coneGeometry args={[1,1,5]}/><meshBasicMaterial transparent opacity={.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
  </instancedMesh>
 </group>;
}

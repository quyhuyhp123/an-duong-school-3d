import React,{useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {RigidBody,CylinderCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {nightFactor} from './DayCycle';
const POLES=[-45,-29,-13,13,29,43,63,75];
export function StreetLights(){
 const lights=useRef([]),last=useRef(-1);
 const resources=useMemo(()=>{
  const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,6.5,0),new THREE.Vector3(0,7.35,.1),new THREE.Vector3(0,8,1.05),new THREE.Vector3(0,8.2,2.2)]);
  return {arm:new THREE.TubeGeometry(path,24,.045,8,false),pole:new THREE.MeshStandardMaterial({color:'#9ca6ac',metalness:.65,roughness:.4}),lamp:new THREE.MeshStandardMaterial({color:'#eff7ff',emissive:'#e1efff',emissiveIntensity:0})};
 },[]);
 useEffect(()=>()=>Object.values(resources).forEach(r=>r.dispose()),[resources]);
 useFrame(({clock})=>{if(clock.elapsedTime-last.current<.5)return;last.current=clock.elapsedTime;const n=nightFactor();resources.lamp.emissiveIntensity=3*n;lights.current.forEach(l=>{if(l)l.intensity=100*n});});
 return <>
 {POLES.map((x,i)=><group key={x} position={[x,0,49.45]}>
  <mesh castShadow material={resources.pole} position={[0,.32,0]}><cylinderGeometry args={[.18,.25,.64,12]}/></mesh>
  <mesh castShadow material={resources.pole} position={[0,4.3,0]}><cylinderGeometry args={[.065,.12,8.1,12]}/></mesh>
  <mesh geometry={resources.arm} material={resources.pole}/>
  <mesh material={resources.pole} position={[0,8.22,2.2]} rotation={[-.12,0,0]}><boxGeometry args={[.42,.16,.8]}/></mesh>
  <mesh material={resources.lamp} position={[0,8.12,2.2]}><boxGeometry args={[.34,.035,.65]}/></mesh>
  <pointLight ref={l=>lights.current[i]=l} position={[0,7.9,2.2]} intensity={0} color="#e1efff" distance={22} decay={1.8}/>
 </group>)}
 <RigidBody type="fixed" colliders={false}>{POLES.map(x=><CylinderCollider key={x} args={[4.15,.15]} position={[x,4.15,49.45]}/>)}</RigidBody>
 </>;
}

import React,{createContext,useContext,useRef} from 'react';
import {Html} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
export const NameplatesVisible=createContext(true);
export function Nameplate({profile,height=2.15}){
 const enabled=useContext(NameplatesVisible);
 const portal=useRef(document.body),root=useRef(),point=useRef(new THREE.Vector3());
 useFrame(({camera})=>{if(root.current){root.current.getWorldPosition(point.current);root.current.visible=point.current.distanceToSquared(camera.position)<32*32;}});
 if(!profile?.name)return null;
 return <group ref={root} position={[0,height,0]}><Html portal={portal} center distanceFactor={9} zIndexRange={[30,0]} style={{display:enabled?'block':'none',pointerEvents:'none',userSelect:'none',whiteSpace:'nowrap'}}><div className="character-nameplate"><strong>{profile.role==='teacher'?`Giáo viên · ${profile.name}`:profile.name}</strong>{profile.role==='teacher'?(profile.subject&&<span>Môn dạy: {profile.subject}</span>):<>{profile.cls&&<span>Lớp {profile.cls}</span>}{profile.year&&<span>Niên khóa {profile.year}</span>}</>}</div></Html></group>;
}

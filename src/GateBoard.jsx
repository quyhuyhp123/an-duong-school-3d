// Bảng tin cạnh lối vào cổng chính: dán ảnh bảng phấn "Tri ân" (Chi đoàn A3-K50) lên mặt bảng 4.7 × 2.64 m (16:9).
// Mặt bảng trong mô hình ở three.js x ≈ 5.6, giữa z 37, tâm cao 2.35 m, quay về phía lối đi giữa (-x).
import React,{useMemo} from 'react';
import {useLoader,useThree} from '@react-three/fiber';
import * as THREE from 'three';

const BOARD={x:5.565,y:2.35,z:37,w:4.7,h:2.64};

export function GateBoard(){
 const gl=useThree(s=>s.gl);
 const tex=useLoader(THREE.TextureLoader,`${import.meta.env.BASE_URL}boards/tri-an-a3k50.jpg`);
 useMemo(()=>{tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());tex.needsUpdate=true;},[tex,gl]);
 return <mesh position={[BOARD.x,BOARD.y,BOARD.z]} rotation={[0,-Math.PI/2,0]} receiveShadow>
  <planeGeometry args={[BOARD.w,BOARD.h]}/>
  <meshStandardMaterial map={tex} roughness={.85}/>
 </mesh>;
}

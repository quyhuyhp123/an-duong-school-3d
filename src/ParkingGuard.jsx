// Chốt bảo vệ ở lối vào nhà xe (chỗ nối nhà xe nhỏ ↔ nhà xe chính, mép phía nam):
// bàn trực + ghế + bác bảo vệ đứng. Người chơi đi vào / đi ra qua chỗ bác đứng → bác quay sang, hiện câu hỏi vé xe.
import React,{useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {RigidBody,CuboidCollider,CapsuleCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {localPlayer} from './localPlayer';

const GUARD=[44.65,.17,17.35];       // chỗ bác đứng (three.js): trên sàn nhà xe chính, sát cột góc tây-nam (x 43.9, z 18)
const TABLE=[43.35,0,18.85];         // bàn trực cạnh bác, sát góc nhà xe chính; quay ngược: ghế ở phía bắc, ngồi nhìn ra đường
const TRIGGER_IN=2.8,TRIGGER_OUT=4.2; // vào vòng 2.8 m thì hỏi; ra xa 4.2 m mới tính lần đi qua tiếp theo
const LINE='Vé xe đâu, lấy ra cho bác kiểm tra!';
const SHOW_MS=3500;

const C={uniform:'#5b6b3a',trim:'#3e4a27',skin:'#d9a77f',cap:'#3e4a27',badge:'#f6c344',shoes:'#1b1b1b',belt:'#2a2a2a'};

export function Guard({face}){
 const root=useRef(),body=useRef();
 useFrame(state=>{ // khẽ nhún như đang thở + quay dần về phía người chơi
  const t=state.clock.elapsedTime;if(body.current)body.current.position.y=Math.sin(t*1.6)*.012;
  if(root.current)root.current.rotation.y+=(((face.current-root.current.rotation.y+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI)*.08;
 });
 return <group ref={root}><group ref={body}>
  {/* chân, giày */}
  {[-1,1].map(s=><group key={s}><mesh castShadow position={[s*.12,.42,0]}><capsuleGeometry args={[.1,.5,5,10]}/><meshStandardMaterial color={C.uniform}/></mesh><mesh position={[s*.12,.06,.05]}><boxGeometry args={[.18,.12,.3]}/><meshStandardMaterial color={C.shoes}/></mesh></group>)}
  {/* thân áo đồng phục, thắt lưng, phù hiệu, cầu vai */}
  <mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[.27,.38,6,12]}/><meshStandardMaterial color={C.uniform}/></mesh>
  <mesh position={[0,.9,0]}><cylinderGeometry args={[.27,.27,.08,16]}/><meshStandardMaterial color={C.belt}/></mesh>
  <mesh position={[0,.9,.27]}><boxGeometry args={[.1,.07,.02]}/><meshStandardMaterial color={C.badge} metalness={.6} roughness={.3}/></mesh>
  <mesh position={[-.12,1.28,.25]}><boxGeometry args={[.09,.11,.02]}/><meshStandardMaterial color={C.badge} metalness={.6} roughness={.3}/></mesh>
  {[-1,1].map(s=><mesh key={s} position={[s*.24,1.43,0]}><boxGeometry args={[.14,.04,.2]}/><meshStandardMaterial color={C.trim}/></mesh>)}
  {/* tay chắp sau lưng */}
  {[-1,1].map(s=><mesh key={s} castShadow position={[s*.27,1.08,-.08]} rotation={[.35,0,s*.25]}><capsuleGeometry args={[.075,.38,5,10]}/><meshStandardMaterial color={C.uniform}/></mesh>)}
  <mesh position={[0,.9,-.27]}><sphereGeometry args={[.09,10,8]}/><meshStandardMaterial color={C.skin}/></mesh>
  {/* đầu, mũ kê-pi có lưỡi trai & phù hiệu */}
  <mesh castShadow position={[0,1.68,0]}><sphereGeometry args={[.22,18,14]}/><meshStandardMaterial color={C.skin}/></mesh>
  {[-1,1].map(s=><mesh key={s} position={[s*.075,1.7,.2]}><sphereGeometry args={[.02,8,8]}/><meshStandardMaterial color="#2a1a14"/></mesh>)}
  <mesh position={[0,1.6,.21]}><boxGeometry args={[.12,.025,.02]}/><meshStandardMaterial color="#5a3a2a"/></mesh>
  <mesh position={[0,1.86,0]}><cylinderGeometry args={[.24,.22,.14,18]}/><meshStandardMaterial color={C.cap}/></mesh>
  <mesh position={[0,1.79,.2]} rotation={[.35,0,0]}><boxGeometry args={[.3,.02,.16]}/><meshStandardMaterial color="#1b1b1b"/></mesh>
  <mesh position={[0,1.87,.235]}><circleGeometry args={[.045,12]}/><meshStandardMaterial color={C.badge} metalness={.6} roughness={.3}/></mesh>
 </group></group>;
}

function GuardDesk(){
 return <group>
  {/* bàn trực: mặt gỗ, 4 chân, sổ ghi chép, bút, cốc nước */}
  <mesh castShadow receiveShadow position={[0,.74,0]}><boxGeometry args={[1.1,.05,.6]}/><meshStandardMaterial color="#8a5a33"/></mesh>
  {[[-.5,-.25],[.5,-.25],[-.5,.25],[.5,.25]].map(([x,z],i)=><mesh key={i} position={[x,.36,z]}><boxGeometry args={[.05,.72,.05]}/><meshStandardMaterial color="#5b3a22"/></mesh>)}
  <mesh position={[-.15,.78,.02]} rotation={[0,.2,0]}><boxGeometry args={[.32,.03,.24]}/><meshStandardMaterial color="#f4efe2"/></mesh>
  <mesh position={[-.15,.795,.02]} rotation={[0,.2,0]}><boxGeometry args={[.33,.005,.25]}/><meshStandardMaterial color="#1d6fb8"/></mesh>
  <mesh position={[.05,.8,.1]} rotation={[0,.6,Math.PI/2]}><cylinderGeometry args={[.008,.008,.15,6]}/><meshStandardMaterial color="#1b1b1b"/></mesh>
  <mesh position={[.35,.82,-.1]}><cylinderGeometry args={[.04,.035,.1,12]}/><meshStandardMaterial color="#e8e8e8"/></mesh>
  {/* ghế nhựa phía sau bàn */}
  <group position={[0,0,.62]}>
   <mesh castShadow position={[0,.45,0]}><boxGeometry args={[.42,.05,.42]}/><meshStandardMaterial color="#1d6fb8"/></mesh>
   <mesh castShadow position={[0,.72,.19]}><boxGeometry args={[.42,.5,.04]}/><meshStandardMaterial color="#1d6fb8"/></mesh>
   {[[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]].map(([x,z],i)=><mesh key={i} position={[x,.22,z]}><cylinderGeometry args={[.018,.018,.44,6]}/><meshStandardMaterial color="#9aa0a6"/></mesh>)}
  </group>
 </group>;
}

export function ParkingGuard(){
 const [talk,setTalk]=useState(false);
 const inside=useRef(false),timer=useRef(null);
 const face=useRef(0); // hướng mặt bác (yaw); mặc định nhìn ra lối vào
 const baseYaw=useMemo(()=>0,[]); // nhìn ra phía nam (đường nội bộ, người đi vào)
 face.current=baseYaw;
 useFrame(()=>{
  const p=localPlayer;if(!p.ready)return;
  const d=Math.hypot(p.x-GUARD[0],p.z-GUARD[2]);
  if(d<TRIGGER_IN&&!inside.current&&p.y<2.5){
   inside.current=true;setTalk(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setTalk(false),SHOW_MS);
  }else if(d>TRIGGER_OUT)inside.current=false;
  // đang hỏi vé → quay mặt về người chơi; xong thì quay lại nhìn lối vào
  face.current=talk||d<TRIGGER_IN?Math.atan2(p.x-GUARD[0],p.z-GUARD[2]):baseYaw;
 });
 return <group>
  <group position={GUARD}><Guard face={face}/>
   {talk&&<Html position={[0,2.35,0]} center style={{pointerEvents:'none'}}><div className="guard-bubble">{LINE}</div></Html>}
  </group>
  <group position={TABLE} rotation={[0,Math.PI,0]}><GuardDesk/></group>
  <RigidBody type="fixed" colliders={false}>
   <CapsuleCollider args={[.55,.28]} position={[GUARD[0],GUARD[1]+.83,GUARD[2]]}/>
   <CuboidCollider args={[.55,.38,.3]} position={[TABLE[0],.38,TABLE[2]]}/>
   <CuboidCollider args={[.22,.45,.22]} position={[TABLE[0],.45,TABLE[2]-.62]}/>
  </RigidBody>
 </group>;
}

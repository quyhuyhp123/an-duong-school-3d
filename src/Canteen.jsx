import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {RigidBody,CuboidCollider,CapsuleCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {Vendor} from './Shops';
import {localPlayer} from './localPlayer';
import {getRole} from './role';
import {useNearVisible} from './useNearVisible';
import {useMergeStatic} from './mergeStatic';

const FLOOR=.26;
const SELLERS=[{x:14.4,z:43.4,shirt:'#d75d81',apron:'#fff3d8'},{x:18,z:43.4,shirt:'#399586',apron:'#f4f6ee'}];
const DRINK_COLORS=['#49a9e0','#f29932','#b52f3a','#63a33f','#f6efe0','#ad723d'];
const ICE_COLORS=['#ef8baf','#f4d9a0','#89553a','#97bc60','#f7f0df','#a1dce4'];
const Box=({p,s,c='#edf2f2',...props})=><mesh position={p} castShadow receiveShadow {...props}><boxGeometry args={s}/><meshStandardMaterial color={c} roughness={.55}/></mesh>;
function Label({text,position,size,bg='#075494',fg='#ffffff',rotation=[0,Math.PI,0]}){
 const map=useMemo(()=>{
  const c=document.createElement('canvas');c.width=1024;c.height=128;const g=c.getContext('2d');
  g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
  let font=90;g.font=`bold ${font}px Arial`;while(g.measureText(text).width>960)g.font=`bold ${font-=2}px Arial`;g.fillText(text,512,67);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
 },[text,bg,fg]);
 useEffect(()=>()=>map.dispose(),[map]);
 return <mesh position={position} rotation={rotation}><planeGeometry args={size}/><meshBasicMaterial map={map} toneMapped={false}/></mesh>;
}
function Glass({p,s}){return <mesh position={p} userData={{noMerge:true}} renderOrder={3}><boxGeometry args={s}/><meshStandardMaterial color="#cdeaf3" transparent opacity={.14} roughness={.06} metalness={.1} depthWrite={false}/></mesh>;}

function DrinksFridge(){return <group position={[12.25,FLOOR,45.85]}>
 <Box p={[0,1.3,.42]} s={[1.5,2.6,.08]} c="#dbe8eb"/>
 {[-1,1].map(s=><Box key={s} p={[s*.72,1.3,0]} s={[.08,2.6,.85]}/>)}
 {[.06,2.55].map(y=><Box key={y} p={[0,y,0]} s={[1.5,.12,.85]}/>)}
 {Array.from({length:4},(_,row)=><group key={row}>
  <Box p={[0,.19+row*.54,0]} s={[1.35,.035,.72]} c="#cbd5d7"/>
  {Array.from({length:12},(_,i)=>{const x=-.55+(i%6)*.22,y=.39+row*.54,z=i<6?-.2:.15,color=DRINK_COLORS[(i+row)%6];return <group key={i} position={[x,y,z]}>
   <mesh><cylinderGeometry args={[.058,.055,.3,10]}/><meshStandardMaterial color={color} roughness={.35} emissive={color} emissiveIntensity={.12}/></mesh>
   <mesh position={[0,.17,0]}><cylinderGeometry args={[.03,.04,.065,8]}/><meshStandardMaterial color="#edf2f5"/></mesh>
   <mesh><cylinderGeometry args={[.059,.059,.085,10]}/><meshStandardMaterial color={i%2?'#fff7e7':'#e2f4ff'}/></mesh>
  </group>;})}
 </group>)}
 <mesh position={[-.63,1.4,.32]}><boxGeometry args={[.025,2.1,.03]}/><meshBasicMaterial color="#ecfaff"/></mesh>
 <Glass p={[0,1.32,-.435]} s={[1.32,2.25,.018]}/>
 {[-.7,.7].map(x=><Box key={x} p={[x,1.3,-.46]} s={[.055,2.55,.045]} c="#34454e"/>)}
 <Box p={[-.54,1.3,-.49]} s={[.045,.6,.055]} c="#d0d7db"/>
 <Label text="NƯỚC MÁT" position={[0,2.43,-.473]} size={[1.3,.23]}/>
 </group>;}
function IceCreamFreezer(){return <group position={[19.8,FLOOR,45.9]}>
 <Box p={[0,.07,0]} s={[2.7,.14,1.2]}/>
 {[-1,1].map(s=><Box key={s} p={[s*1.31,.59,0]} s={[.08,1.1,1.2]}/>)}
 {[-1,1].map(s=><Box key={s} p={[0,.59,s*.56]} s={[2.7,1.1,.08]}/>)}
 <Box p={[0,.65,0]} s={[2.52,.08,1.04]} c="#d5eaf3"/>
 {Array.from({length:24},(_,i)=>{const x=-1.08+(i%8)*.31,z=-.34+Math.floor(i/8)*.32;return <group key={i} position={[x,.78,z]} rotation={[0,(i%3-1)*.12,0]}>
  <Box p={[0,0,0]} s={[.22,.1,.22]} c={ICE_COLORS[i%6]}/>
  <Box p={[0,0,.145]} s={[.05,.045,.12]} c="#d6b582"/>
  <Box p={[0,.057,0]} s={[.13,.008,.055]} c="#fff8e7"/>
 </group>;})}
 {[-1,1].map(s=><group key={s}>
  <Glass p={[s*.65,1.16,0]} s={[1.25,.025,1.06]}/>
  <Box p={[s*.65,1.2,-.37]} s={[.28,.045,.04]} c="#6a9eaf"/>
 </group>)}
 <Box p={[0,1.17,0]} s={[.04,.035,1.12]} c="#8faab4"/>
 <Label text="KEM MÁT LẠNH" position={[0,.69,-.607]} size={[2.3,.33]}/>
 </group>;}

const BOWLS=[[14.6,1.405,41.95],[17,1.405,41.95]];
function NoodleBowls(){return <>{BOWLS.map((p,i)=><group key={i} position={p}>
 <mesh position={[0,.09,0]}><cylinderGeometry args={[.23,.13,.18,24,1,true]}/><meshStandardMaterial color={i?'#e0f0f1':'#fff6e9'} side={THREE.DoubleSide}/></mesh>
 <mesh position={[0,.18,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.215,24]}/><meshStandardMaterial color="#cd9b42"/></mesh>
 <mesh position={[0,.185,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.227,.016,8,24]}/><meshStandardMaterial color="#fffdf4"/></mesh>
 {Array.from({length:7},(_,j)=><mesh key={j} position={[(j-3)*.045,.19,Math.sin(j*2)*.07]} rotation={[-Math.PI/2,0,j*.4]}><torusGeometry args={[.045,.007,5,12,Math.PI*1.5]}/><meshStandardMaterial color="#ffe69a"/></mesh>)}
 {[-.1,.08].map((x,j)=><mesh key={j} position={[x,.2,j?.06:-.065]} scale={[1,.35,.6]}><sphereGeometry args={[.045,8,6]}/><meshStandardMaterial color="#5b9a3e"/></mesh>)}
 {[0,1].map(j=><Box key={j} p={[.15+j*.035,.215,.01]} s={[.012,.012,.43]} c="#906137" rotation={[0,.25,0]}/>)}
 </group>)}</>;}
function Steam(){
 const refs=useRef([]),map=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,.8)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);},[]);
 useEffect(()=>()=>map.dispose(),[map]);
 useFrame(({clock})=>refs.current.forEach((s,i)=>{if(!s)return;const t=(clock.elapsedTime*.55+(i%6)/6)%1,p=BOWLS[Math.floor(i/6)];s.position.set(p[0]+Math.sin(t*5+i)*.06,p[1]+.24+t*.65,p[2]+Math.cos(t*4+i)*.04);s.scale.set(.12+t*.2,.18+t*.28,1);s.material.opacity=Math.sin(t*Math.PI)*.28;}));
 return <group>{Array.from({length:12},(_,i)=><sprite key={i} ref={s=>refs.current[i]=s}><spriteMaterial map={map} transparent opacity={0} depthWrite={false} color="#ffffff"/></sprite>)}</group>;
}

function CanteenSellers(){
 const faces=[useRef(Math.PI),useRef(Math.PI)],last=useRef(-1),entered=useRef(null),speechKey=useRef(''),[speech,setSpeech]=useState(null);
 useFrame(({clock})=>{
  const t=clock.elapsedTime,p=localPlayer;if(!p.ready||t-last.current<.2)return;last.current=t;
  const near=p.x>11.2&&p.x<28.8&&p.z>38.3&&p.z<46.7&&p.y<2.8;
  SELLERS.forEach((v,i)=>{faces[i].current=near?Math.atan2(p.x-v.x,p.z-v.z):Math.PI;});
  if(near&&entered.current===null)entered.current=t;
  if(!near){entered.current=null;if(speechKey.current){speechKey.current='';setSpeech(null);}return;}
  const line=Math.floor((t-entered.current)/5),key=line<4?`${line}-${getRole()}`:'';
  if(key===speechKey.current)return;speechKey.current=key;
  if(!key){setSpeech(null);return;}
  const teacher=getRole()==='teacher',lines=teacher
   ?['Mời thầy cô ghé Căng - tin ạ! Có nước mát, sữa và trà trái cây.','Thầy cô dùng kem hay mì nóng ạ? Mì vừa làm xong còn nóng đấy ạ!','Thầy cô chọn nước trong tủ kính nhé, em lấy ngay ạ.','Cảm ơn thầy cô đã ghé! Chúc thầy cô một ngày thật vui ạ.']
   :['Chào em! Ghé Căng - tin dùng nước mát nhé, có nhiều loại lắm!','Có kem mát lạnh và mì nóng đây! Em ăn gì cô lấy cho nhé?','Nước khoáng, sữa, trà và nước trái cây đều có trong tủ kính nhé!','Mì còn nóng, em ăn cẩn thận nhé. Chúc em học thật vui!'];
  setSpeech({speaker:line%2,text:lines[line]});
 });
 return <>{SELLERS.map((v,i)=><group key={i} position={[v.x,FLOOR,v.z]}><Vendor face={faces[i]} look={{shirt:v.shirt,apron:v.apron}}/></group>)}{speech&&<Html position={[SELLERS[speech.speaker].x,2.65,43.2]} center style={{pointerEvents:'none'}}><div className="guard-bubble shop">{speech.text}</div></Html>}</>;
}
export function Canteen(){
 const near=useNearVisible([20,0,44],55),staticRef=useRef();useMergeStatic(staticRef,'deep');
 return <><group ref={near}>
  <group ref={staticRef}><Label text="Căng - tin" position={[20,2.9,40.775]} size={[4.6,.6]}/><DrinksFridge/><IceCreamFreezer/><NoodleBowls/></group>
  <Steam/><CanteenSellers/>
 </group><RigidBody type="fixed" colliders={false}>
  <CuboidCollider args={[.75,1.3,.425]} position={[12.25,FLOOR+1.3,45.85]}/>
  <CuboidCollider args={[1.35,.6,.6]} position={[19.8,FLOOR+.6,45.9]}/>
  {SELLERS.map((v,i)=><CapsuleCollider key={i} args={[.6,.23]} position={[v.x,FLOOR+.88,v.z]}/>)}
 </RigidBody></>;
}

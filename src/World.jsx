import {Multiplayer,network,CoupleBody} from './multiplayer';
import React,{useRef,useMemo,useEffect,useState,memo} from 'react';
import {useFrame,useLoader,useThree} from '@react-three/fiber';
import {useGLTF,OrbitControls,Html} from '@react-three/drei';
import {Physics,RigidBody,CuboidCollider,CapsuleCollider,useRapier,useBeforePhysicsStep} from '@react-three/rapier';
import * as THREE from 'three';
import {createController,moveCharacter,CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS} from './character-controller';
export const MODEL_VERSION='flower-beds-paved-forecourt-37';
function GateLED(){
 const material=useRef();
 const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,2048,128);ctx.fillStyle='#ff4933';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 66px Arial';ctx.fillText('CHÀO MỪNG NGÀY NHÀ GIÁO VIỆT NAM 20/11',1024,64,1990);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;},[]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 useFrame(({clock})=>{if(material.current)material.current.opacity=.28+.72*(.5+.5*Math.sin(clock.elapsedTime*Math.PI));});
 return <mesh position={[0,4.35,48.965]}><planeGeometry args={[8.8,.5]}/><meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false}/></mesh>;
}
function Player({data,overview,paused,destination,onPosition,onNear}){
 const body=useRef(),capsule=useRef(),avatar=useRef(),keys=useRef({}),motion=useRef({vertical:0,jumpHeld:false});
 const [localPair,setLocalPair]=useState(null);
 const nearbySeat=useRef(null);const [seatHint,setSeatHint]=useState(null);
 const mode=useRef('stand'),anchor=useRef(null),exit=useRef(null),blend=useRef(0),walk=useRef(0),report=useRef(0),near=useRef(false);
 const [menu,setMenu]=useState(false),[swingNearby,setSwingNearby]=useState(false);const swingNearbyRef=useRef(false);const orbit=useRef({yaw:0,pitch:.22,distance:5.8,drag:false});
 const {world,rapier}=useRapier(),{camera,gl}=useThree();const controller=useRef();
 const position=useMemo(()=>new THREE.Vector3(),[]),direction=useMemo(()=>new THREE.Vector3(),[]);
 function choose(value){
  if(value!=='swing')network.send({type:'stop'});
  if(value==='stand')network.send({type:'leave'});
  if(value==='swing'){
   const p=body.current.translation(),swing=Math.abs(p.x-16.5)<Math.abs(p.x-23.5)?0:1;
   if(network.id&&network.socket?.readyState===1){network.send({type:'move',position:[p.x,p.y,p.z],yaw:avatar.current.rotation.y,mode:'stand'});network.send({type:'sit',swing});setMenu(false);return;}
   const x=[16.5,23.5][swing]-.43;exit.current={x,y:1.14,z:13.1};anchor.current={x,y:1.32,z:11.6};mode.current='normal';body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=0;setMenu(true);return;
  }
  if(value==='stand'&&anchor.current&&exit.current){body.current.setTranslation(exit.current,true);body.current.setNextKinematicTranslation(exit.current);}
  if(value==='stand')anchor.current=null;mode.current=value;
  if(value==='bench'&&nearbySeat.current){const s=nearbySeat.current;exit.current={x:s.exit[0],y:s.exit[1],z:s.exit[2]};anchor.current={x:s.position[0],y:s.position[1],z:s.position[2]};body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=s.yaw;}
  setMenu(false);keys.current={};
 }
 useEffect(()=>{const handler=e=>{const m=e.detail;
  if(m.type==='seated'){const [x,y,z]=m.position;exit.current={x,y:1.14,z:13.1};anchor.current={x,y,z};mode.current='normal';body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=0;setMenu(true);}
  if(m.type==='state'){const me=m.players.find(p=>p.id===network.id);setLocalPair(me?.action?me:null);}
  if(m.type==='disconnected'&&anchor.current)choose('stand');
 };window.addEventListener('school-network',handler);return()=>window.removeEventListener('school-network',handler)},[]);
 useEffect(()=>{controller.current=createController(world);return()=>world.removeCharacterController(controller.current)},[world]);
 useEffect(()=>{if(destination&&body.current){choose('stand');const [x,y,z]=destination.position;body.current.setTranslation({x,y,z},true);body.current.setNextKinematicTranslation({x,y,z});motion.current.vertical=0;orbit.current.yaw=destination.yaw??0;}},[destination]);
 useEffect(()=>{if(overview){camera.position.set(100,85,112);camera.lookAt(14,0,0)}},[overview]);
 useEffect(()=>{
  const down=e=>{
   if(e.target?.closest?.('input,textarea,select'))return;
   if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
   if(e.code==='KeyF'&&!e.repeat&&!overview&&!paused){
    e.preventDefault();
    if(mode.current!=='stand')choose('stand');
    else if(nearbySeat.current){choose('bench');setMenu(true);}
    else if(swingNearbyRef.current){choose('swing');}
    else if(controller.current?.computedGrounded()){choose('normal');setMenu(true);}
    return;
   }
   keys.current[e.code]=true;
  };
  const up=e=>keys.current[e.code]=false,clear=()=>keys.current={};
  const start=e=>{if(!overview){orbit.current.drag=true;gl.domElement.setPointerCapture(e.pointerId)}},stop=()=>orbit.current.drag=false;
  const move=e=>{if(orbit.current.drag&&!overview&&!menu){orbit.current.yaw-=e.movementX*.005;orbit.current.pitch=THREE.MathUtils.clamp(orbit.current.pitch+e.movementY*.004,-.15,1.05)}};
  const wheel=e=>{if(!overview)orbit.current.distance=THREE.MathUtils.clamp(orbit.current.distance+e.deltaY*.006,1.4,10)};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
  const el=gl.domElement;el.addEventListener('pointerdown',start);el.addEventListener('pointerup',stop);el.addEventListener('pointermove',move);el.addEventListener('wheel',wheel);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);el.removeEventListener('pointerdown',start);el.removeEventListener('pointerup',stop);el.removeEventListener('pointermove',move);el.removeEventListener('wheel',wheel)};
 },[overview,paused,menu,gl]);
 useBeforePhysicsStep(()=>{
  if(!body.current||!controller.current)return;
  if(anchor.current&&!keys.current.KeyR){body.current.setNextKinematicTranslation(anchor.current);walk.current=0;return;}
  const k=keys.current,active=!overview&&!paused&&!menu&&mode.current==='stand';
  direction.set(active?(+!!(k.KeyD||k.ArrowRight)-+!!(k.KeyA||k.ArrowLeft)):0,0,active?(+!!(k.KeyS||k.ArrowDown)-+!!(k.KeyW||k.ArrowUp)):0).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP,orbit.current.yaw);
  const speed=k.ShiftLeft||k.ShiftRight?6:3.5;walk.current=direction.lengthSq()?speed:0;
  moveCharacter({body:body.current,collider:capsule.current,controller:controller.current,state:motion.current,direction,speed,jump:active&&!!k.Space,dt:world.timestep});
  if(k.KeyR||body.current.translation().y< -8){choose('stand');const [x,y,z]=data.spawn;body.current.setTranslation({x,y,z},true);body.current.setNextKinematicTranslation({x,y,z});motion.current.vertical=0;keys.current.KeyR=false;}
 });
 useFrame((state,delta)=>{
  if(!body.current||!avatar.current)return;
  blend.current=THREE.MathUtils.damp(blend.current,mode.current==='stand'?0:1,10,delta);
  avatar.current.position.y=-.83-.38*blend.current;
  if(walk.current){const a=Math.atan2(direction.x,direction.z);avatar.current.rotation.y+=(THREE.MathUtils.euclideanModulo(a-avatar.current.rotation.y+Math.PI,Math.PI*2)-Math.PI)*(1-Math.exp(-16*delta));}
  avatar.current.traverse(o=>{if(o.name==='thigh'){o.rotation.x=-Math.PI/2*blend.current+(walk.current?Math.sin(state.clock.elapsedTime*walk.current*2.6)*(o.position.x<0?-.4:.4):0)*(1-blend.current);o.rotation.z=(mode.current==='relaxed'?(o.position.x<0?-.22:.22):0)*blend.current;}if(o.name==='shin')o.rotation.x=(mode.current==='stretch'?.35:Math.PI/2)*blend.current;});
  avatar.current.getWorldPosition(position);const p=body.current.translation();
  const closest=(data.seats??[]).map(s=>({s,d:Math.hypot(p.x-s.position[0],p.z-s.position[2])})).sort((a,b)=>a.d-b.d)[0];
  const nextSeat=closest&&closest.d<2&&Math.abs(p.y-closest.s.position[1])<1?closest.s:null;
  if(nextSeat?.id!==nearbySeat.current?.id){nearbySeat.current=nextSeat;setSeatHint(nextSeat);}
  const swingDistance=Math.min(Math.hypot(p.x-16.5,p.z-11.6),Math.hypot(p.x-23.5,p.z-11.6));
  const canSit=swingDistance<3.5&&p.y<2.3;
  if(canSit!==swingNearbyRef.current){swingNearbyRef.current=canSit;setSwingNearby(canSit);}
  const n=Math.hypot(p.x,p.z+24)<10&&p.y<3;if(n!==near.current){near.current=n;onNear(n)}
  if(state.clock.elapsedTime-report.current>.2){report.current=state.clock.elapsedTime;network.send({type:'move',position:[p.x,p.y,p.z],yaw:avatar.current.rotation.y,mode:mode.current});onPosition({x:p.x,y:p.y,z:p.z})}
  if(!overview){const o=orbit.current,target=position.clone().add(new THREE.Vector3(0,1.43,0)),offset=new THREE.Vector3(Math.sin(o.yaw)*Math.cos(o.pitch),Math.sin(o.pitch),Math.cos(o.yaw)*Math.cos(o.pitch));const hit=world.castRay(new rapier.Ray(target,offset),o.distance+.2,true,undefined,undefined,capsule.current,body.current);const d=hit?Math.max(.24,hit.timeOfImpact-.22):o.distance,desired=target.clone().addScaledVector(offset,d);if(hit&&camera.position.distanceTo(target)>d+.25)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-12*Math.min(delta,.05)));camera.lookAt(target);avatar.current.visible=d>2.1;}else avatar.current.visible=true;
  if(localPair)avatar.current.visible=false;
 });
 const swingNear=swingNearby;
 return <>{!overview&&!paused&&!menu&&seatHint&&mode.current==='stand'&&<Html position={[seatHint.position[0],1.65,seatHint.position[2]]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><div style={{background:'rgba(32,41,36,.92)',color:'white',padding:'9px 15px',borderRadius:8}}>F · Ngồi {seatHint.label}</div></Html>}{!overview&&!paused&&!menu&&!seatHint&&swingNear&&mode.current==='stand'&&<Html position={[body.current&&Math.abs(body.current.translation().x-16.5)<Math.abs(body.current.translation().x-23.5)?16.5:23.5,1.81,11.6]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><div style={{background:'rgba(32,41,36,.92)',color:'white',padding:'9px 15px',borderRadius:8,fontSize:15,boxShadow:'0 3px 12px #0003'}}>F · Ngồi vào xích đu</div></Html>}<Html fullscreen style={{pointerEvents:menu?'auto':'none'}}>{menu&&<div style={{position:'absolute',bottom:120,left:'50%',transform:'translateX(-50%)',background:'#fff9ed',padding:20,borderRadius:14,display:'flex',gap:10,flexWrap:'wrap',color:'#263e37'}}><strong>Đang ngồi · Chọn tư thế</strong>{[['normal','Ngồi ngay ngắn'],['relaxed','Ngồi thư giãn'],['stretch','Duỗi chân'],['stand','Đứng lên']].map(([id,label])=><button key={id} onClick={()=>choose(id)}>{label}</button>)}<button onClick={()=>setMenu(false)}>Đóng</button></div>}</Html>
 <RigidBody ref={body} type="kinematicPosition" colliders={false} position={data.spawn} enabledRotations={[false,false,false]}><CapsuleCollider ref={capsule} args={[CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS]}/>{localPair&&<CoupleBody player={localPair}/>}<group ref={avatar} position={[0,-.83,0]}>
 <mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[.25,.36,6,12]}/><meshStandardMaterial color="#edf2ef"/></mesh>
 <mesh castShadow position={[0,1.67,0]}><sphereGeometry args={[.225,20,16]}/><meshStandardMaterial color="#dcad88"/></mesh>
 <mesh castShadow position={[0,1.79,-.025]}><sphereGeometry args={[.23,20,12,0,Math.PI*2,0,Math.PI*.58]}/><meshStandardMaterial color="#232b32"/></mesh>
 {[-1,1].map(s=><group key={s}><mesh position={[s*.078,1.69,.204]}><sphereGeometry args={[.022,8,8]}/><meshStandardMaterial color="#253039"/></mesh><group name="thigh" position={[s*.14,.82,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[.105,.18,5,12]}/><meshStandardMaterial color="#2c4059"/></mesh><group name="shin" position={[0,-.36,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[.09,.18,5,12]}/><meshStandardMaterial color="#2c4059"/></mesh><mesh position={[0,-.37,.07]}><boxGeometry args={[.21,.13,.34]}/><meshStandardMaterial color="#263039"/></mesh></group></group><mesh position={[s*.32,1.12,0]}><capsuleGeometry args={[.085,.39,5,10]}/><meshStandardMaterial color="#edf2ef"/></mesh><mesh position={[s*.32,.84,0]}><sphereGeometry args={[.083,10,10]}/><meshStandardMaterial color="#dcad88"/></mesh></group>)}
 <mesh position={[0,1.29,.24]}><boxGeometry args={[.055,.27,.025]}/><meshStandardMaterial color="#285775"/></mesh><mesh position={[0,1.17,-.25]}><capsuleGeometry args={[.18,.2,5,12]}/><meshStandardMaterial color="#58766e"/></mesh>
 </group></RigidBody></>;
}
export const World=memo(function World(props){const json=useLoader(THREE.FileLoader,`/models/campus-data.json?v=${MODEL_VERSION}`),data=useMemo(()=>JSON.parse(json),[json]);const {scene}=useGLTF(`/models/an-duong-school.glb?v=${MODEL_VERSION}`);useEffect(()=>{scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});props.onData(data)},[scene,data]);return <><Multiplayer/><GateLED/><primitive object={scene}/><Physics gravity={[0,-16,0]} timeStep={1/60} interpolate><RigidBody type="fixed" colliders={false}>{data.colliders.map((c,i)=><CuboidCollider key={i} args={c.halfExtents} position={c.position} quaternion={c.quaternion}/>)}</RigidBody><Player {...props} data={data}/></Physics>{props.overview&&<OrbitControls target={[14,1,0]} minDistance={15} maxDistance={200} maxPolarAngle={Math.PI/2-.035}/>}</>});

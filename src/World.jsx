import {Multiplayer,network,CoupleBody,SCREEN_HUD} from './multiplayer';
import {modeCode} from './protocol';
import {DANCES,dancePose,applyDance,randomDance,STAGE_DANCE,stageMoveOf} from './dances';
import {STAGE_SLOTS,STAGE_CAPACITY,onStage,nearestFreeSlot,localStage} from './stageSlots';
import {beatNow,bpmNow} from './eventAudio';
import {inDJZone} from './live';
import React,{useRef,useMemo,useEffect,useState,memo} from 'react';
import {useFrame,useLoader,useThree} from '@react-three/fiber';
import {useGLTF,OrbitControls,Html} from '@react-three/drei';
import {Physics,RigidBody,CuboidCollider,CapsuleCollider,useRapier,useBeforePhysicsStep} from '@react-three/rapier';
import * as THREE from 'three';
import {NightEvents,CAMPFIRE_SEATS} from './NightEvents';
import {TeachersDayStage} from './TeachersDayStage';
import {CourtyardLamps,useLitClassrooms} from './NightLights';
import {createController,moveCharacter,CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS} from './character-controller';
export const MODEL_VERSION='gate-house-centered-stairs-38';
function GateLED(){
 const material=useRef();
 const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,2048,128);ctx.fillStyle='#ff4933';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 66px Arial';ctx.fillText('CHÀO MỪNG NGÀY NHÀ GIÁO VIỆT NAM 20/11',1024,64,1990);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;},[]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 useFrame(({clock})=>{if(material.current)material.current.opacity=.28+.72*(.5+.5*Math.sin(clock.elapsedTime*Math.PI));});
 return <mesh position={[0,4.35,48.965]}><planeGeometry args={[8.8,.5]}/><meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false}/></mesh>;
}
// Góc xoay đùi/cẳng chân (radian) cho từng tư thế. Ngồi đất: co gối để bàn chân chạm đất, duỗi chân thì chân nằm sát đất.
const SIT_POSES={
 seat:{normal:{thigh:-Math.PI/2,shin:Math.PI/2},relaxed:{thigh:-Math.PI/2,shin:Math.PI/2},stretch:{thigh:-Math.PI/2,shin:.35}},
 ground:{normal:{thigh:-2.2,shin:1.4},relaxed:{thigh:-2.0,shin:1.1},stretch:{thigh:-1.62,shin:.05}}
};
const MOVE_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
function Player({data,overview,paused,destination,onPosition,onNear,event}){
 const body=useRef(),capsule=useRef(),avatar=useRef(),keys=useRef({}),motion=useRef({vertical:0,jumpHeld:false});
 const [localPair,setLocalPair]=useState(null);
 const nearbySeat=useRef(null);const [seatHint,setSeatHint]=useState(null);
 // Nhạc hội DJ: đang đứng trong vùng tham gia? đang nhảy điệu nào (0 = không)?
 const djZone=useRef(false),[djHint,setDjHint]=useState(false),dance=useRef(0),[danceUi,setDanceUi]=useState(0),danceW=useRef(0),danceSince=useRef(0),baseYaw=useRef(0),lastDance=useRef(1),dPose=useMemo(()=>({}),[]);
 function startDance(id){if(!dance.current)baseYaw.current=avatar.current.rotation.y;dance.current=id;lastDance.current=id;setDanceUi(id);danceSince.current=performance.now();keys.current={};}
 function stopDance(){if(!dance.current)return;dance.current=0;setDanceUi(0);avatar.current.rotation.y=baseYaw.current;}
 // Múa trên sân khấu: vị trí đang giữ (0..9) hoặc null; số ô đã có người
 const stageMoveRef=useRef(''),performSlot=useRef(null),stageZone=useRef(false),[stageHint,setStageHint]=useState(false),[stageUi,setStageUi]=useState(null),[stageCount,setStageCount]=useState(0),[stageMove,setStageMove]=useState('');
 function startPerform(slot,[x,y,z]){
  stopDance();anchor.current={x,y,z};exit.current={x,y,z};performSlot.current=slot;localStage.slot=slot;setStageUi(slot);
  body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);
  avatar.current.rotation.y=0;startDance(STAGE_DANCE); // quay mặt về phía khán giả rồi bắt đầu múa
 }
 useEffect(()=>{const count=()=>setStageCount([...network.meta.values()].filter(m=>m.stage!=null&&m.stage!==undefined).length);count();window.addEventListener('school-stage',count);return()=>window.removeEventListener('school-stage',count);},[]);
 const mode=useRef('stand'),anchor=useRef(null),exit=useRef(null),blend=useRef(0),groundSit=useRef(false),walk=useRef(0),report=useRef(0),near=useRef(false);
 const [menu,setMenu]=useState(false),[pose,setPose]=useState('normal'),[swingNearby,setSwingNearby]=useState(false);const swingNearbyRef=useRef(false);const orbit=useRef({yaw:0,pitch:.22,distance:5.8,drag:false});
 const {world,rapier}=useRapier(),{camera,gl}=useThree();const controller=useRef();
 const position=useMemo(()=>new THREE.Vector3(),[]),direction=useMemo(()=>new THREE.Vector3(),[]);
 function choose(value){
  stopDance();
  if(performSlot.current!=null){performSlot.current=null;localStage.slot=null;setStageUi(null);} // rời vị trí múa (server nhận 'leave' và trả ô)
  if(value!=='swing')network.send({type:'stop'});
  if(value==='stand')network.send({type:'leave'});
  if(value==='swing'){
   const p=body.current.translation(),swing=Math.abs(p.x-16.5)<Math.abs(p.x-23.5)?0:1;
   if(network.id&&network.socket?.readyState===1){network.sendMove(p.x,p.y,p.z,avatar.current.rotation.y,0,true);network.send({type:'sit',swing});setMenu(false);return;}
   const x=[16.5,23.5][swing]-.43;exit.current={x,y:1.14,z:13.1};anchor.current={x,y:1.32,z:11.6};mode.current='normal';setPose('normal');body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=0;setMenu(true);return;
  }
  if(value==='stand'&&anchor.current&&exit.current){body.current.setTranslation(exit.current,true);body.current.setNextKinematicTranslation(exit.current);}
  if(value==='stand')anchor.current=null;mode.current=value;if(value!=='stand')setPose(value==='bench'?'normal':value);
  if(value==='bench'&&nearbySeat.current){const s=nearbySeat.current;exit.current={x:s.exit[0],y:s.exit[1],z:s.exit[2]};anchor.current={x:s.position[0],y:s.position[1],z:s.position[2]};body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=s.yaw;}
  setMenu(false);keys.current={};
 }
 useEffect(()=>{const handler=e=>{const m=e.detail;
  if(m.type==='performing')startPerform(m.slot,m.position);
  if(m.type==='seated'){const [x,y,z]=m.position;exit.current={x,y:1.14,z:13.1};anchor.current={x,y,z};mode.current='normal';setPose('normal');body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=0;setMenu(true);}
  // Tư thế đôi của chính mình (nắm tay / tựa đầu…) do server xác nhận
  if(m.type==='meta'||m.type==='welcome'){const me=network.meta.get(network.id);setLocalPair(me?.action?{...me,mode:'normal'}:null);}
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
    if(performSlot.current!=null)choose('stand'); // đang múa trên sân khấu: F để rời
    else if(dance.current)startDance(randomDance(dance.current)); // đang nhảy ở sàn: F đổi sang điệu khác
    else if(mode.current!=='stand')choose('stand');
    else if(nearbySeat.current){choose('bench');setMenu(true);}
    else if(stageZone.current){ // trên sân khấu: xin server một vị trí múa
     const p=body.current.translation();
     if(network.id&&network.socket?.readyState===1){network.sendMove(p.x,p.y,p.z,avatar.current.rotation.y,0,true);network.send({type:'perform'});}
     else{const taken=new Set([...network.meta.values()].filter(m=>m.stage!=null).map(m=>m.stage)),k=nearestFreeSlot([p.x,p.y,p.z],taken);if(k>=0)startPerform(k,STAGE_SLOTS[k]);} // chơi một mình (mất mạng)
    }
    else if(djZone.current)startDance(randomDance()); // trong vùng nhạc hội: F tham gia, chọn ngẫu nhiên 1 trong 3 điệu
    else if(swingNearbyRef.current){choose('swing');}
    else if(controller.current?.computedGrounded()){choose('normal');setMenu(true);}
    return;
   }
   // Đang ngồi mà nhấn phím di chuyển → tự đứng lên rồi đi luôn, không cần nhấn F
   if(!e.repeat&&!overview&&!paused&&mode.current!=='stand'&&MOVE_KEYS.includes(e.code))choose('stand');
   if(MOVE_KEYS.includes(e.code)){if(performSlot.current!=null)choose('stand');else if(dance.current)stopDance();} // đang múa/nhảy mà bấm di chuyển → dừng
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
  // Ngồi trên ghế/xích đu (có anchor) hay ngồi bệt xuống đất (không có anchor) — nhớ lại để lúc đứng dậy vẫn nội suy đúng
  if(mode.current!=='stand')groundSit.current=!anchor.current;
  const ground=groundSit.current,sitPose=SIT_POSES[ground?'ground':'seat'][mode.current]??SIT_POSES[ground?'ground':'seat'].normal;
  // Ngồi đất: hạ hông xuống sát mặt đất (mông chạm đất); ngồi ghế: hạ vừa bằng mặt ghế
  avatar.current.position.y=-.83-(ground?.72:.38)*blend.current;
  if(walk.current){const a=Math.atan2(direction.x,direction.z);avatar.current.rotation.y+=(THREE.MathUtils.euclideanModulo(a-avatar.current.rotation.y+Math.PI,Math.PI*2)-Math.PI)*(1-Math.exp(-16*delta));}
  avatar.current.traverse(o=>{if(o.name==='thigh'){o.rotation.x=sitPose.thigh*blend.current+(walk.current?Math.sin(state.clock.elapsedTime*walk.current*2.6)*(o.position.x<0?-.4:.4):0)*(1-blend.current);o.rotation.z=(mode.current==='relaxed'?(o.position.x<0?-.22:.22):0)*blend.current;}if(o.name==='shin')o.rotation.x=sitPose.shin*blend.current;});
  // Nhảy theo nhịp nhạc (tay, chân, nhún, xoay người); chuyển mượt khi bắt đầu/dừng
  danceW.current=THREE.MathUtils.damp(danceW.current,dance.current?1:0,8,delta);
  if(dance.current||danceW.current>.001){
   const b=beatNow();
   // tự đổi điệu sau 16 nhịp (theo tempo bài đang phát; ~7,7 s ở 124 BPM) — đếm theo đồng hồ thật vì đồng hồ nhịp có thể nhảy khi trình duyệt bật âm thanh
   if(dance.current&&dance.current!==STAGE_DANCE&&performance.now()-danceSince.current>=16*60000/bpmNow())startDance(randomDance(dance.current));
   dancePose(dance.current||lastDance.current,b,dPose);const w=danceW.current;
   applyDance(avatar.current,dPose,w);
   if(dance.current===STAGE_DANCE){const mv=stageMoveOf(b);if(mv!==stageMoveRef.current){stageMoveRef.current=mv;setStageMove(mv);}}
   avatar.current.position.y+=dPose.y*w;avatar.current.position.x=dPose.sway*w;avatar.current.rotation.z=dPose.roll*w;avatar.current.rotation.x=dPose.pitch*w;
   if(dance.current)avatar.current.rotation.y=baseYaw.current+dPose.yaw;
  }else{avatar.current.position.x=0;avatar.current.rotation.z=0;avatar.current.rotation.x=0;}
  avatar.current.getWorldPosition(position);const p=body.current.translation();
  const closest=(data.seats??[]).map(s=>({s,d:Math.hypot(p.x-s.position[0],p.z-s.position[2])})).sort((a,b)=>a.d-b.d)[0];
  const nextSeat=closest&&closest.d<2&&Math.abs(p.y-closest.s.position[1])<1?closest.s:null;
  if(nextSeat?.id!==nearbySeat.current?.id){nearbySeat.current=nextSeat;setSeatHint(nextSeat);}
  const swingDistance=Math.min(Math.hypot(p.x-16.5,p.z-11.6),Math.hypot(p.x-23.5,p.z-11.6));
  const canSit=swingDistance<3.5&&p.y<2.3;
  if(canSit!==swingNearbyRef.current){swingNearbyRef.current=canSit;setSwingNearby(canSit);}
  const n=Math.hypot(p.x,p.z+24)<10&&p.y<3;if(n!==near.current){near.current=n;onNear(n)}
  const st=onStage(p.x,p.y,p.z);if(st!==stageZone.current){stageZone.current=st;setStageHint(st);}
  const inZone=event==='dj'&&inDJZone(p.x,p.y,p.z);if(inZone!==djZone.current){djZone.current=inZone;setDjHint(inZone);}
  if(dance.current&&event!=='dj')stopDance(); // nhạc hội kết thúc → dừng nhảy
  // Gửi vị trí: network.sendMove tự gộp (tối đa 10 lần/giây, chỉ khi thay đổi)
  network.sendMove(p.x,p.y,p.z,dance.current?baseYaw.current:avatar.current.rotation.y,modeCode(mode.current,groundSit.current,dance.current));
  if(state.clock.elapsedTime-report.current>.2){report.current=state.clock.elapsedTime;onPosition({x:p.x,y:p.y,z:p.z})}
  if(!overview){const o=orbit.current,target=position.clone().add(new THREE.Vector3(0,1.43,0)),offset=new THREE.Vector3(Math.sin(o.yaw)*Math.cos(o.pitch),Math.sin(o.pitch),Math.cos(o.yaw)*Math.cos(o.pitch));const hit=world.castRay(new rapier.Ray(target,offset),o.distance+.2,true,undefined,undefined,capsule.current,body.current);const d=hit?Math.max(.24,hit.timeOfImpact-.22):o.distance,desired=target.clone().addScaledVector(offset,d);if(hit&&camera.position.distanceTo(target)>d+.25)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-12*Math.min(delta,.05)));camera.lookAt(target);avatar.current.visible=d>2.1;}else avatar.current.visible=true;
  if(localPair)avatar.current.visible=false;
 });
 const swingNear=swingNearby;
 return <>{!overview&&!paused&&!menu&&seatHint&&mode.current==='stand'&&<Html position={[seatHint.position[0],1.65,seatHint.position[2]]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><div style={{background:'rgba(32,41,36,.92)',color:'white',padding:'9px 15px',borderRadius:8}}>F · Ngồi {seatHint.label}</div></Html>}{!overview&&!paused&&!menu&&!seatHint&&swingNear&&mode.current==='stand'&&<Html position={[body.current&&Math.abs(body.current.translation().x-16.5)<Math.abs(body.current.translation().x-23.5)?16.5:23.5,1.81,11.6]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><div style={{background:'rgba(32,41,36,.92)',color:'white',padding:'9px 15px',borderRadius:8,fontSize:15,boxShadow:'0 3px 12px #0003'}}>F · Ngồi vào xích đu</div></Html>}<Html {...SCREEN_HUD} style={{pointerEvents:menu?'auto':'none'}}>{!overview&&!paused&&!menu&&(stageUi!=null?<div className="dance-hud dancing stage"><span aria-hidden="true">💃</span><b>Đang múa · vị trí {stageUi+1}/{STAGE_CAPACITY}</b><small>Động tác: {stageMove} · <kbd>F</kbd> hoặc di chuyển để rời</small></div>:stageHint&&mode.current==='stand'&&!seatHint?<div className="dance-hud stage">{stageCount>=STAGE_CAPACITY?<><span aria-hidden="true">🚫</span><b>Cả {STAGE_CAPACITY} vị trí đã có người chơi</b><small>Đợi có người rời đi nhé</small></>:<><kbd>F</kbd><b>Tham gia múa</b><small>thay chỗ một vũ công · {stageCount}/{STAGE_CAPACITY} vị trí đã có người chơi</small></>}</div>:danceUi?<div className="dance-hud dancing"><span className="dance-eq" aria-hidden="true"><i/><i/><i/><i/></span><b>Đang quẩy: {DANCES[danceUi].name}</b><small><kbd>F</kbd> đổi điệu · di chuyển để dừng</small></div>:djHint&&mode.current==='stand'&&!seatHint&&<div className="dance-hud"><kbd>F</kbd><b>Tham gia nhạc hội</b><small>3 điệu quẩy ngẫu nhiên</small></div>)}{menu&&<div className="pose-bar" role="toolbar" aria-label="Chọn tư thế ngồi"><span className="pose-title">Tư thế</span>{[['normal','Ngay ngắn'],['relaxed','Thư giãn'],['stretch','Duỗi chân']].map(([id,label])=><button key={id} className={pose===id?'active':''} onClick={()=>choose(id)}>{label}</button>)}<button className="pose-stand" onClick={()=>choose('stand')}>Đứng lên <kbd>F</kbd></button><button className="pose-close" onClick={()=>setMenu(false)} aria-label="Đóng">×</button></div>}</Html>
 <RigidBody ref={body} type="kinematicPosition" colliders={false} position={data.spawn} enabledRotations={[false,false,false]}><CapsuleCollider ref={capsule} args={[CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS]}/>{localPair&&<CoupleBody player={localPair}/>}<group ref={avatar} position={[0,-.83,0]}>
 <mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[.25,.36,6,12]}/><meshStandardMaterial color="#edf2ef"/></mesh>
 <mesh castShadow position={[0,1.67,0]}><sphereGeometry args={[.225,20,16]}/><meshStandardMaterial color="#dcad88"/></mesh>
 <mesh castShadow position={[0,1.79,-.025]}><sphereGeometry args={[.23,20,12,0,Math.PI*2,0,Math.PI*.58]}/><meshStandardMaterial color="#232b32"/></mesh>
 {[-1,1].map(s=><group key={s}><mesh position={[s*.078,1.69,.204]}><sphereGeometry args={[.022,8,8]}/><meshStandardMaterial color="#253039"/></mesh><group name="thigh" position={[s*.14,.82,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[.105,.18,5,12]}/><meshStandardMaterial color="#2c4059"/></mesh><group name="shin" position={[0,-.36,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[.09,.18,5,12]}/><meshStandardMaterial color="#2c4059"/></mesh><mesh position={[0,-.37,.07]}><boxGeometry args={[.21,.13,.34]}/><meshStandardMaterial color="#263039"/></mesh></group></group><group name="arm" position={[s*.32,1.36,0]}><mesh position={[0,-.24,0]}><capsuleGeometry args={[.085,.39,5,10]}/><meshStandardMaterial color="#edf2ef"/></mesh><mesh position={[0,-.52,0]}><sphereGeometry args={[.083,10,10]}/><meshStandardMaterial color="#dcad88"/></mesh></group></group>)}
 <mesh position={[0,1.29,.24]}><boxGeometry args={[.055,.27,.025]}/><meshStandardMaterial color="#285775"/></mesh><mesh position={[0,1.17,-.25]}><capsuleGeometry args={[.18,.2,5,12]}/><meshStandardMaterial color="#58766e"/></mesh>
 </group></RigidBody></>;
}
export const World=memo(function World(props){const json=useLoader(THREE.FileLoader,`${import.meta.env.BASE_URL}models/campus-data.json?v=${MODEL_VERSION}`),data=useMemo(()=>JSON.parse(json),[json]);const {scene}=useGLTF(`${import.meta.env.BASE_URL}models/an-duong-school.glb?v=${MODEL_VERSION}`);useEffect(()=>{scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});props.onData(data)},[scene,data]);
 useLitClassrooms(scene,data.rooms); // ban đêm: ngẫu nhiên khoảng một nửa số lớp bật đèn
 // Lửa trại thêm các khúc gỗ vào danh sách chỗ ngồi (nhấn F để ngồi)
 const playerData=useMemo(()=>props.event==='campfire'?{...data,seats:[...(data.seats??[]),...CAMPFIRE_SEATS]}:data,[data,props.event]);
 return <><Multiplayer/><GateLED/><primitive object={scene}/><Physics gravity={[0,-16,0]} timeStep={1/60} interpolate><RigidBody type="fixed" colliders={false}>{data.colliders.map((c,i)=><CuboidCollider key={i} args={c.halfExtents} position={c.position} quaternion={c.quaternion}/>)}</RigidBody><TeachersDayStage/><CourtyardLamps/><NightEvents event={props.event}/><Player {...props} data={playerData}/></Physics>{props.overview&&<OrbitControls target={[14,1,0]} minDistance={15} maxDistance={200} maxPolarAngle={Math.PI/2-.035}/>}</>});

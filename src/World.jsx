import {WHEELIE_FLAG,wheelieTransform} from './bikeWheelie.js';
import {Nameplate,NameplatesVisible} from './Nameplate';
import {rearSeat} from './bikePassenger.js';
import {localPlayer} from './localPlayer';
import {BikeActions} from './BikeActions';
import {classroomLayout} from './classroomLayout';
import {ClassroomBoards} from './ClassroomBoards';
import {mainGateBikeZone} from './transport';
import {currentHour} from './DayCycle';
import {stageDancersVisible} from './stageSchedule';
import {Multiplayer,network,CoupleBody,SCREEN_HUD} from './multiplayer';
import {modeCode} from './protocol';
import {DANCES,dancePose,applyDance,randomDance,STAGE_DANCE,stageMoveOf,shouldStopForEvent} from './dances';
import {STAGE_SLOTS,STAGE_CAPACITY,STAGES,stageAt,stageOf,slotYaw,nearestFreeSlot,localStage} from './stageSlots';
import {beatNow,bpmNow} from './eventAudio';
import {inDJZone} from './live';
import {RIDE,RIDE_SPEED,nearestBay,setBay} from './bikes';
import {ParkedBikes,RidingBike,bikeColorOf} from './EBikes';
import React,{useRef,useMemo,useEffect,useState,memo} from 'react';
import {useFrame,useLoader,useThree} from '@react-three/fiber';
import {useGLTF,OrbitControls,Html} from '@react-three/drei';
import {Physics,RigidBody,CuboidCollider,CapsuleCollider,useRapier,useBeforePhysicsStep} from '@react-three/rapier';
import * as THREE from 'three';
import {NightEvents,CAMPFIRE_SEATS} from './NightEvents';
import {TeachersDayStage} from './TeachersDayStage';
import {CourtyardLamps,ParkingLights,useLitClassrooms} from './NightLights';
import {WallMurals} from './Murals';
import {ParkingGuard} from './ParkingGuard';
import {PhotoRoom} from './PhotoRoom';
import {PondFish} from './PondFish';
import {LightPool} from './lightPool';
import {Clouds} from './Clouds';
import {StreetLights} from './StreetLights';
import {GateGreeters} from './GateGreeters';
import {FlowerPots} from './FlowerPots';
import {GateBoard} from './GateBoard';
import {getRole} from './role';
import {HallStage,HALL_SEATS} from './HallStage';
import {Shops,SHOP_SEATS} from './Shops';
import {Canteen} from './Canteen';
import {setLocalPlayer} from './localPlayer';
import {AvatarBody} from './Avatar';
import {touch} from './device';
import {useProfile,lookCode} from './profile';
import {createController,moveCharacter,CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS} from './character-controller';
export const MODEL_VERSION='open-ground-corner-95';
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
 const myProfile=useProfile(),myLook=lookCode(myProfile),autoWalk=useRef(0),snapCam=useRef(true); // snapCam: vừa dịch chuyển → đặt camera thẳng sau lưng, không bay // autoWalk: thời điểm dừng tự đi (vừa vào trường từ cổng)
 const [localPair,setLocalPair]=useState(null);
 const nearbySeat=useRef(null),seatKey=useRef(''),lastSeatScan=useRef(0),seatFound=useRef(null);const [seatHint,setSeatHint]=useState(null);
 // Nhạc hội DJ: đang đứng trong vùng tham gia? đang nhảy điệu nào (0 = không)?
 const djZone=useRef(false),[djHint,setDjHint]=useState(false),dance=useRef(0),[danceUi,setDanceUi]=useState(0),danceW=useRef(0),danceSince=useRef(0),baseYaw=useRef(0),lastDance=useRef(1),dPose=useMemo(()=>({}),[]);
 function startDance(id){if(!dance.current)baseYaw.current=avatar.current.rotation.y;dance.current=id;lastDance.current=id;setDanceUi(id);danceSince.current=performance.now();keys.current={};}
 function stopDance(){if(!dance.current)return;dance.current=0;setDanceUi(0);avatar.current.rotation.y=baseYaw.current;}
 // Múa trên sân khấu: vị trí đang giữ (0..9) hoặc null; số ô đã có người
 // sân bóng rổ: đứng ở vùng vạch ném phạt của 1 trong 2 rổ (bảng rổ ở z 17.5 và z 38.5, x 17.7) → F mở mini-game ném bóng
 const courtNear=useRef(false),[courtHint,setCourtHint]=useState(false);
 const stageWhichRef=useRef(-1),stageMoveRef=useRef(''),performSlot=useRef(null),stageZone=useRef(false),[stageHint,setStageHint]=useState(false),[stageUi,setStageUi]=useState(null),[stageTaken,setStageTaken]=useState([]),[stageWhich,setStageWhich]=useState(-1),[stageMove,setStageMove]=useState('');
 function startPerform(slot,[x,y,z]){
  stopDance();anchor.current={x,y,z};exit.current={x,y,z};performSlot.current=slot;localStage.slot=slot;setStageUi(slot);
  body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);
  avatar.current.rotation.y=slotYaw(slot);startDance(STAGE_DANCE); // quay mặt về phía khán giả (ngoài sân +z, nhà đa năng -z) rồi bắt đầu múa
 }
 useEffect(()=>{const count=()=>setStageTaken([...network.meta.values()].filter(m=>m.stage!=null&&m.stage!==undefined).map(m=>m.stage));count();window.addEventListener('school-stage',count);return()=>window.removeEventListener('school-stage',count);},[]);
 const mode=useRef('stand'),anchor=useRef(null),exit=useRef(null),blend=useRef(0),groundSit=useRef(false),walk=useRef(0),report=useRef(0),near=useRef(false);
 const [menu,setMenu]=useState(false),[pose,setPose]=useState('normal'),[swingNearby,setSwingNearby]=useState(false);const swingNearbyRef=useRef(false);const orbit=useRef({yaw:0,pitch:.22,distance:5.8,drag:false});
 const {world,rapier}=useRapier(),{camera,gl}=useThree();const controller=useRef();
 const renderedRoot=useMemo(()=>new THREE.Vector3(),[]),position=useMemo(()=>new THREE.Vector3(),[]),direction=useMemo(()=>new THREE.Vector3(),[]);
 const cameraVectors=useMemo(()=>({target:new THREE.Vector3(),offset:new THREE.Vector3(),desired:new THREE.Vector3(),h:null,d:null}),[]);
 // Xe đạp điện: đang đạp xe nào (null = đi bộ), ô xe ở gần (để lấy / đỗ)
 const [gateWarning,setGateWarning]=useState(false),[gateFade,setGateFade]=useState(false);const gateTimer=useRef(null),gateWarned=useRef(false);
 useEffect(()=>()=>clearTimeout(gateTimer.current),[]);
 const wheelie=useRef(false),wheelieBlend=useRef(0),wheeliePose=useRef({});
 const passengerDriver=useRef(null),passengerTarget=useRef(null);
 const riding=useRef(null),[rideUi,setRideUi]=useState(null),bikeNear=useRef(null),[bikeHint,setBikeHint]=useState(null),rideW=useRef(0),pedal=useRef(0),rPose=useMemo(()=>({}),[]),lastBikeCheck=useRef(0);
 function startRide(bay){
  stopDance();setBay(bay.id,false);riding.current={from:bay.id,color:bikeColorOf(bay.id)};setRideUi(riding.current);
  const p=body.current.translation(),pos={x:bay.x,y:p.y,z:bay.z};body.current.setTranslation(pos,true);body.current.setNextKinematicTranslation(pos);avatar.current.rotation.y=bay.yaw;keys.current={};
 }
 function parkRide(bay){
  setBay(bay.id,true);riding.current=null;setRideUi(null);
  // bước ra lối đi phía trước ô vừa đỗ để không đứng đè lên xe
  const p=body.current.translation(),pos={x:bay.x+Math.sin(bay.yaw)*1.5,y:p.y,z:bay.z+Math.cos(bay.yaw)*1.5};body.current.setTranslation(pos,true);body.current.setNextKinematicTranslation(pos);keys.current={};
 }
 function choose(value){
  // báo ra ngoài đang ngồi ghế nào (VD ghế phòng tin học → hiện nút chơi game trên máy tính); null = không ngồi ghế
  window.dispatchEvent(new CustomEvent('seat-change',{detail:value==='bench'&&nearbySeat.current?nearbySeat.current.id:null}));
  if(riding.current){if(riding.current.from)setBay(riding.current.from,true);riding.current=null;setRideUi(null);} // bị dịch chuyển / về sân khi đang đạp xe → trả xe về ô cũ
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
  if(m.type==='bike-mounted'){passengerDriver.current=m.driver;keys.current={};walk.current=0;stopDance();mode.current='normal';setMenu(false);capsule.current?.setSensor(true);}
  if(m.type==='bike-follow'){const [x,y,z]=m.position;passengerTarget.current={x,y,z,yaw:m.yaw};}
  if(m.type==='bike-exit'||m.type==='disconnected'&&passengerDriver.current){passengerDriver.current=null;passengerTarget.current=null;capsule.current?.setSensor(false);if(anchor.current){anchor.current=null;mode.current='stand';const p=body.current.translation();const pos={x:p.x+1,y:p.y,z:p.z};body.current.setTranslation(pos,true);body.current.setNextKinematicTranslation(pos);}}
  if(m.type==='performing'){if(stageZone.current)startPerform(m.slot,m.position);else network.send({type:'leave'});}
  if(m.type==='seated'){const [x,y,z]=m.position;exit.current={x,y:1.14,z:13.1};anchor.current={x,y,z};mode.current='normal';setPose('normal');body.current.setTranslation(anchor.current,true);body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=0;setMenu(true);}
  // Tư thế đôi của chính mình (nắm tay / tựa đầu…) do server xác nhận
  if(m.type==='meta'||m.type==='welcome'){const me=network.meta.get(network.id);setLocalPair(me?.action?{...me,mode:'normal',initiator:me.actionFrom===network.id}:null);}
  if(m.type==='disconnected'&&anchor.current)choose('stand');
 };window.addEventListener('school-network',handler);return()=>window.removeEventListener('school-network',handler)},[]);
 useEffect(()=>{controller.current=createController(world);return()=>world.removeCharacterController(controller.current)},[world]);
 useEffect(()=>{if(destination&&body.current){snapCam.current=true;choose('stand');if(avatar.current)avatar.current.rotation.y=Math.PI+(destination.yaw??0); // quay mặt cùng hướng camera nhìn (vào trường), camera sau lưng
const [x,y,z]=destination.position;body.current.setTranslation({x,y,z},true);body.current.setNextKinematicTranslation({x,y,z});motion.current.vertical=0;if(destination.transport==='bike'){riding.current={from:null,color:'#286b70'};setRideUi(riding.current);}orbit.current.yaw=destination.yaw??0;autoWalk.current=destination.autoWalk?performance.now()+destination.autoWalk*1000:0;}},[destination]);
 useEffect(()=>{if(overview){camera.position.set(100,85,112);camera.lookAt(14,0,0)}},[overview]);
 useEffect(()=>{
  const down=e=>{
   if(e.target?.closest?.('input,textarea,select'))return;
   if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
   if(riding.current&&!overview&&!paused&&e.code==='KeyA'&&e.ctrlKey){e.preventDefault();if(!e.repeat)wheelie.current=!wheelie.current;delete keys.current.KeyA;return;}
   if(e.code==='KeyF'&&!e.repeat&&!overview&&!paused){
    e.preventDefault();
    if(passengerDriver.current){network.send({type:'bike-dismount'});return;}
    if(riding.current){if(bikeNear.current)parkRide(bikeNear.current);return;} // đang đạp xe: F đỗ vào ô trống gần nhất
    if(performSlot.current!=null)choose('stand'); // đang múa trên sân khấu: F để rời
    else if(dance.current)startDance(randomDance(dance.current)); // đang nhảy ở sàn: F đổi sang điệu khác
    else if(mode.current!=='stand')choose('stand');
    else if(bikeNear.current){startRide(bikeNear.current);} // cạnh ô có xe đạp điện: F lấy xe
    else if(nearbySeat.current){const lab=nearbySeat.current.id?.startsWith('lab-');choose('bench');setMenu(!lab);} // ghế phòng tin học: không hiện bảng chọn tư thế (chỉ có nút chơi game)
    else if(courtNear.current){keys.current={};window.dispatchEvent(new CustomEvent('open-basketball',{detail:courtNear.current}));}
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
   if(!passengerDriver.current&&!e.repeat&&!overview&&!paused&&mode.current!=='stand'&&MOVE_KEYS.includes(e.code))choose('stand');
   if(MOVE_KEYS.includes(e.code)){if(performSlot.current!=null)choose('stand');else if(dance.current)stopDance();} // đang múa/nhảy mà bấm di chuyển → dừng
   if(MOVE_KEYS.includes(e.code))autoWalk.current=0; // người chơi tự điều khiển → thôi tự đi
   keys.current[e.code]=true;
  };
  const up=e=>keys.current[e.code]=false,clear=()=>keys.current={};
  // xoay camera: tính độ lệch từ vị trí con trỏ trước (chạy cả với ngón tay trên điện thoại — movementX không có trên cảm ứng)
  const start=e=>{if(!overview){orbit.current.drag=true;orbit.current.lx=e.clientX;orbit.current.ly=e.clientY;gl.domElement.setPointerCapture(e.pointerId)}},stop=()=>orbit.current.drag=false;
  const move=e=>{if(orbit.current.drag&&!overview&&!paused){const dx=e.clientX-orbit.current.lx,dy=e.clientY-orbit.current.ly;orbit.current.lx=e.clientX;orbit.current.ly=e.clientY;orbit.current.yaw-=dx*.005;orbit.current.pitch=THREE.MathUtils.clamp(orbit.current.pitch+dy*.004,-.15,1.05)}};
  const wheel=e=>{if(!overview)orbit.current.distance=THREE.MathUtils.clamp(orbit.current.distance+e.deltaY*.006,1.4,10)};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
  const el=gl.domElement;el.addEventListener('pointerdown',start);el.addEventListener('pointerup',stop);el.addEventListener('pointermove',move);el.addEventListener('wheel',wheel);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);el.removeEventListener('pointerdown',start);el.removeEventListener('pointerup',stop);el.removeEventListener('pointermove',move);el.removeEventListener('wheel',wheel)};
 },[overview,paused,menu,gl]);
 useBeforePhysicsStep(()=>{
  if(!body.current||!controller.current)return;
  if(passengerDriver.current){
   const d=network.remotes.get(passengerDriver.current),target=d?{...rearSeat(d),yaw:d.yaw}:passengerTarget.current;
   if(target){anchor.current={x:target.x,y:target.y,z:target.z};body.current.setNextKinematicTranslation(anchor.current);avatar.current.rotation.y=target.yaw;}
   walk.current=0;return;
  }
  if(anchor.current&&!keys.current.KeyR){body.current.setNextKinematicTranslation(anchor.current);walk.current=0;return;}
  const k=autoWalk.current>performance.now()?{...keys.current,KeyW:true}:keys.current,active=!overview&&!paused&&!menu&&!gateFade&&mode.current==='stand';
  const tc=active&&touch.active; // điện thoại: cần điều khiển ảo (đẩy hết cỡ hoặc bật nút chạy = chạy)
  direction.set(tc?touch.x:active?(+!!(k.KeyD||k.ArrowRight)-+!!(k.KeyA||k.ArrowLeft)):0,0,tc?touch.y:active?(+!!(k.KeyS||k.ArrowDown)-+!!(k.KeyW||k.ArrowUp)):0).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP,orbit.current.yaw);
  const speed=riding.current?RIDE_SPEED:k.ShiftLeft||k.ShiftRight||(tc&&(touch.run||Math.hypot(touch.x,touch.y)>.95))?6:3.5;walk.current=direction.lengthSq()?speed:0;
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
  // Đạp xe: ngồi trên yên, chân đạp theo tốc độ, tay cầm ghi đông
  rideW.current=THREE.MathUtils.damp(rideW.current,riding.current?1:0,10,delta);
  if(rideW.current>.001){if(walk.current)pedal.current+=delta*1.6;dancePose(RIDE,pedal.current,rPose);applyDance(avatar.current,rPose,rideW.current);}
  if(!riding.current)wheelie.current=false;
  wheelieBlend.current=THREE.MathUtils.damp(wheelieBlend.current,riding.current&&wheelie.current&&walk.current&&!paused&&!overview?1:0,7,Math.min(delta,.05));
  const wp=wheelieTransform(wheelieBlend.current,wheeliePose.current);
  avatar.current.rotation.x+=wp.pitch;avatar.current.position.y+=wp.y;avatar.current.position.z=wp.z;
  // Use the driver's rendered pose for the seat and camera; physics follows separately.
  avatar.current.parent.getWorldPosition(renderedRoot);
  if(passengerDriver.current){
   const d=network.remotes.get(passengerDriver.current),target=d?{...rearSeat(d),yaw:d.yaw}:passengerTarget.current;
   if(target){avatar.current.position.x=target.x-renderedRoot.x;avatar.current.position.z=target.z-renderedRoot.z;avatar.current.position.y+=target.y-renderedRoot.y;avatar.current.rotation.y=target.yaw;renderedRoot.set(target.x,target.y,target.z);}
  }
  avatar.current.getWorldPosition(position);const p=body.current.translation();localPlayer.yaw=avatar.current.rotation.y;
  if(riding.current&&!gateFade){
   const atMain=mainGateBikeZone(p.x,p.z);
   if(atMain&&!gateWarned.current){gateWarned.current=true;setGateWarning(true);}
   if(atMain&&gateWarned.current&&p.z<47){
    setGateFade(true);keys.current={};gateTimer.current=setTimeout(()=>{
     const pos={x:49,y:1,z:49.3};body.current.setTranslation(pos,true);body.current.setNextKinematicTranslation(pos);motion.current.vertical=0;setGateWarning(false);gateWarned.current=false;
     gateTimer.current=setTimeout(()=>setGateFade(false),450);
    },650);
   }
   if(!atMain&&p.z>53){gateWarned.current=false;setGateWarning(false);}
  }else if(!riding.current&&gateWarning){setGateWarning(false);gateWarned.current=false;}
setLocalPlayer(renderedRoot.x,renderedRoot.y,renderedRoot.z);
  // chỗ ngồi gần nhất: quét 8 lần/giây (danh sách có ~250 chỗ: ghế đá, ghế nhà đa năng, quán xôi, lửa trại…)
  let nextSeat=seatFound.current;
  if(state.clock.elapsedTime-lastSeatScan.current>.125){lastSeatScan.current=state.clock.elapsedTime;let best=null,bd=4;
   for(const s of data.seats??[]){const dx=p.x-s.position[0],dz=p.z-s.position[2],d=dx*dx+dz*dz;if(d<bd&&Math.abs(p.y-s.position[1])<1){bd=d;best=s;}}
   nextSeat=seatFound.current=best;}
  // ghế teacher:true (bàn thầy cô trong nhà đa năng) chỉ nhân vật Thầy cô ngồi được; học sinh chỉ thấy lời nhắc
  const blockedSeat=!!(nextSeat?.teacher&&getRole()!=='teacher'),key=nextSeat?nextSeat.id+(blockedSeat?'!':''):'';
  if(key!==seatKey.current){seatKey.current=key;nearbySeat.current=blockedSeat?null:nextSeat;setSeatHint(nextSeat?{...nextSeat,blocked:blockedSeat}:null);}
  // rổ gần căng tin (z 34.2) → ném bóng 45 giây; rổ gần xích đu (z 21.8) → Chạm rổ
  const cn=p.y<2.2&&Math.abs(p.x-17.7)<4.2?(Math.abs(p.z-34.2)<3.2?'shoot':Math.abs(p.z-21.8)<3.2?'flap':false):false;if(cn!==courtNear.current){courtNear.current=cn;setCourtHint(cn);}
  const swingDistance=Math.min(Math.hypot(p.x-16.5,p.z-11.6),Math.hypot(p.x-23.5,p.z-11.6));
  const canSit=swingDistance<3.5&&p.y<2.3;
  if(canSit!==swingNearbyRef.current){swingNearbyRef.current=canSit;setSwingNearby(canSit);}
  const n=Math.hypot(p.x,p.z+24)<10&&p.y<3;if(n!==near.current){near.current=n;onNear(n)}
  // ô xe gần nhất: đang đạp → tìm ô trống để đỗ; đi bộ → tìm ô có xe để lấy (5 lần/giây)
  if(state.clock.elapsedTime-lastBikeCheck.current>.2){lastBikeCheck.current=state.clock.elapsedTime;
   const bay=mode.current==='stand'&&performSlot.current==null?nearestBay(p.x,p.y,p.z,!riding.current):null;
   if(bay?.id!==bikeNear.current?.id){bikeNear.current=bay;setBikeHint(bay);}}
  const stageAvailable=stageDancersVisible(currentHour(),event);
  if(!stageAvailable&&performSlot.current!=null)choose('stand');
  const which=stageAvailable?stageAt(p.x,p.y,p.z):-1,st=which>=0;if(st!==stageZone.current){stageZone.current=st;setStageHint(st);}if(which!==stageWhichRef.current){stageWhichRef.current=which;setStageWhich(which);}
  const inZone=event==='dj'&&inDJZone(p.x,p.y,p.z);if(inZone!==djZone.current){djZone.current=inZone;setDjHint(inZone);}
  if(shouldStopForEvent(dance.current,event))stopDance(); // nhạc hội kết thúc → dừng nhảy
  // Gửi vị trí: network.sendMove tự gộp (tối đa 10 lần/giây, chỉ khi thay đổi)
  if(destination&&!passengerDriver.current)network.sendMove(p.x,p.y,p.z,dance.current?baseYaw.current:avatar.current.rotation.y,(modeCode(mode.current,groundSit.current,riding.current?RIDE:dance.current)|(riding.current&&wheelie.current&&walk.current&&!paused&&!overview?WHEELIE_FLAG:0)));
  if(state.clock.elapsedTime-report.current>.2){report.current=state.clock.elapsedTime;onPosition({x:p.x,y:p.y,z:p.z})}
  if(!overview){const o=orbit.current,cv=cameraVectors,cdt=Math.min(delta,.05),snap=snapCam.current||cv.h==null;
   // Camera ổn định trên cầu thang:
   //  1. độ cao bám theo nhân vật được làm mượt — mỗi bậc thang nâng nhân vật 15 cm một nấc, camera trượt đều theo chứ không nảy;
   //  2. khoảng cách tới nhân vật làm mượt — gặp vật cản lại gần nhanh (không xuyên tường), lùi ra chậm (không giật khi tia vừa chạm vừa thoát bậc thang);
   //  3. tia dò vật cản bỏ qua thanh mảnh (tay vịn, lan can, song chắn < 14 cm) — chỉ tường / sàn / trần mới đẩy camera lại gần.
   if(snap||Math.abs(position.y-cv.h)>3)cv.h=position.y;else cv.h+=(position.y-cv.h)*(1-Math.exp(-7*cdt));
   const target=cv.target.set(position.x,cv.h+1.43,position.z),offset=cv.offset.set(Math.sin(o.yaw)*Math.cos(o.pitch),Math.sin(o.pitch),Math.cos(o.yaw)*Math.cos(o.pitch));
   const hit=world.castRay(new rapier.Ray(target,offset),o.distance+.2,true,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,capsule.current,body.current,cameraBlocks);
   const want=hit?Math.max(.24,hit.timeOfImpact-.22):o.distance;
   if(snap||cv.d==null)cv.d=want;else cv.d+=(want-cv.d)*(1-Math.exp(-(want<cv.d?22:3.5)*cdt));
   const desired=cv.desired.copy(target).addScaledVector(offset,cv.d);
   if(snap){camera.position.copy(desired);snapCam.current=false;}else camera.position.lerp(desired,1-Math.exp(-16*cdt));
   camera.lookAt(target);avatar.current.visible=cv.d>2.1;}else avatar.current.visible=true;
  if(localPair)avatar.current.visible=false;
 },-.5);
 const swingNear=swingNearby;
 const stageCountHere=stageTaken.filter(k=>stageOf(k)===(stageUi!=null?stageOf(stageUi):stageWhich)).length;
 return <><BikeActions riding={!!rideUi}/><Html {...SCREEN_HUD} style={{pointerEvents:'none'}}>{gateFade&&<div style={{position:'absolute',inset:0,background:'#000',zIndex:9999}}/>}{gateWarning&&!gateFade&&<div style={{position:'absolute',bottom:160,left:'50%',transform:'translateX(-50%)',background:'#fff6de',padding:20,borderRadius:12,color:'#513b22'}}>Bảo vệ: Em đi xe hãy vào cổng phụ nhé! Tiếp tục đi vào sẽ được đưa về cổng phụ.</div>}</Html>{!overview&&!paused&&!menu&&seatHint&&mode.current==='stand'&&<Html position={[seatHint.position[0],seatHint.position[1]+.75,seatHint.position[2]]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><div className="seat-hint" style={{background:'rgba(32,41,36,.92)',color:'white',padding:'9px 15px',borderRadius:8}}>{seatHint.blocked?'Chỗ ngồi dành cho thầy cô':<>F · Ngồi {seatHint.label}</>}</div></Html>}{!overview&&!paused&&!menu&&!seatHint&&swingNear&&mode.current==='stand'&&<Html position={[body.current&&Math.abs(body.current.translation().x-16.5)<Math.abs(body.current.translation().x-23.5)?16.5:23.5,1.81,11.6]} center style={{pointerEvents:'none',whiteSpace:'nowrap'}}><div className="seat-hint" style={{background:'rgba(32,41,36,.92)',color:'white',padding:'9px 15px',borderRadius:8,fontSize:15,boxShadow:'0 3px 12px #0003'}}>F · Ngồi vào xích đu</div></Html>}<Html {...SCREEN_HUD} style={{pointerEvents:'none'}}>{!overview&&!paused&&!menu&&(rideUi?<div className="dance-hud ride"><span aria-hidden="true">🚲</span><b>Đang đi xe đạp điện</b><small>{bikeHint?<><kbd>F</kbd> đỗ xe vào ô này</>:'Tới ô trống trong nhà xe hoặc hai bên các quán để đỗ'}</small></div>:bikeHint&&mode.current==='stand'?<div className="dance-hud ride"><kbd>F</kbd><b>Lấy xe đạp điện</b><small>đi ra cổng phụ rồi quay lại, nhấn F ở ô trống để đỗ</small></div>:stageUi!=null?<div className="dance-hud dancing stage"><span aria-hidden="true">💃</span><b>Đang múa · vị trí {stageUi-STAGES[stageOf(stageUi)].from+1}/{STAGE_CAPACITY}</b><small>Động tác: {stageMove} · <kbd>F</kbd> hoặc di chuyển để rời</small></div>:stageHint&&mode.current==='stand'&&!seatHint?<div className="dance-hud stage">{stageCountHere>=STAGE_CAPACITY?<><span aria-hidden="true">🚫</span><b>Cả {STAGE_CAPACITY} vị trí đã có người chơi</b><small>Đợi có người rời đi nhé</small></>:<><kbd>F</kbd><b>Tham gia múa</b><small>thay chỗ một vũ công · {stageCountHere}/{STAGE_CAPACITY} vị trí đã có người chơi</small></>}</div>:danceUi?<div className="dance-hud dancing"><span className="dance-eq" aria-hidden="true"><i/><i/><i/><i/></span><b>Đang quẩy: {DANCES[danceUi].name}</b><small><kbd>F</kbd> đổi điệu · di chuyển để dừng</small></div>:courtHint&&mode.current==='stand'&&!seatHint?<div className="dance-hud court" style={{pointerEvents:'auto',cursor:'pointer'}} onClick={()=>window.dispatchEvent(new CustomEvent('open-basketball',{detail:courtHint}))}><span aria-hidden="true">🏀</span><kbd>F</kbd><b>{courtHint==='flap'?'Chơi Chạm rổ':'Chơi ném bóng rổ'}</b><small>{courtHint==='flap'?'chạm để bóng bay vào rổ · bảng xếp hạng trong ngày':'45 giây tính điểm · bảng xếp hạng trong ngày'}</small></div>:djHint&&mode.current==='stand'&&!seatHint&&<div className="dance-hud"><kbd>F</kbd><b>Tham gia nhạc hội</b><small>3 điệu quẩy ngẫu nhiên</small></div>)}{menu&&<div className="pose-bar" style={{pointerEvents:'auto'}} role="toolbar" aria-label="Chọn tư thế ngồi"><span className="pose-title">Tư thế</span>{[['normal','Ngay ngắn'],['relaxed','Thư giãn'],['stretch','Duỗi chân']].map(([id,label])=><button key={id} className={pose===id?'active':''} onClick={()=>choose(id)}>{label}</button>)}<button className="pose-stand" onClick={()=>choose('stand')}>Đứng lên <kbd>F</kbd></button><button className="pose-close" onClick={()=>setMenu(false)} aria-label="Đóng">×</button></div>}</Html>
 <RigidBody ref={body} type="kinematicPosition" colliders={false} position={data.spawn} enabledRotations={[false,false,false]}><CapsuleCollider ref={capsule} args={[CHARACTER_HALF_HEIGHT,CHARACTER_RADIUS]}/>{localPair&&<><CoupleBody player={{...localPair,look:myLook}}/>{destination&&!overview&&<Nameplate profile={myProfile} height={.97}/>}</>}<group ref={avatar} position={[0,-.83,0]}>{rideUi&&<RidingBike color={rideUi.color}/>}<AvatarBody look={myLook}/>{!localPair&&destination&&!overview&&<Nameplate profile={myProfile}/>}
 </group></RigidBody></>;
}
// ~2 500 khối va chạm đứng yên của trường: mỗi CuboidCollider tạo 1 vật thể three.js ẩn → trước đây bị tính lại ma trận MỖI khung hình
// (updateMatrixWorld ~1 s CPU / 15 s). Sau khi thư viện vật lý đã tạo xong va chạm (đọc vị trí 1 lần), tắt cập nhật ma trận cho cả nhóm.
function StaticColliders({colliders}){
 const g=useRef();
 useEffect(()=>{let id=requestAnimationFrame(()=>{id=requestAnimationFrame(()=>{if(g.current){g.current.matrixAutoUpdate=false;g.current.matrixWorldAutoUpdate=false;}});});return()=>cancelAnimationFrame(id);},[colliders]);
 return <group ref={g}>{colliders.map((c,i)=><CuboidCollider key={i} args={c.halfExtents} position={c.position} quaternion={c.quaternion}/>)}</group>;
}
// Tia dò vật cản của camera chỉ tính khối dày (tường, sàn, trần…): bỏ qua tay vịn / lan can / song chắn mảnh (cạnh nhỏ nhất < 14 cm),
// nếu không camera giật vào sát lưng mỗi khi tia lướt qua thanh vịn cầu thang.
function cameraBlocks(collider){const h=collider.halfExtents?.();return !h||Math.min(h.x,h.y,h.z)>=.07;}
export const World=memo(function World(props){const [boardEditing,setBoardEditing]=useState(false);const json=useLoader(THREE.FileLoader,`${import.meta.env.BASE_URL}models/campus-data.json?v=${MODEL_VERSION}`),data=useMemo(()=>JSON.parse(json),[json]);const {scene}=useGLTF(`${import.meta.env.BASE_URL}models/an-duong-school.glb?v=${MODEL_VERSION}`);useEffect(()=>{scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
  // kính trong suốt (3 dãy chính): không ghi chiều sâu để các ô kính phía sau vẫn thấy được; không đổ bóng
  if(o.material?.name==='glass'){o.material.transparent=true;o.material.depthWrite=false;o.material.side=THREE.DoubleSide;o.material.forceSinglePass=true;/* kính phẳng: vẽ 1 lượt — mặc định three.js vẽ 2 lượt và đặt needsUpdate mỗi lần vẽ → tìm lại shader hàng trăm lần / khung */o.castShadow=false;o.renderOrder=1;}}});props.onData(data)},[scene,data]);
 useLitClassrooms(scene,data.rooms); // ban đêm: ngẫu nhiên khoảng một nửa số lớp bật đèn
 // Lửa trại thêm các khúc gỗ vào danh sách chỗ ngồi (nhấn F để ngồi)
 const classroom=useMemo(()=>classroomLayout(data.rooms??[]),[data]);
 const playerData=useMemo(()=>({...data,seats:[...(data.seats??[]),...classroom.seats,...HALL_SEATS,...SHOP_SEATS,...(props.event==='campfire'?CAMPFIRE_SEATS:[])]}),[data,props.event,classroom]);
 return <NameplatesVisible.Provider value={!props.paused&&!props.overview}><Multiplayer/><GateLED/><primitive object={scene}/><Physics gravity={[0,-16,0]} timeStep={1/60} updatePriority={-1} interpolate><RigidBody type="fixed" colliders={false}><StaticColliders colliders={data.colliders}/></RigidBody><TeachersDayStage event={props.event}/><LightPool/><CourtyardLamps/><ParkingLights/><StreetLights/><WallMurals/><ParkedBikes/><ParkingGuard/><GateGreeters/><FlowerPots/><GateBoard/><HallStage event={props.event}/><Shops/><Canteen/><PhotoRoom/><PondFish/><Clouds/><NightEvents event={props.event}/><ClassroomBoards boards={classroom.boards} paused={props.paused||props.overview} onEditing={setBoardEditing}/><Player {...props} paused={props.paused||boardEditing} data={playerData}/></Physics>{props.overview&&<OrbitControls target={[14,1,0]} minDistance={15} maxDistance={200} maxPolarAngle={Math.PI/2-.035}/>}</NameplatesVisible.Provider>});

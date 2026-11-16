import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {encodeMove,decodeSnapshot,yawOf,modeName,GROUND_FLAG,danceOf} from './protocol';
import {dancePose,applyDance} from './dances';
import {beatNow} from './eventAudio';

// ---------------- Trạng thái mạng dùng chung ----------------
// Vị trí người khác cập nhật thẳng vào network.remotes (không qua React) để 500+ người không gây render lại liên tục.
export const network={
 id:null,socket:null,config:null,chat:[],
 remotes:new Map(), // id → {x,y,z,yaw (đang vẽ), tx,ty,tz,tyaw (mục tiêu), mode}
 meta:new Map(),    // id → {seat, action}  (ngồi xích đu / tương tác đôi)
 lastMove:null,
 get online(){return this.remotes.size+(this.id?1:0);},
 get players(){return {length:this.online};}, // tương thích code cũ
 send(m){if(this.socket?.readyState===1){this.socket.send(JSON.stringify(m));return true;}return false;},
 // Gửi vị trí của mình: tối đa 10 lần/giây và chỉ khi có thay đổi
 sendMove(x,y,z,yaw,code,force=false){
  if(this.socket?.readyState!==1)return false;
  const now=performance.now(),l=this.lastMove;
  const changed=!l||Math.abs(l.x-x)>.02||Math.abs(l.y-y)>.02||Math.abs(l.z-z)>.02||Math.abs(l.yaw-yaw)>.03||l.code!==code;
  if(!force&&(!changed||(l&&now-l.at<100)))return false; // lần gửi đầu (l còn rỗng) luôn được gửi
  this.socket.send(encodeMove(x,y,z,yaw,code));this.lastMove={x,y,z,yaw,code,at:now};return true;
 },
};
// Lớp giao diện phủ toàn màn hình: luôn ghim giữa canvas, không bị ẩn khi gốc toạ độ (0,0,0) nằm sau camera
export const SCREEN_HUD={fullscreen:true,calculatePosition:(_o,_c,size)=>[size.width/2,size.height/2],onOcclude:()=>{}};

// Cấu hình sự kiện & tin nhắn trò chuyện từ server — lưu vào network để giao diện đọc (xem live.js)
function applyLive(m){
 if(m.type==='config'){network.config=m.config;return true;}
 if(m.type==='chat-history'){network.chat=m.messages??[];return true;}
 if(m.type==='chat'){network.chat=[...network.chat,m.message].slice(-150);return true;}
 if(m.type==='chat-delete'){network.chat=network.chat.filter(c=>c.id!==m.id);return true;}
 if(m.type==='chat-clear'){network.chat=[];return true;}
 return m.type==='chat-error';
}
// meta: ngồi xích đu (seat), tương tác đôi (action), vị trí múa trên sân khấu (stage: 0..9)
function setMeta(list){for(const x of list??[]){if(x.seat||x.action||x.stage!=null)network.meta.set(x.id,{seat:x.seat,action:x.action,stage:x.stage??null});else network.meta.delete(x.id);}window.dispatchEvent(new CustomEvent('school-stage'));}
function onSnapshot(buffer){
 decodeSnapshot(new DataView(buffer),(id,x,y,z,yq,mode)=>{
  if(id===network.id)return;
  const yaw=yawOf(yq);let r=network.remotes.get(id);
  if(!r){r={id,x,y,z,yaw,tx:x,ty:y,tz:z,tyaw:yaw,mode};network.remotes.set(id,r);}
  // nhảy xa (dịch chuyển, vào chỗ ngồi) → đặt thẳng, không trượt xuyên tường
  if(Math.abs(r.tx-x)+Math.abs(r.tz-z)>6){r.x=x;r.y=y;r.z=z;}
  r.tx=x;r.ty=y;r.tz=z;r.tyaw=yaw;r.mode=mode;
 });
}

export function Multiplayer(){
 const [,setVersion]=useState(0),[invite,setInvite]=useState(null),[notice,setNotice]=useState(null);
 useEffect(()=>{
  let retry,timer,closed=false,attempt=0;
  const bump=()=>setVersion(v=>v+1);
  function connect(){
   const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/multiplayer`);ws.binaryType='arraybuffer';network.socket=ws;let full=false;
   ws.onopen=()=>{attempt=0;network.lastMove=null;};
   ws.onmessage=e=>{
    if(typeof e.data!=='string'){onSnapshot(e.data);return;}
    const m=JSON.parse(e.data);
    if(m.type==='welcome'){network.id=m.id;network.remotes.clear();network.meta.clear();setMeta(m.meta);bump();}
    if(m.type==='full'){full=true;setNotice(m.message);}
    if(m.type==='gone'){for(const id of m.ids){network.remotes.delete(id);network.meta.delete(id);}bump();}
    if(m.type==='meta'){setMeta(m.list);bump();}
    if(m.type==='invite'){setInvite(m);clearTimeout(timer);timer=setTimeout(()=>setInvite(null),20000);}
    if(m.type==='notice'||m.type==='error'||m.type==='stage-full'){setNotice(m.message);setTimeout(()=>setNotice(null),4000);}
    if(applyLive(m))window.dispatchEvent(new CustomEvent('school-live',{detail:m}));
    window.dispatchEvent(new CustomEvent('school-network',{detail:m}));
   };
   ws.onclose=()=>{
    network.id=null;network.remotes.clear();network.meta.clear();setInvite(null);bump();
    window.dispatchEvent(new CustomEvent('school-network',{detail:{type:'disconnected'}}));
    // Kết nối lại với độ trễ tăng dần + ngẫu nhiên để 500 người không cùng ập vào một lúc khi server khởi động lại
    if(closed)return;const base=full?30000:Math.min(30000,1000*2**attempt++);retry=setTimeout(connect,base*(.5+Math.random()));
   };
  }
  connect();
  return()=>{closed=true;clearTimeout(retry);clearTimeout(timer);network.socket?.close()};
 },[]);
 const me=network.meta.get(network.id);
 const other=me?.seat&&[...network.meta].find(([id,x])=>id!==network.id&&x.seat?.swing===me.seat.swing);
 const labels={hand:'Nắm tay',lean:'Tựa đầu',kiss:'Hôn nhẹ'};
 const show=(me?.seat&&other)||me?.action||invite||notice;
 return <><Crowd/><Html {...SCREEN_HUD} style={{pointerEvents:'none'}}>{show&&<div style={{position:'absolute',right:20,bottom:20,background:'#fff9ed',padding:12,borderRadius:12,color:'#263e37',pointerEvents:'auto',maxWidth:330}}>{notice&&<p style={{margin:'0 0 6px',fontSize:13}}>{notice}</p>}{me?.seat&&other&&<div>{Object.entries(labels).map(([action,label])=><button key={action} disabled={!!me.action} onClick={()=>network.send({type:'invite',action})}>{label}</button>)}</div>}{me?.action&&<button onClick={()=>network.send({type:'stop'})}>Dừng tương tác</button>}{invite&&<div><p>Người bên cạnh mời: {labels[invite.action]}. Bạn đồng ý?</p><button onClick={()=>{network.send({type:'respond',id:invite.id,accept:true});setInvite(null)}}>Đồng ý</button><button onClick={()=>{network.send({type:'respond',id:invite.id,accept:false});setInvite(null)}}>Từ chối</button></div>}</div>}</Html></>;
}

// ---------------- Vẽ đám đông ----------------
// 3 mức chi tiết:
//  - Gần (tối đa DETAIL_MAX người gần camera nhất, hoặc đang tương tác đôi): nhân vật đầy đủ, có tư thế đôi.
//  - Vừa (< FAR_DIST): 1 InstancedMesh cho người đứng + 1 cho người ngồi — mỗi loại chỉ 1 lệnh vẽ cho mọi người.
//  - Xa: hình khối đơn giản, 1 lệnh vẽ, không đổ bóng.
const CAP=1100,DETAIL_MAX=16,DETAIL_DIST=26,FAR_DIST=55;
const COLORS={shirt:'#edf2ef',skin:'#dcad88',hair:'#232b32',pants:'#2c4059'};
function part(geo,color,x,y,z,rx=0){
 if(rx)geo.rotateX(rx);geo.translate(x,y,z);
 const c=new THREE.Color(color),n=geo.attributes.position.count,arr=new Float32Array(n*3);for(let i=0;i<n;i++){arr[i*3]=c.r;arr[i*3+1]=c.g;arr[i*3+2]=c.b;}
 geo.setAttribute('color',new THREE.BufferAttribute(arr,3));
 for(const k of Object.keys(geo.attributes))if(!['position','normal','color'].includes(k))geo.deleteAttribute(k);
 return geo;
}
// Hình nhân vật gộp thành 1 khối (gốc toạ độ ở bàn chân), khớp với CoupleBody
function avatarGeometry(sitting){
 const parts=[part(new THREE.CapsuleGeometry(.25,.36,3,10),COLORS.shirt,0,1.15,0),part(new THREE.SphereGeometry(.225,10,8),COLORS.skin,0,1.67,0),part(new THREE.SphereGeometry(.23,10,6,0,Math.PI*2,0,Math.PI*.58),COLORS.hair,0,1.79,-.025)];
 for(const s of [-1,1]){
  parts.push(part(new THREE.CapsuleGeometry(.075,.4,2,6),COLORS.skin,s*.32,1.04,0));
  if(sitting)parts.push(part(new THREE.CapsuleGeometry(.1,.18,2,6),COLORS.pants,s*.14,.8,.18,Math.PI/2),part(new THREE.CapsuleGeometry(.09,.25,2,6),COLORS.pants,s*.14,.62,.36));
  else parts.push(part(new THREE.CapsuleGeometry(.1,.18,2,6),COLORS.pants,s*.14,.62,0),part(new THREE.CapsuleGeometry(.09,.25,2,6),COLORS.pants,s*.14,.44,0));
 }
 return mergeGeometries(parts);
}
function farGeometry(){return mergeGeometries([part(new THREE.CylinderGeometry(.24,.2,1.25,6),COLORS.shirt,0,.95,0),part(new THREE.SphereGeometry(.23,6,4),COLORS.skin,0,1.7,0),part(new THREE.CylinderGeometry(.2,.2,.5,5),COLORS.pants,0,.25,0)]);}
const yOffset=mode=>(mode&3)===0?-.83:mode&GROUND_FLAG?-1.55:-1.21;

function Crowd(){
 const {camera}=useThree();
 const [detailed,setDetailed]=useState([]);
 const stand=useRef(),sit=useRef(),far=useRef(),detailKey=useRef(''),detailSet=useRef(new Set()),lastPick=useRef(0),ranked=useRef([]);
 const geo=useMemo(()=>({stand:avatarGeometry(false),sit:avatarGeometry(true),far:farGeometry()}),[]);
 const mat=useMemo(()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}),[]);
 useEffect(()=>()=>{geo.stand.dispose();geo.sit.dispose();geo.far.dispose();mat.dispose();},[geo,mat]);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);
 useFrame((state,dt)=>{
  const k=1-Math.exp(-12*Math.min(dt,.1)),cx=camera.position.x,cz=camera.position.z;
  // Nội suy mượt vị trí giữa các gói (10 Hz → 60 FPS), không cấp phát đối tượng mới mỗi khung hình
  for(const r of network.remotes.values()){
   r.x+=(r.tx-r.x)*k;r.y+=(r.ty-r.y)*k;r.z+=(r.tz-r.z)*k;
   r.yaw+=(((r.tyaw-r.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI)*k;
  }
  // 4 lần/giây chọn lại ai được vẽ chi tiết
  if(state.clock.elapsedTime-lastPick.current>.25){
   lastPick.current=state.clock.elapsedTime;const list=ranked.current;list.length=0;let stars=0;
   for(const r of network.remotes.values()){const d2=(r.x-cx)**2+(r.z-cz)**2,m=network.meta.get(r.id);// người đang múa trên sân khấu luôn được vẽ chi tiết (khán giả đứng xa vẫn thấy rõ động tác)
    const star=m?.stage!=null&&d2<90**2;if(d2<DETAIL_DIST**2||(m?.action&&d2<1600)||star)list.push([star?-2:m?.action?-1:d2,r.id]);}
   list.sort((a,b)=>a[0]-b[0]);stars=list.filter(x=>x[0]===-2).length;const ids=list.slice(0,DETAIL_MAX+Math.min(stars,10)).map(x=>x[1]).sort((a,b)=>a-b),key=ids.join(',');
   if(key!==detailKey.current){detailKey.current=key;detailSet.current=new Set(ids);setDetailed(ids);}
  }
  let ns=0,nsit=0,nf=0;const set=detailSet.current;
  for(const r of network.remotes.values()){
   if(set.has(r.id))continue;
   const d2=(r.x-cx)**2+(r.z-cz)**2;
   // người đang nhảy ở xa: nhún + lắc người theo nhịp (rẻ, không cần khớp tay chân)
   const dn=danceOf(r.mode),bb=dn?beatNow()+r.id*.13:0;
   dummy.position.set(r.x,r.y+yOffset(r.mode)-(dn?.07*Math.abs(Math.sin(Math.PI*bb)):0),r.z);dummy.rotation.set(0,r.yaw+(dn?.35*Math.sin(Math.PI*bb/2):0),dn?.06*Math.sin(Math.PI*bb):0);dummy.updateMatrix();
   if(d2>FAR_DIST**2){if(nf<CAP)far.current.setMatrixAt(nf++,dummy.matrix);}
   else if((r.mode&3)===0){if(ns<CAP)stand.current.setMatrixAt(ns++,dummy.matrix);}
   else if(nsit<CAP)sit.current.setMatrixAt(nsit++,dummy.matrix);
  }
  for(const [mesh,n] of [[stand.current,ns],[sit.current,nsit],[far.current,nf]]){mesh.count=n;mesh.instanceMatrix.needsUpdate=true;}
 });
 return <>
  <instancedMesh ref={stand} args={[geo.stand,mat,CAP]} castShadow frustumCulled={false}/>
  <instancedMesh ref={sit} args={[geo.sit,mat,CAP]} castShadow frustumCulled={false}/>
  <instancedMesh ref={far} args={[geo.far,mat,CAP]} frustumCulled={false}/>
  {detailed.map(id=><DetailedAvatar key={id} id={id}/>)}
 </>;
}

// Nhân vật đầy đủ cho người ở gần — đọc vị trí trực tiếp mỗi khung hình, chỉ render lại khi đổi tư thế
function DetailedAvatar({id}){
 const ref=useRef(),[pose,setPose]=useState(null),poseKey=useRef('');
 useFrame(()=>{
  const r=network.remotes.get(id);if(!r||!ref.current)return;
  ref.current.position.set(r.x,r.y,r.z);ref.current.rotation.y=r.yaw;
  const m=network.meta.get(id),key=`${r.mode}|${m?.action??''}|${m?.seat?.slot??''}`;
  if(key!==poseKey.current){poseKey.current=key;setPose({mode:modeName(r.mode),ground:!!(r.mode&GROUND_FLAG),seat:m?.seat,action:m?.action,dance:danceOf(r.mode)});}
 });
 return <group ref={ref}>{pose&&(pose.dance?<DancerBody dance={pose.dance} seed={id}/>:<CoupleBody player={pose}/>)}</group>;
}

// Nhân vật đang nhảy (người chơi khác ở gần): cùng dáng với nhân vật của mình, có khớp vai/đùi/gối để nhảy đúng điệu
function DancerBody({dance,seed}){
 const root=useRef(),pose=useMemo(()=>({}),[]);
 useFrame(()=>{if(!root.current)return;const b=beatNow()+(dance===4?0:seed*.07);dancePose(dance,b,pose);/* múa sân khấu: không lệch nhịp để cả nhóm đồng loạt */applyDance(root.current,pose,1);root.current.position.set(pose.sway,-.83+pose.y,0);root.current.rotation.set(pose.pitch,pose.yaw,pose.roll);});
 return <group ref={root} position={[0,-.83,0]}>
  <mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[.25,.36,6,12]}/><meshStandardMaterial color="#edf2ef"/></mesh>
  <mesh castShadow position={[0,1.67,0]}><sphereGeometry args={[.225,16,12]}/><meshStandardMaterial color="#dcad88"/></mesh>
  <mesh position={[0,1.79,-.025]}><sphereGeometry args={[.23,16,10,0,Math.PI*2,0,Math.PI*.58]}/><meshStandardMaterial color="#232b32"/></mesh>
  {[-1,1].map(s=><group key={s}>
   <group name="thigh" position={[s*.14,.82,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[.1,.18,5,10]}/><meshStandardMaterial color="#2c4059"/></mesh>
    <group name="shin" position={[0,-.36,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[.09,.18,5,10]}/><meshStandardMaterial color="#2c4059"/></mesh><mesh position={[0,-.37,.07]}><boxGeometry args={[.21,.13,.34]}/><meshStandardMaterial color="#263039"/></mesh></group></group>
   <group name="arm" position={[s*.32,1.36,0]}><mesh position={[0,-.24,0]}><capsuleGeometry args={[.085,.39,5,10]}/><meshStandardMaterial color="#edf2ef"/></mesh><mesh position={[0,-.52,0]}><sphereGeometry args={[.083,10,10]}/><meshStandardMaterial color="#dcad88"/></mesh></group>
  </group>)}
 </group>;
}

export function CoupleBody({player:p}){const leaning=p.action==='lean'||p.action==='kiss',side=p.seat?.slot===0?1:-1,standing=p.mode==='stand',ground=!standing&&p.ground;return <group position={[0,standing?-.83:ground?-1.55:-1.21,0]}><group rotation={[0,0,leaning?side*.18:0]}><mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[.25,.36,6,12]}/><meshStandardMaterial color="#edf2ef"/></mesh><group position={[leaning?side*.12:0,1.67,p.action==='kiss'?.12:0]} rotation={[0,p.action==='kiss'?side*1.2:0,leaning?side*.2:0]}><mesh castShadow><sphereGeometry args={[.225,16,12]}/><meshStandardMaterial color="#dcad88"/></mesh><mesh position={[0,.12,-.025]}><sphereGeometry args={[.23,16,10,0,Math.PI*2,0,Math.PI*.58]}/><meshStandardMaterial color="#232b32"/></mesh></group>{[-1,1].map(s=><mesh key={s} position={[s*.32,1.04,p.action==='hand'?.23:0]} rotation={[p.action==='hand'?-.7:0,0,p.action==='hand'&&s===side?s*.9:0]}><capsuleGeometry args={[.075,.4,5,10]}/><meshStandardMaterial color="#dcad88"/></mesh>)}</group>{[-1,1].map(s=><group key={s} position={[s*.14,.8,0]} rotation={[standing?0:-Math.PI/2,0,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[.1,.18,5,10]}/><meshStandardMaterial color="#2c4059"/></mesh><mesh position={standing?[0,-.36,0]:ground?[0,-.5,0]:[0,-.36,-.18]} rotation={[standing||ground?0:Math.PI/2,0,0]}><capsuleGeometry args={[.09,.25,5,10]}/><meshStandardMaterial color="#2c4059"/></mesh></group>)}</group>}

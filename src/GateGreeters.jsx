// Đón học sinh ở cổng trường.
//  - Cổng chính: bác bảo vệ đứng trong trụ cổng phải (luôn có) + 2 bạn Sao đỏ bên trái lối vào.
//  - Cổng phụ: mỗi bên cổng 2 bạn Sao đỏ (cạnh cánh cổng sắt đang mở), tay cầm sổ & bút ghi tên học sinh đi muộn.
// Sao đỏ đứng cổng 6:00 → 8:00 và 13:00 → 13:30. Người chơi đi qua cổng vào trường (vượt vạch cổng theo hướng bắc):
//  - thầy cô: luôn "Kính chào thầy cô và các bạn học sinh tới trường!"
//  - học sinh: trong giờ Sao đỏ đứng cổng được chào; đi muộn (8:00 → 11:30, 13:30 → 17:00) bác bảo vệ (cổng chính) hỏi
//    "Em học sinh lớp nào? Tại sao lại đi muộn?"; ngoài các giờ đó bác vẫn chào bình thường.
import React,{useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {RigidBody,CapsuleCollider} from '@react-three/rapier';
import {Guard} from './ParkingGuard';
import {localPlayer} from './localPlayer';
import {currentHour} from './DayCycle';
import {getRole} from './role';

const SAO_DO=[[6,8],[13,13.5]];               // giờ Sao đỏ đứng cổng
const LATE=[[8,11.5],[13.5,17]];             // giờ học sinh vào cổng bị tính là đi muộn
const inSpan=(h,spans)=>spans.some(([a,b])=>h>=a&&h<b);
const GREET='Kính chào thầy cô và các bạn học sinh tới trường!';
const LATE_LINE='Em học sinh lớp nào? Tại sao lại đi muộn?';
const SHOW_MS=4000;
const turn=(obj,target,k=.08)=>{obj.rotation.y+=(((target-obj.rotation.y+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI)*k;};
const saoDoTime=()=>inSpan(currentHour(),SAO_DO);

// line: vạch cổng (z), cx/half: tâm & nửa bề rộng lối đi; guard: chỗ bác bảo vệ (nếu có); stars: các bạn Sao đỏ
const GATES=[
 {id:'main',line:47.5,cx:0,half:4.6,guard:[3.3,.07,46.4],
  stars:[{p:[-3.25,.07,46.3],girl:true},{p:[-2.3,.07,46.3]}]},
 {id:'side',line:47.5,cx:49,half:2.4,
  stars:[{p:[47.25,.08,46.75],girl:true,book:true},{p:[47.25,.08,45.75],book:true},
         {p:[50.75,.08,46.75],book:true},{p:[50.75,.08,45.75],girl:true,book:true}]},
];

function SaoDo({face,girl,book}){
 const root=useRef(),body=useRef(),pen=useRef(),phase=useRef(Math.random()*6);
 useFrame(s=>{
  const t=s.clock.elapsedTime+phase.current;
  if(body.current)body.current.position.y=Math.sin(t*1.7)*.012;
  if(pen.current)pen.current.rotation.z=.5+Math.sin(t*5)*.25;   // khẽ ghi chép
  if(root.current)turn(root.current,face.current);
 });
 const navy='#22314f',shirt='#f4f6f4',skin='#e0b18c',hair='#1d1715',red='#d3242c',gold='#f6c344';
 return <group ref={root}><group ref={body}>
  {girl
   ?<><mesh castShadow position={[0,.72,0]}><cylinderGeometry args={[.2,.3,.42,16]}/><meshStandardMaterial color={navy}/></mesh>
      {[-1,1].map(s=><mesh key={s} position={[s*.1,.3,0]}><capsuleGeometry args={[.07,.42,5,10]}/><meshStandardMaterial color={skin}/></mesh>)}</>
   :[-1,1].map(s=><mesh key={s} castShadow position={[s*.11,.45,0]}><capsuleGeometry args={[.095,.55,5,10]}/><meshStandardMaterial color={navy}/></mesh>)}
  {[-1,1].map(s=><mesh key={s} position={[s*.11,.05,.05]}><boxGeometry args={[.16,.1,.28]}/><meshStandardMaterial color={girl?'#efefef':'#1b1b1b'}/></mesh>)}
  {/* áo sơ mi trắng; huy hiệu Sao đỏ trước ngực (nền đỏ, sao vàng) */}
  <mesh castShadow position={[0,1.14,0]}><capsuleGeometry args={[.24,.34,6,12]}/><meshStandardMaterial color={shirt}/></mesh>
  <group position={[-.11,1.27,.238]}>
   <mesh><circleGeometry args={[.065,18]}/><meshStandardMaterial color={red} side={2}/></mesh>
   <mesh position={[0,0,.003]}><circleGeometry args={[.036,5]}/><meshStandardMaterial color={gold} emissive={gold} emissiveIntensity={.2}/></mesh>
  </group>
  {/* tay: băng ruy băng đỏ ở bắp tay trái (có 2 dải thả); cầm sổ & bút thì đưa tay ra trước */}
  {[-1,1].map(s=><group key={s} position={[s*.31,1.33,0]} rotation={book?[-.95,0,-s*.32]:[0,0,0]}>
   <mesh castShadow position={[0,-.25,0]}><capsuleGeometry args={[.075,.36,5,10]}/><meshStandardMaterial color={shirt}/></mesh>
   <mesh position={[0,-.53,0]}><sphereGeometry args={[.07,10,8]}/><meshStandardMaterial color={skin}/></mesh>
   {s<0&&<>
    <mesh position={[0,-.18,0]}><cylinderGeometry args={[.088,.088,.11,12]}/><meshStandardMaterial color={red}/></mesh>
    {[-.03,.03].map(d=><mesh key={d} position={[-.085,-.24,d]} rotation={[0,0,d*4]}><boxGeometry args={[.012,.13,.035]}/><meshStandardMaterial color={red}/></mesh>)}
   </>}
  </group>)}
  {book&&<>
   {/* sổ ghi tên (bìa xanh, giấy trắng) ở tay trái, bút ở tay phải */}
   <group position={[-.08,1.01,.47]} rotation={[-.55,.15,0]}>
    <mesh><boxGeometry args={[.26,.025,.2]}/><meshStandardMaterial color="#1d4f9a"/></mesh>
    <mesh position={[0,.015,0]}><boxGeometry args={[.24,.01,.18]}/><meshStandardMaterial color="#f8f6ee"/></mesh>
   </group>
   <group position={[.17,1.05,.47]}><mesh ref={pen} rotation={[0,0,.5]}><cylinderGeometry args={[.009,.009,.15,6]}/><meshStandardMaterial color="#1b1b1b"/></mesh></group>
  </>}
  <mesh castShadow position={[0,1.62,0]}><sphereGeometry args={[.21,18,14]}/><meshStandardMaterial color={skin}/></mesh>
  <mesh position={[0,1.7,-.03]}><sphereGeometry args={[.22,16,10,0,Math.PI*2,0,Math.PI*.55]}/><meshStandardMaterial color={hair}/></mesh>
  {girl&&<mesh position={[0,1.45,-.15]}><boxGeometry args={[.38,.45,.1]}/><meshStandardMaterial color={hair}/></mesh>}
  {[-1,1].map(s=><mesh key={s} position={[s*.07,1.64,.19]}><sphereGeometry args={[.02,8,8]}/><meshStandardMaterial color="#2a1a14"/></mesh>)}
  <mesh position={[0,1.55,.2]}><boxGeometry args={[.1,.022,.02]}/><meshStandardMaterial color="#a0524a"/></mesh>
 </group></group>;
}

function GatePost({gate,stars}){
 const [bubble,setBubble]=useState(null);   // {at:[x,y,z], who:'guard'|'stars', text, late}
 const guardFace=useRef(0),faces=useRef(gate.stars.map(()=>({current:0}))).current;
 const prevZ=useRef(null),armed=useRef(true),timer=useRef(null);
 useFrame(()=>{
  const p=localPlayer;if(!p.ready)return;
  const pz=prevZ.current;prevZ.current=p.z;
  const dx=p.x-gate.cx;
  // vượt vạch cổng theo hướng vào trường (z giảm) trong lối đi → chào / hỏi
  if(armed.current&&pz!=null&&pz>=gate.line&&p.z<gate.line&&Math.abs(dx)<gate.half&&p.y<2){
   armed.current=false;
   const late=getRole()==='student'&&inSpan(currentHour(),LATE);
   let msg=null;
   if(late&&gate.guard)msg={at:gate.guard,who:'guard',text:LATE_LINE,late};          // đi muộn → bác bảo vệ hỏi
   else if(stars&&!late){                                                              // Sao đỏ (nhóm gần người chơi) chào
    const near=gate.stars.filter(s=>Math.sign(s.p[0]-gate.cx)===Math.sign(dx||-1));
    const grp=near.length?near:gate.stars,mx=grp.reduce((a,s)=>a+s.p[0],0)/grp.length,mz=grp.reduce((a,s)=>a+s.p[2],0)/grp.length;
    msg={at:[mx,grp[0].p[1],mz],who:'stars',text:GREET};
   }else if(gate.guard)msg={at:gate.guard,who:'guard',text:GREET};
   if(msg){setBubble(msg);clearTimeout(timer.current);timer.current=setTimeout(()=>setBubble(null),SHOW_MS);}
  }
  if(Math.abs(p.z-gate.line)>4||Math.abs(dx)>gate.half+3.5)armed.current=true;   // đi xa khỏi cổng mới tính lần sau
  const near=Math.hypot(dx,p.z-gate.line)<7;
  if(gate.guard)guardFace.current=near?Math.atan2(p.x-gate.guard[0],p.z-gate.guard[2]):0;
  gate.stars.forEach((s,i)=>{faces[i].current=near?Math.atan2(p.x-s.p[0],p.z-s.p[2]):0;});
 });
 return <group>
  {gate.guard&&<group position={gate.guard}><Guard face={guardFace}/></group>}
  {stars&&gate.stars.map((s,i)=><group key={i} position={s.p}><SaoDo face={faces[i]} girl={s.girl} book={s.book}/></group>)}
  {bubble&&<Html position={[bubble.at[0],bubble.at[1]+(bubble.who==='guard'?2.35:2.25),bubble.at[2]]} center style={{pointerEvents:'none'}}>
   <div className={'guard-bubble'+(bubble.who==='stars'?' saodo':'')+(bubble.late?' late':'')}>{bubble.who==='stars'&&<b>Sao đỏ · </b>}{bubble.text}</div></Html>}
  {gate.guard&&<RigidBody type="fixed" colliders={false}>
   <CapsuleCollider args={[.55,.28]} position={[gate.guard[0],gate.guard[1]+.83,gate.guard[2]]}/>
  </RigidBody>}
  {stars&&<RigidBody type="fixed" colliders={false}>
   {gate.stars.map((s,i)=><CapsuleCollider key={i} args={[.52,.26]} position={[s.p[0],s.p[1]+.8,s.p[2]]}/>)}
  </RigidBody>}
 </group>;
}

export function GateGreeters(){
 const [stars,setStars]=useState(saoDoTime);
 const clock=useRef(0);
 useFrame((_,dt)=>{clock.current+=dt;if(clock.current>1){clock.current=0;const on=saoDoTime();if(on!==stars)setStars(on);}});
 return <>{GATES.map(g=><GatePost key={g.id} gate={g} stars={stars}/>)}</>;
}

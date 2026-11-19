// Nhà đa năng (three.js x 54.6 → 74.4, z 21 → 46.1, sàn y 0.1): sân khấu z 39.65 → 45.15, mặt sàn sân khấu y 1.2.
//  - Trang trí 20/11: băng rôn "TRI ÂN THẦY CÔ" trên màn LED, cổng bóng bay hai bên mép sân khấu nối vòm,
//    bồn hoa dọc mép sân khấu, lẵng hoa chân đứng, dây cờ đuôi nheo, thảm đỏ lối giữa.
//  - Đội múa 10 vũ công áo dài (quay mặt xuống khán giả), cùng giờ với đội múa ngoài sân.
//  - Hàng đầu: 2 bàn đại biểu dài (mỗi bàn 4 ghế) chỉ dành cho thầy cô; phía sau 8 hàng ghế nhựa (160 ghế).
//    Tới gần nhấn F để ngồi, quay lên sân khấu (HALL_SEATS gộp vào danh sách chỗ ngồi; teacher:true = chỉ thầy cô).
import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {RigidBody,CuboidCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NpcDancer,DANCER_LOOKS} from './TeachersDayStage';
import {stageDancersVisible} from './stageSchedule';
import {currentHour} from './DayCycle';
import {useNearVisible} from './useNearVisible';
import {useMergeStatic} from './mergeStatic';
import {useLightSources} from './lightPool';

const FLOOR=.1,STAGE_TOP=1.2,STAGE_X0=56.5,STAGE_X1=71.5,STAGE_FRONT=39.65,STAGE_BACK=45.15,STAGE_CX=64;
const AISLE_X=64.5;                       // lối giữa thẳng cửa sau nhà
const FLOWER_COLORS=['#d61f3c','#ff4d6d','#ff8fab','#ffd23f','#fff4e6','#ff8c42','#c9184a','#f7b7d2'];
const rand=seed=>{let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};};

// ---------- Ghế nhựa ----------
const ROWS=10,PER_SIDE=10,ROW_STEP=1.1,CHAIR_STEP=.62,FRONT_ROW_Z=36.4,FIRST_X=57.6;
const CHAIR_SEAT=.45;                    // mặt ghế cao 0.45 m so với sàn
const chairs=[];
const FIRST_ROW=2;                       // 2 hàng đầu nhường chỗ cho bàn thầy cô
for(let r=FIRST_ROW;r<ROWS;r++)for(let j=0;j<PER_SIDE*2;j++){
 const left=j<PER_SIDE,k=left?j:j-PER_SIDE,x=left?FIRST_X+k*CHAIR_STEP:2*AISLE_X-FIRST_X-(PER_SIDE-1-k)*CHAIR_STEP;
 chairs.push({x,z:FRONT_ROW_Z-r*ROW_STEP,row:r,left});
}
// Bàn đại biểu cho thầy cô: mỗi bên lối giữa 1 bàn dài, 4 ghế phía sau bàn quay lên sân khấu
const TABLE_Z=36.25,TABLE_LEN=4.2,TABLE_DEPTH=.7,TABLE_H=.76,TCHAIR_Z=35.5,TCHAIR_STEP=.95;
const TEACHER_TABLES=[(FIRST_X+FIRST_X+(PER_SIDE-1)*CHAIR_STEP)/2,2*AISLE_X-(FIRST_X+FIRST_X+(PER_SIDE-1)*CHAIR_STEP)/2];
const teacherChairs=TEACHER_TABLES.flatMap(cx=>[-1.5,-.5,.5,1.5].map(k=>({x:cx+k*TCHAIR_STEP,z:TCHAIR_Z})));
export const HALL_SEATS=[
 ...teacherChairs.map((c,i)=>({id:'hall-teacher-'+i,label:'ghế thầy cô',teacher:true,position:[c.x,FLOOR+CHAIR_SEAT+.36,c.z],yaw:0,exit:[c.x,FLOOR+.98,c.z-.62]})),
 ...chairs.map((c,i)=>({id:'hall-chair-'+i,label:'ghế nhựa',position:[c.x,FLOOR+CHAIR_SEAT+.36,c.z],yaw:0,exit:[c.x,FLOOR+.98,c.z+.55]})),
];

function TeacherTables(){
 const mergeRef=useRef();useMergeStatic(mergeRef,'deep');
 return <group ref={mergeRef}>
  {TEACHER_TABLES.map(cx=><group key={cx} position={[cx,FLOOR,TABLE_Z]}>
   {/* mặt bàn + khăn trải đỏ phủ trước, viền vàng; 4 chân */}
   <mesh castShadow receiveShadow position={[0,TABLE_H,0]}><boxGeometry args={[TABLE_LEN,.05,TABLE_DEPTH]}/><meshStandardMaterial color="#b0122a" roughness={.85}/></mesh>
   <mesh castShadow position={[0,TABLE_H/2+.03,TABLE_DEPTH/2+.01]}><boxGeometry args={[TABLE_LEN,TABLE_H-.02,.02]}/><meshStandardMaterial color="#b0122a" roughness={.85}/></mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*(TABLE_LEN/2+.01),TABLE_H/2+.03,0]}><boxGeometry args={[.02,TABLE_H-.02,TABLE_DEPTH]}/><meshStandardMaterial color="#b0122a" roughness={.85}/></mesh>)}
   <mesh position={[0,TABLE_H-.08,TABLE_DEPTH/2+.025]}><boxGeometry args={[TABLE_LEN,.06,.01]}/><meshStandardMaterial color="#f6c344" metalness={.4} roughness={.4}/></mesh>
   {[[-1,-1],[1,-1]].map(([sx,sz],i)=><mesh key={i} position={[sx*(TABLE_LEN/2-.08),TABLE_H/2,sz*(TABLE_DEPTH/2-.06)]}><boxGeometry args={[.05,TABLE_H,.05]}/><meshStandardMaterial color="#5b3a22"/></mesh>)}
   {/* trên bàn: lẵng hoa giữa bàn, chai nước & biển tên trước mỗi chỗ ngồi */}
   <mesh position={[0,TABLE_H+.08,.05]}><cylinderGeometry args={[.16,.11,.13,14]}/><meshStandardMaterial color="#f4efe2"/></mesh>
   {Array.from({length:14},(_,i)=>{const a=i*2.4,d=i<6?.06:.14;return <mesh key={i} position={[Math.cos(a)*d,TABLE_H+.2+(i<6?.05:0),.05+Math.sin(a)*d*.7]}><icosahedronGeometry args={[.055,0]}/><meshStandardMaterial color={FLOWER_COLORS[i%FLOWER_COLORS.length]} flatShading/></mesh>;})}
   {[-1.5,-.5,.5,1.5].map(k=><group key={k} position={[k*TCHAIR_STEP,TABLE_H+.025,-.05]}>
    <mesh position={[.22,.1,0]}><cylinderGeometry args={[.03,.03,.2,8]}/><meshStandardMaterial color="#9fd3f0" transparent opacity={.75}/></mesh>
    <mesh position={[.22,.21,0]}><cylinderGeometry args={[.015,.015,.03,8]}/><meshStandardMaterial color="#1d6fb8"/></mesh>
    <mesh position={[0,.05,.18]} rotation={[-.5,0,0]}><boxGeometry args={[.24,.09,.01]}/><meshStandardMaterial color="#ffffff"/></mesh>
   </group>)}
  </group>)}
  {/* ghế bọc nệm đỏ cho thầy cô (phía sau bàn, quay lên sân khấu) */}
  {teacherChairs.map((c,i)=><group key={i} position={[c.x,FLOOR,c.z]}>
   <mesh castShadow position={[0,CHAIR_SEAT,0]}><boxGeometry args={[.46,.08,.44]}/><meshStandardMaterial color="#8b1020" roughness={.7}/></mesh>
   <mesh castShadow position={[0,CHAIR_SEAT+.33,-.21]} rotation={[-.1,0,0]}><boxGeometry args={[.46,.58,.06]}/><meshStandardMaterial color="#8b1020" roughness={.7}/></mesh>
   <mesh position={[0,CHAIR_SEAT+.63,-.24]}><boxGeometry args={[.48,.04,.08]}/><meshStandardMaterial color="#f6c344" metalness={.5} roughness={.35}/></mesh>
   {[[-.19,-.18],[.19,-.18],[-.19,.18],[.19,.18]].map(([x,z],k)=><mesh key={k} position={[x,CHAIR_SEAT/2,z]}><cylinderGeometry args={[.02,.02,CHAIR_SEAT,6]}/><meshStandardMaterial color="#c8a24a" metalness={.6} roughness={.3}/></mesh>)}
  </group>)}
  <RigidBody type="fixed" colliders={false}>
   {TEACHER_TABLES.map(cx=><CuboidCollider key={cx} args={[TABLE_LEN/2,TABLE_H/2,TABLE_DEPTH/2]} position={[cx,FLOOR+TABLE_H/2,TABLE_Z]}/>)}
   {TEACHER_TABLES.map(cx=><CuboidCollider key={'c'+cx} args={[1.5*TCHAIR_STEP+.23,(CHAIR_SEAT+.05)/2,.22]} position={[cx,FLOOR+(CHAIR_SEAT+.05)/2,TCHAIR_Z]}/>)}
  </RigidBody>
 </group>;
}

function chairGeometry(){
 const parts=[];
 const box=(w,h,d,x,y,z,rx=0)=>{const g=new THREE.BoxGeometry(w,h,d);if(rx)g.rotateX(rx);g.translate(x,y,z);parts.push(g);};
 box(.42,.04,.4,0,CHAIR_SEAT,0);                           // mặt ngồi
 box(.42,.4,.035,0,CHAIR_SEAT+.24,-.2,-.12);               // lưng tựa ngả nhẹ ra sau
 for(const x of [-.18,.18])for(const z of [-.17,.17]){const g=new THREE.CylinderGeometry(.018,.024,CHAIR_SEAT,6);g.translate(x,CHAIR_SEAT/2,z);parts.push(g);}
 for(const x of [-.19,.19])box(.03,.03,.36,x,CHAIR_SEAT-.06,0); // nẹp dưới mặt ghế
 return mergeGeometries(parts.map(g=>g.toNonIndexed()));
}
function HallChairs(){
 const ref=useRef();
 const geo=useMemo(chairGeometry,[]),mat=useMemo(()=>new THREE.MeshStandardMaterial({roughness:.55}),[]);
 useLayoutEffect(()=>{
  const m=new THREE.Matrix4(),c=new THREE.Color();
  chairs.forEach((ch,i)=>{m.makeTranslation(ch.x,FLOOR,ch.z);ref.current.setMatrixAt(i,m);ref.current.setColorAt(i,c.set(ch.left?'#1d6fb8':'#2a7fc8'));});
  ref.current.instanceMatrix.needsUpdate=true;ref.current.instanceColor.needsUpdate=true;
 },[]);
 // mỗi hàng 2 dãy → khung va chạm thấp (cao bằng mặt ghế) để không đi xuyên ghế
 const blocks=[];for(let r=FIRST_ROW;r<ROWS;r++)for(const left of [true,false]){const xs=chairs.filter(c=>c.row===r&&c.left===left).map(c=>c.x);blocks.push({x:(Math.min(...xs)+Math.max(...xs))/2,w:Math.max(...xs)-Math.min(...xs)+.44,z:FRONT_ROW_Z-r*ROW_STEP});}
 return <group>
  <instancedMesh ref={ref} args={[geo,mat,chairs.length]} castShadow receiveShadow/>
  <RigidBody type="fixed" colliders={false}>{blocks.map((b,i)=><CuboidCollider key={i} args={[b.w/2,(CHAIR_SEAT+.05)/2,.22]} position={[b.x,FLOOR+(CHAIR_SEAT+.05)/2,b.z]}/>)}</RigidBody>
 </group>;
}

// ---------- Trang trí ----------
function bannerTexture(){
 const c=document.createElement('canvas');c.width=2048;c.height=160;const g=c.getContext('2d');
 const gr=g.createLinearGradient(0,0,0,160);gr.addColorStop(0,'#d0182f');gr.addColorStop(1,'#9c0c1f');g.fillStyle=gr;g.fillRect(0,0,2048,160);
 g.strokeStyle='#f6c344';g.lineWidth=8;g.strokeRect(10,10,2028,140);
 const text='TRI ÂN THẦY CÔ  ★  KỶ NIỆM NGÀY NHÀ GIÁO VIỆT NAM 20/11';
 let size=92;const font=s=>`bold ${s}px "Be Vietnam Pro", Arial, sans-serif`;
 g.font=font(size);while(size>30&&g.measureText(text).width>1820){size-=2;g.font=font(size);}   // co chữ cho vừa trong khung viền
 g.fillStyle='#ffd84d';g.textAlign='center';g.textBaseline='middle';g.fillText(text,1024,84);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}

// điểm trên vòm bóng bay: hai cột thẳng ở hai mép trước sân khấu, nối nhau bằng cung tròn phía trên
const ARCH_L=STAGE_X0-.35,ARCH_R=STAGE_X1+.35,ARCH_Z=STAGE_FRONT-.3,ARCH_COL_TOP=5.0,ARCH_RISE=1.4;
function archPoint(t){ // t 0 → 1 dọc vòm (trái lên, qua đỉnh, xuống phải)
 const colLen=ARCH_COL_TOP-FLOOR,span=(ARCH_R-ARCH_L)/2,arcLen=Math.PI*Math.hypot(span,ARCH_RISE)/1.6,total=colLen*2+arcLen,d=t*total;
 if(d<colLen)return [ARCH_L,FLOOR+d];
 if(d>colLen+arcLen)return [ARCH_R,ARCH_COL_TOP-(d-colLen-arcLen)];
 const a=Math.PI*(1-(d-colLen)/arcLen);return [STAGE_CX+(ARCH_R-ARCH_L)/2*Math.cos(a)+(ARCH_L+ARCH_R)/2-STAGE_CX,ARCH_COL_TOP+ARCH_RISE*Math.sin(a)];
}
const BALLOON_COLORS=['#d61f3c','#ffffff','#ffd23f','#ff4d6d','#1d6fb8'];

function Instanced({items,geometry,material,shadow=true}){
 const ref=useRef();
 useLayoutEffect(()=>{
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),v=new THREE.Vector3(),s=new THREE.Vector3(),c=new THREE.Color();
  items.forEach((it,i)=>{e.set(...(it.rot??[0,0,0]));q.setFromEuler(e);m.compose(v.set(...it.p),q,s.set(...(Array.isArray(it.s)?it.s:[it.s,it.s,it.s])));ref.current.setMatrixAt(i,m);ref.current.setColorAt(i,c.set(it.c));});
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;
 },[items]);
 return <instancedMesh ref={ref} args={[geometry,material,items.length]} castShadow={shadow}/>;
}

function HallDecor(){
 const banner=useMemo(bannerTexture,[]);
 const res=useMemo(()=>({
  sphere:new THREE.IcosahedronGeometry(1,2),flower:new THREE.IcosahedronGeometry(1,0),leaf:new THREE.OctahedronGeometry(1,0),
  flag:(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,0,-1,0],3));g.computeVertexNormals();return g;})(),
  glossy:new THREE.MeshStandardMaterial({roughness:.25,metalness:.05}),
  petal:new THREE.MeshStandardMaterial({roughness:.6,flatShading:true}),
  cloth:new THREE.MeshStandardMaterial({roughness:.7,side:THREE.DoubleSide}),
 }),[]);
 const data=useMemo(()=>{
  const r=rand(2011),balloons=[],flowers=[],leaves=[],flags=[];
  // vòm bóng bay: mỗi "vòng" 4 quả quanh đường vòm
  const N=150;for(let i=0;i<N;i++){const [x,y]=archPoint(i/(N-1));for(let k=0;k<4;k++){const a=k*Math.PI/2+i*.6;balloons.push({p:[x+Math.cos(a)*.2,y,ARCH_Z+Math.sin(a)*.2],s:.17+r()*.03,c:BALLOON_COLORS[(i+k)%BALLOON_COLORS.length]});}}
  // bồn hoa dọc mép trước sân khấu (chừa giữa cho lối lên xuống)
  for(const [x0,x1] of [[STAGE_X0+.3,STAGE_CX-1.4],[STAGE_CX+1.4,STAGE_X1-.3]]){
   for(let i=0;i<260;i++)flowers.push({p:[x0+r()*(x1-x0),STAGE_TOP+.33+r()*.1,STAGE_FRONT+.22+(r()-.5)*.3],s:.055+r()*.03,c:FLOWER_COLORS[Math.floor(r()*FLOWER_COLORS.length)]});
   for(let i=0;i<90;i++)leaves.push({p:[x0+r()*(x1-x0),STAGE_TOP+.3,STAGE_FRONT+.22+(r()-.5)*.36],s:.09,rot:[r()*3,r()*3,r()*3],c:r()<.5?'#3f7d3a':'#5a9c48'});
  }
  // lẵng hoa chân đứng: 2 dưới sàn cạnh bậc lên sân khấu, 2 trên sân khấu ở góc sau
  const baskets=[[55.6,FLOOR,38.9],[73.0,FLOOR,38.9],[58.1,STAGE_TOP,43.9],[71.9,STAGE_TOP,42.6]];
  for(const [bx,by,bz] of baskets){const top=by+1.35;
   for(let i=0;i<70;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*.42,h=top+.15+Math.cos(d*3)*.35*r();flowers.push({p:[bx+Math.cos(a)*d,h,bz+Math.sin(a)*d*.6],s:.06+r()*.035,c:FLOWER_COLORS[Math.floor(r()*FLOWER_COLORS.length)]});}
   for(let i=0;i<24;i++){const a=r()*Math.PI*2;leaves.push({p:[bx+Math.cos(a)*.45,top+.05+r()*.25,bz+Math.sin(a)*.3],s:.1,rot:[r()*3,r()*3,r()*3],c:'#3f7d3a'});}
  }
  // dây cờ đuôi nheo: 3 dây ngang nhà phía trên khán giả + 1 dây trước sân khấu
  for(const [z,y0] of [[38.8,6.3],[34,6.4],[29,6.4],[24.5,6.2]]){const n=34;for(let i=0;i<n;i++){const t=i/(n-1),x=54.9+t*19.2,y=y0-Math.sin(t*Math.PI)*.55;flags.push({p:[x,y,z],s:[.32,.42,1],c:BALLOON_COLORS[i%BALLOON_COLORS.length]});}}
  return {balloons,flowers,leaves,flags,baskets};
 },[]);
 const mergeRef=useRef();useMergeStatic(mergeRef,'deep');
 return <group ref={mergeRef}>
  {/* băng rôn đỏ chữ vàng phía trên màn LED */}
  <mesh position={[STAGE_CX,5.72,44.8]} rotation={[0,Math.PI,0]}><planeGeometry args={[12.5,.98]}/><meshStandardMaterial map={banner} roughness={.7} side={THREE.DoubleSide}/></mesh>
  {/* ngôi sao vàng hai bên băng rôn */}
  {[STAGE_CX-7,STAGE_CX+7].map(x=><mesh key={x} position={[x,5.72,44.75]} rotation={[0,Math.PI,Math.PI/2]}><circleGeometry args={[.55,5]}/><meshStandardMaterial color="#f6c344" emissive="#f6c344" emissiveIntensity={.25} side={THREE.DoubleSide}/></mesh>)}
  {/* bồn hoa trắng dọc mép sân khấu */}
  {[[STAGE_X0+.3,STAGE_CX-1.4],[STAGE_CX+1.4,STAGE_X1-.3]].map(([a,b])=><mesh key={a} castShadow receiveShadow position={[(a+b)/2,STAGE_TOP+.16,STAGE_FRONT+.22]}><boxGeometry args={[b-a+.1,.32,.42]}/><meshStandardMaterial color="#f4efe2" roughness={.8}/></mesh>)}
  {/* chân lẵng hoa (3 chân) + giỏ mây */}
  {data.baskets.map(([x,y,z],i)=><group key={i} position={[x,y,z]}>
   {[0,1,2].map(k=>{const a=k*Math.PI*2/3;return <mesh key={k} position={[Math.cos(a)*.18,.62,Math.sin(a)*.18]} rotation={[Math.sin(a)*.14,0,-Math.cos(a)*.14]}><cylinderGeometry args={[.018,.018,1.28,6]}/><meshStandardMaterial color="#c8a24a" metalness={.5} roughness={.35}/></mesh>;})}
   <mesh position={[0,1.3,0]}><cylinderGeometry args={[.4,.22,.3,14,1,true]}/><meshStandardMaterial color="#b0814e" roughness={.9} side={THREE.DoubleSide}/></mesh>
   <mesh position={[0,1.12,.3]}><boxGeometry args={[.08,.5,.01]}/><meshStandardMaterial color="#d61f3c"/></mesh>
  </group>)}
  {/* thảm đỏ lối giữa từ cửa sau tới chân sân khấu */}
  <mesh receiveShadow position={[AISLE_X,FLOOR+.012,30.6]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[1.4,17.6]}/><meshStandardMaterial color="#a3122a" roughness={.95}/></mesh>
  {[AISLE_X-.72,AISLE_X+.72].map(x=><mesh key={x} position={[x,FLOOR+.014,30.6]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.06,17.6]}/><meshStandardMaterial color="#f6c344"/></mesh>)}
  <Instanced items={data.balloons} geometry={res.sphere} material={res.glossy}/>
  <Instanced items={data.flowers} geometry={res.flower} material={res.petal} shadow={false}/>
  <Instanced items={data.leaves} geometry={res.leaf} material={res.petal} shadow={false}/>
  <Instanced items={data.flags} geometry={res.flag} material={res.cloth} shadow={false}/>
  {/* dây treo cờ */}
  {[[38.8,6.3],[34,6.4],[29,6.4],[24.5,6.2]].map(([z,y])=><mesh key={z} position={[64.5,y-.28,z]}><boxGeometry args={[19.2,.012,.012]}/><meshStandardMaterial color="#555"/></mesh>)}
 </group>;
}

// ---------- Đội múa 10 người trên sân khấu nhà đa năng (ô 10 → 19 trong stageSlots.js) ----------
// Người chơi bước lên sân khấu nhấn F → thay chỗ một vũ công (vũ công ô đó ẩn đi), rời đi thì vũ công quay lại.
function HallDancers({event}){
 const group=useRef();
 useFrame(()=>{if(group.current)group.current.visible=stageDancersVisible(currentHour(),event);});
 return <group ref={group}>{Array.from({length:10},(_,i)=><NpcDancer key={i} slot={10+i} look={DANCER_LOOKS[(i+3)%DANCER_LOOKS.length]} rot={Math.PI}/>)}</group>;
}

// ---------- Đèn trần nhà đa năng (bật cả ngày: mái che kín nên trong nhà tối) ----------
// 12 bộ đèn tấm treo dưới trần (trần ~7 m): 3 hàng dọc theo chiều dài nhà × 4 hàng ngang. Ánh sáng thật lấy từ bể đèn chung
// (src/lightPool.jsx): đứng trong nhà thì cả bể dời về đây; ở ngoài vẫn thấy đèn sáng nhờ mặt đèn phát sáng.
const HALL_LAMPS=[57.8,64.5,71.2].flatMap(x=>[24,29.2,34.4,39.2].map(z=>[x,6.3,z]));
const HALL_LIGHT_SOURCES=HALL_LAMPS.map(([x,y,z])=>({p:[x,y-.25,z],color:'#fff4e2',power:()=>15,distance:13,decay:1.4}));
function HallLights(){
 useLightSources(HALL_LIGHT_SOURCES);
 const panel=useRef(),rod=useRef();
 const res=useMemo(()=>({
  panelGeo:new THREE.BoxGeometry(1.8,.08,.32),rodGeo:new THREE.CylinderGeometry(.012,.012,.7,5),
  panelMat:new THREE.MeshStandardMaterial({color:'#fffaf0',emissive:'#fff1d6',emissiveIntensity:1.6,roughness:.3}),
  rodMat:new THREE.MeshStandardMaterial({color:'#5d6468',metalness:.6,roughness:.4}),
 }),[]);
 useLayoutEffect(()=>{const o=new THREE.Object3D();
  HALL_LAMPS.forEach(([x,y,z],i)=>{o.position.set(x,y,z);o.rotation.set(0,Math.PI/2,0);o.updateMatrix();panel.current.setMatrixAt(i,o.matrix);
   [-.7,.7].forEach((d,k)=>{o.position.set(x,y+.37,z+d);o.rotation.set(0,0,0);o.updateMatrix();rod.current.setMatrixAt(i*2+k,o.matrix);});});
  panel.current.instanceMatrix.needsUpdate=true;rod.current.instanceMatrix.needsUpdate=true;},[]);
 return <>
  <instancedMesh ref={panel} args={[res.panelGeo,res.panelMat,HALL_LAMPS.length]}/>
  <instancedMesh ref={rod} args={[res.rodGeo,res.rodMat,HALL_LAMPS.length*2]}/>
 </>;
}

export function HallStage({event}){
 const ref=useNearVisible([64.5,0,33.5],40); // chỉ vẽ khi camera trong / gần nhà đa năng (va chạm ghế, bàn vẫn luôn hoạt động)
 return <group ref={ref}><HallLights/><HallDecor/><TeacherTables/><HallChairs/><HallDancers event={event}/></group>;
}

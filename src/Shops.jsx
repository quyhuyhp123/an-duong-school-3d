// 3 ngôi nhà quán nhỏ bên kia đường trước cổng chính (đường nhựa z 49 → 56, vỉa hè z 56 → 58.2). Cửa quay về phía cổng trường (-z).
// Nhà 1 tầng: tường vôi, mái tôn đua ra làm hiên, biển hiệu trên cửa, cửa cuốn kéo lên.
//  - Quán bánh mì: tủ kính bày bánh mì, lò nướng, cô bán hàng sau quầy.
//  - Quán nước: quầy nước, tủ mát, kệ chai lọ, thùng đá, cô bán hàng.
//  - Quán xôi: quầy với nồi xôi xéo / xôi gấc, 2 bàn nhựa thấp + ghế đẩu trong nhà cho khách ngồi (F để ngồi).
// Bước vào trong nhà quán: cô bán hàng quay sang chào & mời mua; bước ra thì cảm ơn, chúc. Lời thoại theo vai trò (học sinh / thầy cô).
import React,{useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {RigidBody,CuboidCollider,CapsuleCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {localPlayer} from './localPlayer';
import {getRole} from './role';
import {useNearVisible} from './useNearVisible';
import {useMergeStatic} from './mergeStatic';

const STEP_MS=4200,BYE_MS=3600;
const FRONT_Z=58.2,BACK_Z=63,DEPTH=BACK_Z-FRONT_Z,WALL_H=3.2,FLOOR_H=.12,T=.18;   // khách đứng trên vỉa hè trước cửa
const COUNTER_Z=FRONT_Z+3.1,VENDOR_Z=FRONT_Z+3.95;
const turn=(obj,target,k=.08)=>{obj.rotation.y+=(((target-obj.rotation.y+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI)*k;};

const SHOPS=[
 {id:'banhmi',name:'BÁNH MÌ',sub:'Pate · Trứng · Xúc xích',x:3.5,w:5,wall:'#f3e6c4',roof:'#b5452f',signBg:'#c8102e',signFg:'#ffd84d',
  vendor:{shirt:'#3a7bd5',apron:'#f4efe2'},
  lines:{student:['Chào cháu! Bánh mì nóng giòn vừa ra lò đây, cháu ăn một ổ cho chắc bụng nhé?','Có bánh mì pate, trứng ốp, xúc xích đủ cả, cháu thích loại nào cô làm ngay cho nào?','Cháu cầm cẩn thận kẻo nóng nhé. Cảm ơn cháu, chúc cháu một ngày học thật tốt!'],
         teacher:['Chào thầy cô ạ! Thầy cô dùng một ổ bánh mì nóng cho bữa sáng nhé?','Bánh mì pate, trứng, xúc xích đều có ạ. Thầy cô dùng loại nào em làm ngay ạ.','Em cảm ơn thầy cô. Chúc thầy cô có một buổi dạy thật vui ạ!']}},
 {id:'nuoc',name:'NƯỚC GIẢI KHÁT',sub:'Trà đá · Nước mía · Sữa đậu nành',x:9.5,w:5,wall:'#dcecf5',roof:'#2f6f9f',signBg:'#1d6fb8',signFg:'#ffffff',
  vendor:{shirt:'#d9497a',apron:'#ffffff'},
  lines:{student:['Chào cháu! Trời hôm nay nóng, vào làm cốc trà chanh mát lạnh nhé?','Cô có trà đá, nước mía, sữa đậu nành với nước cam. Cháu uống gì cô lấy cho nào?','Cảm ơn cháu nhé! Nhớ uống đủ nước để học cho tỉnh táo nha.'],
         teacher:['Chào thầy cô ạ! Mời thầy cô vào dùng cốc nước mát trước giờ lên lớp ạ.','Có trà đá, nước mía, sữa đậu nành, nước cam ạ. Thầy cô dùng gì em lấy ngay ạ.','Em cảm ơn thầy cô. Chúc thầy cô giữ gìn sức khỏe, giảng bài thật hay ạ!']}},
 {id:'xoi',name:'XÔI NÓNG',sub:'Xôi xéo · Xôi gấc · Xôi ruốc',x:16.7,w:6.2,wall:'#f6dccb',roof:'#8a4b2a',signBg:'#f6c344',signFg:'#7a1f12',
  vendor:{shirt:'#4f9443',apron:'#fff4e0'},
  lines:{student:['Chào cháu! Xôi xéo, xôi gấc nóng hổi đây, cháu vào ngồi ăn cho ấm bụng nhé!','Cháu ăn xôi xéo hay xôi gấc? Có thêm ruốc, chả, trứng đấy. Mời cháu ngồi, cô xới ngay.','Ăn từ từ kẻo nghẹn cháu nhé. Cảm ơn cháu, chúc cháu học giỏi!'],
         teacher:['Chào thầy cô ạ! Mời thầy cô vào ngồi dùng đĩa xôi nóng cho ấm bụng ạ.','Có xôi xéo, xôi gấc, ăn kèm ruốc, chả, trứng ạ. Thầy cô dùng loại nào em xới ngay ạ.','Em cảm ơn thầy cô đã ủng hộ. Chúc thầy cô một ngày tốt lành ạ!']}},
];

// bàn nhựa thấp + ghế đẩu trong quán xôi
const XOI=SHOPS[2],XOI_TABLES=[[XOI.x-1.3,FRONT_Z+1.4],[XOI.x+1.3,FRONT_Z+1.4]],STOOL_TOP=.32,STOOL_OFF=.62;
const stools=XOI_TABLES.flatMap(([tx,tz],t)=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz],k)=>({id:`xoi-stool-${t}-${k}`,x:tx+dx*STOOL_OFF,z:tz+dz*STOOL_OFF,dx,dz,tx,tz})));
export const SHOP_SEATS=stools.map(s=>({id:s.id,label:'ghế quán xôi',position:[s.x,FLOOR_H+STOOL_TOP+.36,s.z],yaw:Math.atan2(s.tx-s.x,s.tz-s.z),exit:[s.tx+s.dx*1.2,FLOOR_H+.98,s.tz+s.dz*1.2]}));

function signTexture(title,sub,bg,fg){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');
 g.fillStyle=bg;g.fillRect(0,0,1024,256);g.strokeStyle=fg;g.lineWidth=10;g.strokeRect(12,12,1000,232);
 g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
 let s=130;const f=n=>`900 ${n}px "Be Vietnam Pro", Arial, sans-serif`;g.font=f(s);while(g.measureText(title).width>940)g.font=f(s-=4);g.fillText(title,512,100);
 let t=50;const f2=n=>`600 ${n}px "Be Vietnam Pro", Arial, sans-serif`;g.font=f2(t);while(g.measureText(sub).width>940)g.font=f2(t-=2);g.fillText(sub,512,200);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
}

// Khung nhà: nền, 3 bức tường, 2 trụ cửa + lanh tô, cửa cuốn kéo lên, mái tôn dốc ra trước làm hiên, biển hiệu
function House({shop}){
 const tex=useMemo(()=>signTexture(shop.name,shop.sub,shop.signBg,shop.signFg),[shop]);
 const {x,w}=shop,cz=(FRONT_Z+BACK_Z)/2,open=w-1.2,pier=(w-open)/2;
 const wallMat=<meshStandardMaterial color={shop.wall} roughness={.85}/>;
 return <group>
  <mesh receiveShadow position={[x,FLOOR_H/2,cz-.3]}><boxGeometry args={[w+.2,FLOOR_H,DEPTH+.6]}/><meshStandardMaterial color="#d9cfc0" roughness={.8}/></mesh>
  <mesh castShadow receiveShadow position={[x,WALL_H/2,BACK_Z-T/2]}><boxGeometry args={[w,WALL_H,T]}/>{wallMat}</mesh>
  {[-1,1].map(s=><mesh key={s} castShadow receiveShadow position={[x+s*(w/2-T/2),WALL_H/2,cz]}><boxGeometry args={[T,WALL_H,DEPTH]}/>{wallMat}</mesh>)}
  {[-1,1].map(s=><mesh key={'p'+s} castShadow position={[x+s*(w/2-pier/2),WALL_H/2,FRONT_Z+T/2]}><boxGeometry args={[pier,WALL_H,T]}/>{wallMat}</mesh>)}
  <mesh castShadow position={[x,2.75+(WALL_H-2.75)/2,FRONT_Z+T/2]}><boxGeometry args={[open,WALL_H-2.75,T]}/>{wallMat}</mesh>
  {/* chân tường ốp gạch */}
  {[-1,1].map(s=><mesh key={'b'+s} position={[x+s*(w/2-pier/2),.3,FRONT_Z-.005]}><boxGeometry args={[pier,.6,.02]}/><meshStandardMaterial color="#9a5b3f"/></mesh>)}
  {/* cửa cuốn đã kéo lên (hộp cuốn trên lanh tô) */}
  <mesh position={[x,2.62,FRONT_Z+.18]}><boxGeometry args={[open,.26,.26]}/><meshStandardMaterial color="#9aa0a6" metalness={.5} roughness={.4}/></mesh>
  {/* trần & mái tôn: dốc ra trước, đua 1.2 m làm hiên */}
  <mesh position={[x,WALL_H-.02,cz]}><boxGeometry args={[w-.1,.04,DEPTH-.1]}/><meshStandardMaterial color="#f4efe2"/></mesh>
  <mesh castShadow position={[x,WALL_H+.28,cz-.6]} rotation={[-.12,0,0]}><boxGeometry args={[w+.5,.08,DEPTH+1.6]}/><meshStandardMaterial color={shop.roof} roughness={.6} metalness={.2}/></mesh>
  {Array.from({length:Math.round(w/.5)},(_,i)=><mesh key={'r'+i} position={[x-w/2+.25+i*.5,WALL_H+.34,cz-.6]} rotation={[-.12,0,0]}><boxGeometry args={[.05,.04,DEPTH+1.6]}/><meshStandardMaterial color={shop.roof} roughness={.5} metalness={.3}/></mesh>)}
  {/* biển hiệu dựng hẳn trên mái (mép trước), 2 cột đỡ — không chạm mái tôn */}
  <mesh position={[x,3.98,FRONT_Z-.25]} rotation={[0,Math.PI,0]}><planeGeometry args={[open+.4,(open+.4)/4]}/><meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={.6}/></mesh>
  <mesh position={[x,3.98,FRONT_Z-.22]}><boxGeometry args={[open+.5,(open+.4)/4+.1,.04]}/><meshStandardMaterial color="#3a3a3a"/></mesh>
  {[-1,1].map(s=><mesh key={'sp'+s} position={[x+s*(open/2-.2),3.45,FRONT_Z-.2]}><cylinderGeometry args={[.035,.035,.5,8]}/><meshStandardMaterial color="#3a3a3a"/></mesh>)}
  {/* bóng đèn trong quán */}
  <mesh position={[x,WALL_H-.25,cz+.4]}><sphereGeometry args={[.09,12,8]}/><meshStandardMaterial color="#fff3c4" emissive="#ffd98a" emissiveIntensity={1.2}/></mesh>
 </group>;
}

function BanhMiInside({x}){
 return <group position={[x,FLOOR_H,COUNTER_Z]}>
  <mesh castShadow position={[0,.5,0]}><boxGeometry args={[2.4,1,.6]}/><meshStandardMaterial color="#f4efe2"/></mesh>
  <mesh position={[0,.5,-.31]}><boxGeometry args={[2.3,.5,.01]}/><meshStandardMaterial color="#c8102e"/></mesh>
  <mesh position={[0,1.25,0]}><boxGeometry args={[2.2,.5,.55]}/><meshStandardMaterial color="#cfe8f5" transparent opacity={.35} roughness={.1}/></mesh>
  <mesh position={[0,1.51,0]}><boxGeometry args={[2.26,.04,.6]}/><meshStandardMaterial color="#c8102e"/></mesh>
  {Array.from({length:12},(_,i)=><mesh key={i} position={[-.85+(i%6)*.34,1.08+Math.floor(i/6)*.15,-.08+Math.floor(i/6)*.12]} rotation={[0,.25,Math.PI/2]} scale={[1,1,.6]}><capsuleGeometry args={[.06,.24,4,8]}/><meshStandardMaterial color="#d9a04e" roughness={.8}/></mesh>)}
  {/* lò nướng bánh mì sau lưng cô bán hàng */}
  <mesh position={[1.4,.8,1.3]}><boxGeometry args={[.8,1.6,.5]}/><meshStandardMaterial color="#b9b9b9" metalness={.6} roughness={.3}/></mesh>
  <mesh position={[1.4,1.0,1.04]}><boxGeometry args={[.6,.4,.02]}/><meshStandardMaterial color="#ff9a3c" emissive="#ff7a1c" emissiveIntensity={.6}/></mesh>
 </group>;
}
function NuocInside({x}){
 return <group position={[x,FLOOR_H,COUNTER_Z]}>
  <mesh castShadow position={[0,.5,0]}><boxGeometry args={[2.4,1,.6]}/><meshStandardMaterial color="#e8f2fb"/></mesh>
  <mesh position={[0,.5,-.31]}><boxGeometry args={[2.3,.5,.01]}/><meshStandardMaterial color="#1d6fb8"/></mesh>
  <mesh position={[-.7,1.2,0]}><boxGeometry args={[.5,.36,.45]}/><meshStandardMaterial color="#d73a3a"/></mesh>
  <mesh position={[-.7,1.39,0]}><boxGeometry args={[.52,.04,.47]}/><meshStandardMaterial color="#ffffff"/></mesh>
  <mesh position={[0,1.22,0]}><cylinderGeometry args={[.13,.13,.42,14]}/><meshStandardMaterial color="#c47a2c" transparent opacity={.8}/></mesh>
  {[0,1,2,3].map(i=><mesh key={i} position={[.45+i*.14,1.08,-.12]}><cylinderGeometry args={[.04,.032,.12,10]}/><meshStandardMaterial color="#f7efe0" transparent opacity={.7}/></mesh>)}
  {/* tủ mát & kệ chai sau lưng */}
  <mesh position={[-1.35,.95,1.3]}><boxGeometry args={[.8,1.9,.55]}/><meshStandardMaterial color="#e9eef2"/></mesh>
  <mesh position={[-1.35,1.05,1.02]}><boxGeometry args={[.66,1.4,.02]}/><meshStandardMaterial color="#9fd3f0" transparent opacity={.6}/></mesh>
  {Array.from({length:12},(_,i)=><mesh key={i} position={[-1.6+(i%4)*.17,.6+Math.floor(i/4)*.42,1.15]}><cylinderGeometry args={[.035,.035,.22,8]}/><meshStandardMaterial color={['#ff8c42','#7dc243','#ffffff','#f6c344','#ff4d6d','#3a7bd5'][i%6]}/></mesh>)}
  <mesh position={[1.3,1.1,1.45]}><boxGeometry args={[1.2,.04,.3]}/><meshStandardMaterial color="#8a5a33"/></mesh>
  {Array.from({length:6},(_,i)=><mesh key={i} position={[.85+i*.18,1.25,1.45]}><cylinderGeometry args={[.04,.04,.26,8]}/><meshStandardMaterial color={['#7dc243','#ff8c42','#ffffff'][i%3]} transparent opacity={.85}/></mesh>)}
 </group>;
}
function XoiInside({x}){
 return <group>
  <group position={[x,FLOOR_H,COUNTER_Z]}>
   <mesh castShadow position={[0,.45,0]}><boxGeometry args={[2.6,.9,.6]}/><meshStandardMaterial color="#8a5a33"/></mesh>
   <mesh position={[0,.62,-.31]}><boxGeometry args={[2.5,.36,.01]}/><meshStandardMaterial color="#f6e7c4"/></mesh>
   {[[-.7,'#f2c14e'],[.1,'#c8102e'],[.85,'#e8e0c8']].map(([dx,c])=><group key={dx} position={[dx,.9,0]}>
    <mesh position={[0,.14,0]}><cylinderGeometry args={[.25,.21,.28,18]}/><meshStandardMaterial color="#b9b9b9" metalness={.7} roughness={.3}/></mesh>
    <mesh position={[0,.3,0]}><sphereGeometry args={[.23,16,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color={c} roughness={.9}/></mesh>
   </group>)}
  </group>
  {XOI_TABLES.map(([tx,tz])=><group key={tx} position={[tx,FLOOR_H,tz]}>
   <mesh castShadow position={[0,.5,0]}><boxGeometry args={[.7,.04,.7]}/><meshStandardMaterial color="#2a7fc8"/></mesh>
   {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b],i)=><mesh key={i} position={[a*.3,.25,b*.3]}><boxGeometry args={[.04,.5,.04]}/><meshStandardMaterial color="#2a7fc8"/></mesh>)}
   <mesh position={[-.12,.56,.05]}><cylinderGeometry args={[.11,.07,.06,14]}/><meshStandardMaterial color="#ffffff"/></mesh>
   <mesh position={[-.12,.6,.05]}><sphereGeometry args={[.08,10,6,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#f2c14e"/></mesh>
   <mesh position={[.15,.57,-.1]}><cylinderGeometry args={[.035,.03,.1,10]}/><meshStandardMaterial color="#c47a2c" transparent opacity={.8}/></mesh>
  </group>)}
  {stools.map(s=><group key={s.id} position={[s.x,FLOOR_H,s.z]}>
   <mesh castShadow position={[0,STOOL_TOP-.02,0]}><cylinderGeometry args={[.17,.19,.04,14]}/><meshStandardMaterial color="#d32f2f"/></mesh>
   <mesh position={[0,(STOOL_TOP-.04)/2,0]}><cylinderGeometry args={[.15,.19,STOOL_TOP-.04,14,1,true]}/><meshStandardMaterial color="#d32f2f" side={THREE.DoubleSide}/></mesh>
  </group>)}
 </group>;
}

// nhà quán + đồ bày: đứng yên → gộp thành vài khối theo chất liệu
function ShopStatic({children}){const ref=useRef();useMergeStatic(ref,'deep');return <group ref={ref}>{children}</group>;}

function Vendor({look,face}){
 const root=useRef(),body=useRef(),ph=useRef(Math.random()*6);useMergeStatic(root,'joint');
 useFrame(s=>{if(body.current)body.current.position.y=Math.sin(s.clock.elapsedTime*1.5+ph.current)*.01;if(root.current)turn(root.current,face.current);});
 const skin='#dcaa82';
 return <group ref={root}><group ref={body}>
  {[-1,1].map(s=><mesh key={s} castShadow position={[s*.11,.45,0]}><capsuleGeometry args={[.095,.55,5,10]}/><meshStandardMaterial color="#2b2b38"/></mesh>)}
  {[-1,1].map(s=><mesh key={s} position={[s*.11,.05,.04]}><boxGeometry args={[.15,.08,.26]}/><meshStandardMaterial color="#6b4a32"/></mesh>)}
  <mesh castShadow position={[0,1.13,0]}><capsuleGeometry args={[.25,.36,6,12]}/><meshStandardMaterial color={look.shirt}/></mesh>
  <mesh position={[0,.98,.2]}><boxGeometry args={[.4,.55,.06]}/><meshStandardMaterial color={look.apron}/></mesh>
  {[-1,1].map(s=><group key={s} position={[s*.31,1.33,0]} rotation={[-.6,0,-s*.2]}>
   <mesh castShadow position={[0,-.24,0]}><capsuleGeometry args={[.075,.36,5,10]}/><meshStandardMaterial color={look.shirt}/></mesh>
   <mesh position={[0,-.52,0]}><sphereGeometry args={[.07,10,8]}/><meshStandardMaterial color={skin}/></mesh>
  </group>)}
  <mesh castShadow position={[0,1.62,0]}><sphereGeometry args={[.21,18,14]}/><meshStandardMaterial color={skin}/></mesh>
  <mesh position={[0,1.68,-.04]}><sphereGeometry args={[.22,16,10,0,Math.PI*2,0,Math.PI*.55]}/><meshStandardMaterial color="#1d1715"/></mesh>
  {[-1,1].map(s=><mesh key={s} position={[s*.07,1.64,.19]}><sphereGeometry args={[.02,8,8]}/><meshStandardMaterial color="#2a1a14"/></mesh>)}
  <mesh position={[0,1.55,.2]} rotation={[0,0,Math.PI]}><torusGeometry args={[.05,.012,6,10,Math.PI]}/><meshStandardMaterial color="#a0524a"/></mesh>
 </group></group>;
}

function Shop({shop}){
 const face=useRef(Math.PI);   // mặc định nhìn ra cửa (-z)
 const [say,setSay]=useState(null);
 const near=useRef(false),timers=useRef([]);
 const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[];};
 const vendorPos=[shop.x,FLOOR_H,VENDOR_Z];
 useFrame(()=>{
  const p=localPlayer;if(!p.ready)return;
  const d=Math.hypot(p.x-shop.x,p.z-(FRONT_Z+.6));
  // trong nhà: giữa 2 tường hông, từ cửa vào tới tường sau; ra khỏi nhà (thêm 0.4 m) mới tính là đi ra
  const inside=Math.abs(p.x-shop.x)<shop.w/2-T&&p.z>FRONT_Z+.1&&p.z<BACK_Z&&p.y<2.5;
  const outside=Math.abs(p.x-shop.x)>shop.w/2+.4||p.z<FRONT_Z-.4||p.z>BACK_Z+.4;
  if(!near.current&&inside){
   near.current=true;clear();const lines=shop.lines[getRole()==='teacher'?'teacher':'student'];
   setSay(lines[0]);timers.current.push(setTimeout(()=>setSay(lines[1]),STEP_MS),setTimeout(()=>setSay(null),STEP_MS*2.2));
  }else if(near.current&&outside){
   near.current=false;clear();const lines=shop.lines[getRole()==='teacher'?'teacher':'student'];
   setSay(lines[2]);timers.current.push(setTimeout(()=>setSay(null),BYE_MS));
  }
  face.current=d<7?Math.atan2(p.x-vendorPos[0],p.z-vendorPos[2]):Math.PI;
 });
 return <group>
  <ShopStatic>
  <House shop={shop}/>
  {shop.id==='banhmi'&&<BanhMiInside x={shop.x}/>}
  {shop.id==='nuoc'&&<NuocInside x={shop.x}/>}
  {shop.id==='xoi'&&<XoiInside x={shop.x}/>}
  </ShopStatic>
  <group position={vendorPos}><Vendor look={shop.vendor} face={face}/></group>
  {say&&<Html position={[shop.x,2.55,VENDOR_Z-.2]} center style={{pointerEvents:'none'}}><div className="guard-bubble shop">{say}</div></Html>}
 </group>;
}

export function Shops(){
 const cz=(FRONT_Z+BACK_Z)/2,ref=useNearVisible([10,0,58],55); // chỉ vẽ khi camera ở gần cổng / dãy quán
 return <group ref={ref}>
  {SHOPS.map(s=><Shop key={s.id} shop={s}/>)}
  <RigidBody type="fixed" colliders={false}>
   {SHOPS.map(s=>{const open=s.w-1.2,pier=(s.w-open)/2;return <React.Fragment key={s.id}>
    <CuboidCollider args={[s.w/2,WALL_H/2,T/2]} position={[s.x,WALL_H/2,BACK_Z-T/2]}/>
    {[-1,1].map(k=><CuboidCollider key={k} args={[T/2,WALL_H/2,DEPTH/2]} position={[s.x+k*(s.w/2-T/2),WALL_H/2,cz]}/>)}
    {[-1,1].map(k=><CuboidCollider key={'p'+k} args={[pier/2,WALL_H/2,T/2]} position={[s.x+k*(s.w/2-pier/2),WALL_H/2,FRONT_Z+T/2]}/>)}
    <CuboidCollider args={[s.w/2,FLOOR_H/2,(DEPTH+.6)/2]} position={[s.x,FLOOR_H/2,cz-.3]}/>
    <CuboidCollider args={[s.id==='xoi'?1.3:1.2,.5,.3]} position={[s.x,FLOOR_H+.5,COUNTER_Z]}/>
    <CapsuleCollider args={[.55,.27]} position={[s.x,FLOOR_H+.83,VENDOR_Z]}/>
   </React.Fragment>;})}
   {XOI_TABLES.map(([x,z])=><CuboidCollider key={'t'+x} args={[.35,.26,.35]} position={[x,FLOOR_H+.26,z]}/>)}
  </RigidBody>
 </group>;
}

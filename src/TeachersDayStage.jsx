import {currentHour} from './DayCycle';
import {stageDancersVisible} from './stageSchedule';
// Trang trí sân khấu xanh chào mừng Ngày Nhà giáo Việt Nam 20/11:
// phông nền 20/11, lẵng hoa tươi chân đứng, bồn hoa mép sân khấu, cột bóng bay quanh trụ, dây cờ đuôi nheo, đèn nháy, thảm đỏ.
// Hoa/lá/bóng/cờ vẽ bằng InstancedMesh (mỗi loại 1 lệnh vẽ) nên vài nghìn bông vẫn nhẹ.
import React,{useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {RigidBody,CylinderCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {STAGE_SLOTS,localStage} from './stageSlots';
import {network} from './multiplayer';
import {dancePose,applyDance,STAGE_DANCE} from './dances';
import {beatNow} from './eventAudio';

// Toạ độ sân khấu (three.js): mặt sàn y=0.96, mép trước z=-26.5, phông nền z≈-32.07, trụ xanh x=±8 z=-27.5
const STAGE_Y=.96,FRONT_Z=-26.5,BACKDROP_Z=-32.0;
// Phông 20/11 chỉ phủ phần bên phải phông thật. Phần bên trái (x < -3) giữ nguyên ảnh gốc:
// rèm đỏ, ngôi sao vàng và tượng Bác Hồ trên bục (khoảng x = -5.9 … -4.6).
const BANNER_LEFT=-3.0,BANNER_RIGHT=7.3,BANNER_W=BANNER_RIGHT-BANNER_LEFT,BANNER_H=5.0;
const FLOWER_COLORS=['#d61f3c','#ff4d6d','#ff8fab','#ffd23f','#fff4e6','#ff8c42','#c9184a','#f7b7d2'];
const SERIF="'Playfair Display', Georgia, serif",SANS="'Be Vietnam Pro', Arial, sans-serif";

// Số ngẫu nhiên cố định (cùng hạt giống → mọi người thấy giống nhau, không nhảy khi tải lại)
function rng(seed){let s=seed>>>0||1;return()=>((s=Math.imul(s^(s>>>15),2246822507)^Math.imul(s^(s>>>13),3266489909),(s^=s>>>16)>>>0)/4294967296);}

// ---------- Phông nền 20/11 vẽ bằng canvas ----------
function drawFlower(ctx,x,y,r,color){
 ctx.save();ctx.translate(x,y);
 for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.ellipse(0,-r*.55,r*.38,r*.6,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
 ctx.beginPath();ctx.arc(0,0,r*.25,0,Math.PI*2);ctx.fillStyle='#ffd23f';ctx.fill();ctx.restore();
}
function drawBackdrop(canvas){
 const W=canvas.width,H=canvas.height,ctx=canvas.getContext('2d');
 // nền đỏ nhung + tia nắng vàng
 const bg=ctx.createRadialGradient(W/2,H*.55,40,W/2,H*.55,W*.65);bg.addColorStop(0,'#c62a3f');bg.addColorStop(.6,'#9b1830');bg.addColorStop(1,'#6e0f22');
 ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.translate(W/2,H*.62);for(let i=0;i<36;i++){ctx.rotate(Math.PI*2/36);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-40,-W);ctx.lineTo(40,-W);ctx.closePath();ctx.fillStyle=i%2?'rgba(255,215,120,.06)':'rgba(255,255,255,.025)';ctx.fill();}ctx.restore();
 // khung viền vàng đôi
 ctx.strokeStyle='#f3c969';ctx.lineWidth=10;ctx.strokeRect(26,26,W-52,H-52);ctx.lineWidth=3;ctx.strokeRect(48,48,W-96,H-96);
 // hoa hai góc dưới & hai góc trên
 const r=rng(2011);
 for(const [cx,cy,dir] of [[110,H-110,1],[W-110,H-110,-1]])for(let i=0;i<16;i++){const a=r()*Math.PI/2,d=r()*230;drawFlower(ctx,cx+dir*Math.cos(a)*d,cy-Math.sin(a)*d,26+r()*26,FLOWER_COLORS[(r()*FLOWER_COLORS.length)|0]);}
 for(const [cx,dir] of [[90,1],[W-90,-1]])for(let i=0;i<7;i++)drawFlower(ctx,cx+dir*r()*150,90+r()*80,16+r()*16,FLOWER_COLORS[(r()*FLOWER_COLORS.length)|0]);
 ctx.textAlign='center';ctx.textBaseline='middle';
 const gold=ctx.createLinearGradient(0,H*.32,0,H*.78);gold.addColorStop(0,'#fff1b8');gold.addColorStop(.45,'#f3c969');gold.addColorStop(1,'#d39a2c');
 ctx.fillStyle='#f3c969';ctx.font=`700 30px ${SANS}`;ctx.fillText('S Ở   G D & Đ T   H Ả I   P H Ò N G   ·   T R Ư Ờ N G   T H P T   A N   D Ư Ơ N G',W/2,H*.11);
 ctx.fillStyle='#ffffff';ctx.font=`600 70px ${SANS}`;ctx.fillText('KỶ NIỆM 44 NĂM NGÀY NHÀ GIÁO VIỆT NAM',W/2,H*.2);
 // số 20-11 lớn
 ctx.shadowColor='rgba(60,0,10,.55)';ctx.shadowBlur=24;ctx.shadowOffsetY=8;
 ctx.fillStyle=gold;ctx.font=`700 340px ${SERIF}`;ctx.fillText('20 · 11',W/2,H*.53);
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.fillStyle='#ffffff';ctx.font=`500 52px ${SANS}`;ctx.fillText('20/11/1982  –  20/11/2026',W/2,H*.75);
 ctx.fillStyle='#f3c969';ctx.font=`italic 600 58px ${SERIF}`;ctx.fillText('Tôn sư trọng đạo  ·  Uống nước nhớ nguồn',W/2,H*.87);
}
function useCanvasTexture(width,height,draw){
 const tex=useMemo(()=>{const c=document.createElement('canvas');c.width=width;c.height=height;draw(c);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;},[width,height,draw]);
 // vẽ lại khi font web tải xong (lần đầu có thể dùng font dự phòng)
 useEffect(()=>{let live=true;document.fonts?.ready.then(()=>{if(!live)return;draw(tex.image);tex.needsUpdate=true;});return()=>{live=false;tex.dispose();};},[tex,draw]);
 return tex;
}
function Backdrop(){
 const tex=useCanvasTexture(2048,Math.round(2048*BANNER_H/BANNER_W),drawBackdrop);
 return <mesh position={[(BANNER_LEFT+BANNER_RIGHT)/2,3.6,BACKDROP_Z]}><planeGeometry args={[BANNER_W,BANNER_H]}/><meshBasicMaterial map={tex} toneMapped={false}/></mesh>;
}

// ---------- Ruy băng "Kính chúc thầy cô" trên lẵng hoa ----------
function drawRibbon(canvas){const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;ctx.fillStyle='#c1121f';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f3c969';ctx.fillRect(0,4,W,4);ctx.fillRect(0,H-8,W,4);ctx.font=`700 46px ${SANS}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('KÍNH CHÚC THẦY CÔ',W/2,H/2+2);}

// ---------- Dữ liệu vị trí ----------
// Lẵng hoa chân đứng: [x, y nền, z, hướng quay mặt (rad)]
const BASKETS=[
 [-7.4,0,-24.9,.25],[7.4,0,-24.9,-.25],      // hai bên chân bậc thềm (dưới sân)
 [-9.6,0,-25.9,.45],[9.6,0,-25.9,-.45],
 [-7.7,STAGE_Y,-31.0,.35],[6.8,STAGE_Y,-31.3,-.35], // hai góc sau (bên trái dạt sát mép để không che tượng Bác)
 [-7.2,STAGE_Y,-29.2,.3],[6.9,STAGE_Y,-29.4,-.3],   // hai bên sân khấu, cạnh trụ (không che chữ trên phông)
];
// Bồn hoa dài dọc mép trước sân khấu (chừa lối giữa 4 m để lên xuống)
const PLANTERS=[[-5.6,-1],[5.6,1]]; // [tâm x, hướng]

function buildDecor(){
 const r=rng(1120);
 const flowers=[],leaves=[],balloons=[],metal=[],wicker=[],ribbons=[];
 const pushFlower=(x,y,z,s)=>flowers.push({x,y,z,s,c:FLOWER_COLORS[(r()*FLOWER_COLORS.length)|0]});
 for(const [bx,by,bz,yaw] of BASKETS){
  const cos=Math.cos(yaw),sin=Math.sin(yaw);
  const local=(lx,ly,lz)=>[bx+lx*cos+lz*sin,by+ly,bz-lx*sin+lz*cos];
  // chân đỡ 3 càng + bát giỏ
  for(let k=0;k<3;k++){const a=k/3*Math.PI*2;metal.push({from:local(Math.sin(a)*.32,0,Math.cos(a)*.32),to:local(0,1.05,0)});}
  wicker.push(local(0,1.12,0));
  // mặt hoa hình quạt bầu dục: nửa elip hướng ra phía trước
  for(let i=0;i<110;i++){
   const u=r()*2-1,v=r()*2-1;if(u*u+v*v>1){i--;continue;}
   const depth=Math.sqrt(1-u*u-v*v)*.22;
   const [x,y,z]=local(u*.55,1.85+v*.68,depth+.02);pushFlower(x,y,z,.065+r()*.035);
  }
  for(let i=0;i<26;i++){const a=r()*Math.PI*2,rad=.5+r()*.15;const [x,y,z]=local(Math.cos(a)*.6*rad/.5*.95,1.85+Math.sin(a)*.72,-.04);leaves.push({x,y,z,s:.11,rz:a});}
  for(let i=0;i<14;i++){const a=r()*Math.PI*2;const [x,y,z]=local(Math.cos(a)*.3,1.24+r()*.1,Math.sin(a)*.3);leaves.push({x,y,z,s:.09,rz:a});}
  ribbons.push({pos:local(.05,1.55,.26),yaw,tilt:-.55});
 }
 // bồn hoa mép sân khấu
 for(const [cx] of PLANTERS){for(let i=0;i<170;i++){const x=cx+(r()-.5)*3.2,z=FRONT_Z-.32+(r()-.5)*.36;pushFlower(x,STAGE_Y+.38+r()*.12,z,.06+r()*.03);}
  for(let i=0;i<60;i++)leaves.push({x:cx+(r()-.5)*3.3,y:STAGE_Y+.36,z:FRONT_Z-.32+(r()-.5)*.4,s:.1,rz:r()*6});}
 // cột bóng bay xoắn quanh hai trụ xanh
 const BALLOON=['#d61f3c','#ffffff','#f3c969','#ff8fab'];
 for(const px of [-8,8])for(let i=0;i<70;i++){const a=i*.62,y=1.25+i*.068;balloons.push({x:px+Math.cos(a)*.62,y,z:-27.5+Math.sin(a)*.62,c:BALLOON[i%4],s:.2});}
 // chùm bóng trên đỉnh trụ
 for(const px of [-8,8])for(let i=0;i<9;i++){const a=i/9*Math.PI*2;balloons.push({x:px+Math.cos(a)*.45,y:6.15+Math.sin(i*2.1)*.2,z:-26.9+Math.sin(a)*.3,c:BALLOON[(i+1)%4],s:.26});}
 return {flowers,leaves,balloons,metal,wicker,ribbons};
}

function Instanced({items,geometry,material,apply}){
 const ref=useRef();
 useEffect(()=>{const m=ref.current,d=new THREE.Object3D(),c=new THREE.Color();items.forEach((it,i)=>{apply(d,it);d.updateMatrix();m.setMatrixAt(i,d.matrix);if(it.c)m.setColorAt(i,c.set(it.c));});m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();},[items,apply]);
 return <instancedMesh ref={ref} args={[geometry,material,items.length]} castShadow/>;
}

// Dây cờ đuôi nheo giữa hai trụ, khẽ bay trong gió
function Bunting(){
 const ref=useRef(),N=34;
 const geo=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.17,0,0,.17,0,0,0,-.42,0],3));g.computeVertexNormals();return g;},[]);
 const mat=useMemo(()=>new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.7}),[]);
 const flags=useMemo(()=>Array.from({length:N},(_,i)=>{const t=i/(N-1),x=-7.6+t*15.2;return {x,y:6.48-.6*(1-(2*t-1)**2),z:-25.75,c:['#d61f3c','#f3c969','#ffffff','#1d6fb8'][i%4]};}),[]);
 const d=useMemo(()=>new THREE.Object3D(),[]);
 useEffect(()=>{const c=new THREE.Color();flags.forEach((f,i)=>ref.current.setColorAt(i,c.set(f.c)));ref.current.instanceColor.needsUpdate=true;return()=>{geo.dispose();mat.dispose();};},[flags,geo,mat]);
 useFrame(state=>{const t=state.clock.elapsedTime;flags.forEach((f,i)=>{d.position.set(f.x,f.y,f.z);d.rotation.set(Math.sin(t*2.2+i*.7)*.35,0,0);d.updateMatrix();ref.current.setMatrixAt(i,d.matrix);});ref.current.instanceMatrix.needsUpdate=true;});
 const curve=useMemo(()=>new THREE.CatmullRomCurve3(Array.from({length:12},(_,i)=>{const t=i/11;return new THREE.Vector3(-8+t*16,6.51-.6*(1-(2*t-1)**2),-25.75);})),[]);
 return <><mesh><tubeGeometry args={[curve,40,.012,4]}/><meshStandardMaterial color="#e9e3d0"/></mesh><instancedMesh ref={ref} args={[geo,mat,N]}/></>;
}

// Đèn nháy dọc khung phông nền — sáng rõ khi trời tối
function FairyLights(){
 const ref=useRef();
 const pts=useMemo(()=>{const p=[],w=7.45,h0=1.08,h1=6.12,step=.32;for(let x=-w;x<=w;x+=step){p.push([x,h1]);}for(let y=h0;y<h1;y+=step){p.push([-w,y],[w,y],[BANNER_LEFT-.05,y]);/* thêm hàng đèn dọc mép trái phông 20/11 */}return p;},[]);
 const d=useMemo(()=>new THREE.Object3D(),[]),c=useMemo(()=>new THREE.Color(),[]);
 useFrame(state=>{const t=state.clock.elapsedTime;pts.forEach(([x,y],i)=>{d.position.set(x,y,BACKDROP_Z+.06);d.updateMatrix();ref.current.setMatrixAt(i,d.matrix);const k=.55+.45*Math.sin(t*3+i*1.7);ref.current.setColorAt(i,c.setRGB(1,.82*k+.15,.45*k));});ref.current.instanceMatrix.needsUpdate=true;ref.current.instanceColor.needsUpdate=true;});
 return <instancedMesh ref={ref} args={[undefined,undefined,pts.length]}><sphereGeometry args={[.045,8,6]}/><meshBasicMaterial toneMapped={false}/></instancedMesh>;
}

// Bậc thềm: mép trước ở z = -25.275 / -25.695 / -26.115, mặt bậc cao 0.24 / 0.5 / 0.76, sàn sân khấu 0.96 từ z = -26.5
function RedCarpet(){
 const levels=[0,.24,.5,.76,STAGE_Y],edges=[-25.275,-25.695,-26.115,FRONT_Z],W=3.2,o=.006;
 const parts=[];
 for(let j=0;j<4;j++){
  const h=levels[j+1]-levels[j];parts.push({pos:[0,levels[j]+h/2,edges[j]+o],rot:[0,0,0],size:[W,h]}); // mặt đứng bậc
  if(j<3){const d=edges[j]-edges[j+1];parts.push({pos:[0,levels[j+1]+o,edges[j]-d/2],rot:[-Math.PI/2,0,0],size:[W,d]});} // mặt bậc
 }
 parts.push({pos:[0,STAGE_Y+o,FRONT_Z-1.1],rot:[-Math.PI/2,0,0],size:[W,2.2]}); // trên sàn sân khấu
 return parts.map((p,i)=><mesh key={i} receiveShadow position={p.pos} rotation={p.rot}><planeGeometry args={p.size}/><meshStandardMaterial color="#b3122e" roughness={.9}/></mesh>);
}

// ---------- 10 vũ công áo dài múa sẵn trên sân khấu ----------
// Khi người chơi nhấn F tham gia, người đó thay chỗ vũ công ở ô được xếp (vũ công ô đó ẩn đi); rời đi thì vũ công quay lại.
// Đội hình xen kẽ nữ / nam (hàng trước N-n-N-n-N-n, hàng sau n-N-n-N), ai cũng cầm hoa hai tay
export const DANCER_LOOKS=[
 {f:true,ao:'#c8102e'},{f:false,ao:'#1d3f8f'},{f:true,ao:'#ffffff'},{f:false,ao:'#8b1020'},{f:true,ao:'#e75480'},{f:false,ao:'#1d3f8f'},
 {f:false,ao:'#8b1020'},{f:true,ao:'#f6c344'},{f:false,ao:'#1d3f8f'},{f:true,ao:'#1d6fb8'},
];
const SKIN='#e8b892',HAIR='#1b1410';
const BOUQUET_COLORS=['#ff4d6d','#ffd23f','#ffffff','#ff8fab','#c9184a'];
// Bó hoa cầm tay (gắn vào bàn tay → giơ tay lên là hoa giơ theo)
function Bouquet({seed}){
 const blooms=useMemo(()=>Array.from({length:6},(_,i)=>{const a=i/6*Math.PI*2+seed;return {p:[Math.cos(a)*.065,-.7-Math.abs(Math.sin(a*1.7))*.03,Math.sin(a)*.065],c:BOUQUET_COLORS[(i+seed)%BOUQUET_COLORS.length]};}),[seed]);
 return <group>
  <mesh position={[0,-.6,0]}><cylinderGeometry args={[.025,.012,.18,6]}/><meshStandardMaterial color="#3f7d33"/></mesh>
  <mesh position={[0,-.66,0]}><coneGeometry args={[.11,.12,8,1,true]}/><meshStandardMaterial color="#fff4e6" side={THREE.DoubleSide}/></mesh>
  <mesh position={[0,-.73,0]}><sphereGeometry args={[.05,8,6]}/><meshStandardMaterial color="#c8102e" roughness={.6}/></mesh>
  {blooms.map((b,i)=><mesh key={i} position={b.p}><sphereGeometry args={[.042,7,5]}/><meshStandardMaterial color={b.c} roughness={.6}/></mesh>)}
 </group>;
}
// pos/rot: đặt ở chỗ khác (VD sân khấu nhà đa năng); linked=false → không bị người chơi thay chỗ
export function NpcDancer({slot,look,pos,rot=0,linked=true}){
 const root=useRef(),panels=useRef(),pose=useMemo(()=>({}),[]);
 const {f,ao}=look,pants=ao==='#ffffff'?'#c8102e':'#ffffff';
 useFrame(()=>{
  const r=root.current;if(!r)return;
  let taken=linked&&localStage.slot===slot;if(linked&&!taken)for(const m of network.meta.values())if(m.stage===slot){taken=true;break;}
  r.parent.visible=!taken;if(taken)return;
  dancePose(STAGE_DANCE,beatNow(),pose);applyDance(r,pose,1); // cùng nhịp với người chơi đang múa → cả đội đồng loạt
  r.position.set(pose.sway,-.83+pose.y,0);r.rotation.set(pose.pitch,pose.yaw,pose.roll);
  // tà áo dài bay theo nhịp bước
  // tà trước xoè ra trước (xoay âm), tà sau xoè ra sau; xoè nhiều hơn khi lắc người hoặc nhấc gối
  if(panels.current){const flare=.08+.6*Math.abs(pose.sway)+Math.max(0,-(pose.thighXL+pose.thighXR))*.3;panels.current.children.forEach((c,i)=>{c.rotation.x=(i?1:-1)*flare;});}
 });
 const [x,y,z]=pos??STAGE_SLOTS[slot],sh=f?.27:.3; // vai nữ hẹp hơn
 return <group position={[x,y,z]} rotation={[0,rot,0]} scale={f?.95:1}><group ref={root}>
  {f?<>
   {/* NỮ: thân áo dài ôm eo, cổ áo vàng, hai tà dài trước/sau, tóc dài cài hoa */}
   <mesh castShadow position={[0,1.18,0]}><capsuleGeometry args={[.2,.34,6,12]}/><meshStandardMaterial color={ao} roughness={.45}/></mesh>
   <mesh position={[0,1.44,0]}><cylinderGeometry args={[.07,.08,.08,12]}/><meshStandardMaterial color={ao} roughness={.45}/></mesh>
   <group ref={panels} position={[0,.98,0]}>
    {/* mỗi tà áo xoay quanh mép eo (pivot), dài ~0,8 m xuống gần mắt cá */}
    <group position={[0,0,.12]}><mesh castShadow position={[0,-.4,0]}><boxGeometry args={[.36,.8,.02]}/><meshStandardMaterial color={ao} roughness={.45}/></mesh></group>
    <group position={[0,0,-.12]}><mesh castShadow position={[0,-.4,0]}><boxGeometry args={[.36,.8,.02]}/><meshStandardMaterial color={ao} roughness={.45}/></mesh></group>
   </group>
   <mesh castShadow position={[0,1.66,0]}><sphereGeometry args={[.2,16,12]}/><meshStandardMaterial color={SKIN}/></mesh>
   <mesh position={[0,1.74,-.02]}><sphereGeometry args={[.215,16,10,0,Math.PI*2,0,Math.PI*.6]}/><meshStandardMaterial color={HAIR}/></mesh>
   <mesh position={[0,1.38,-.17]}><boxGeometry args={[.34,.62,.06]}/><meshStandardMaterial color={HAIR}/></mesh>
   <mesh position={[.16,1.84,.04]}><sphereGeometry args={[.055,8,6]}/><meshStandardMaterial color="#ff4d6d"/></mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*.07,1.68,.185]}><sphereGeometry args={[.018,6,6]}/><meshStandardMaterial color="#2a1a14"/></mesh>)}
  </>:<>
   {/* NAM: áo dài nam (tà ngắn hơn), khăn đóng */}
   <mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[.25,.36,6,12]}/><meshStandardMaterial color={ao} roughness={.5}/></mesh>
   <mesh castShadow position={[0,.74,0]}><cylinderGeometry args={[.25,.3,.42,12,1,true]}/><meshStandardMaterial color={ao} roughness={.5} side={THREE.DoubleSide}/></mesh>
   <mesh castShadow position={[0,1.67,0]}><sphereGeometry args={[.225,16,12]}/><meshStandardMaterial color={SKIN}/></mesh>
   <mesh position={[0,1.82,0]}><cylinderGeometry args={[.23,.235,.13,16]}/><meshStandardMaterial color={ao==='#1d3f8f'?'#1d3f8f':'#c8a24a'} roughness={.6}/></mesh>
   <mesh position={[0,1.82,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.232,.025,6,18]}/><meshStandardMaterial color="#f6c344" metalness={.5} roughness={.35}/></mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*.075,1.69,.205]}><sphereGeometry args={[.02,6,6]}/><meshStandardMaterial color="#2a1a14"/></mesh>)}
  </>}
  <mesh position={[0,1.36,f?.2:.24]}><torusGeometry args={[.07,.016,6,14,Math.PI]}/><meshStandardMaterial color="#f6c344" metalness={.6} roughness={.3}/></mesh>
  {[-1,1].map(s=><group key={s}>
   <group name="thigh" position={[s*(f?.1:.12),.82,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[f?.085:.09,.18,5,10]}/><meshStandardMaterial color={pants}/></mesh>
    <group name="shin" position={[0,-.36,0]}><mesh position={[0,-.18,0]}><capsuleGeometry args={[f?.09:.08,.18,5,10]}/><meshStandardMaterial color={pants}/></mesh><mesh position={[0,-.37,.06]}><boxGeometry args={[.16,.09,.26]}/><meshStandardMaterial color={f?'#f6c344':'#1b1410'}/></mesh></group></group>
   <group name="arm" position={[s*sh,1.36,0]}><mesh position={[0,-.24,0]}><capsuleGeometry args={[f?.065:.075,.39,5,10]}/><meshStandardMaterial color={ao} roughness={.5}/></mesh><mesh position={[0,-.52,0]}><sphereGeometry args={[.065,10,10]}/><meshStandardMaterial color={SKIN}/></mesh><Bouquet seed={slot*2+(s>0?1:0)}/></group>
  </group>)}
 </group></group>;
}
function StageDancers({event}){const group=useRef();useFrame(()=>{if(group.current)group.current.visible=stageDancersVisible(currentHour(),event)});return <group ref={group} visible={stageDancersVisible(currentHour(),event)}>{STAGE_SLOTS.slice(0,10).map((_,i)=><NpcDancer key={i} slot={i} look={DANCER_LOOKS[i]}/>)}</group>;}

export function TeachersDayStage({event}){
 const decor=useMemo(buildDecor,[]);
 const ribbonTex=useCanvasTexture(512,64,drawRibbon);
 const res=useMemo(()=>({
  flower:new THREE.SphereGeometry(1,7,5),flowerMat:new THREE.MeshStandardMaterial({roughness:.55}),
  leaf:new THREE.SphereGeometry(1,6,4),leafMat:new THREE.MeshStandardMaterial({color:'#2f7d32',roughness:.8}),
  balloon:new THREE.SphereGeometry(1,14,10),balloonMat:new THREE.MeshStandardMaterial({roughness:.25,metalness:.1}),
  rod:new THREE.CylinderGeometry(.018,.018,1,6),rodMat:new THREE.MeshStandardMaterial({color:'#c9a24a',metalness:.7,roughness:.35}),
  bowl:new THREE.CylinderGeometry(.3,.18,.26,14,1,true),bowlMat:new THREE.MeshStandardMaterial({color:'#a8743f',roughness:.95,side:THREE.DoubleSide}),
 }),[]);
 useEffect(()=>()=>Object.values(res).forEach(v=>v.dispose?.()),[res]);
 const applyFlower=useMemo(()=>(d,f)=>{d.position.set(f.x,f.y,f.z);d.rotation.set(0,0,0);d.scale.setScalar(f.s);},[]);
 const applyLeaf=useMemo(()=>(d,l)=>{d.position.set(l.x,l.y,l.z);d.rotation.set(0,0,l.rz);d.scale.set(l.s*1.6,l.s*.55,l.s*.35);},[]);
 const applyBalloon=useMemo(()=>(d,b)=>{d.position.set(b.x,b.y,b.z);d.rotation.set(0,0,0);d.scale.set(b.s,b.s*1.18,b.s);},[]);
 const up=useMemo(()=>new THREE.Vector3(0,1,0),[]);
 const applyRod=useMemo(()=>(d,m)=>{const a=new THREE.Vector3(...m.from),b=new THREE.Vector3(...m.to),dir=b.clone().sub(a);d.position.copy(a).add(b).multiplyScalar(.5);d.quaternion.setFromUnitVectors(up,dir.clone().normalize());d.scale.set(1,dir.length(),1);d.rotation.setFromQuaternion(d.quaternion);},[up]);
 const applyBowl=useMemo(()=>(d,p)=>{d.position.set(...p);d.rotation.set(0,0,0);d.scale.setScalar(1);},[]);
 const balloonRef=useRef();
 return <group>
  <Backdrop/>
  <StageDancers event={event}/>
  {/* đèn vàng ấm dưới mái sân khấu — làm hoa và phông nổi bật khi trời tối */}
  {[-4.5,4.5].map(x=><pointLight key={x} position={[x,5.6,-27.2]} color="#ffd9a0" intensity={18} distance={16} decay={1.6}/>)}
  <FairyLights/>
  <Bunting/>
  {/* hoa, lá, bóng bay, chân lẵng, giỏ: mỗi loại 1 lệnh vẽ */}
  <Instanced items={decor.flowers} geometry={res.flower} material={res.flowerMat} apply={applyFlower}/>
  <Instanced items={decor.leaves} geometry={res.leaf} material={res.leafMat} apply={applyLeaf}/>
  <group ref={balloonRef}><Instanced items={decor.balloons} geometry={res.balloon} material={res.balloonMat} apply={applyBalloon}/></group>
  <Instanced items={decor.metal} geometry={res.rod} material={res.rodMat} apply={applyRod}/>
  <Instanced items={decor.wicker} geometry={res.bowl} material={res.bowlMat} apply={applyBowl}/>
  {/* ruy băng trên mỗi lẵng */}
  {decor.ribbons.map((rb,i)=><mesh key={i} position={rb.pos} rotation={[0,rb.yaw,rb.tilt]}><planeGeometry args={[1.05,.13]}/><meshStandardMaterial map={ribbonTex} side={THREE.DoubleSide}/></mesh>)}
  {/* bồn hoa gỗ dọc mép sân khấu */}
  {PLANTERS.map(([cx])=><mesh key={cx} castShadow receiveShadow position={[cx,STAGE_Y+.18,FRONT_Z-.32]}><boxGeometry args={[3.4,.36,.5]}/><meshStandardMaterial color="#f4efe2" roughness={.8}/></mesh>)}
  {/* thảm đỏ phủ theo từng bậc thềm giữa rồi kéo lên sàn sân khấu */}
  <RedCarpet/>
  {/* không đi xuyên lẵng hoa / bồn hoa */}
  <RigidBody type="fixed" colliders={false}>
   {BASKETS.map(([x,y,z],i)=><CylinderCollider key={i} args={[1.2,.42]} position={[x,y+1.2,z]}/>)}
  </RigidBody>
 </group>;
}

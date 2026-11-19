// Hình nhân vật theo hồ sơ (dùng chung: nhân vật của mình, người chơi khác ở gần, xem trước khi chọn nhân vật).
// Gốc toạ độ ở bàn chân. Các khớp đặt tên 'thigh' / 'shin' / 'arm' để đi bộ, ngồi, nhảy, múa điều khiển được.
//  - Học sinh mùa hè: áo sơ mi trắng, quần xanh đậm, cặp sau lưng. Nữ: chân váy xếp ly xanh than, tất trắng, ba lô hồng, nơ cổ áo.
//  - Nhân vật nữ (học sinh & cô giáo): dáng thon, eo nhỏ, vai hẹp, tóc dài buộc nơ, môi hồng.
//  - Học sinh mùa đông: áo khoác đồng phục xanh than phối sọc trắng ngang ngực, cổ đứng, logo trường ở ngực trái; quần kaki.
//  - Cô giáo: áo dài (chọn màu), quần trắng, tóc dài, tay ôm giáo án.
//  - Thầy giáo: áo vest (chọn màu), sơ mi trắng, cà vạt, tay xách cặp da; có ria mép vểnh xoăn 2 đầu hoặc không.
import React,{useRef} from 'react';
import * as THREE from 'three';
import {decodeLook,AO_DAI_COLORS,VEST_COLORS} from './profile';
import {useMergeStatic} from './mergeStatic';

const SKIN='#dcad88',HAIR='#232b32';
const M=({c,...p})=><meshStandardMaterial color={c} roughness={.75} {...p}/>;

// Logo trường trên áo khoác mùa đông: miếng vải trắng viền đỏ, biểu tượng "AD" đỏ + chữ TRƯỜNG THPT / AN DƯƠNG (vẽ 1 lần, dùng chung)
let logoTex=null;
function schoolLogo(){
 if(logoTex)return logoTex;
 const c=document.createElement('canvas');c.width=320;c.height=200;const g=c.getContext('2d');
 g.fillStyle='#ffffff';g.fillRect(0,0,320,200);g.strokeStyle='#c8102e';g.lineWidth=10;g.strokeRect(5,5,310,190);
 // biểu tượng: cuốn sách đỏ mở + chữ AD
 g.fillStyle='#c8102e';g.beginPath();g.moveTo(22,40);g.lineTo(78,52);g.lineTo(134,40);g.lineTo(134,160);g.lineTo(78,172);g.lineTo(22,160);g.closePath();g.fill();
 g.fillStyle='#ffffff';g.font='italic 900 64px Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('AD',78,108);
 g.fillStyle='#f6c344';g.fillRect(70,40,16,8);
 g.fillStyle='#c8102e';g.font='800 34px Arial, sans-serif';g.fillText('TRƯỜNG',228,66);g.fillText('THPT',228,106);
 g.fillStyle='#1d3f8f';g.font='900 30px Arial, sans-serif';g.fillText('AN DƯƠNG',228,148);
 logoTex=new THREE.CanvasTexture(c);logoTex.colorSpace=THREE.SRGBColorSpace;logoTex.anisotropy=4;return logoTex;
}

// Ria mép vểnh (handlebar): dày ở giữa, thon dần ra 2 bên rồi xoăn tròn lên ở đầu mút; bám theo mặt (đầu bán kính 0.225, tâm y 1.67)
let mustacheGeo=null;
function mustacheGeometry(){
 if(mustacheGeo)return mustacheGeo;
 const R=.236,onFace=(x,y)=>new THREE.Vector3(x,y,Math.sqrt(Math.max(0,R*R-x*x-(y-1.67)**2)));
 const half=[[.004,1.614],[.035,1.607],[.068,1.598],[.098,1.6],[.12,1.614],[.128,1.632],[.12,1.646],[.106,1.645],[.1,1.634],[.108,1.627]];
 const parts=[];
 for(const s of [-1,1]){
  const pts=half.map(([x,y])=>onFace(s*x,y)),curve=new THREE.CatmullRomCurve3(pts),n=48;
  const g=new THREE.TubeGeometry(curve,n,1,8,false),pos=g.attributes.position,center=new THREE.Vector3(),v=new THREE.Vector3();
  // thon dần: bán kính 0.019 ở giữa → 0.006 ở đầu mút (co từng vòng ống quanh tâm đường cong)
  for(let i=0;i<=n;i++){const t=i/n,r=.019*(1-t)+.006*t;curve.getPointAt(t,center);for(let j=0;j<=8;j++){const k=i*9+j;v.fromBufferAttribute(pos,k).sub(center).normalize().multiplyScalar(r).add(center);pos.setXYZ(k,v.x,v.y,v.z);}}
  g.computeVertexNormals();parts.push(g);
 }
 const merged=new THREE.BufferGeometry(),pos=[],idx=[];let off=0;
 for(const g of parts){pos.push(...g.attributes.position.array);for(const i of g.index.array)idx.push(i+off);off+=g.attributes.position.count;}
 merged.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));merged.setIndex(idx);merged.computeVertexNormals();
 mustacheGeo=merged;return merged;
}

function outfit({teacher,female,winter,color}){
 if(teacher&&female){const c=(AO_DAI_COLORS[color]??AO_DAI_COLORS[0])[0];return {top:c,sleeve:c,pants:c==='#f4f1ea'?'#f8f6f0':'#f5f3ec',shoes:'#e9e2d6',aoDai:true};}
 if(teacher){const c=(VEST_COLORS[color]??VEST_COLORS[0])[0];return {top:c,sleeve:c,pants:'#2c4059',shoes:'#141414',suit:true};/* chỉ đổi màu áo vest; quần giữ màu xanh đậm như học sinh nam */}
 if(winter)return {top:'#1f2f5c',sleeve:'#1f2f5c',pants:'#8f8a5c',shoes:'#263039',jacket:true,bag:true};
 return {top:'#edf2ef',sleeve:'#edf2ef',pants:'#2c4059',shoes:'#263039',tag:true,bag:true,skirt:female,skirtC:'#24365a'};
}

export function AvatarBody({look=0,eyes=true,expression=null,joinedSide=0,fireHair=false}){
 const mergeRef=useRef();useMergeStatic(mergeRef,'joint',[look,eyes,expression,joinedSide,fireHair]); // mỗi khớp còn vài khối thay vì hàng chục mảnh
 const L=decodeLook(look),o=outfit(L);
 const hair=fireHair?{c:'#ff6820',emissive:'#ff3608',emissiveIntensity:.85}:{c:HAIR};
 // Nữ: thân thon (eo nhỏ), vai hẹp, tay chân mảnh; tóc dài buộc nơ; môi hồng; học sinh nữ ba lô hồng, mùa hè mặc chân váy xếp ly
 const F=L.female,torsoR=F?.205:.25,R=torsoR+.007,armX=F?.285:.32,armR=F?.068:.085,thighR=F?.088:.105,shinR=F?.078:.09;
 const legC=F&&o.skirt?SKIN:o.pants,bagC=F?(L.winter?'#d9668f':'#f08bb0'):(L.winter?'#2a2a2a':'#58766e');
 const bookSide=joinedSide===-1?1:-1,caseSide=joinedSide===1?-1:1;
 const lx=.11,lz=Math.sqrt(R*R-lx*lx);   // logo áp lên mặt cong của thân
 return <group ref={mergeRef}>
  {/* thân (nữ: thêm phần eo thắt lại) */}
  <mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[torsoR,.36,6,12]}/><M c={o.top}/></mesh>
  {F&&<mesh position={[0,1.0,0]}><cylinderGeometry args={[torsoR-.005,torsoR-.035,.14,16]}/><M c={o.skirt?o.skirtC:o.top}/></mesh>}
  {o.jacket&&<>
   {/* sọc trắng ngang ngực + sọc trắng nhỏ ở bụng, cổ đứng, khoá kéo, logo trường */}
   <mesh position={[0,1.27,0]}><cylinderGeometry args={[R,R,.17,20,1,true]}/><M c="#f2f4f6" side={2}/></mesh>
   <mesh position={[0,1.05,0]}><cylinderGeometry args={[R,R,.08,20,1,true]}/><M c="#f2f4f6" side={2}/></mesh>
   <mesh position={[0,1.47,0]}><cylinderGeometry args={[F?.11:.13,F?.13:.15,.1,16]}/><M c="#1f2f5c"/></mesh>
   <mesh position={[0,1.13,torsoR+.002]}><boxGeometry args={[.015,.52,.01]}/><M c="#d9dde3"/></mesh>
   {/* logo trường ở ngực trái (phía +x khi nhân vật quay mặt +z) */}
   <mesh position={[lx,1.16,lz]} rotation={[0,Math.atan2(lx,lz),0]}><planeGeometry args={[F?.115:.13,F?.072:.081]}/><meshStandardMaterial map={schoolLogo()} roughness={.7}/></mesh>
  </>}
  {o.suit&&<>
   {/* cổ sơ mi trắng chữ V + cà vạt đỏ, cúc áo */}
   <mesh position={[0,1.37,.2]} rotation={[-.25,0,Math.PI/4]}><boxGeometry args={[.13,.13,.02]}/><M c="#ffffff"/></mesh>
   <mesh position={[0,1.2,.252]}><boxGeometry args={[.055,.3,.012]}/><M c="#a3122a"/></mesh>
   {[1.06,.96].map(y=><mesh key={y} position={[0,y,.252]}><sphereGeometry args={[.015,6,6]}/><M c="#111"/></mesh>)}
  </>}
  {o.aoDai&&<>
   {/* cổ áo đứng, 2 tà áo dài trước / sau */}
   <mesh position={[0,1.44,0]}><cylinderGeometry args={[.07,.08,.09,12]}/><M c={o.top}/></mesh>
   {[.12,-.12].map(z=><mesh key={z} castShadow position={[0,.56,z]}><boxGeometry args={[.32,.82,.02]}/><M c={o.top}/></mesh>)}
  </>}
  {/* chân váy xếp ly (học sinh nữ mùa hè) */}
  {o.skirt&&<>
   <mesh castShadow position={[0,.76,0]}><cylinderGeometry args={[.215,.3,.34,16]}/><M c={o.skirtC}/></mesh>
   {Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2;return <mesh key={i} position={[Math.sin(a)*.284,.67,Math.cos(a)*.284]} rotation={[0,a,0]}><boxGeometry args={[.012,.15,.02]}/><M c="#1b2b45"/></mesh>;})}
  </>}
  {o.tag&&!F&&<mesh position={[0,1.29,.24]}><boxGeometry args={[.055,.27,.025]}/><M c="#285775"/></mesh>}
  {o.tag&&F&&<group position={[0,1.37,.19]}>{/* nơ cổ áo */}{[-1,1].map(s=><mesh key={s} position={[s*.045,0,0]} rotation={[0,0,s*Math.PI/2]}><coneGeometry args={[.035,.07,8]}/><M c="#24365a"/></mesh>)}<mesh><sphereGeometry args={[.018,8,8]}/><M c="#24365a"/></mesh></group>}
  {o.bag&&<mesh position={[0,1.17,-torsoR]}><capsuleGeometry args={[F?.16:.18,F?.17:.2,5,12]}/><M c={bagC}/></mesh>}
  {/* đầu, tóc */}
  <group name="head" position={[0,1.67,0]}><group position={[0,-1.67,0]}>
  <mesh castShadow position={[0,1.67,0]}><sphereGeometry args={[F?.198:.225,20,16]}/><M c={SKIN}/></mesh>
  <mesh castShadow position={[0,F?1.775:1.79,-.025]}><sphereGeometry args={[F?.206:.23,20,12,0,Math.PI*2,0,Math.PI*.58]}/><M {...hair}/></mesh>
  {F&&<>
   {/* tóc đen phủ kín nửa sau đầu (không lộ da gáy), tóc dài xoã sau lưng, 2 lọn hai bên má, nơ buộc tóc */}
   <mesh castShadow position={[0,1.67,-.012]}><sphereGeometry args={[.206,20,16,Math.PI,Math.PI,0,Math.PI*.86]}/><M {...hair}/></mesh>
   {/* học sinh nữ: kẹp tóc hình bông hoa (5 cánh hồng, nhuỵ vàng) đính trên tóc, phía trước đỉnh đầu */}
   {!L.teacher&&<group position={[-.095,1.835,.115]} rotation={[-.9,-.6,0]}>
    {Array.from({length:5},(_,i)=>{const a=i/5*Math.PI*2;return <mesh key={i} position={[Math.cos(a)*.034,Math.sin(a)*.034,0]} scale={[1,1,.5]}><sphereGeometry args={[.026,10,8]}/><M c="#ff6fa5"/></mesh>;})}
    <mesh position={[0,0,.01]}><sphereGeometry args={[.018,10,8]}/><M c="#ffd23f"/></mesh>
   </group>}
   {/* học sinh nữ: 2 bím tóc tết vắt ra trước vai, buộc chun cuối bím (cô giáo không có) */}
   {!L.teacher&&[-1,1].map(s=><group key={'b'+s}>
    {[[.17,1.56,.03],[.185,1.49,.09],[.18,1.42,.15],[.165,1.35,.195],[.155,1.28,.215],[.15,1.21,.222],[.148,1.14,.226]].map(([x,y,z],i)=>
     <mesh key={i} position={[s*(x+(i%2?.012:-.012)),y,z]} rotation={[.3,0,(i%2?1:-1)*.5]}><sphereGeometry args={[.042-i*.002,10,8]}/><M {...hair}/></mesh>)}
    <mesh position={[s*.148,1.095,.226]}><sphereGeometry args={[.022,8,8]}/><M c={L.teacher?'#f6c344':'#e75480'}/></mesh>
   </group>)}
   <mesh castShadow position={[0,1.45,-.15]}><boxGeometry args={[.36,.62,.09]}/><M {...hair}/></mesh>
   <mesh position={[0,1.14,-.15]}><sphereGeometry args={[.18,12,8,0,Math.PI*2,Math.PI/2,Math.PI/2]}/><M {...hair}/></mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*.18,1.6,-.03]}><boxGeometry args={[.05,.3,.14]}/><M {...hair}/></mesh>)}
   <group position={[0,1.73,-.22]}>
    {[-1,1].map(s=><mesh key={s} position={[s*.06,0,0]} rotation={[0,0,s*.6]}><coneGeometry args={[.05,.1,8]}/><M c={L.teacher?'#f6c344':'#e75480'}/></mesh>)}
    <mesh><sphereGeometry args={[.025,8,8]}/><M c={L.teacher?'#f6c344':'#e75480'}/></mesh>
   </group>
   <mesh position={[0,1.59,.184]} rotation={[0,0,Math.PI]}><torusGeometry args={[.032,.01,6,10,Math.PI]}/><M c="#d9576b"/></mesh>
  </>}
  {L.teacher&&!F&&L.beard&&<mesh geometry={mustacheGeometry()}><M c="#2a2420" roughness={.6}/></mesh>/* ria mép vểnh, xoăn 2 đầu */}
  {eyes&&[-1,1].map(s=><mesh key={s} position={[s*(F?.068:.078),1.69,F?.18:.204]} scale={[1,expression==='kiss'?.2:1,1]}><sphereGeometry args={[F?.023:.022,8,8]}/><M c="#253039"/></mesh>)}
  {/* chân */}
  </group></group>
  {[-1,1].map(s=><group key={s} name="thigh" position={[s*(F?.11:.14),.82,0]}>
   <mesh position={[0,-.18,0]}><capsuleGeometry args={[o.aoDai?.1:thighR,.18,5,12]}/><M c={legC}/></mesh>
   <group name="shin" position={[0,-.36,0]}>
    <mesh position={[0,-.18,0]}><capsuleGeometry args={[o.aoDai?.095:shinR,.18,5,12]}/><M c={legC}/></mesh>
    {o.skirt&&<mesh position={[0,-.3,0]}><cylinderGeometry args={[shinR+.006,shinR+.006,.12,10]}/><M c="#ffffff"/></mesh>}
    <mesh position={[0,-.37,.07]}><boxGeometry args={[F?.17:.21,.13,F?.3:.34]}/><M c={o.shoes} roughness={o.suit?.35:.75}/></mesh>
   </group>
  </group>)}
  {/* tay */}
  {[-1,1].map(s=><group key={s} name="arm" position={[s*armX,1.36,0]}>
   {/* cô giáo: tay trái gập ra trước ôm giáo án vào ngực */}
   <group rotation={o.aoDai&&s===bookSide?[-.8,0,-s*.78]:[0,0,0]}>
    <mesh position={[0,-.24,0]}><capsuleGeometry args={[armR,.39,5,10]}/><M c={o.sleeve}/></mesh>
    {o.jacket&&<mesh position={[0,-.12,0]}><cylinderGeometry args={[armR+.006,armR+.006,.12,12,1,true]}/><M c="#f2f4f6" side={2}/></mesh>}
    {o.suit&&<mesh position={[0,-.46,0]}><cylinderGeometry args={[.07,.07,.04,10]}/><M c="#ffffff"/></mesh>}
    <mesh position={[0,-.52,0]}><sphereGeometry args={[F?.07:.083,10,10]}/><M c={SKIN}/></mesh>
    {o.aoDai&&s===bookSide&&<group position={[.03,-.48,.1]} rotation={[.8,0,-.55]}>
     <mesh><boxGeometry args={[.26,.34,.035]}/><M c="#2a5caa"/></mesh>
     <mesh position={[0,0,.02]}><boxGeometry args={[.2,.26,.005]}/><M c="#f6f1e2"/></mesh>
    </group>}
    {/* thầy giáo: tay phải xách cặp da */}
    {o.suit&&s===caseSide&&<group position={[0,-.78,0]}>
     <mesh castShadow><boxGeometry args={[.09,.28,.4]}/><M c="#4a2e1c" roughness={.5}/></mesh>
     <mesh position={[0,.17,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.06,.012,6,12,Math.PI]}/><M c="#2a1a10"/></mesh>
     <mesh position={[.047,.06,0]}><boxGeometry args={[.004,.04,.08]}/><M c="#c8a24a" metalness={.6}/></mesh>
    </group>}
   </group>
  </group>)}
 </group>;
}

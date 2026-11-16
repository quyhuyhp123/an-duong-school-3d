import React,{useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Stars} from '@react-three/drei';
import * as THREE from 'three';

// Ánh sáng theo giờ thực trong ngày (giờ máy người chơi).
// Mỗi mốc: giờ, màu trời/sương mù, màu trời & đất của đèn bán cầu, cường độ, ánh sáng nền, màu & cường độ mặt trời (ban đêm là ánh trăng).
const KEYS=[
 {h:0,   sky:'#0b1426',hemi:'#2a3b66',ground:'#1a1a22',hemiI:.35,amb:.12,sun:'#9fb4ff',sunI:.35,stars:1},
 {h:4.5, sky:'#0b1426',hemi:'#2a3b66',ground:'#1a1a22',hemiI:.35,amb:.12,sun:'#9fb4ff',sunI:.35,stars:1},
 {h:5.4, sky:'#4a5878',hemi:'#7c86b0',ground:'#4a4038',hemiI:.55,amb:.18,sun:'#ffb07a',sunI:.45,stars:.4}, // tờ mờ sáng
 {h:6.4, sky:'#f2b98c',hemi:'#ffd6b0',ground:'#8a7a5c',hemiI:.85,amb:.25,sun:'#ffbe84',sunI:1.1,stars:0},  // bình minh
 {h:8,   sky:'#c8dce6',hemi:'#eaf5ff',ground:'#a49a6c',hemiI:1.1,amb:.35,sun:'#ffffff',sunI:1.8,stars:0},  // ban ngày
 {h:16,  sky:'#c8dce6',hemi:'#eaf5ff',ground:'#a49a6c',hemiI:1.1,amb:.35,sun:'#ffffff',sunI:1.8,stars:0},
 {h:17.4,sky:'#f3c79a',hemi:'#ffe0bd',ground:'#9a8660',hemiI:.95,amb:.3, sun:'#ffc88a',sunI:1.4,stars:0},  // nắng chiều
 {h:18.2,sky:'#c9876f',hemi:'#d9a3a0',ground:'#6a5a48',hemiI:.65,amb:.22,sun:'#ff9a60',sunI:.7, stars:0},  // hoàng hôn
 {h:19,  sky:'#2e3a5e',hemi:'#5a6690',ground:'#2e2a2a',hemiI:.45,amb:.15,sun:'#a8b4e0',sunI:.4, stars:.5}, // chập tối
 {h:20.3,sky:'#0b1426',hemi:'#2a3b66',ground:'#1a1a22',hemiI:.35,amb:.12,sun:'#9fb4ff',sunI:.35,stars:1},
 {h:24,  sky:'#0b1426',hemi:'#2a3b66',ground:'#1a1a22',hemiI:.35,amb:.12,sun:'#9fb4ff',sunI:.35,stars:1},
];
const COLORS=['sky','hemi','ground','sun'],NUMBERS=['hemiI','amb','sunI','stars'];
const ca=new THREE.Color(),cb=new THREE.Color();

// Cho phép xem thử một giờ cố định: http://localhost:5173/?hour=18.5
const fixedHour=(()=>{const v=parseFloat(new URLSearchParams(location.search).get('hour'));return Number.isFinite(v)?((v%24)+24)%24:null})();
export function currentHour(){if(fixedHour!==null)return fixedHour;const d=new Date();return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600;}
// Độ "tối" 0..1 theo giờ: 0 ban ngày, tăng dần lúc chập tối (17:36 → 19:00), giảm dần lúc rạng sáng (05:00 → 06:24).
// Đèn sân trường và đèn lớp học dùng giá trị này để bật/tắt mượt.
export function nightFactor(h=currentHour()){
 if(h>=19||h<5)return 1;
 if(h>=17.6)return THREE.MathUtils.smoothstep(h,17.6,19);
 if(h<6.4)return 1-THREE.MathUtils.smoothstep(h,5,6.4);
 return 0;
}

function sample(h){
 const i=KEYS.findIndex((k,j)=>h>=k.h&&h<KEYS[j+1]?.h),a=KEYS[i],b=KEYS[i+1],t=THREE.MathUtils.smoothstep(h,a.h,b.h),out={};
 for(const c of COLORS)out[c]=ca.set(a[c]).lerp(cb.set(b[c]),t).clone();
 for(const n of NUMBERS)out[n]=THREE.MathUtils.lerp(a[n],b[n],t);
 return out;
}

export function DayCycle(){
 const {scene}=useThree();
 const hemi=useRef(),amb=useRef(),sun=useRef(),stars=useRef(),last=useRef(-1);
 useFrame(state=>{
  // Thời gian thay đổi chậm nên chỉ cập nhật mỗi giây
  if(state.clock.elapsedTime-last.current<1&&last.current>=0)return;last.current=state.clock.elapsedTime;
  const h=currentHour(),s=sample(h);
  if(scene.background?.isColor)scene.background.copy(s.sky);else scene.background=s.sky.clone();
  if(scene.fog)scene.fog.color.copy(s.sky);
  hemi.current.color.copy(s.hemi);hemi.current.groundColor.copy(s.ground);hemi.current.intensity=s.hemiI;
  amb.current.intensity=s.amb;
  // Mặt trời mọc hướng đông (6h), lên đỉnh (12h), lặn hướng tây (18h); ban đêm đèn này thành mặt trăng đi cung đối diện
  const a=(h-6)/12*Math.PI,elev=Math.max(.25,Math.abs(Math.sin(a)));
  sun.current.position.set(-Math.cos(a)*80,elev*65,30);
  sun.current.color.copy(s.sun);sun.current.intensity=s.sunI;
  if(stars.current)stars.current.visible=s.stars>.05;
 });
 return <>
  <hemisphereLight ref={hemi} args={['#eaf5ff','#a49a6c',1.1]}/><ambientLight ref={amb} intensity={.35}/>
  <directionalLight ref={sun} castShadow position={[25,60,30]} intensity={1.8} shadow-mapSize={[2048,2048]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-far={260} shadow-bias={-.001} shadow-normalBias={.08}/>
  <group ref={stars}><Stars radius={220} depth={60} count={2500} factor={6} fade speed={.4}/></group>
 </>;
}

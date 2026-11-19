// Tranh tường về thầy cô & học sinh trên đoạn tường tây (dọc lối đi lát gạch giữa tường và vườn).
// 6 bức tranh minh hoạ GỐC vẽ bằng canvas (không dùng ảnh có bản quyền trên mạng).
// Muốn thay bằng ảnh thật của trường: đặt file ảnh vào public/murals/ và liệt kê trong public/murals/murals.json,
// ví dụ ["le-khai-giang.jpg","thay-co-2025.jpg"] — ảnh thứ i thay cho tranh thứ i.
import React,{useEffect,useMemo,useState} from 'react';
import * as THREE from 'three';

// Mặt trong tường tây ở x = -36.15 (tường dày 0.2, tâm -36.25). Tranh quay mặt về phía +x (lối đi).
const WALL_X=-36.12,START_Z=5.3,PANEL_W=4.6,PANEL_H=1.75,BASE_Y=.17,WALL_LEN=6*4.6+5*.35; // đoạn tường dùng: z 5.3 → 34.65
const SANS="'Be Vietnam Pro', Arial, sans-serif",SERIF="'Playfair Display', Georgia, serif";
const SKIN=['#f1c9a5','#e8b892','#d9a37a'];

// ---------- Bộ vẽ nhân vật phẳng ----------
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function limb(g,x,y,len,angle,width,color){g.save();g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.sin(angle)*len,y+Math.cos(angle)*len);g.stroke();g.restore();return [x+Math.sin(angle)*len,y+Math.cos(angle)*len];}
function flowers(g,x,y,s){const c=['#ff4d6d','#ffd23f','#ffffff','#ff8fab','#c9184a'];g.fillStyle='#3f7d33';g.fillRect(x-2*s,y,4*s,14*s);for(let i=0;i<6;i++){const a=i/6*Math.PI*2;g.fillStyle=c[i%c.length];g.beginPath();g.arc(x+Math.cos(a)*7*s,y-4*s+Math.sin(a)*5*s,5*s,0,Math.PI*2);g.fill();}g.fillStyle='#ffd23f';g.beginPath();g.arc(x,y-4*s,4*s,0,Math.PI*2);g.fill();}
function book(g,x,y,s,color='#1d6fb8'){g.fillStyle=color;g.save();g.translate(x,y);g.rotate(-.15);g.fillRect(-12*s,-9*s,24*s,18*s);g.fillStyle='#fff';g.fillRect(-1*s,-9*s,2*s,18*s);g.restore();}
// p: {x, y (chân), h (chiều cao px), skin, hair:'short'|'long'|'bun', top, bottom, skirt, aodai, scarf, glasses, armL, armR (rad, 0 = buông xuôi, π = giơ thẳng lên), hold:'flowers'|'book'|'chalk', face: 1|-1}
function person(g,p){
 const s=p.h/170,x=p.x,y=p.y,skin=p.skin??SKIN[0],top=p.top??'#ffffff',bottom=p.bottom??'#1f3b73';
 const hip=y-78*s,shoulder=y-128*s,headY=y-148*s;
 // chân / váy / tà áo dài
 if(p.aodai){g.fillStyle=p.bottom??'#ffffff';rr(g,x-14*s,hip-4*s,28*s,82*s,8*s);g.fill();g.fillStyle=top;g.beginPath();g.moveTo(x-16*s,hip-6*s);g.lineTo(x+16*s,hip-6*s);g.lineTo(x+20*s,y-8*s);g.lineTo(x-20*s,y-8*s);g.closePath();g.fill();}
 else if(p.skirt){g.fillStyle=bottom;g.beginPath();g.moveTo(x-16*s,hip-8*s);g.lineTo(x+16*s,hip-8*s);g.lineTo(x+24*s,hip+30*s);g.lineTo(x-24*s,hip+30*s);g.closePath();g.fill();g.strokeStyle=skin;g.lineWidth=9*s;g.lineCap='round';for(const d of [-8,8]){g.beginPath();g.moveTo(x+d*s,hip+28*s);g.lineTo(x+d*s,y-6*s);g.stroke();}}
 else{g.strokeStyle=bottom;g.lineWidth=14*s;g.lineCap='round';for(const d of [-8,8]){g.beginPath();g.moveTo(x+d*s,hip);g.lineTo(x+d*1.2*s,y-6*s);g.stroke();}}
 g.fillStyle='#2a2a2a';for(const d of [-9,9]){rr(g,x+d*s-8*s,y-9*s,16*s,8*s,3*s);g.fill();}
 // thân
 g.fillStyle=top;rr(g,x-19*s,shoulder-4*s,38*s,58*s,12*s);g.fill();
 if(p.aodai){g.fillStyle='#f6c344';g.fillRect(x-6*s,shoulder-6*s,12*s,4*s);}
 if(p.scarf){g.fillStyle='#d62828';g.beginPath();g.moveTo(x-12*s,shoulder);g.lineTo(x+12*s,shoulder);g.lineTo(x+2*s,shoulder+26*s);g.closePath();g.fill();}
 // tay
 const handL=limb(g,x-17*s,shoulder+6*s,42*s,p.armL??-.15,10*s,top),handR=limb(g,x+17*s,shoulder+6*s,42*s,p.armR??.15,10*s,top);
 for(const h of [handL,handR]){g.fillStyle=skin;g.beginPath();g.arc(h[0],h[1],6*s,0,Math.PI*2);g.fill();}
 if(p.hold==='flowers')flowers(g,handR[0],handR[1]-4*s,s);
 if(p.hold==='book')book(g,(handL[0]+handR[0])/2,(handL[1]+handR[1])/2-6*s,s,p.bookColor);
 if(p.hold==='chalk'){g.fillStyle='#fff';g.fillRect(handR[0]-2*s,handR[1]-10*s,4*s,10*s);}
 // đầu, tóc, mặt
 g.fillStyle=skin;g.fillRect(x-5*s,shoulder-12*s,10*s,10*s);
 if(p.hair==='long'){g.fillStyle='#1b1410';rr(g,x-21*s,headY-6*s,42*s,62*s,16*s);g.fill();}
 g.fillStyle=skin;g.beginPath();g.arc(x,headY,19*s,0,Math.PI*2);g.fill();
 g.fillStyle=p.hairColor??'#1b1410';g.beginPath();g.arc(x,headY-3*s,20*s,Math.PI*1.02,Math.PI*1.98);g.fill();
 if(p.hair==='bun'){g.beginPath();g.arc(x,headY-22*s,9*s,0,Math.PI*2);g.fill();}
 if(p.hair==='short'){g.fillRect(x-20*s,headY-6*s,6*s,8*s);}
 const f=p.face??0;g.fillStyle='#2a1a14';for(const d of [-7,7]){g.beginPath();g.arc(x+(d+f*3)*s,headY+1*s,2.2*s,0,Math.PI*2);g.fill();}
 g.strokeStyle='#a0413a';g.lineWidth=2*s;g.beginPath();g.arc(x+f*3*s,headY+7*s,6*s,.15*Math.PI,.85*Math.PI);g.stroke();
 g.fillStyle='rgba(255,120,120,.35)';for(const d of [-12,12]){g.beginPath();g.arc(x+(d+f*2)*s,headY+6*s,4*s,0,Math.PI*2);g.fill();}
 if(p.glasses){g.strokeStyle='#2a2a2a';g.lineWidth=2*s;for(const d of [-7,7]){g.beginPath();g.arc(x+(d+f*3)*s,headY+1*s,5.5*s,0,Math.PI*2);g.stroke();}}
}
const sky=(g,W,H,a='#bfe3ff',b='#fff6e0')=>{const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,a);gr.addColorStop(1,b);g.fillStyle=gr;g.fillRect(0,0,W,H);};
const sun=(g,x,y,r)=>{g.fillStyle='rgba(255,210,80,.35)';g.beginPath();g.arc(x,y,r*1.6,0,Math.PI*2);g.fill();g.fillStyle='#ffc93c';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
function tree(g,x,y,s){g.fillStyle='#7a5434';g.fillRect(x-8*s,y-90*s,16*s,90*s);g.fillStyle='#3f8f3a';for(const [dx,dy,r] of [[0,-130,55],[-45,-100,40],[45,-100,40],[-25,-150,38],[30,-150,36]]){g.beginPath();g.arc(x+dx*s,y+dy*s,r*s,0,Math.PI*2);g.fill();}g.fillStyle='rgba(255,255,255,.08)';g.beginPath();g.arc(x-15*s,y-150*s,25*s,0,Math.PI*2);g.fill();}
function school(g,x,y,w,h){g.fillStyle='#f3d27a';g.fillRect(x,y-h,w,h);g.fillStyle='#b5442d';g.beginPath();g.moveTo(x-10,y-h);g.lineTo(x+w/2,y-h-h*.35);g.lineTo(x+w+10,y-h);g.closePath();g.fill();g.fillStyle='#2e6b8a';for(let i=0;i<5;i++)for(let j=0;j<2;j++)g.fillRect(x+12+i*(w-24)/5,y-h+12+j*h*.42,(w-24)/5-10,h*.28);g.fillStyle='#d62828';g.fillRect(x+w/2-1,y-h-h*.35-30,2,30);g.fillRect(x+w/2+1,y-h-h*.35-30,18,12);}
function caption(g,W,H,text){g.fillStyle='rgba(122,35,53,.92)';rr(g,W/2-300,H-58,600,46,23);g.fill();g.fillStyle='#fff6e0';g.font=`700 26px ${SANS}`;g.textAlign='center';g.textBaseline='middle';g.fillText(text,W/2,H-34);}
function frame(g,W,H){g.strokeStyle='#5b3a22';g.lineWidth=18;g.strokeRect(9,9,W-18,H-18);g.strokeStyle='#c49a6c';g.lineWidth=4;g.strokeRect(20,20,W-40,H-40);}

// ---------- 6 bức tranh ----------
const SCENES=[
 {title:'Thầy cô – người lái đò thầm lặng',draw(g,W,H){
  sky(g,W,H,'#ffd6a5','#fff1d6');sun(g,W-170,110,48);
  g.fillStyle='#6fa86b';g.beginPath();g.moveTo(W-330,H*.62);g.quadraticCurveTo(W-150,H*.5,W,H*.58);g.lineTo(W,H*.66);g.lineTo(W-330,H*.66);g.fill();school(g,W-230,H*.6,150,70);
  g.fillStyle='#4f9dc9';g.fillRect(0,H*.62,W,H*.38);g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=3;for(let i=0;i<14;i++){const x=40+i*75,y=H*.7+(i%3)*28;g.beginPath();g.arc(x,y,16,Math.PI*1.1,Math.PI*1.9);g.stroke();}
  g.fillStyle='#8b5a2b';g.beginPath();g.moveTo(170,H*.72);g.lineTo(640,H*.72);g.lineTo(590,H*.82);g.lineTo(220,H*.82);g.closePath();g.fill();
  person(g,{x:250,y:H*.74,h:150,aodai:true,top:'#c8102e',hair:'bun',armR:2.4,armL:2.2,face:1});
  g.strokeStyle='#5b3a22';g.lineWidth=7;g.beginPath();g.moveTo(205,H*.5);g.lineTo(150,H*.88);g.stroke();
  for(const [i,x] of [[0,360],[1,450],[2,540]])person(g,{x,y:H*.74,h:120,top:'#fff',bottom:i===1?'#1f3b73':'#1f3b73',skirt:i===1,hair:i===1?'long':'short',scarf:true,armR:i===2?2.6:.3,face:1,skin:SKIN[i]});
  caption(g,W,H,this.title);}},
 {title:'Giờ học trên lớp',draw(g,W,H){
  g.fillStyle='#f6ecd6';g.fillRect(0,0,W,H);g.fillStyle='#e9d9b6';g.fillRect(0,H*.72,W,H*.28);
  g.fillStyle='#5b3a22';g.fillRect(250,40,560,210);g.fillStyle='#2f5d46';g.fillRect(262,52,536,186);
  g.fillStyle='#fff';g.font=`700 64px ${SERIF}`;g.textAlign='center';g.fillText('20 – 11',530,130);g.font=`500 28px ${SANS}`;g.fillText('Tôn sư trọng đạo',530,180);g.font=`400 22px ${SANS}`;g.fillText('a² + b² = c²   ·   H₂O   ·   Văn học Việt Nam',530,220);
  person(g,{x:170,y:H*.86,h:190,top:'#ffffff',bottom:'#3a3a3a',hair:'short',glasses:true,armR:2.35,hold:'chalk',face:1});
  for(let i=0;i<5;i++){const x=470+i*110;g.fillStyle='#a8743f';g.fillRect(x-48,H*.79,96,14);person(g,{x,y:H*.97,h:110,top:'#fff',skirt:i%2===1,hair:i%2?'long':'short',scarf:true,armR:i===1||i===3?Math.PI*.95:.2,face:-1,skin:SKIN[i%3]});}
  caption(g,W,H,this.title);}},
 {title:'Kính chúc thầy cô ngày 20/11',draw(g,W,H){
  sky(g,W,H,'#ffe3ea','#fff6ef');
  for(let i=0;i<26;i++){const x=(i*137)%W,y=(i*71)%(H*.7);g.fillStyle=['#ff8fab','#ffd23f','#ff4d6d'][i%3];g.beginPath();g.ellipse(x,y,6,10,i,0,Math.PI*2);g.fill();}
  g.fillStyle='#c1121f';rr(g,W/2-250,38,500,62,12);g.fill();g.fillStyle='#f6c344';g.font=`700 34px ${SANS}`;g.textAlign='center';g.textBaseline='middle';g.fillText('KÍNH CHÚC THẦY CÔ',W/2,70);
  person(g,{x:380,y:H*.88,h:200,aodai:true,top:'#1d6fb8',hair:'long',armL:-.3,armR:-1.3,face:1});
  person(g,{x:560,y:H*.88,h:150,top:'#fff',skirt:true,hair:'long',scarf:true,armR:-1.6,armL:-1.2,hold:'flowers',face:-1,skin:SKIN[1]});
  person(g,{x:700,y:H*.88,h:145,top:'#fff',hair:'short',scarf:true,armR:Math.PI*.9,face:-1,skin:SKIN[2]});
  g.fillStyle='#ff4d6d';for(const [x,y,r] of [[470,150,14],[505,125,10],[640,160,12]]){g.beginPath();g.arc(x-r/2,y,r/2,Math.PI,0);g.arc(x+r/2,y,r/2,Math.PI,0);g.lineTo(x,y+r);g.closePath();g.fill();}
  caption(g,W,H,this.title);}},
 {title:'Đọc sách dưới tán cây',draw(g,W,H){
  sky(g,W,H,'#cfeeff','#f2ffe8');g.fillStyle='#8cc26a';g.fillRect(0,H*.7,W,H*.3);
  tree(g,520,H*.74,1.6);
  person(g,{x:390,y:H*.92,h:130,top:'#fff',hair:'short',scarf:true,armL:-2.2,armR:2.2,hold:'book',face:1});
  person(g,{x:650,y:H*.92,h:130,top:'#fff',skirt:true,hair:'long',scarf:true,armL:-2.2,armR:2.2,hold:'book',bookColor:'#c8102e',face:-1,skin:SKIN[1]});
  person(g,{x:820,y:H*.92,h:175,aodai:true,top:'#f6c344',hair:'bun',armL:-.2,armR:-.9,face:-1});
  g.fillStyle='#ffffff';g.font=`italic 600 26px ${SERIF}`;g.textAlign='left';g.fillText('“Học, học nữa, học mãi”',60,90);
  caption(g,W,H,this.title);}},
 {title:'Giờ ra chơi',draw(g,W,H){
  sky(g,W,H,'#bfe3ff','#fffbe8');school(g,560,H*.62,380,120);g.fillStyle='#d9b49a';g.fillRect(0,H*.62,W,H*.38);
  person(g,{x:190,y:H*.9,h:140,top:'#fff',skirt:true,hair:'long',scarf:true,armL:-2.6,armR:2.6,face:1});
  g.strokeStyle='#ff4d6d';g.lineWidth=4;g.beginPath();g.ellipse(190,H*.68,85,95,0,Math.PI*.05,Math.PI*.95,true);g.stroke();
  person(g,{x:390,y:H*.9,h:140,top:'#fff',hair:'short',scarf:true,armL:-.9,armR:1.1,face:1,skin:SKIN[2]});
  g.fillStyle='#f6c344';g.beginPath();g.arc(470,H*.55,9,0,Math.PI*2);g.fill();g.strokeStyle='#d62828';g.lineWidth=3;for(let i=0;i<4;i++){g.beginPath();g.moveTo(470,H*.55);g.lineTo(462+i*5,H*.55-26);g.stroke();}
  person(g,{x:520,y:H*.9,h:140,top:'#fff',hair:'short',scarf:true,armL:-1,armR:1.6,face:-1,skin:SKIN[1]});
  person(g,{x:840,y:H*.9,h:180,top:'#ffffff',bottom:'#3a3a3a',hair:'short',glasses:true,armL:-.2,armR:-.2,face:-1});
  caption(g,W,H,this.title);}},
 {title:'Ước mơ bay xa',draw(g,W,H){
  sky(g,W,H,'#9fd3ff','#fff4dc');
  const cols=['#ff4d6d','#ff8c42','#ffd23f','#2bb673','#1d6fb8','#7b4dff'];for(let i=0;i<6;i++){g.strokeStyle=cols[i];g.lineWidth=12;g.beginPath();g.arc(W/2,H*.95,360-i*12,Math.PI,0);g.stroke();}
  for(const [x,y,r] of [[210,90,-.3],[420,60,.2],[700,85,-.1],[860,140,.35]]){g.save();g.translate(x,y);g.rotate(r);g.fillStyle='#fff';g.beginPath();g.moveTo(-26,0);g.lineTo(26,-8);g.lineTo(-6,10);g.closePath();g.fill();g.restore();}
  for(const [x,y,r] of [[300,120,.3],[560,80,-.2],[760,110,.25]]){g.save();g.translate(x,y);g.rotate(r);g.fillStyle='#1b1b2e';g.fillRect(-26,-5,52,10);g.fillRect(-12,0,24,14);g.fillStyle='#f6c344';g.fillRect(18,0,3,22);g.restore();}
  for(let i=0;i<4;i++)person(g,{x:250+i*170,y:H*.9,h:145,top:'#fff',skirt:i%2===1,hair:i%2?'long':'short',scarf:true,armL:-Math.PI*.85,armR:Math.PI*.85,skin:SKIN[i%3]});
  caption(g,W,H,this.title);}},
];

function makeTexture(scene){
 const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*PANEL_H/PANEL_W);
 const g=c.getContext('2d');scene.draw.call(scene,g,c.width,c.height);frame(g,c.width,c.height);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

export function WallMurals(){
 const [custom,setCustom]=useState([]);
 const drawn=useMemo(()=>SCENES.map(makeTexture),[]);
 // vẽ lại khi font web tải xong (lần đầu có thể là font dự phòng)
 useEffect(()=>{let live=true;document.fonts?.ready.then(()=>{if(!live)return;SCENES.forEach((s,i)=>{const g=drawn[i].image.getContext('2d');s.draw.call(s,g,drawn[i].image.width,drawn[i].image.height);frame(g,drawn[i].image.width,drawn[i].image.height);drawn[i].needsUpdate=true;});});return()=>{live=false;};},[drawn]);
 // Ảnh thật (nếu có public/murals/murals.json)
 useEffect(()=>{let live=true;const base=import.meta.env.BASE_URL+'murals/';
  fetch(base+'murals.json?v=an-duong-2').then(r=>r.ok?r.json():[]).then(list=>{if(!live||!Array.isArray(list))return;const loader=new THREE.TextureLoader();
   list.slice(0,SCENES.length).forEach((name,i)=>loader.load(base+name,t=>{if(!live)return;t.colorSpace=THREE.SRGBColorSpace;setCustom(c=>{const n=[...c];n[i]=t;return n;});}));}).catch(()=>{});
  return()=>{live=false;};},[]);
 useEffect(()=>()=>drawn.forEach(t=>t.dispose()),[drawn]);
 // Bề rộng mỗi tranh theo đúng tỉ lệ ảnh (không méo); các tranh chia đều trên đoạn tường WALL_LEN
 const tex=SCENES.map((_,i)=>custom[i]??drawn[i]);
 const widths=tex.map(t=>{const im=t.image;return im&&im.width?PANEL_H*im.width/im.height:PANEL_W;});
 const total=widths.reduce((a,b)=>a+b,0),gap=Math.max(.25,(WALL_LEN-total)/(widths.length-1));
 let z=START_Z;
 return <group>{tex.map((t,i)=>{const w=widths[i],cz=z+w/2;z+=w+gap;const framed=!!custom[i];return <group key={i} position={[WALL_X,BASE_Y+PANEL_H/2,cz]} rotation={[0,Math.PI/2,0]}>
  {/* khung gỗ quanh ảnh thật (tranh vẽ sẵn đã có khung trong ảnh) */}
  {framed&&<mesh position={[0,0,-.004]} receiveShadow><planeGeometry args={[w+.14,PANEL_H+.14]}/><meshStandardMaterial color="#5b3a22" roughness={.8}/></mesh>}
  {framed&&<mesh position={[0,0,-.002]}><planeGeometry args={[w+.05,PANEL_H+.05]}/><meshStandardMaterial color="#c49a6c" roughness={.7}/></mesh>}
  <mesh receiveShadow><planeGeometry args={[w,PANEL_H]}/><meshStandardMaterial map={t} roughness={.9}/></mesh>
 </group>;})}</group>;
}

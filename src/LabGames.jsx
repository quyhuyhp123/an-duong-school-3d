// Máy tính phòng tin học (dãy B, tầng 3): ngồi vào ghế (F) → nút "Chơi game" (hoặc phím G) mở màn hình máy.
//  - Mỗi máy được gán ngẫu nhiên 1 trong 3 game (đổi theo ngày, mọi người cùng thấy giống nhau):
//      plane  — Máy bay giấy: chạm / Space để bay lên, luồn qua khe giữa các chồng sách.
//      merge  — Ghép số: trượt các ô số, 2 ô cùng số chạm nhau thì ghép lại.
//      tower  — Xếp nhà cao tầng: cần cẩu đung đưa tầng nhà, chạm / Space để thả cho khớp lên tầng dưới.
//  - Điểm ghi CHUNG theo từng game (mọi máy cùng game chung 1 bảng xếp hạng ngày, giữ top 5 hôm trước) — /api/basketball?game=…
//  - Máy số 12 (lab-11, cuối hàng 2) luôn cố định: màn hình "DESIGNED BY TQH 12A3K50"; các máy khác (kể cả máy 6) chơi game ngẫu nhiên.
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {getProfile} from './profile';
import {serverUrl} from './serverUrl';

import {LAB_GAMES} from './labInfo';
import {sfx,getVolume,setVolume} from './labSfx';   // hiệu ứng âm thanh tổng hợp (Web Audio)

/** Loa chỉnh âm lượng hiệu ứng game: kéo thanh trượt; bấm biểu tượng loa để tắt / bật lại mức cũ. Mặc định ở giữa. */
function VolumeControl(){
 const [v,setV]=useState(getVolume),last=useRef(getVolume()||50);
 const change=n=>{setVolume(n);setV(getVolume());if(n>0)last.current=n;};
 const icon=v===0?'🔇':v<34?'🔈':v<67?'🔉':'🔊';
 return <div className="lab-vol" title={`Âm lượng ${v}%`}>
  <button type="button" className="lab-vol-btn" aria-label={v?'Tắt âm thanh game':'Bật âm thanh game'} onClick={()=>{change(v?0:last.current);if(!v)sfx.point();}}>{icon}</button>
  <input type="range" min="0" max="100" step="5" value={v} aria-label="Âm lượng game" style={{'--p':v+'%'}}
   onChange={e=>change(Number(e.target.value))} onPointerUp={e=>{sfx.point();e.currentTarget.blur();}} onKeyDown={e=>e.stopPropagation()}/>   {/* thả chuột → bỏ focus để Space / phím mũi tên lại điều khiển game */}
  <span className="lab-vol-num">{v}</span>
 </div>;
}

function clientId(){try{let id=localStorage.getItem('school-client-id');if(!id){id=crypto.randomUUID();localStorage.setItem('school-client-id',id);}return id;}catch{return '';}}
async function api(game,method,body,retry=2){
 let r;
 try{r=await fetch(serverUrl('/api/basketball?game='+game),{method,headers:{'Content-Type':'application/json','X-Client-Id':clientId()},body:body?JSON.stringify(body):undefined});}
 catch(e){if(retry>0){await new Promise(ok=>setTimeout(ok,2500));return api(game,method,body,retry-1);}throw new Error('Không kết nối được máy chủ.');}
 // bị giới hạn tốc độ (chơi lại quá nhanh / nhiều người cùng wifi) hoặc server vừa thức dậy → tự gửi lại, không làm mất điểm
 if((r.status===429||r.status>=500)&&retry>0){await new Promise(ok=>setTimeout(ok,3200));return api(game,method,body,retry-1);}
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Không kết nối được máy chủ.');return d;
}
const fmtDay=d=>d?d.split('-').reverse().join('/'):'';
const fmt=n=>Number(n).toLocaleString('vi-VN');
const useRaf=(fn,on=true)=>{const ref=useRef(fn);ref.current=fn;useEffect(()=>{if(!on)return;let id,last=performance.now();const loop=t=>{const dt=Math.min(.033,(t-last)/1000);last=t;ref.current(dt,t/1000);id=requestAnimationFrame(loop);};id=requestAnimationFrame(loop);return()=>cancelAnimationFrame(id);},[on]);};
/** canvas sắc nét trên màn hình mật độ điểm ảnh cao: vẽ theo toạ độ logic W×H */
function useCanvas(W,H){const ref=useRef();useEffect(()=>{const c=ref.current,r=Math.min(2,window.devicePixelRatio||1);c.width=W*r;c.height=H*r;c.getContext('2d').setTransform(r,0,0,r,0,0);},[W,H]);return ref;}
const isTyping=e=>e.target?.closest?.('input,textarea,select');

// ───────────────────────── Máy bay giấy ─────────────────────────
function PlaneGame({onOver}){
 const W=480,H=640,FLOOR=H-46,PX=130,PW=66;
 const cv=useCanvas(W,H),s=useRef({y:H/2,vy:0,started:false,dead:false,pipes:[],score:0,t:0,dist:0,flash:0});
 const flap=useCallback(()=>{const g=s.current;if(g.dead)return;g.started=true;g.vy=-410;sfx.flap();},[]);
 useEffect(()=>{const k=e=>{if(isTyping(e))return;if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)flap();}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[flap]);
 useRaf((dt,now)=>{
  const g=s.current,ctx=cv.current?.getContext('2d');if(!ctx)return;g.t+=dt;
  const speed=165+Math.min(95,g.score*3),gap=Math.max(138,178-g.score*1.4);
  if(g.started&&!g.dead){
   g.vy+=1450*dt;g.y+=g.vy*dt;g.dist+=speed*dt;
   if(!g.pipes.length||g.pipes[g.pipes.length-1].x<W-240)g.pipes.push({x:W+20,gy:110+Math.random()*(FLOOR-260),gap,seed:Math.random()*1e6|0,passed:false});
   for(const p of g.pipes){p.x-=speed*dt;if(!p.passed&&p.x+PW<PX){p.passed=true;g.score++;g.flash=.25;sfx.point();}}
   g.pipes=g.pipes.filter(p=>p.x>-PW-10);
   if(g.y<12){g.y=12;g.vy=0;}
   const hitPipe=g.pipes.some(p=>PX+11>p.x&&PX-11<p.x+PW&&(g.y-10<p.gy-p.gap/2||g.y+10>p.gy+p.gap/2));
   if(hitPipe||g.y>FLOOR-10){g.dead=true;g.vy=-200;sfx.hit();if(hitPipe)sfx.fall();setTimeout(()=>{sfx.over();onOver(g.score);},700);}
  }else if(!g.started){g.y=H/2+Math.sin(g.t*3)*10;}
  else{g.vy+=1450*dt;g.y=Math.min(FLOOR-10,g.y+g.vy*dt);}
  // nền: bầu trời đêm kiểu màn hình máy tính, lưới neon trôi, mặt bàn gỗ
  const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0a0f2c');bg.addColorStop(.7,'#1d2f6f');bg.addColorStop(1,'#3a2b6b');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#4cc9f022';ctx.lineWidth=1;const off=(g.dist*.3)%40;
  for(let x=-off;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,FLOOR);ctx.stroke();}
  for(let y=0;y<FLOOR;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  for(let i=0;i<40;i++){const x=(i*97-g.dist*.08)%W,y=(i*53)%(FLOOR-120);ctx.fillStyle=`rgba(255,255,255,${.25+.25*Math.sin(now*2+i)})`;ctx.fillRect((x+W)%W,y,2,2);}
  // chồng sách
  const COL=['#e63946','#f4a261','#2a9d8f','#e9c46a','#8ecae6','#b5179e','#90be6d','#ffffff'];
  for(const p of g.pipes){
   const top=p.gy-p.gap/2,bot=p.gy+p.gap/2;
   const stack=(y0,y1,dir)=>{let y=dir>0?y0:y1,k=0;while(dir>0?y<y1:y>y0){const h=20+((p.seed>>k)%3)*4,c=COL[(p.seed+k*7)%COL.length],jit=((p.seed>>(k%16))%7)-3;const yy=dir>0?y:y-h;
     ctx.fillStyle=c;ctx.fillRect(p.x+jit,yy,PW,h-1);ctx.fillStyle='#0003';ctx.fillRect(p.x+jit+PW-10,yy,10,h-1);ctx.fillStyle='#fff8';ctx.fillRect(p.x+jit+6,yy+h/2-2,PW-24,3);y+=dir*h;k++;}};
   stack(top-400,top,-1);stack(bot,FLOOR,1);
   ctx.strokeStyle='#4cc9f0';ctx.lineWidth=2;ctx.shadowColor='#4cc9f0';ctx.shadowBlur=10;ctx.strokeRect(p.x-3,top-6,PW+6,6);ctx.strokeRect(p.x-3,bot,PW+6,6);ctx.shadowBlur=0;
  }
  ctx.fillStyle='#7a4a24';ctx.fillRect(0,FLOOR,W,H-FLOOR);ctx.fillStyle='#9b6232';ctx.fillRect(0,FLOOR,W,8);
  ctx.fillStyle='#5a3418';for(let x=-(g.dist%60);x<W;x+=60)ctx.fillRect(x,FLOOR+20,40,3);
  // máy bay giấy
  ctx.save();ctx.translate(PX,g.y);ctx.rotate(Math.max(-.5,Math.min(1.2,g.vy/600)));
  ctx.shadowColor='#bde0fe';ctx.shadowBlur=14;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(-16,-12);ctx.lineTo(-8,0);ctx.lineTo(-16,11);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle='#cfd8e6';ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(-8,0);ctx.lineTo(-16,11);ctx.closePath();ctx.fill();ctx.restore();
  // điểm
  g.flash=Math.max(0,g.flash-dt);ctx.textAlign='center';ctx.font=`900 ${54+g.flash*40}px "Be Vietnam Pro",sans-serif`;ctx.fillStyle='#fff';ctx.shadowColor='#f72585';ctx.shadowBlur=18;ctx.fillText(g.score,W/2,86);ctx.shadowBlur=0;
  if(!g.started){ctx.font='700 20px "Be Vietnam Pro",sans-serif';ctx.fillStyle='#fffc';ctx.fillText('Nhấn Space / chạm để cất cánh',W/2,H/2+70);}
 });
 return <canvas ref={cv} className="lab-canvas" style={{aspectRatio:`${W}/${H}`}} onPointerDown={e=>{e.preventDefault();flap();}}/>;
}

// ───────────────────────── Ghép số ─────────────────────────
const N=4;
function slide(grid,dir){ // dir: 0 trái, 1 phải, 2 lên, 3 xuống → {grid,gain,moved,merged:Set}
 const out=Array(16).fill(0),merged=new Set();let gain=0,moved=false;
 for(let a=0;a<N;a++){
  const idx=[];for(let b=0;b<N;b++){const k=dir<2?b:b;const r=dir<2?a:k,c=dir<2?k:a;idx.push(r*N+c);}
  if(dir===1||dir===3)idx.reverse();
  const vals=idx.map(i=>grid[i]).filter(Boolean),res=[];
  for(let i=0;i<vals.length;i++){if(vals[i]===vals[i+1]){res.push(vals[i]*2);gain+=vals[i]*2;merged.add(idx[res.length-1]);i++;}else res.push(vals[i]);}
  idx.forEach((gi,i)=>{out[gi]=res[i]??0;if(out[gi]!==grid[gi])moved=true;});
 }
 return {grid:out,gain,moved,merged};
}
const addTile=g=>{const empty=g.map((v,i)=>v?-1:i).filter(i=>i>=0);if(!empty.length)return -1;const i=empty[Math.random()*empty.length|0];g[i]=Math.random()<.9?2:4;return i;};
const canMove=g=>g.some(v=>!v)||g.some((v,i)=>(i%N<N-1&&v===g[i+1])||(i<N*(N-1)&&v===g[i+N]));
function MergeGame({onOver}){
 const [st,setSt]=useState(()=>{const g=Array(16).fill(0);addTile(g);addTile(g);return {grid:g,score:0,best:0,move:0,merged:new Set(),fresh:-1,over:false};});
 const ref=useRef(st);ref.current=st;
 const move=useCallback(dir=>{
  const cur=ref.current;if(cur.over)return;const r=slide(cur.grid,dir);if(!r.moved)return;
  if(r.merged.size)sfx.merge(Math.max(...[...r.merged].map(i=>r.grid[i])));else sfx.slide();
  const g=r.grid,fresh=addTile(g),over=!canMove(g),score=cur.score+r.gain;
  setSt({grid:g,score,move:cur.move+1,merged:r.merged,fresh,over,best:Math.max(cur.best,...g)});
  if(over)setTimeout(()=>{sfx.over();onOver(score);},900);
 },[onOver]);
 useEffect(()=>{const k=e=>{if(isTyping(e))return;const d={ArrowLeft:0,KeyA:0,ArrowRight:1,KeyD:1,ArrowUp:2,KeyW:2,ArrowDown:3,KeyS:3}[e.code];if(d!=null){e.preventDefault();move(d);}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[move]);
 const sw=useRef(null);
 return <div className="mg-wrap">
  <div className="mg-top"><div className="mg-score"><small>ĐIỂM</small><b>{fmt(st.score)}</b></div><div className="mg-score"><small>Ô LỚN NHẤT</small><b>{st.best||Math.max(...st.grid)}</b></div>
   <button className="lab-btn ghost" onClick={()=>{if(!st.over){setSt(x=>({...x,over:true}));onOver(st.score);}}}>Kết thúc &amp; lưu điểm</button></div>
  <div className="mg-grid" onPointerDown={e=>{sw.current=[e.clientX,e.clientY];}} onPointerUp={e=>{if(!sw.current)return;const dx=e.clientX-sw.current[0],dy=e.clientY-sw.current[1];sw.current=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;move(Math.abs(dx)>Math.abs(dy)?(dx<0?0:1):(dy<0?2:3));}}>
   {st.grid.map((v,i)=><div key={i} className="mg-cell">{v?<div key={st.move+'-'+i} className={`mg-tile v${Math.min(v,4096)}${st.merged.has(i)?' pop':''}${st.fresh===i?' new':''}`}>{v}</div>:null}</div>)}
  </div>
 </div>;
}

// ───────────────────────── Xếp nhà cao tầng ─────────────────────────
function TowerGame({onOver}){
 const W=480,H=640,BW=128,BH=50,GROUND=H-60,PAL=[['#f2b632','#b97f12'],['#e05a47','#9c3022'],['#3aa6a0','#1f6c68'],['#f1e3c2','#b59f72'],['#7b8cde','#46539a']];
 const cv=useCanvas(W,H);
 const s=useRef({tower:[{x:W/2,c:3}],state:'hang',phase:0,drop:null,falling:[],score:0,lives:3,cam:0,combo:0,pop:null,over:false,t:0,city:Array.from({length:14},(_,i)=>({x:i*38-10,w:30+(i*37)%26,h:90+(i*71)%160}))});
 const drop=useCallback(()=>{const g=s.current;if(g.state!=='hang'||g.over)return;const top=g.tower.length*BH;g.state='drop';g.drop={x:hookX(g),y:top+200,vy:0};sfx.drop();},[]);
 function hookX(g){return W/2+Math.sin(g.phase)*150;}
 useEffect(()=>{const k=e=>{if(isTyping(e))return;if(['Space','ArrowDown','KeyS','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)drop();}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[drop]);
 const block=(ctx,x,y,c,rot=0,alpha=1)=>{ // x tâm, y đáy (toạ độ màn hình)
  const [f,d]=PAL[c%PAL.length];ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y-BH/2);ctx.rotate(rot);
  ctx.fillStyle=d;ctx.fillRect(-BW/2,-BH/2,BW,BH);ctx.fillStyle=f;ctx.fillRect(-BW/2+3,-BH/2+3,BW-6,BH-9);
  for(const wx of [-BW/4,BW/4]){ctx.fillStyle='#1d3557';ctx.fillRect(wx-17,-BH/2+10,34,24);ctx.fillStyle='#8ecae6';ctx.fillRect(wx-14,-BH/2+13,13,18);ctx.fillRect(wx+1,-BH/2+13,13,18);ctx.fillStyle='#fff6';ctx.fillRect(wx-14,-BH/2+13,4,18);}
  ctx.fillStyle='#0004';ctx.fillRect(-BW/2,BH/2-6,BW,6);ctx.restore();};
 useRaf((dt,now)=>{
  const g=s.current,ctx=cv.current?.getContext('2d');if(!ctx)return;g.t+=dt;
  const n=g.tower.length,top=n*BH,base=g.tower[0].x;
  g.phase+=dt*Math.min(3.3,1.5+(n-1)*.06);
  if(g.state==='drop'&&g.drop){
   const b=g.drop;b.vy+=2000*dt;b.y-=b.vy*dt;
   if(b.y<=top){
    const prev=g.tower[n-1],dx=b.x-prev.x;
    if(Math.abs(dx)<=BW*.72){
     let x=b.x,perfect=Math.abs(dx)<8;if(perfect){x=prev.x;g.combo++;}else g.combo=0;
     g.tower.push({x,c:(n+Math.floor(n/3))%PAL.length});g.score+=perfect?2:1;sfx.land();if(perfect)sfx.perfect(g.combo);
     g.pop={text:perfect?(g.combo>1?`Hoàn hảo ×${g.combo}! +2`:'Hoàn hảo! +2'):'+1',t:1,x,y:top+BH};
     const com=g.tower.slice(1).reduce((a,t)=>a+t.x,0)/(g.tower.length-1)-base;
     if(Math.abs(com)>BW*.62){g.over=true;g.collapse=1;sfx.collapse();setTimeout(()=>onOver(g.score),1200);}
     g.state='hang';g.drop=null;
    }else{g.falling.push({x:b.x,y:top,vy:0,vx:Math.sign(dx)*90,rot:0,c:n});g.lives--;g.combo=0;g.drop=null;g.state='hang';g.pop={text:'Trượt rồi!',t:1,x:b.x,y:top+BH};sfx.miss();
     if(g.lives<=0){g.over=true;setTimeout(()=>{sfx.over();onOver(g.score);},1100);}}
   }
  }
  for(const f of g.falling){f.vy+=1600*dt;f.y-=f.vy*dt;f.x+=f.vx*dt;f.rot+=f.vx/90*2.5*dt;}g.falling=g.falling.filter(f=>f.y>g.cam-400);
  g.cam+=(Math.max(0,top-300)-g.cam)*Math.min(1,dt*3);
  const sy=wy=>GROUND-(wy-g.cam);   // toạ độ thế giới (đáy, tính từ mặt đất) → màn hình
  // trời đổi màu theo độ cao: xanh → hoàng hôn → đêm sao
  const h=Math.min(1,g.cam/2500),sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,`hsl(${210+h*40},${70-h*20}%,${55-h*42}%)`);sky.addColorStop(1,`hsl(${200-h*170},${60+h*10}%,${78-h*40}%)`);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  if(h>.4)for(let i=0;i<50;i++){ctx.fillStyle=`rgba(255,255,255,${(h-.4)*1.4*(.5+.5*Math.sin(now*2+i))})`;ctx.fillRect((i*89)%W,(i*137+g.cam*.05)%H,2,2);}
  for(let i=0;i<4;i++){const cx=((i*170+now*12)%(W+160))-80,cy=90+i*120+g.cam*.2%H;ctx.fillStyle='#ffffff55';ctx.beginPath();ctx.ellipse(cx,cy%H,46,14,0,0,7);ctx.ellipse(cx+30,(cy-8)%H,30,12,0,0,7);ctx.fill();}
  for(const b of g.city){const y=GROUND+g.cam*.5;ctx.fillStyle='#1d355788';ctx.fillRect(b.x,y-b.h,b.w,b.h);ctx.fillStyle='#ffd16655';for(let k=12;k<b.h-6;k+=16)ctx.fillRect(b.x+6,y-b.h+k,4,6);}
  ctx.fillStyle='#4f772d';ctx.fillRect(0,sy(0),W,H);ctx.fillStyle='#90a955';ctx.fillRect(0,sy(0),W,6);
  // tháp (nghiêng nhẹ theo trọng tâm khi sắp đổ)
  const com=n>1?g.tower.slice(1).reduce((a,t)=>a+t.x,0)/(n-1)-base:0,lean=g.collapse?Math.min(1.2,(g.collapse+=dt*1.5)-1)*Math.sign(com||1):Math.sin(now*2.2)*Math.abs(com)/BW*.03;
  ctx.save();ctx.translate(base,sy(0));ctx.rotate(lean);ctx.translate(-base,-sy(0));
  g.tower.forEach((b,i)=>{if(i===0){ctx.fillStyle='#6c757d';ctx.fillRect(b.x-BW/2-10,sy(BH),BW+20,BH);ctx.fillStyle='#343a40';ctx.fillRect(b.x-14,sy(BH)+14,28,BH-14);ctx.fillStyle='#ffd166';ctx.font='700 11px "Be Vietnam Pro"';ctx.textAlign='center';ctx.fillText('THPT AN DƯƠNG',b.x,sy(BH)+11);}else block(ctx,b.x,sy(i*BH),b.c);});
  ctx.restore();
  if(Math.abs(com)>BW*.4&&!g.over){ctx.fillStyle='#ffb703';ctx.font='800 16px "Be Vietnam Pro"';ctx.textAlign='center';ctx.fillText('⚠ Tháp đang nghiêng!',W/2,H-18);}
  for(const f of g.falling)block(ctx,f.x,sy(f.y),f.c,f.rot,.9);
  // cần cẩu + tầng đang treo / đang rơi
  const hx=hookX(g),hy=sy(top+200);
  ctx.strokeStyle='#222';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W/2,-10);ctx.lineTo(g.state==='hang'?hx:W/2+Math.sin(g.phase)*150,hy-BH-6);ctx.stroke();
  if(g.state==='hang'&&!g.over){ctx.fillStyle='#ffb703';ctx.fillRect(hx-8,hy-BH-10,16,8);block(ctx,hx,hy,n);}
  if(g.drop)block(ctx,g.drop.x,sy(g.drop.y),n);
  if(g.pop){g.pop.t-=dt;ctx.globalAlpha=Math.max(0,g.pop.t);ctx.fillStyle='#fff';ctx.strokeStyle='#0008';ctx.lineWidth=4;ctx.font='900 24px "Be Vietnam Pro"';ctx.textAlign='center';const py=sy(g.pop.y)-20-(1-g.pop.t)*30;ctx.strokeText(g.pop.text,g.pop.x,py);ctx.fillText(g.pop.text,g.pop.x,py);ctx.globalAlpha=1;if(g.pop.t<=0)g.pop=null;}
  // HUD
  ctx.textAlign='left';ctx.fillStyle='#fff';ctx.strokeStyle='#0007';ctx.lineWidth=5;ctx.font='900 40px "Be Vietnam Pro"';ctx.strokeText(g.score,18,52);ctx.fillText(g.score,18,52);
  ctx.font='700 14px "Be Vietnam Pro"';ctx.strokeText(`${n-1} tầng`,20,74);ctx.fillText(`${n-1} tầng`,20,74);
  ctx.textAlign='right';ctx.font='24px sans-serif';ctx.fillText('❤️'.repeat(Math.max(0,g.lives))+'🤍'.repeat(3-Math.max(0,g.lives)),W-14,44);
  if(n===1&&g.state==='hang'){ctx.textAlign='center';ctx.font='700 19px "Be Vietnam Pro"';ctx.strokeText('Nhấn Space / chạm để thả tầng nhà',W/2,H/2+40);ctx.fillText('Nhấn Space / chạm để thả tầng nhà',W/2,H/2+40);}
 });
 return <canvas ref={cv} className="lab-canvas" style={{aspectRatio:`${W}/${H}`}} onPointerDown={e=>{e.preventDefault();drop();}}/>;
}

// ───────────────────────── Bảng xếp hạng chung ─────────────────────────
function Board({board,error}){
 const row=(e,i)=><li key={i} className={i<3?'top'+(i+1):''}><span className="lab-rank">{i+1}</span><span className="lab-name">{e.role==='teacher'?'GV · ':''}{e.name}{e.cls?<em> · {e.cls}</em>:null}</span><b>{fmt(e.score)}</b></li>;
 return <aside className="lab-board">
  <h3>🏆 Xếp hạng hôm nay</h3>
  <small>{board?`${fmtDay(board.day)} · ${board.total} người chơi · chung mọi máy`:'Đang tải…'}</small>
  {error&&<p className="lab-err">{error}</p>}
  <ol>{(board?.today??[]).map(row)}{board&&!board.today.length&&<li className="lab-empty">Chưa có ai ghi điểm — mở hàng nào!</li>}</ol>
  {board?.me&&<p className="lab-me">Kỷ lục của bạn hôm nay: <b>{fmt(board.me.best)}</b> · hạng <b>{board.me.rank}</b></p>}
  <h3>⭐ Top 5 hôm trước{board?.yesterday?` · ${fmtDay(board.yesterday.day)}`:''}</h3>
  <ol className="small">{(board?.yesterday?.top??[]).map(row)}{!board?.yesterday&&<li className="lab-empty">Chưa có dữ liệu.</li>}</ol>
 </aside>;
}

function GameScreen({game,machine,onClose}){
 const info=LAB_GAMES[game],[round,setRound]=useState(0),[result,setResult]=useState(null),[board,setBoard]=useState(null),[err,setErr]=useState('');
 useEffect(()=>{api(game,'GET').then(d=>{setBoard(d);setErr('');}).catch(e=>setErr(e.message));},[game]);
 useEffect(()=>{const k=e=>{if(e.code==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 const over=useCallback(async score=>{
  setResult({score,saving:true});const p=getProfile();
  try{const d=await api(game,'POST',{score,name:p?.name??'Ẩn danh',cls:p?.role==='teacher'?'':p?.cls??'',role:p?.role??'student'});setBoard(d);setResult({score,improved:d.improved,rank:d.me?.rank});setErr('');if(d.improved&&score>0)sfx.record();}
  catch(e){setResult({score,error:e.message});}
 },[game]);
 const Game={plane:PlaneGame,merge:MergeGame,tower:TowerGame}[game];
 return <div className="modal lab-modal" role="dialog" aria-modal="true" aria-label={info.title}>
  <section className="lab-panel">
   <header className="lab-head"><span className="lab-led"/><div><small>PHÒNG TIN HỌC · MÁY {machine}</small><h2>{info.icon} {info.title}</h2></div><VolumeControl/><button className="lab-x" onClick={onClose} aria-label="Đóng">×</button></header>
   <p className="lab-hint">{info.hint}</p>
   <div className="lab-layout">
    <div className="lab-screen">
     <Game key={round} onOver={over}/>
     {result&&<div className="lab-over"><small>KẾT THÚC</small><div className="lab-final">{fmt(result.score)}</div>
      <p>{result.saving?'Đang lưu điểm…':result.error?`Chưa lưu được: ${result.error}`:result.improved?`Kỷ lục mới của bạn hôm nay! Hạng ${result.rank}`:`Đã ghi nhận · hạng của bạn: ${result.rank??'—'}`}</p>
      <div className="lab-actions"><button className="lab-btn" onClick={()=>{setResult(null);setRound(r=>r+1);}}>Chơi lại</button><button className="lab-btn ghost" onClick={onClose}>Rời máy</button></div></div>}
    </div>
    <Board board={board} error={err}/>
   </div>
  </section>
 </div>;
}

// ───────────────────────── Máy đặc biệt: DESIGNED BY ─────────────────────────
function MatrixRain(){
 const ref=useRef();
 useEffect(()=>{const c=ref.current,ctx=c.getContext('2d');let id,cols=[];const chars='TQH12A3K50ANDUONG20152018アイウエオカキクケコ01'.split('');
  const fit=()=>{c.width=c.clientWidth;c.height=c.clientHeight;cols=Array.from({length:Math.ceil(c.width/16)},()=>Math.random()*-50);};fit();
  const loop=()=>{ctx.fillStyle='rgba(3,8,20,.14)';ctx.fillRect(0,0,c.width,c.height);ctx.font='15px monospace';
   cols.forEach((y,i)=>{const ch=chars[Math.random()*chars.length|0];ctx.fillStyle=Math.random()<.04?'#fff':i%3?'#00f5d4':'#f72585';ctx.fillText(ch,i*16,y*16);cols[i]=y*16>c.height&&Math.random()>.975?0:y+.5;});
   id=requestAnimationFrame(loop);};loop();window.addEventListener('resize',fit);return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',fit);};},[]);
 return <canvas ref={ref} className="cr-rain" aria-hidden="true"/>;
}
function CreditsScreen({machine,onClose}){
 useEffect(()=>{const k=e=>{if(e.code==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);
 const ang=Math.atan2(900,1600)*180/Math.PI;   // đường chéo màn 16:9, trên trái → dưới phải
 return <div className="modal lab-modal cr-modal" role="dialog" aria-modal="true" aria-label="Designed by TQH 12A3K50" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="cr-monitor">
   <button className="lab-x" onClick={onClose} aria-label="Đóng">×</button>
   <div className="cr-screen">
    <MatrixRain/>
    <svg className="cr-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
     <defs>
      <linearGradient id="crg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#00f5d4"/><stop offset=".5" stopColor="#ffffff"/><stop offset="1" stopColor="#f72585"/>
       <animate attributeName="x1" values="0;-1;0" dur="6s" repeatCount="indefinite"/><animate attributeName="x2" values="1;2;1" dur="6s" repeatCount="indefinite"/></linearGradient>
      <filter id="crglow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
     </defs>
     <line x1="40" y1="22" x2="1560" y2="878" stroke="#00f5d433" strokeWidth="2" strokeDasharray="6 14"/>
     <g transform={`rotate(${ang} 800 450)`}>
      <text className="cr-ghost c" x="800" y="472" textAnchor="middle" textLength="1460" lengthAdjust="spacingAndGlyphs">DESIGNED BY TQH 12A3K50</text>
      <text className="cr-ghost m" x="800" y="472" textAnchor="middle" textLength="1460" lengthAdjust="spacingAndGlyphs">DESIGNED BY TQH 12A3K50</text>
      <text className="cr-main" x="800" y="472" textAnchor="middle" textLength="1460" lengthAdjust="spacingAndGlyphs" fill="url(#crg)" filter="url(#crglow)">DESIGNED BY TQH 12A3K50</text>
     </g>
     <g className="cr-bottom">
      <text x="800" y="790" textAnchor="middle" className="cr-years">2015 – 2018</text>
      <text x="800" y="850" textAnchor="middle" className="cr-teacher">GVCN Vũ Thị Phương</text>
     </g>
    </svg>
    <div className="cr-scan" aria-hidden="true"/>
    <span className="cr-tag">PHÒNG TIN HỌC · MÁY {machine} · THPT AN DƯƠNG</span>
   </div>
   <div className="cr-bezel"><span className="lab-led"/>TQH-PC</div>
  </section>
 </div>;
}

// tải theo yêu cầu từ LabComputer.jsx (chỉ khi người chơi bật máy)
export {GameScreen,CreditsScreen};

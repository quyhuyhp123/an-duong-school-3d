// 2 mini-game bóng rổ trên sân bóng rổ (đứng ở vạch ném phạt, nhấn F):
//  - Rổ gần căng tin  → "Ném bóng 45 giây" (ShootGame, bên dưới).
//  - Rổ gần xích đu   → "Chạm rổ" (TapGame, cuối file): chạm / nhấn để bóng nảy lên bay về phía rổ.
// Mỗi game một bảng xếp hạng riêng trong ngày; sang ngày mới giữ top 5 hôm trước.
//
// ── Ném bóng 45 giây ──
// Kéo chuột / ngón tay ra phía sau quả bóng để ngắm & lấy lực, thả tay để ném. 45 giây mỗi lượt.
// Điểm: vị trí gần 2 điểm, vị trí xa (ngoài vạch 3 điểm) 3 điểm; bóng lọt sạch không chạm vành / bảng +1.
// Hết giờ → gửi điểm lên server, bảng xếp hạng trong ngày (giờ Việt Nam); sang ngày mới giữ top 5 hôm trước.
import React,{useEffect,useRef,useState,useCallback} from 'react';
import {getProfile} from './profile';
import {serverUrl} from './serverUrl';

const W=900,H=520,GROUND=470,G=1500,BALL_R=15,GAME_S=45;
const RIM_Y=235,RIM_FRONT=742,RIM_BACK=800,BOARD_X=820,BOARD_TOP=135,BOARD_BOTTOM=265;
const SPOTS=[{x:440,pts:2},{x:340,pts:2},{x:225,pts:3},{x:180,pts:3}];
const START_Y=385,MAX_DRAG=280,POWER=5;

function clientId(){try{let id=localStorage.getItem('school-client-id');if(!id){id=crypto.randomUUID();localStorage.setItem('school-client-id',id);}return id;}catch{return '';}}
async function api(game,method,body){
 const r=await fetch(serverUrl('/api/basketball?game='+game),{method,headers:{'Content-Type':'application/json','X-Client-Id':clientId()},body:body?JSON.stringify(body):undefined});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Không kết nối được máy chủ.');return d;
}
const fmtDay=d=>d?d.split('-').reverse().join('/'):'';

function Board({board,error,title='🏆 Bảng xếp hạng hôm nay'}){
 const me=board?.me;
 return <aside className="bb-board" aria-label="Bảng xếp hạng ném bóng rổ">
  <h3>{title}</h3>
  <small>{board?`Ngày ${fmtDay(board.day)} · ${board.total} người đã chơi · reset lúc 0:00`:'Đang tải…'}</small>
  {error&&<p className="bb-error">{error}</p>}
  <ol className="bb-list">{(board?.today??[]).map((e,i)=><li key={i} className={i<3?'top'+(i+1):''}><span className="bb-rank">{i+1}</span><span className="bb-name">{e.role==='teacher'?'GV · ':''}{e.name}{e.cls?<em> · {e.cls}</em>:null}</span><b>{e.score}</b></li>)}
   {board&&!board.today.length&&<li className="bb-empty">Chưa có ai ghi điểm hôm nay — bạn mở hàng nhé!</li>}</ol>
  {me&&<p className="bb-me">Điểm cao nhất của bạn hôm nay: <b>{me.best}</b> · hạng <b>{me.rank}</b></p>}
  <h3>⭐ Top 5 hôm trước{board?.yesterday?` (${fmtDay(board.yesterday.day)})`:''}</h3>
  <ol className="bb-list small">{(board?.yesterday?.top??[]).map((e,i)=><li key={i}><span className="bb-rank">{i+1}</span><span className="bb-name">{e.role==='teacher'?'GV · ':''}{e.name}{e.cls?<em> · {e.cls}</em>:null}</span><b>{e.score}</b></li>)}
   {!board?.yesterday&&<li className="bb-empty">Chưa có dữ liệu ngày trước.</li>}</ol>
 </aside>;
}

function ShootGame({onClose}){
 const canvas=useRef(),st=useRef(null),[hud,setHud]=useState({score:0,time:GAME_S,shots:0,made:0,pts:2,msg:''}),[phase,setPhase]=useState('ready'); // ready → playing → over
 const [board,setBoard]=useState(null),[err,setErr]=useState(''),[result,setResult]=useState(null);
 const refresh=useCallback(()=>api('shoot','GET').then(d=>{setBoard(d);setErr('');}).catch(e=>setErr(e.message)),[]);
 useEffect(()=>{refresh();},[refresh]);
 useEffect(()=>{const k=e=>{if(e.code==='Escape')onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose]);

 const reset=useCallback(()=>{
  st.current={spot:0,ball:{x:SPOTS[0].x,y:START_Y,vx:0,vy:0,fly:false,touched:false,scored:false,t:0},drag:null,score:0,shots:0,made:0,streak:0,
   startAt:0,timeLeft:GAME_S,popups:[],ended:false};
  setHud({score:0,time:GAME_S,shots:0,made:0,pts:SPOTS[0].pts,msg:'Kéo ra phía sau quả bóng để ngắm, thả tay để ném!'});setPhase('ready');setResult(null);
 },[]);
 useEffect(()=>{reset();},[reset]);

 // gửi điểm khi hết giờ
 const finish=useCallback(async score=>{
  setPhase('over');const p=getProfile();
  try{const d=await api('shoot','POST',{score,name:p?.name??'Ẩn danh',cls:p?.role==='teacher'?'':p?.cls??'',role:p?.role??'student'});setBoard(d);setResult({score,improved:d.improved,rank:d.me?.rank});setErr('');}
  catch(e){setResult({score,error:e.message});}
 },[]);

 useEffect(()=>{
  const c=canvas.current,ctx=c.getContext('2d');let raf,last=performance.now();
  const resize=()=>{const r=c.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);c.width=r.width*dpr;c.height=r.width*H/W*dpr;};
  resize();window.addEventListener('resize',resize);
  const toGame=e=>{const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*W/r.width};};
  const down=e=>{const s=st.current;if(!s||s.ended||s.ball.fly)return;c.setPointerCapture(e.pointerId);const p=toGame(e);s.drag={x0:p.x,y0:p.y,x:p.x,y:p.y};};
  const move=e=>{const s=st.current;if(s?.drag){const p=toGame(e);s.drag.x=p.x;s.drag.y=p.y;}};
  const up=()=>{const s=st.current;if(!s?.drag)return;const v=launch(s.drag);s.drag=null;if(!v)return;
   if(!s.startAt){s.startAt=performance.now();setPhase('playing');}
   Object.assign(s.ball,{vx:v.vx,vy:v.vy,fly:true,touched:false,scored:false,t:0});s.shots++;};
  c.addEventListener('pointerdown',down);c.addEventListener('pointermove',move);c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
  const frame=now=>{
   const dt=Math.min(.033,(now-last)/1000);last=now;const s=st.current;
   if(s){step(s,dt,now);draw(ctx,c,s);}
   raf=requestAnimationFrame(frame);
  };
  raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);c.removeEventListener('pointerdown',down);c.removeEventListener('pointermove',move);c.removeEventListener('pointerup',up);c.removeEventListener('pointercancel',up);};
 },[]);

 // vật lý & luật chơi (gọi mỗi khung hình)
 const step=(s,dt,now)=>{
  if(s.startAt&&!s.ended){s.timeLeft=Math.max(0,GAME_S-(now-s.startAt)/1000);}
  const b=s.ball;
  if(b.fly){
   const n=4,h=dt/n;
   for(let i=0;i<n;i++){
    const py=b.y;b.vy+=G*h;b.x+=b.vx*h;b.y+=b.vy*h;
    // vành rổ: 2 điểm tròn (mép trước & mép sau)
    for(const rx of [RIM_FRONT,RIM_BACK]){const dx=b.x-rx,dy=b.y-RIM_Y,d=Math.hypot(dx,dy),m=BALL_R+4;
     if(d<m&&d>0){const nx=dx/d,ny=dy/d,vn=b.vx*nx+b.vy*ny;b.x=rx+nx*m;b.y=RIM_Y+ny*m;if(vn<0){b.vx-=1.6*vn*nx;b.vy-=1.6*vn*ny;}b.touched=true;}}
    // bảng rổ
    if(b.vx>0&&b.x+BALL_R>BOARD_X-4&&b.x<BOARD_X+6&&b.y>BOARD_TOP&&b.y<BOARD_BOTTOM){b.x=BOARD_X-4-BALL_R;b.vx=-b.vx*.55;b.touched=true;}
    // vào rổ: tâm bóng đi xuống qua mặt vành, nằm giữa 2 mép
    if(!b.scored&&py<RIM_Y&&b.y>=RIM_Y&&b.vy>0&&b.x>RIM_FRONT+5&&b.x<RIM_BACK-5){
     b.scored=true;const base=SPOTS[s.spot].pts,swish=!b.touched,pts=base+(swish?1:0);s.score+=pts;s.made++;s.streak++;
     s.popups.push({x:(RIM_FRONT+RIM_BACK)/2,y:RIM_Y-30,t:now,text:`+${pts}${swish?' · Lọt sạch!':''}${s.streak>=3?` · ${s.streak} quả liên tiếp 🔥`:''}`});
     b.vx*=.3;   // lưới rổ hãm bóng
    }
    if(b.y+BALL_R>GROUND){b.y=GROUND-BALL_R;b.vy=-b.vy*.55;b.vx*=.8;if(Math.abs(b.vy)<60)b.vy=0;}
    if(b.x+BALL_R>W){b.x=W-BALL_R;b.vx=-b.vx*.5;}
   }
   b.t+=dt;
   // bóng dừng / bay ra ngoài / quá 3.2 giây → bóng mới ở vị trí ném tiếp theo
   if(b.t>3.2||b.x<-60||(b.y>=GROUND-BALL_R-1&&Math.abs(b.vx)<25&&b.t>.6)){
    if(!b.scored)s.streak=0;
    if(b.scored)s.spot=(s.spot+1+Math.floor(Math.random()*(SPOTS.length-1)))%SPOTS.length;   // vào rổ → đổi vị trí ném
    Object.assign(b,{x:SPOTS[s.spot].x,y:START_Y,vx:0,vy:0,fly:false,t:0});
   }
  }
  // hết giờ: chờ quả đang bay rơi xong rồi chốt điểm
  if(s.startAt&&!s.ended&&s.timeLeft<=0&&!b.fly){s.ended=true;s.drag=null;finish(s.score);}
  s.popups=s.popups.filter(p=>now-p.t<1400);
  const t=Math.ceil(s.timeLeft);
  setHud(h=>h.score===s.score&&h.time===t&&h.shots===s.shots&&h.made===s.made&&h.pts===SPOTS[s.spot].pts?h:{...h,score:s.score,time:t,shots:s.shots,made:s.made,pts:SPOTS[s.spot].pts,msg:''});
 };

 return <div className="modal bb-modal" role="dialog" aria-modal="true" aria-label="Ném bóng rổ">
  <section className="bb-panel">
   <button className="close" onClick={onClose} aria-label="Đóng">×</button>
   <small>SÂN BÓNG RỔ · THPT AN DƯƠNG</small>
   <h2>Ném bóng rổ tính điểm</h2>
   <div className="bb-layout">
    <div className="bb-game">
     <div className="bb-hud">
      <span>Điểm <b>{hud.score}</b></span>
      <span>Thời gian <b className={hud.time<=10&&phase==='playing'?'bb-hurry':''}>{hud.time}s</b></span>
      <span>Vào rổ <b>{hud.made}/{hud.shots}</b></span>
      <span className="bb-spot">Vị trí ném: <b>{hud.pts} điểm</b></span>
     </div>
     <div className="bb-canvas-wrap">
      <canvas ref={canvas} className="bb-canvas" aria-label="Khung chơi: kéo ra sau quả bóng rồi thả để ném"/>
      {phase==='ready'&&<div className="bb-tip">👆 Kéo ra <b>phía sau</b> quả bóng để ngắm & lấy lực, <b>thả tay</b> để ném.<br/>Đồng hồ 45 giây chạy từ cú ném đầu tiên. Lọt sạch không chạm vành +1 điểm.</div>}
      {phase==='over'&&<div className="bb-over">
       <h3>Hết giờ!</h3><p className="bb-final">{result?.score??hud.score} điểm</p>
       {result?.error?<p className="bb-error">Chưa lưu được điểm: {result.error}</p>
        :result?<p>{result.improved?'🎉 Kỷ lục mới của bạn hôm nay!':'Chưa vượt điểm cao nhất hôm nay của bạn.'}{result.rank?` Bạn đang xếp hạng ${result.rank}.`:''}</p>:<p>Đang lưu điểm…</p>}
       <div className="bb-actions"><button className="ob-primary" onClick={reset}>Chơi lại</button><button className="ob-secondary" onClick={onClose}>Về sân trường</button></div>
      </div>}
     </div>
    </div>
    <Board board={board} error={err}/>
   </div>
  </section>
 </div>;
}

// vận tốc ném từ thao tác kéo (kéo ra sau → ném về phía trước)
function launch(d){
 let dx=d.x0-d.x,dy=d.y0-d.y;const len=Math.hypot(dx,dy);if(len<12)return null;
 if(len>MAX_DRAG){dx*=MAX_DRAG/len;dy*=MAX_DRAG/len;}
 return {vx:dx*POWER,vy:dy*POWER};
}

function draw(ctx,c,s){
 const k=c.width/W;ctx.setTransform(k,0,0,k,0,0);
 // nền nhà thi đấu ngoài trời: trời, tường trường, mặt sân
 const sky=ctx.createLinearGradient(0,0,0,GROUND);sky.addColorStop(0,'#bfe0f2');sky.addColorStop(1,'#eaf4f8');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#f0d9a2';ctx.fillRect(0,250,W,GROUND-250);ctx.fillStyle='#e3c47f';for(let x=20;x<W;x+=110)ctx.fillRect(x,280,60,70);
 ctx.fillStyle='#8f9b8e';ctx.fillRect(0,GROUND,W,H-GROUND);ctx.fillStyle='#7f8b7f';ctx.fillRect(0,GROUND,W,6);
 // vạch 3 điểm & các vị trí ném
 ctx.strokeStyle='#ffffffcc';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(275,GROUND);ctx.lineTo(275,H);ctx.stroke();
 ctx.fillStyle='#ffffffaa';ctx.font='600 13px "Be Vietnam Pro",sans-serif';ctx.textAlign='center';ctx.fillText('VẠCH 3 ĐIỂM',275,GROUND+40);
 SPOTS.forEach((p,i)=>{ctx.fillStyle=i===s.spot?'#f6c344':'#ffffff55';ctx.beginPath();ctx.ellipse(p.x,GROUND+12,22,6,0,0,Math.PI*2);ctx.fill();});
 // cột, bảng rổ, vành, lưới
 ctx.fillStyle='#5d666e';ctx.fillRect(BOARD_X+22,BOARD_BOTTOM-20,12,GROUND-BOARD_BOTTOM+20);ctx.fillRect(BOARD_X+2,BOARD_BOTTOM-30,32,8);
 ctx.fillStyle='#fdfdfd';ctx.fillRect(BOARD_X,BOARD_TOP,10,BOARD_BOTTOM-BOARD_TOP);ctx.strokeStyle='#c8102e';ctx.lineWidth=3;ctx.strokeRect(BOARD_X-1,BOARD_TOP+50,6,50);
 ctx.strokeStyle='#e9e9e9';ctx.lineWidth=2;for(let i=0;i<=4;i++){const t=i/4;ctx.beginPath();ctx.moveTo(RIM_FRONT+t*(RIM_BACK-RIM_FRONT),RIM_Y);ctx.lineTo(RIM_FRONT+12+t*(RIM_BACK-RIM_FRONT-24),RIM_Y+45);ctx.stroke();}
 for(let j=1;j<=3;j++){const y=RIM_Y+j*15,inset=j*4;ctx.beginPath();ctx.moveTo(RIM_FRONT+inset,y);ctx.lineTo(RIM_BACK-inset,y);ctx.stroke();}
 ctx.strokeStyle='#e8562a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(RIM_FRONT,RIM_Y);ctx.lineTo(BOARD_X,RIM_Y);ctx.stroke();
 // đường ngắm (vài chấm đầu của quỹ đạo)
 const b=s.ball;
 if(s.drag&&!b.fly){const v=launch(s.drag);if(v){ctx.fillStyle='#ffffffd9';for(let i=1;i<=9;i++){const t=i*.045,x=b.x+v.vx*t,y=b.y+v.vy*t+G*t*t/2;ctx.beginPath();ctx.arc(x,y,4-i*.25,0,Math.PI*2);ctx.fill();}
  const pw=Math.min(1,Math.hypot(s.drag.x0-s.drag.x,s.drag.y0-s.drag.y)/MAX_DRAG);ctx.fillStyle='#00000033';ctx.fillRect(b.x-30,b.y+28,60,7);ctx.fillStyle=pw>.85?'#e8562a':'#f6c344';ctx.fillRect(b.x-30,b.y+28,60*pw,7);}}
 // quả bóng
 ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.x/BALL_R*.5);
 ctx.fillStyle='#e8762a';ctx.beginPath();ctx.arc(0,0,BALL_R,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#5a2a10';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,0,BALL_R,0,Math.PI*2);ctx.moveTo(-BALL_R,0);ctx.lineTo(BALL_R,0);ctx.moveTo(0,-BALL_R);ctx.lineTo(0,BALL_R);ctx.stroke();
 ctx.beginPath();ctx.arc(-BALL_R*1.1,0,BALL_R*.75,-.9,.9);ctx.stroke();ctx.beginPath();ctx.arc(BALL_R*1.1,0,BALL_R*.75,Math.PI-.9,Math.PI+.9);ctx.stroke();ctx.restore();
 // điểm bật lên
 const now=performance.now();ctx.textAlign='center';ctx.font='800 22px "Be Vietnam Pro",sans-serif';
 for(const p of s.popups){const a=1-(now-p.t)/1400;ctx.fillStyle=`rgba(200,16,46,${a})`;ctx.fillText(p.text,Math.min(W-160,p.x-60),p.y-(1-a)*40);}
}

// ── Chạm rổ ──
// Mỗi lần chạm / nhấn chuột / Space: bóng nảy lên và bay về phía rổ. Rơi xuống sàn thì nảy lại.
// Bay ra khỏi mép màn hình (vượt qua cột rổ) → xuất hiện ở mép đối diện. Vào rổ → rổ chuyển sang phía bên kia, độ cao ngẫu nhiên.
// Mỗi rổ có đồng hồ đếm ngược (ngắn dần khi điểm tăng); hết giờ chưa vào rổ → hết lượt.
// Điểm: vào rổ +1; lọt sạch (không chạm vành / bảng / sàn) +2, lọt sạch liên tiếp +3, +4…
const TG={W:620,H:520,   // sân hẹp (620) → 2 rổ trái / phải gần nhau hơn
 GROUND:470,G:1350,R:16,JUMP:-560,PUSH:250,RIM_W:74};
const tapTime=score=>Math.max(4,10-score*.25);   // số giây cho mỗi rổ

function newHoop(side){return {side,y:180+Math.random()*170};}
function hoopGeom(h){ // side 1 = bên phải, -1 = bên trái; bảng rổ ở phía ngoài
 const board=h.side>0?TG.W-48:48,front=h.side>0?board-12-TG.RIM_W:board+12+TG.RIM_W,back=h.side>0?board-12:board+12;
 return {board,front,back,y:h.y};
}

function TapGame({onClose}){
 const canvas=useRef(),st=useRef(null),[hud,setHud]=useState({score:0,left:10,combo:0}),[phase,setPhase]=useState('ready');
 const [board,setBoard]=useState(null),[err,setErr]=useState(''),[result,setResult]=useState(null);
 const refresh=useCallback(()=>api('flap','GET').then(d=>{setBoard(d);setErr('');}).catch(e=>setErr(e.message)),[]);
 useEffect(()=>{refresh();},[refresh]);
 const finish=useCallback(async score=>{
  setPhase('over');const p=getProfile();
  try{const d=await api('flap','POST',{score,name:p?.name??'Ẩn danh',cls:p?.role==='teacher'?'':p?.cls??'',role:p?.role??'student'});setBoard(d);setResult({score,improved:d.improved,rank:d.me?.rank});setErr('');}
  catch(e){setResult({score,error:e.message});}
 },[]);
 const reset=useCallback(()=>{
  st.current={ball:{x:TG.W*.3,y:TG.GROUND-TG.R,vx:0,vy:0,touched:false,spin:0},hoop:newHoop(1),started:false,ended:false,score:0,combo:0,deadline:0,popups:[],trail:[]};
  setHud({score:0,left:10,combo:0});setPhase('ready');setResult(null);
 },[]);
 useEffect(()=>{reset();},[reset]);
 const tap=useCallback(()=>{const s=st.current;if(!s||s.ended)return;
  if(!s.started){s.started=true;s.deadline=performance.now()+tapTime(0)*1000;setPhase('playing');}
  const b=s.ball;b.vy=TG.JUMP;b.vx=s.hoop.side*TG.PUSH;b.spin=s.hoop.side*8;},[]);
 useEffect(()=>{const k=e=>{if(e.code==='Escape')onClose();if((e.code==='Space'||e.code==='ArrowUp')&&!e.repeat){e.preventDefault();tap();}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onClose,tap]);

 const stepTap=(s,dt,now)=>{
  const b=s.ball,h=hoopGeom(s.hoop);
  if(s.started&&!s.ended){
   for(let i=0,n=4,q=dt/n;i<n;i++){
    const py=b.y;b.vy+=TG.G*q;b.x+=b.vx*q;b.y+=b.vy*q;b.vx*=Math.pow(.6,q);   // lực cản không khí nhẹ
    // vành rổ: 2 mép tròn
    for(const rx of [h.front,h.back]){const dx=b.x-rx,dy=b.y-h.y,d=Math.hypot(dx,dy),m=TG.R+4;
     if(d<m&&d>0){const nx=dx/d,ny=dy/d,vn=b.vx*nx+b.vy*ny;b.x=rx+nx*m;b.y=h.y+ny*m;if(vn<0){b.vx-=1.5*vn*nx;b.vy-=1.5*vn*ny;}b.touched=true;}}
    // bảng rổ (chỉ chắn bóng bay ra phía ngoài; bay cao hơn bảng thì vượt qua được)
    const top=h.y-95,bot=h.y+15;
    if(b.y>top&&b.y<bot){
     if(s.hoop.side>0&&b.vx>0&&b.x+TG.R>h.board&&b.x<h.board+10){b.x=h.board-TG.R;b.vx=-b.vx*.5;b.touched=true;}
     if(s.hoop.side<0&&b.vx<0&&b.x-TG.R<h.board&&b.x>h.board-10){b.x=h.board+TG.R;b.vx=-b.vx*.5;b.touched=true;}
    }
    // vào rổ: đi xuống qua mặt vành, nằm giữa 2 mép
    const lo=Math.min(h.front,h.back)+5,hi=Math.max(h.front,h.back)-5;
    if(py<h.y&&b.y>=h.y&&b.vy>0&&b.x>lo&&b.x<hi){
     const swish=!b.touched;s.combo=swish?s.combo+1:0;const pts=swish?1+s.combo:1;s.score+=pts;
     s.popups.push({x:(h.front+h.back)/2,y:h.y-40,t:now,text:swish?(s.combo>1?`Lọt sạch x${s.combo}! +${pts}`:`Lọt sạch! +${pts}`):'+1'});
     s.hoop=newHoop(-s.hoop.side);s.deadline=now+tapTime(s.score)*1000;b.touched=false;b.vy*=.4;break;
    }
    // sàn: nảy lại; trần: chặn
    if(b.y+TG.R>TG.GROUND){b.y=TG.GROUND-TG.R;b.vy=-Math.abs(b.vy)*.45;b.vx*=.85;if(Math.abs(b.vy)<40)b.vy=0;b.touched=true;}
    if(b.y-TG.R<0){b.y=TG.R;b.vy=Math.abs(b.vy)*.3;}
    // ra khỏi mép → xuất hiện ở mép đối diện
    if(b.x>TG.W+TG.R)b.x=-TG.R;else if(b.x<-TG.R)b.x=TG.W+TG.R;
   }
   b.spin*=Math.pow(.5,dt);
   s.trail.push({x:b.x,y:b.y});if(s.trail.length>14)s.trail.shift();
   if(now>s.deadline){s.ended=true;finish(s.score);}
  }else if(!s.started){b.y=TG.GROUND-TG.R-Math.abs(Math.sin(now/260))*30;}   // chờ chạm: bóng nảy tại chỗ
  s.popups=s.popups.filter(p=>now-p.t<1200);
  const left=s.started?Math.max(0,Math.ceil((s.deadline-now)/1000)):Math.ceil(tapTime(0));
  setHud(o=>o.score===s.score&&o.left===left&&o.combo===s.combo?o:{score:s.score,left,combo:s.combo});
 };
 const stepRef=useRef(stepTap);stepRef.current=stepTap;

 useEffect(()=>{
  const c=canvas.current,ctx=c.getContext('2d');let raf,last=performance.now();
  const resize=()=>{const r=c.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);c.width=r.width*dpr;c.height=r.width*TG.H/TG.W*dpr;};
  resize();window.addEventListener('resize',resize);
  const down=e=>{e.preventDefault();tap();};c.addEventListener('pointerdown',down);
  const frame=now=>{const dt=Math.min(.033,(now-last)/1000);last=now;const s=st.current;if(s){stepRef.current(s,dt,now);drawTap(ctx,c,s,now);}raf=requestAnimationFrame(frame);};
  raf=requestAnimationFrame(frame);
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);c.removeEventListener('pointerdown',down);};
 },[tap]);

 return <div className="modal bb-modal" role="dialog" aria-modal="true" aria-label="Chạm rổ">
  <section className="bb-panel">
   <button className="close" onClick={onClose} aria-label="Đóng">×</button>
   <small>SÂN BÓNG RỔ · RỔ GẦN XÍCH ĐU</small>
   <h2>Chạm rổ</h2>
   <div className="bb-layout">
    <div className="bb-game">
     <div className="bb-hud">
      <span>Điểm <b>{hud.score}</b></span>
      <span>Còn <b className={hud.left<=3&&phase==='playing'?'bb-hurry':''}>{hud.left}s</b> cho rổ này</span>
      {hud.combo>1&&<span>Lọt sạch liên tiếp <b>x{hud.combo}</b></span>}
     </div>
     <div className="bb-canvas-wrap">
      <canvas ref={canvas} className="bb-canvas tap" aria-label="Khung chơi: chạm hoặc nhấn để bóng nảy lên"/>
      {phase==='ready'&&<div className="bb-tip">👆 <b>Chạm màn hình / nhấn chuột / phím Space</b> để bóng nảy lên bay về phía rổ.<br/>Căn nhịp cho bóng rơi lọt vành. Bay ra khỏi mép sẽ xuất hiện ở mép bên kia. Vào rổ → rổ đổi phía.</div>}
      {phase==='over'&&<div className="bb-over">
       <h3>Hết giờ!</h3><p className="bb-final">{result?.score??hud.score} điểm</p>
       {result?.error?<p className="bb-error">Chưa lưu được điểm: {result.error}</p>
        :result?<p>{result.improved?'🎉 Kỷ lục mới của bạn hôm nay!':'Chưa vượt điểm cao nhất hôm nay của bạn.'}{result.rank?` Bạn đang xếp hạng ${result.rank}.`:''}</p>:<p>Đang lưu điểm…</p>}
       <div className="bb-actions"><button className="ob-primary" onClick={reset}>Chơi lại</button><button className="ob-secondary" onClick={onClose}>Về sân trường</button></div>
      </div>}
     </div>
    </div>
    <Board board={board} error={err} title="🏆 Bảng xếp hạng Chạm rổ hôm nay"/>
   </div>
  </section>
 </div>;
}

function drawTap(ctx,c,s,now){
 const k=c.width/TG.W;ctx.setTransform(k,0,0,k,0,0);
 // nền: tường lớp học tối màu, cửa sổ vàng ấm, chữ AN DƯƠNG mờ, mặt sân xanh xám
 const bg=ctx.createLinearGradient(0,0,0,TG.GROUND);bg.addColorStop(0,'#2d3b4a');bg.addColorStop(1,'#46586a');ctx.fillStyle=bg;ctx.fillRect(0,0,TG.W,TG.H);
 ctx.fillStyle='#f0d9a233';for(let x=35;x<TG.W;x+=130)ctx.fillRect(x,60,65,90);
 ctx.fillStyle='#ffffff10';ctx.font='900 72px "Be Vietnam Pro",sans-serif';ctx.textAlign='center';ctx.fillText('AN DƯƠNG',TG.W/2,300);
 ctx.fillStyle='#7f8b7f';ctx.fillRect(0,TG.GROUND,TG.W,TG.H-TG.GROUND);ctx.fillStyle='#6b766b';ctx.fillRect(0,TG.GROUND,TG.W,5);
 // rổ hiện tại: cột, bảng, vành, lưới
 const h=hoopGeom(s.hoop),dir=s.hoop.side,poleX=dir>0?TG.W-18:18;
 ctx.fillStyle='#c98a2b';ctx.fillRect(poleX-7,h.y-30,14,TG.GROUND-h.y+30);ctx.fillRect(Math.min(poleX,h.board),h.y-34,Math.abs(poleX-h.board),10);
 ctx.fillStyle='#f4f4f4';ctx.fillRect(h.board-(dir>0?0:10),h.y-95,10,110);ctx.fillStyle='#c8102e';ctx.fillRect(h.board-(dir>0?0:10),h.y-50,10,4);
 ctx.strokeStyle='#eaeaea';ctx.lineWidth=2;
 const lo=Math.min(h.front,h.back),hi=Math.max(h.front,h.back);
 for(let i=0;i<=5;i++){const t=i/5;ctx.beginPath();ctx.moveTo(lo+t*(hi-lo),h.y);ctx.lineTo(lo+12+t*(hi-lo-24),h.y+50);ctx.stroke();}
 for(let j=1;j<=3;j++){const y=h.y+j*16,ins=j*4;ctx.beginPath();ctx.moveTo(lo+ins,y);ctx.lineTo(hi-ins,y);ctx.stroke();}
 ctx.strokeStyle='#1d6fb8';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(lo,h.y);ctx.lineTo(hi,h.y);ctx.stroke();
 // vệt bóng bay
 s.trail.forEach((p,i)=>{ctx.fillStyle=`rgba(255,200,80,${i/s.trail.length*.35})`;ctx.beginPath();ctx.arc(p.x,p.y,TG.R*i/s.trail.length,0,Math.PI*2);ctx.fill();});
 // bóng + bóng đổ trên sàn
 const b=s.ball;ctx.fillStyle='#00000040';ctx.beginPath();ctx.ellipse(b.x,TG.GROUND+4,TG.R*(1-Math.min(.7,(TG.GROUND-b.y)/600)),5,0,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.translate(b.x,b.y);ctx.rotate(now/1000*b.spin+b.x/40);
 ctx.fillStyle='#ef7d2b';ctx.beginPath();ctx.arc(0,0,TG.R,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#5a2a10';ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,0,TG.R,0,Math.PI*2);ctx.moveTo(-TG.R,0);ctx.lineTo(TG.R,0);ctx.moveTo(0,-TG.R);ctx.lineTo(0,TG.R);ctx.stroke();
 ctx.beginPath();ctx.arc(-TG.R*1.1,0,TG.R*.75,-.9,.9);ctx.stroke();ctx.beginPath();ctx.arc(TG.R*1.1,0,TG.R*.75,Math.PI-.9,Math.PI+.9);ctx.stroke();ctx.restore();
 // điểm bật lên
 ctx.textAlign='center';ctx.font='800 24px "Be Vietnam Pro",sans-serif';
 for(const p of s.popups){const a=1-(now-p.t)/1200;ctx.fillStyle=`rgba(255,216,77,${a})`;ctx.fillText(p.text,Math.min(TG.W-110,Math.max(110,p.x)),p.y-(1-a)*40);}
}

// Chọn game theo rổ: 'shoot' (rổ gần căng tin) hoặc 'flap' (rổ gần xích đu)
export function BasketballGame({game='shoot',onClose}){return game==='flap'?<TapGame onClose={onClose}/>:<ShootGame onClose={onClose}/>;}

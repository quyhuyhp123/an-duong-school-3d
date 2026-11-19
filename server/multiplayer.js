import {characterIdentity} from '../src/characterIdentity.js';
import {bikeActions} from './bikeActions.js';
import {readFileSync} from 'node:fs';
import {isSharedBench,sameSeat,seatCapacity,seatOffset} from '../src/seating.js';
const sharedBenches=new Map(JSON.parse(readFileSync(new URL('../public/models/campus-data.json',import.meta.url),'utf8')).seats.filter(isSharedBench).map(s=>[s.id,s]));
// Máy chủ thời gian thực cho một khuôn viên chung (500–800 người).
//
// Thiết kế:
//  - Nhận vị trí (gói nhị phân 9 byte) chỉ cập nhật trạng thái; KHÔNG phát lại ngay.
//  - Mỗi tick (10 lần/giây) gửi cho từng người MỘT gói nhị phân chỉ gồm những người đã thay đổi (delta),
//    ưu tiên theo khoảng cách: gần → mỗi tick; xa hơn → thưa dần; tổng số mục mỗi tick có ngân sách cố định
//    nên kể cả khi cả trường dồn về sân khấu, băng thông mỗi người vẫn bị chặn trên.
//  - Kết nối chậm: nếu hàng đợi gửi đầy thì bỏ qua tick đó (trạng thái mới nhất sẽ được gửi sau — tự gộp),
//    nghẽn quá lâu thì ngắt. Có ping/pong phát hiện kết nối chết, giới hạn tin nhắn đến, giới hạn số người.
//  - Sự kiện hiếm (ngồi xích đu, mời, chat, người rời đi…) vẫn đi bằng JSON.
import {WebSocketServer} from 'ws';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {hub,postChat,welcomeMessages} from './events.js';
import {metrics} from './metrics.js';
import {clientIp,originAllowed} from './net.js';
import {STAGE_SLOTS,STAGE_CAPACITY,STAGES,stageAt,onStage,nearestFreeSlot,slotYaw} from '../src/stageSlots.js';
import {TICK_HZ,MSG_SNAPSHOT,HEADER_BYTES,ENTITY_BYTES,MOVE_BYTES,decodeMove,quantPos,quantYaw,modeCode,GROUND_FLAG} from '../src/protocol.js';

const env=(k,d)=>{const v=Number(process.env[k]);return Number.isFinite(v)&&v>0?v:d;};
export const CONFIG={
 maxPlayers:env('MAX_PLAYERS',800),
 tickMs:1000/TICK_HZ,
 nearRadius:20,midRadius:45,       // m
 fullRateBudget:env('FULL_RATE_BUDGET',48),  // số người gần nhất được cập nhật mỗi tick (10 lần/giây)
 perTickBudget:env('PER_TICK_BUDGET',160),   // trần số người trong một gói (~1,6 KB) → ≤ ~16 KB/s mỗi người
 midPeriod:3,farPeriod:10,         // người ở vòng giữa: 1/3 tick (~3 Hz); xa: 1/10 tick (1 Hz)
 softBufferBytes:256*1024,         // hàng đợi gửi vượt mức này → bỏ qua gói vị trí tick này
 hardBufferBytes:2*1024*1024,      // vượt mức này liên tục quá slowGraceMs → ngắt kết nối
 slowGraceMs:15000,
 heartbeatMs:5000,
 msgPerSec:25,msgBurst:50,         // giới hạn tin nhắn đến mỗi kết nối
 abuseLimit:400,                   // số tin bị chặn trong 10 s trước khi ngắt
};

export function attachMultiplayer(server,options={}){
 const cfg={...CONFIG,...options};
 const CAP=cfg.maxPlayers+64;
 const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
 const players=new Map(); // id (số) → player
 const invites=new Map();
 // Trạng thái vị trí lưu dạng mảng kiểu (typed array) theo slot để vòng lặp tick nhanh
 const X=new Float32Array(CAP),Z=new Float32Array(CAP),version=new Uint32Array(CAP);
 const records=Buffer.alloc(CAP*ENTITY_BYTES),encodedVersion=new Uint32Array(CAP);
 const freeSlots=Array.from({length:CAP-1},(_,i)=>i+1); // slot 0 không dùng; trả slot về cuối hàng để không tái dùng ngay
 let globalVersion=1,tickNo=0,lastOnline=0,gone=[];const metaChanged=new Set();
 const active=[]; // danh sách player để duyệt nhanh

 const sendText=(p,text)=>{
  if(p.socket.readyState!==1)return;
  if(p.socket.bufferedAmount>cfg.hardBufferBytes*2){dropSlow(p);return;}
  p.socket.send(text);metrics.count('bytesOut',text.length);metrics.count('messagesOut');
 };
 const send=(p,m)=>p&&sendText(p,JSON.stringify(m));
 // Phát một lần serialize cho tất cả
 const broadcastText=text=>{for(const p of active)sendText(p,text);};
 function dropSlow(p){if(p.dropped)return;p.dropped=true;metrics.count('slowClientsDropped');try{p.socket.close(4008,'slow connection')}catch{}setTimeout(()=>p.socket.terminate(),2000).unref?.();}

 const metaOf=p=>({id:p.id,seat:p.seat,action:p.action,actionFrom:p.actionFrom??null,partnerSlot:players.get(p.partner)?.seat?.slot??null,stage:p.stageSlot,look:p.look||0,identity:p.identity??null});
 function setPos(p,x,y,z,yaw,mode){
  p.position=[x,y,z];p.yaw=yaw;p.mode=mode;
  X[p.id]=x;Z[p.id]=z;
  const o=p.id*ENTITY_BYTES;records.writeUInt16LE(p.id,o);records.writeInt16LE(quantPos(x),o+2);records.writeInt16LE(quantPos(y),o+4);records.writeInt16LE(quantPos(z),o+6);records.writeUInt8(quantYaw(yaw),o+8);records.writeUInt8(mode&255,o+9);
  version[p.id]=++globalVersion;
 }
 const bikeControl=bikeActions({players,send,setPos});wss.on('close',()=>bikeControl.close());
 function end(p){
  if(!p)return;const partner=players.get(p.partner);
  if(p.action||p.partner){p.partner=null;p.action=null;p.actionFrom=null;metaChanged.add(p);}
  if(partner){partner.partner=null;partner.action=null;partner.actionFrom=null;metaChanged.add(partner);}
  for(const [id,i] of invites)if(i.from===p.id||i.to===p.id)invites.delete(id);
 }

 // events.js dùng hub để phát cấu hình sự kiện / chat
 hub.broadcast=m=>broadcastText(JSON.stringify(m));hub.online=()=>players.size;

 server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!=='/multiplayer')return;
  if(!originAllowed(req)){metrics.count('rejectedOrigin');socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });

 wss.on('connection',(socket,req)=>{
  if(players.size>=cfg.maxPlayers||!freeSlots.length){
   metrics.count('rejectedFull');socket.send(JSON.stringify({type:'full',message:'Trường đang quá đông, bạn thử lại sau ít phút nhé.'}));socket.close(1013,'full');return;
  }
  const id=freeSlots.shift();
  const p={id,uid:randomUUID(),socket,ip:clientIp(req),position:[8,1,17],yaw:0,mode:0,seat:null,partner:null,action:null,stageSlot:null,
   lastSent:new Uint32Array(CAP),alive:true,tokens:cfg.msgBurst,tokenAt:Date.now(),blocked:0,blockedAt:Date.now(),slowSince:0,joined:false,hasPosition:false,dropped:false};
  players.set(id,p);active.push(p);setPos(p,8,1,17,0,0);
  metrics.count('connectionsTotal');metrics.gauge('players',players.size);
  socket.on('pong',()=>{p.alive=true;});

  // Gói chào: id của mình + trạng thái ngồi/tương tác của những người khác; vị trí sẽ đến trong gói nhị phân kế tiếp
  send(p,{type:'welcome',id,uid:p.uid,tick:TICK_HZ,online:players.size,meta:[...players.values()].filter(q=>q.seat||q.action||q.stageSlot!=null||q.look||q.identity?.name).map(metaOf)});
  welcomeMessages().then(list=>list.forEach(m=>send(p,m))).catch(()=>{});
  p.joined=true;bikeControl.sync(p);

  socket.on('message',(raw,isBinary)=>{
   metrics.count('bytesIn',raw.length);metrics.count('messagesIn');
   // Giới hạn tốc độ tin nhắn đến (token bucket); gửi dồn quá mức thì ngắt
   const now=Date.now();p.tokens=Math.min(cfg.msgBurst,p.tokens+(now-p.tokenAt)/1000*cfg.msgPerSec);p.tokenAt=now;
   if(p.tokens<1){metrics.count('rateLimitedMessages');if(now-p.blockedAt>10000){p.blocked=0;p.blockedAt=now;}if(++p.blocked>cfg.abuseLimit)socket.close(1008,'rate limit');return;}
   p.tokens-=1;
   if(isBinary){
    if(raw.length!==MOVE_BYTES||p.seat||p.bikeDriver)return;
    const m=decodeMove(new DataView(raw.buffer,raw.byteOffset,raw.byteLength));
    if(m){p.hasPosition=true;setPos(p,m.x,m.y,m.z,m.yaw/256*Math.PI*2,m.mode);}
    return;
   }
   let m;try{m=JSON.parse(raw);}catch{return;}
   if(!m||typeof m!=='object')return;
   if(bikeControl.handle(p,m))return;
   if(m.type==='chat'){postChat(p,m).then(error=>{if(error)send(p,{type:'chat-error',message:error})}).catch(()=>{});return;}
   if(m.type==='sit'&&typeof m.id==='string'){
    const s=sharedBenches.get(m.id);if(!s||p.seat||p.bikeDriver||p.stageSlot!=null)return;
    if(Math.hypot(p.position[0]-s.position[0],p.position[2]-s.position[2])>3||Math.abs(p.position[1]-s.position[1])>2)return;
    const slot=Array.from({length:seatCapacity(s)},(_,i)=>i).find(slot=>!active.some(q=>q.seat?.id===s.id&&q.seat.slot===slot));
    if(slot===undefined){send(p,{type:'error',message:`Ghế đã đủ ${seatCapacity(s)} người, bạn chọn ghế khác nhé.`});return;}
    end(p);p.seat={id:s.id,slot,yaw:s.yaw,exit:s.exit};const offset=seatOffset(s,slot);
    setPos(p,s.position[0]+Math.cos(s.yaw)*offset,s.position[1],s.position[2]-Math.sin(s.yaw)*offset,s.yaw,modeCode('normal',false));metaChanged.add(p);
    send(p,{type:'seated',seat:p.seat,position:p.position});return;
   }
   if(m.type==='sit'&&[0,1].includes(m.swing)){
    const x=[16.5,23.5][m.swing];if(Math.hypot(p.position[0]-x,p.position[2]-11.6)>4||p.position[1]>2.5)return;
    const slot=[0,1].find(slot=>!active.some(q=>q.seat?.swing===m.swing&&q.seat.slot===slot));
    if(slot===undefined){send(p,{type:'error',message:'Xích đu đã đủ hai người.'});return;}
    end(p);p.seat={swing:m.swing,slot};setPos(p,x+(slot===0?-.43:.43),1.32,11.6,0,modeCode('normal',false));metaChanged.add(p);
    send(p,{type:'seated',seat:p.seat,position:p.position});return;
   }
   // hồ sơ nhân vật: mã ngoại hình 0-127 (giáo viên / nữ / đồng phục mùa đông / màu áo / râu) để người khác vẽ đúng trang phục
   if(m.type==='profile'){
    const look=Number(m.look);if(Number.isInteger(look)&&look>=0&&look<128&&look!==(p.look||0)){p.look=look;metaChanged.add(p);}
    if(m.identity&&typeof m.identity==='object'){const identity=characterIdentity(m.identity);if(JSON.stringify(identity)!==JSON.stringify(p.identity)){p.identity=identity;metaChanged.add(p);}}
    return;
   }
   if(m.type==='leave'){end(p);if(p.seat){const exit=p.seat.exit??[p.position[0],1.14,13.1];p.seat=null;setPos(p,...exit,p.yaw,0);metaChanged.add(p);}if(p.stageSlot!=null){p.stageSlot=null;metaChanged.add(p);}return;}
   // Múa trên sân khấu: 10 vị trí, mỗi vị trí một người; xếp vào ô trống gần nhất, đủ thì báo
   if(m.type==='perform'){
    if(p.seat||p.stageSlot!=null)return;
    if(!onStage(...p.position)){send(p,{type:'error',message:'Hãy bước lên sân khấu rồi nhấn F để tham gia múa.'});return;}
    const taken=new Set(active.filter(q=>q.stageSlot!=null).map(q=>q.stageSlot)),k=nearestFreeSlot(p.position,taken);
    if(k<0){const name=STAGES[stageAt(...p.position)]?.name??'Sân khấu';send(p,{type:'stage-full',message:`${name[0].toUpperCase()+name.slice(1)} đã đủ ${STAGE_CAPACITY} người múa, bạn đợi lượt sau nhé.`});return;}
    end(p);p.stageSlot=k;const [x,y,z]=STAGE_SLOTS[k];setPos(p,x,y,z,slotYaw(k),modeCode('stand',false,4));metaChanged.add(p);
    send(p,{type:'performing',slot:k,position:[x,y,z]});return;
   }
   if(m.type==='invite'&&['hand','lean','kiss'].includes(m.action)&&p.seat&&!p.partner){
    const others=active.filter(q=>q.id!==p.id&&sameSeat(q.seat,p.seat)),q=Number.isInteger(m.to)?others.find(q=>q.id===m.to):others.length===1?others[0]:null;
    if(q&&!q.partner){for(const i of invites.values())if([i.from,i.to].some(id=>id===p.id||id===q.id))return;const iid=randomUUID();invites.set(iid,{from:p.id,to:q.id,action:m.action,expires:Date.now()+20000});send(q,{type:'invite',id:iid,action:m.action,from:p.id,name:p.identity?.name??`Người chơi ${p.id}`});send(p,{type:'notice',message:'Đã gửi lời mời, đang chờ người kia đồng ý.'});}
    return;
   }
   if(m.type==='respond'){
    const i=invites.get(m.id);if(!i||i.to!==p.id)return;invites.delete(m.id);const q=players.get(i.from);
    if(m.accept===true&&i.expires>Date.now()&&sameSeat(p.seat,q?.seat)&&!p.partner&&!q.partner){p.partner=q.id;q.partner=p.id;p.action=q.action=i.action;p.actionFrom=q.actionFrom=q.id;metaChanged.add(p);metaChanged.add(q);}
    else send(q,{type:'notice',message:'Lời mời đã bị từ chối hoặc hết hạn.'});
    return;
   }
   if(m.type==='stop')end(p);
  });
  socket.on('close',()=>{
   end(p);players.delete(id);const k=active.indexOf(p);if(k>=0)active.splice(k,1);
   gone.push(id);freeSlots.push(id);metrics.gauge('players',players.size);
  });
  socket.on('error',()=>{});
 });

 // ---------- Vòng tick: gom cập nhật theo nhịp cố định ----------
 // Mỗi tick 100 ms chia thành SLICES lát 20 ms; mỗi lát phục vụ 1/SLICES số người — mỗi người vẫn nhận 10 gói/giây
 // nhưng vòng lặp sự kiện không bị khoá một mạch lâu (chat, API, ping vẫn mượt).
 const SLICES=5;
 // Bộ đệm tái sử dụng để không cấp phát mỗi tick
 const ids=new Uint16Array(CAP); // id của người đang online, cập nhật khi vào/ra
 const nearIds=new Uint16Array(CAP),nearD2=new Float32Array(CAP),otherIds=new Uint16Array(CAP),pick=new Uint16Array(CAP);
 const BINS=10,binCount=new Uint16Array(BINS);
 const nearR2=cfg.nearRadius**2,midR2=cfg.midRadius**2;
 let entitiesSent=0,snapshotsSent=0,slice=0,sliceTotal=0,selectMs=0,sendMs=0,sliceMax=0;

 function sliceTick(){
  const t0=performance.now();
  if(slice===0){
   tickNo++;sliceTotal=0;
   if(players.size!==lastOnline){lastOnline=players.size;broadcastText(JSON.stringify({type:'presence',online:lastOnline}));}
   if(gone.length){broadcastText(JSON.stringify({type:'gone',ids:gone}));gone=[];}
   if(metaChanged.size){const list=[...metaChanged].filter(p=>players.has(p.id)).map(metaOf);metaChanged.clear();if(list.length)broadcastText(JSON.stringify({type:'meta',list,online:players.size}));}
  }
  const now=Date.now(),n=active.length;
  for(let k=0;k<n;k++)ids[k]=active[k].id;
  for(let r=slice;r<n;r+=SLICES){
   const me=active[r],sock=me.socket;
   if(sock.readyState!==1||!me.joined)continue;
   // Kết nối chậm: bỏ qua lượt này (trạng thái mới nhất sẽ gửi ở lượt sau — tự gộp), nghẽn lâu thì ngắt
   const buffered=sock.bufferedAmount;
   if(buffered>cfg.softBufferBytes){
    metrics.count('snapshotsSkippedBackpressure');
    if(buffered>cfg.hardBufferBytes){if(!me.slowSince)me.slowSince=now;else if(now-me.slowSince>cfg.slowGraceMs)dropSlow(me);}
    continue;
   }
   me.slowSince=0;
   const ts=performance.now(),myId=me.id,mx=X[myId],mz=Z[myId],last=me.lastSent;
   let nearN=0,otherN=0;binCount.fill(0);
   for(let k=0;k<n;k++){
    const id=ids[k];
    if(!active[k].hasPosition||id===myId||version[id]<=last[id])continue; // không đổi từ lần gửi trước → bỏ (chỉ gửi phần thay đổi)
    const dx=X[id]-mx,dz=Z[id]-mz,d2=dx*dx+dz*dz;
    if(d2<nearR2){nearIds[nearN]=id;nearD2[nearN]=d2;nearN++;binCount[Math.min(BINS-1,(Math.sqrt(d2)/cfg.nearRadius*BINS)|0)]++;}
    else if((tickNo+id)%(d2<midR2?cfg.midPeriod:cfg.farPeriod)===0)otherIds[otherN++]=id;
   }
   let count=0;
   if(nearN){
    // 1) Người gần nhất (~fullRateBudget) → mọi tick. Tìm bán kính cắt theo vòng 2 m, không cần sắp xếp.
    let cutBin=BINS,acc=0;
    for(let b=0;b<BINS;b++){if(acc+binCount[b]>cfg.fullRateBudget){cutBin=b;break;}acc+=binCount[b];}
    const cutD2=(cutBin/BINS*cfg.nearRadius)**2;let restNear=0;
    for(let k=0;k<nearN;k++)if(nearD2[k]<cutD2)pick[count++]=nearIds[k];else restNear++;
    // 2) Phần còn lại của đám đông gần → chia lượt quay vòng, được ưu tiên hơn người ở xa
    if(restNear){
     const room=Math.max(10,cfg.perTickBudget-count-Math.min(otherN,15)),period=Math.ceil(restNear/room);
     for(let k=0;k<nearN;k++)if(nearD2[k]>=cutD2&&(period<=1||(tickNo+nearIds[k])%period===0))pick[count++]=nearIds[k];
    }
   }
   // 3) Người ở vòng giữa / xa (đã lọc theo nhịp thưa) lấp phần ngân sách còn lại.
   //    Bắt đầu từ vị trí xoay vòng để không ai bị "đói" (luôn đứng cuối danh sách nên không bao giờ được gửi).
   if(otherN){const start=(tickNo*31+r*7)%otherN;for(let k=0;k<otherN&&count<cfg.perTickBudget;k++)pick[count++]=otherIds[(start+k)%otherN];}
   const tm=performance.now();selectMs+=tm-ts;
   if(!count)continue;
   const buf=Buffer.allocUnsafe(HEADER_BYTES+count*ENTITY_BYTES);
   buf.writeUInt8(MSG_SNAPSHOT,0);buf.writeUInt32LE(now>>>0,1);buf.writeUInt16LE(count,5);
   for(let k=0,o=HEADER_BYTES;k<count;k++,o+=ENTITY_BYTES){const id=pick[k];records.copy(buf,o,id*ENTITY_BYTES,id*ENTITY_BYTES+ENTITY_BYTES);last[id]=version[id];}
   sock.send(buf,{binary:true});sendMs+=performance.now()-tm;
   metrics.count('bytesOut',buf.length);metrics.count('messagesOut');entitiesSent+=count;snapshotsSent++;
  }
  const dt=performance.now()-t0;sliceTotal+=dt;sliceMax=Math.max(sliceMax,dt);
  slice=(slice+1)%SLICES;
  if(slice===0)metrics.tick(sliceTotal); // thời gian CPU cả tick (tổng các lát)
 }
 // Bộ hẹn giờ bù trễ: setInterval trên Windows làm tròn lên ~15,6 ms nên 20 ms thành ~31 ms (tick chỉ còn ~6 Hz).
 // Lên lịch theo mốc tuyệt đối để trung bình đúng 10 tick/giây.
 let nextAt=performance.now(),tickTimer=null,stopped=false;
 // Tự giảm tải: khi phần việc tick chiếm > 35% CPU (đo mỗi 5 s), giãn tick 100 → 125 → 150 ms (10 → 8 → 6,7 Hz);
 // nhẹ lại (< 22%) thì trở về 10 Hz. Server chậm đi một chút thay vì nghẽn rồi trễ hàng giây.
 let tickMs=cfg.tickMs;metrics.gauge('tickHz',1000/tickMs);
 (function loop(){if(stopped)return;sliceTick();nextAt+=tickMs/SLICES;const now=performance.now();if(now-nextAt>tickMs)nextAt=now;tickTimer=setTimeout(loop,Math.max(0,nextAt-now));tickTimer.unref?.();})();
 const statTimer=setInterval(()=>{metrics.gauge('entitiesPerSnapshotAvg',snapshotsSent?+(entitiesSent/snapshotsSent).toFixed(1):0);metrics.gauge('selectMsPerSec',+(selectMs/5).toFixed(1));metrics.gauge('sendMsPerSec',+(sendMs/5).toFixed(1));
  const busy=(selectMs+sendMs)/5000;if(busy>.35&&tickMs<cfg.tickMs*1.5)tickMs+=cfg.tickMs/4;else if(busy<.22&&tickMs>cfg.tickMs)tickMs-=cfg.tickMs/4;metrics.gauge('tickHz',+(1000/tickMs).toFixed(1));
  selectMs=sendMs=0;metrics.gauge('sliceMaxMs',+sliceMax.toFixed(1));sliceMax=0;let maxBuf=0;for(const p of active)maxBuf=Math.max(maxBuf,p.socket.bufferedAmount);metrics.gauge('maxBufferedBytes',maxBuf);entitiesSent=snapshotsSent=0;},5000);
 // Ping/pong: kết nối không trả lời trong một chu kỳ → coi là chết và dọn dẹp
 const heartbeat=setInterval(()=>{for(const p of active){if(!p.alive){metrics.count('heartbeatTimeouts');p.socket.terminate();continue;}p.alive=false;try{p.socket.ping()}catch{}}},cfg.heartbeatMs);
 const inviteTimer=setInterval(()=>{const now=Date.now();for(const [id,i] of invites)if(i.expires<now)invites.delete(id);},1000);
 for(const t of [statTimer,heartbeat,inviteTimer])t.unref?.();
 wss.on('close',()=>{stopped=true;clearTimeout(tickTimer);for(const t of [statTimer,heartbeat,inviteTimer])clearInterval(t);});
 wss.players=players;
 return wss;
}
export {GROUND_FLAG};

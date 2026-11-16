// Kiểm thử chức năng giao thức multiplayer (server riêng, cổng ngẫu nhiên, thư mục dữ liệu tạm).
import {createServer} from 'node:http';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import WebSocket from 'ws';
import assert from 'node:assert/strict';
process.env.DATA_DIR=await mkdtemp(join(tmpdir(),'school-mp-'));
const {attachMultiplayer}=await import('../server/multiplayer.js');
const {encodeMove,decodeSnapshot}=await import('../src/protocol.js');

const server=createServer(),wss=attachMultiplayer(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const clients=[];
async function client(){
 const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/multiplayer`),messages=[],seen=new Map();
 const c={ws,messages,seen,snapshots:0,send:m=>ws.send(JSON.stringify(m)),move:(x,y,z,yaw=0,mode=0)=>ws.send(Buffer.from(encodeMove(x,y,z,yaw,mode)))};
 ws.on('message',(raw,isBinary)=>{
  if(isBinary){c.snapshots++;decodeSnapshot(new DataView(raw.buffer,raw.byteOffset,raw.byteLength),(id,x,y,z,yaw,mode)=>seen.set(id,{x,y,z,mode,at:c.snapshots}));}
  else{const m=JSON.parse(raw);messages.push(m);if(m.type==='welcome')c.id=m.id;}
 });
 await new Promise(r=>ws.on('open',r));clients.push(c);await until(()=>c.id);return c;
}
async function until(fn,ms=3000){const end=Date.now()+ms;while(Date.now()<end){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out: '+fn);}
const meta=(c,id)=>{let v=null;for(const m of c.messages){if(m.type==='welcome')for(const x of m.meta)if(x.id===id)v=x;if(m.type==='meta')for(const x of m.list)if(x.id===id)v=x;}return v;};
try{
 const a=await client(),b=await client(),c=await client();
 // Vị trí đi qua gói nhị phân theo tick
 a.move(5,1,5,1.2);await until(()=>b.seen.get(a.id)?.x===5&&c.seen.get(a.id)?.z===5);
 // Delta: không di chuyển thì không gửi lại
 const before=b.seen.get(a.id).at;await new Promise(r=>setTimeout(r,400));assert.equal(b.seen.get(a.id).at,before,'unchanged player must not be resent');
 for(const p of [a,b,c]){p.move(16.5,1,13);}await new Promise(r=>setTimeout(r,30));
 for(const p of [a,b,c])p.send({type:'sit',swing:0});
 const sa=await until(()=>a.messages.find(m=>m.type==='seated')),sb=await until(()=>b.messages.find(m=>m.type==='seated'));assert.notEqual(sa.seat.slot,sb.seat.slot);
 await until(()=>c.messages.find(m=>m.type==='error'));
 a.send({type:'invite',action:'hand'});const i=await until(()=>b.messages.find(m=>m.type==='invite'));assert(!meta(a,a.id)?.action);
 b.send({type:'respond',id:i.id,accept:false});await until(()=>a.messages.find(m=>m.type==='notice'&&m.message.includes('từ chối')));
 a.send({type:'invite',action:'lean'});const j=await until(()=>b.messages.find(m=>m.type==='invite'&&m.id!==i.id));
 c.send({type:'respond',id:j.id,accept:true});await new Promise(r=>setTimeout(r,250));assert(!meta(a,a.id)?.action,'forged acceptance must be rejected');
 b.send({type:'respond',id:j.id,accept:true});await until(()=>meta(c,a.id)?.action==='lean'&&meta(c,b.id)?.action==='lean');
 b.send({type:'leave'});await until(()=>!meta(c,a.id)?.action&&!meta(c,b.id)?.seat);
 c.send({type:'sit',swing:0});await until(()=>c.messages.find(m=>m.type==='seated'));
 const cid=c.id;c.ws.close();await until(()=>a.messages.some(m=>m.type==='gone'&&m.ids.includes(cid)));
 // Múa trên sân khấu: 10 vị trí độc quyền, người thứ 11 nhận "đầy", rời đi thì trả chỗ, mất kết nối cũng trả chỗ
 {
  const dancers=[];for(let i=0;i<11;i++)dancers.push(await client());
  a.send({type:'leave'});await new Promise(r=>setTimeout(r,30));a.move(0,1,0);a.send({type:'perform'});await until(()=>a.messages.find(m=>m.type==='error'&&m.message.includes('sân khấu')));
  for(const d of dancers){d.move(-1+Math.random()*2,1.8,-28);}await new Promise(r=>setTimeout(r,60));
  for(const d of dancers.slice(0,10))d.send({type:'perform'});
  const got=await until(()=>{const s=dancers.slice(0,10).map(d=>d.messages.find(m=>m.type==='performing'));return s.every(Boolean)&&s;});
  assert.equal(new Set(got.map(m=>m.slot)).size,10,'10 người nhận 10 vị trí khác nhau');
  const last=dancers[10];last.send({type:'perform'});await until(()=>last.messages.find(m=>m.type==='stage-full'));
  await until(()=>meta(c2(),dancers[3].id)?.stage===got[3].slot);
  dancers[3].send({type:'leave'});await until(()=>meta(c2(),dancers[3].id)?.stage==null);
  last.send({type:'perform'});const mine=await until(()=>last.messages.find(m=>m.type==='performing'));assert.equal(mine.slot,got[3].slot,'người thứ 11 vào đúng chỗ vừa trống');
  dancers[5].ws.close();await until(()=>a.messages.some(m=>m.type==='gone'&&m.ids.includes(dancers[5].id)));
  dancers[3].move(0,1.8,-28);await new Promise(r=>setTimeout(r,30));dancers[3].send({type:'perform'});
  const again=await until(()=>dancers[3].messages.filter(m=>m.type==='performing')[1]);assert.equal(again.slot,got[5].slot,'người mất kết nối được trả chỗ');
  function c2(){return b;}
 }
 // Gói rác / sai kích thước bị bỏ qua, không làm sập server
 a.ws.send(Buffer.from([1,2,3]));a.ws.send('not json');a.ws.send(JSON.stringify(null));await new Promise(r=>setTimeout(r,50));assert.equal(a.ws.readyState,1);
 console.log('PASS binary positions, delta suppression, distinct seats, stage slots (10 exclusive, full, reuse, disconnect), full seat rejection, consent, refusal, forged acceptance rejection, paired action, leave cancellation, disconnect cleanup, malformed input');
}finally{for(const c of clients)c.ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}

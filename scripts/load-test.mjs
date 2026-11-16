// Kiểm thử tải multiplayer: tăng dần 100 → 250 → 500 người, rồi 500 người dồn về sân khấu.
//
//   node scripts/load-test.mjs                    (mặc định: giữ mỗi mức 20 s)
//   LOAD_HOLD_MS=60000 node scripts/load-test.mjs (giữ lâu hơn)
//   LOAD_STEPS=100,250,500,700 node scripts/load-test.mjs
//   LOAD_URL=wss://staging.example.com/multiplayer node scripts/load-test.mjs   (bắn vào máy staging; KHÔNG dùng cho máy thật đang có người)
//
// Mặc định tự chạy một server RIÊNG (tiến trình riêng, cổng ngẫu nhiên, dữ liệu tạm) — không đụng server dev/đang chạy, không đụng data/.
// Người chơi ảo chạy trong 4 tiến trình riêng để máy tạo tải không phải nút thắt.
// Mỗi người ảo: gửi vị trí nhị phân 10 lần/giây như trình duyệt thật, đọc & giải mã mọi gói nhận được.
// Có chat (~5 tin/giây toàn trường) và 2% kết nối "chậm" (ngừng đọc) ở pha sân khấu để kiểm tra xử lý nghẽn.
import {fork} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';

const self=fileURLToPath(import.meta.url);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const STAGE=[1,-18]; // trước sân khấu xanh (khớp DJ_FLOOR)

// ===================== Tiến trình SERVER =====================
if(process.argv.includes('--server')){
 const {attachMultiplayer}=await import('../server/multiplayer.js');
 const {metrics}=await import('../server/metrics.js');
 const server=createServer((req,res)=>res.writeHead(404).end());
 attachMultiplayer(server);
 let cpu=process.cpuUsage(),t0=performance.now(),bytes0=0;
 process.on('message',m=>{
  if(m==='reset'){metrics.resetWindow();cpu=process.cpuUsage();t0=performance.now();bytes0=metrics.snapshot().bytesOut;process.send({reset:true});}
  if(m==='exit')process.exit(0);
  if(m==='metrics'){const s=metrics.snapshot(),u=process.cpuUsage(cpu),ms=performance.now()-t0;process.send({metrics:{...s,cpuOneCorePct:+((u.user+u.system)/ms/10).toFixed(1),outMBps:+((s.bytesOut-bytes0)/ms/1000).toFixed(2)}});}
 });
 server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
}

// ===================== Tiến trình TẠO TẢI =====================
else if(process.argv.includes('--gen')){
 const {default:WebSocket}=await import('ws');
 const {encodeMove,decodeSnapshot}=await import('../src/protocol.js');
 let url,clients=[],mode='spread',slowShare=0;
 const rand=(a,b)=>a+Math.random()*(b-a);
 function newTarget(c){
  if(mode==='stage'){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*10;c.target=[STAGE[0]+Math.cos(a)*r,STAGE[1]+Math.sin(a)*r*.8];}
  else c.target=[rand(-30,30),rand(-40,40)];
 }
 function makeClient(){
  const c={ws:new WebSocket(url),x:rand(-30,30),z:rand(-40,40),yaw:0,id:null,known:new Map(),bytes:0,ages:[],entities:0,snaps:0,nearUpdates:0,nearSamples:0,perSec:new Map(),n10Updates:0,n10Samples:0,open:false,closed:false,slow:false};
  newTarget(c);
  c.ws.binaryType='nodebuffer';
  c.ws.on('open',()=>{c.open=true;});
  c.ws.on('close',()=>{c.closed=true;});
  c.ws.on('error',()=>{});
  c.ws.on('message',(raw,isBinary)=>{
   c.bytes+=raw.length;
   if(!isBinary){const m=JSON.parse(raw);if(m.type==='welcome')c.id=m.id;if(m.type==='gone')for(const id of m.ids)c.known.delete(id);return;}
   const now=Date.now();
   const info=decodeSnapshot(new DataView(raw.buffer,raw.byteOffset,raw.byteLength),(id,x,y,z)=>{
    if(id===c.id)return;c.known.set(id,[x,z]);c.perSec.set(id,(c.perSec.get(id)??0)+1);
    if((x-c.x)**2+(z-c.z)**2<400)c.nearUpdates++;
   });
   // hiệu thời gian có dấu (hai tiến trình có thể lệch nhau 1 ms) → kẹp về ≥ 0
   if(info){c.snaps++;c.entities+=info.count;c.ages.push(Math.max(0,((now>>>0)-info.time)|0));}
  });
  return c;
 }
 // Mỗi 100 ms: di chuyển & gửi vị trí (như trình duyệt: 10 lần/giây) — hẹn giờ bù trễ cho đúng 10 Hz trên Windows
 const every=(ms,fn)=>{let next=performance.now();(function loop(){fn();next+=ms;const now=performance.now();if(now-next>ms)next=now;setTimeout(loop,Math.max(0,next-now));})();};
 every(100,()=>{
  for(const c of clients){
   if(!c.open||c.closed||c.ws.readyState!==1)continue;
   const dx=c.target[0]-c.x,dz=c.target[1]-c.z,d=Math.hypot(dx,dz);
   if(d<.5){if(mode==='stage'){c.x+=rand(-.25,.25);c.z+=rand(-.25,.25);c.yaw+=rand(-.5,.5);} else newTarget(c);} // nhảy nhót tại chỗ
   else{const step=Math.min(d,(mode==='stage'?5:3.5)*.1);c.x+=dx/d*step;c.z+=dz/d*step;c.yaw=Math.atan2(dx,dz);}
   c.ws.send(Buffer.from(encodeMove(c.x,1,c.z,c.yaw,0)));
  }
 });
 // Mỗi giây: đếm số người ở gần (để tính tần suất cập nhật người gần)
 // + tần suất cập nhật của 10 người gần nhất (những người bạn thực sự nhìn rõ)
 const scratch=[];
 setInterval(()=>{for(const c of clients){if(c.slow){c.perSec.clear();continue;}let n=0;scratch.length=0;for(const [id,[x,z]] of c.known){const d2=(x-c.x)**2+(z-c.z)**2;if(d2<400)n++;scratch.push([d2,id]);}c.nearSamples+=n;
  scratch.sort((a,b)=>a[0]-b[0]);const k=Math.min(10,scratch.length);for(let i=0;i<k;i++)c.n10Updates+=c.perSec.get(scratch[i][1])??0;c.n10Samples+=k;c.perSec.clear();}},1000);
 // Chat: phân bố đều
 let chatPerSec=0;setInterval(()=>{const live=clients.filter(c=>c.open&&!c.slow);for(let i=0;i<chatPerSec/5&&live.length;i++)live[(Math.random()*live.length)|0].ws.send(JSON.stringify({type:'chat',name:'bot',text:'xin chào '+Math.random().toString(36).slice(2,8)}));},200);

 process.on('message',async m=>{
  if(m.cmd==='init'){url=m.url;process.send({ok:true});}
  if(m.cmd==='grow'){ // mở thêm kết nối, rải đều (mô phỏng người vào dần)
   for(let i=0;i<m.n;i++){clients.push(makeClient());if(i%10===9)await sleep(m.spacingMs??40);}
   const end=Date.now()+15000;while(Date.now()<end&&clients.some(c=>!c.id&&!c.closed))await sleep(50);
   process.send({ok:true,open:clients.filter(c=>c.id).length});
  }
  if(m.cmd==='mode'){mode=m.mode;chatPerSec=m.chatPerSec??0;for(const c of clients)newTarget(c);
   const slowN=Math.round(clients.length*(m.slowShare??0));
   clients.forEach((c,i)=>{const want=i<slowN;if(want&&!c.slow){c.slow=true;c.ws._socket?.pause();}if(!want&&c.slow){c.slow=false;c.ws._socket?.resume();}});
   process.send({ok:true});}
  if(m.cmd==='reset'){for(const c of clients){c.bytes=0;c.ages=[];c.entities=0;c.snaps=0;c.nearUpdates=0;c.nearSamples=0;c.n10Updates=0;c.n10Samples=0;c.perSec.clear();}process.send({ok:true});}
  if(m.cmd==='stats'){
   const live=clients.filter(c=>c.id&&!c.slow&&!c.closed);
   process.send({stats:{
    open:clients.filter(c=>c.ws.readyState===1).length,closed:clients.filter(c=>c.closed).length,slowClosed:clients.filter(c=>c.slow&&c.closed).length,slow:clients.filter(c=>c.slow).length,
    bytes:live.map(c=>c.bytes),ages:live.flatMap(c=>c.ages.length>400?c.ages.filter((_,i)=>i%Math.ceil(c.ages.length/400)===0):c.ages),
    entities:live.reduce((s,c)=>s+c.entities,0),snaps:live.reduce((s,c)=>s+c.snaps,0),
    known:live.map(c=>c.known.size),nearUpdates:live.reduce((s,c)=>s+c.nearUpdates,0),nearSamples:live.reduce((s,c)=>s+c.nearSamples,0),n10Updates:live.reduce((s,c)=>s+c.n10Updates,0),n10Samples:live.reduce((s,c)=>s+c.n10Samples,0),
   }});
  }
  if(m.cmd==='stop'){for(const c of clients)c.ws.terminate();process.exit(0);}
 });
}

// ===================== Điều phối =====================
else{
 const HOLD=Number(process.env.LOAD_HOLD_MS??20000),WARM=4000,WORKERS=Number(process.env.LOAD_WORKERS??4);
 const STEPS=(process.env.LOAD_STEPS??'100,250,500').split(',').map(Number);
 const TOP=STEPS.at(-1);
 const out=resolve('.tools/load-test');await mkdir(out,{recursive:true});
 const ask=(proc,msg,key)=>new Promise(r=>{const on=m=>{if(key?m[key]!==undefined:true){proc.off('message',on);r(m);}};proc.on('message',on);proc.send(msg);});

 let url=process.env.LOAD_URL,srv=null;
 if(!url){
  const dataDir=await mkdtemp(join(tmpdir(),'school-load-'));
  srv=fork(self,['--server'],{execArgv:process.env.LOAD_PROFILE?['--cpu-prof','--cpu-prof-dir=.tools/load-test/profile']:[],env:{...process.env,DATA_DIR:dataDir,MONITOR_LOG:'0',MAX_PLAYERS:String(Math.max(800,TOP+50))},stdio:['ignore','inherit','inherit','ipc']});
  const {port}=await new Promise(r=>srv.once('message',r));url=`ws://127.0.0.1:${port}/multiplayer`;
 }
 const gens=await Promise.all(Array.from({length:WORKERS},async()=>{const g=fork(self,['--gen'],{stdio:['ignore','inherit','inherit','ipc']});await ask(g,{cmd:'init',url},'ok');return g;}));
 const all=(msg,key)=>Promise.all(gens.map(g=>ask(g,msg,key)));
 const pct=(arr,p)=>{if(!arr.length)return 0;const s=[...arr].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))];};

 console.log(`Kiểm thử tải · ${url} · giữ mỗi mức ${HOLD/1000}s · ${WORKERS} tiến trình tạo tải · CPU ${os.cpus()[0]?.model} ×${os.cpus().length}`);
 const results=[];let current=0;
 const phases=[...STEPS.map(n=>({n,mode:'spread',name:`${n} người · rải khắp trường`,chat:n/100})),{n:TOP,mode:'stage',name:`${TOP} người · dồn về sân khấu + 2% kết nối chậm`,chat:5,slow:.02}];
 for(const ph of phases){
  if(ph.n>current){const add=ph.n-current,per=Math.ceil(add/WORKERS);await Promise.all(gens.map((g,i)=>ask(g,{cmd:'grow',n:Math.max(0,Math.min(per,add-per*i))},'ok')));current=ph.n;}
  await all({cmd:'mode',mode:ph.mode,chatPerSec:ph.chat/WORKERS,slowShare:ph.slow??0},'ok');
  await sleep(ph.mode==='stage'?WARM+6000:WARM); // pha sân khấu: chờ mọi người đi tới nơi
  if(srv)await ask(srv,'reset','reset');await all({cmd:'reset'},'ok');
  const t0=Date.now();await sleep(HOLD);const secs=(Date.now()-t0)/1000;
  const server=srv?(await ask(srv,'metrics','metrics')).metrics:null;
  const parts=(await all({cmd:'stats'},'stats')).map(x=>x.stats);
  const bytes=parts.flatMap(p=>p.bytes).map(b=>b/secs/1024),ages=parts.flatMap(p=>p.ages),known=parts.flatMap(p=>p.known);
  const snaps=parts.reduce((s,p)=>s+p.snaps,0),entities=parts.reduce((s,p)=>s+p.entities,0),nearU=parts.reduce((s,p)=>s+p.nearUpdates,0),nearS=parts.reduce((s,p)=>s+p.nearSamples,0),n10U=parts.reduce((s,p)=>s+p.n10Updates,0),n10S=parts.reduce((s,p)=>s+p.n10Samples,0);
  const r={phase:ph.name,players:ph.n,openConnections:parts.reduce((s,p)=>s+p.open,0),slowClients:parts.reduce((s,p)=>s+p.slow,0),slowClientsClosedByServer:parts.reduce((s,p)=>s+p.slowClosed,0),
   client:{downKBpsAvg:+(bytes.reduce((a,b)=>a+b,0)/Math.max(1,bytes.length)).toFixed(1),downKBpsP95:+pct(bytes,.95).toFixed(1),updateAgeP50Ms:pct(ages,.5),updateAgeP95Ms:pct(ages,.95),updateAgeP99Ms:pct(ages,.99),
    entitiesPerSnapshot:+(entities/Math.max(1,snaps)).toFixed(1),coveragePct:+(100*known.reduce((a,b)=>a+b,0)/Math.max(1,known.length)/Math.max(1,ph.n-1)).toFixed(1),nearUpdateHz:+(nearU/Math.max(1,nearS)).toFixed(2),nearest10UpdateHz:+(n10U/Math.max(1,n10S)).toFixed(2)},
   server};
  results.push(r);
  const s=server??{};
  console.log(`\n▶ ${ph.name}`);
  console.log(`  server : loop p95 ${s.eventLoopP95Ms}ms (max ${s.eventLoopMaxMs}) · tick p95 ${s.tickP95Ms}ms (max ${s.tickMaxMs}) · CPU ${s.cpuOneCorePct}% 1 lõi · RSS ${s.rssMB}MB · ra ${s.outMBps}MB/s · bỏ qua do nghẽn ${s.snapshotsSkippedBackpressure} · ngắt kết nối chậm ${s.slowClientsDropped} · hàng đợi lớn nhất ${Math.round((s.maxBufferedBytes??0)/1024)}KB · tick ${s.tickHz} Hz · lát tick dài nhất ${s.sliceMaxMs?.toFixed?.(1)}ms · chọn ${s.selectMsPerSec}ms/s gửi ${s.sendMsPerSec}ms/s`);
  console.log(`  client : tải xuống TB ${r.client.downKBpsAvg}KB/s (p95 ${r.client.downKBpsP95}) · độ trễ cập nhật p50 ${r.client.updateAgeP50Ms}ms p95 ${r.client.updateAgeP95Ms}ms p99 ${r.client.updateAgeP99Ms}ms · ${r.client.entitiesPerSnapshot} người/gói · thấy ${r.client.coveragePct}% người chơi · 10 người gần nhất cập nhật ${r.client.nearest10UpdateHz} lần/s · mọi người trong 20 m: ${r.client.nearUpdateHz} lần/s`);
 }
 // Tiêu chí chấp nhận (đề xuất — xem LOAD-TEST.md)
 const checks=[];
 for(const r of results){
  const s=r.server??{};
  const c=(name,ok,val)=>checks.push({phase:r.phase,name,ok,val});
  if(r.server){c('event loop p95 ≤ 50ms',s.eventLoopP95Ms<=50,s.eventLoopP95Ms);c('lát tick dài nhất ≤ 30ms',s.sliceMaxMs<=30,s.sliceMaxMs);c('CPU server ≤ 70% một lõi',s.cpuOneCorePct<=70,s.cpuOneCorePct);c('RSS ≤ 1000MB',s.rssMB<=1000,s.rssMB);c('hàng đợi gửi bị chặn (≤ 4MB)',(s.maxBufferedBytes??0)<=4*1024*1024,s.maxBufferedBytes);}
  c('độ trễ cập nhật p95 ≤ 250ms',r.client.updateAgeP95Ms<=250,r.client.updateAgeP95Ms);
  c('tải xuống p95 ≤ 64KB/s mỗi người',r.client.downKBpsP95<=64,r.client.downKBpsP95);
  c('thấy ≥ 95% người chơi',r.client.coveragePct>=95,r.client.coveragePct);
  c('10 người gần nhất cập nhật ≥ 8 lần/s',r.client.nearest10UpdateHz>=8,r.client.nearest10UpdateHz);
  c('mọi người trong 20 m cập nhật ≥ 2 lần/s',r.client.nearUpdateHz>=2,r.client.nearUpdateHz);
  c('không rớt kết nối thường',r.openConnections>=r.players-r.slowClients,`${r.openConnections}/${r.players}`);
 }
 const failed=checks.filter(x=>!x.ok);
 console.log(`\n${failed.length?'✗':'✓'} ${checks.length-failed.length}/${checks.length} tiêu chí đạt`);for(const f of failed)console.log(`  ✗ [${f.phase}] ${f.name}: ${f.val}`);
 const file=join(out,`report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
 await writeFile(file,JSON.stringify({createdAt:new Date().toISOString(),url:srv?'local isolated server':url,host:{cpu:os.cpus()[0]?.model,cores:os.cpus().length,memGB:+(os.totalmem()/1e9).toFixed(1)},holdMs:HOLD,results,checks},null,2));
 console.log('Báo cáo: '+file);
 for(const g of gens)g.send({cmd:'stop'});if(srv){srv.send('exit');await new Promise(r=>{srv.once('exit',r);setTimeout(r,5000);});}process.exit(failed.length?1:0);
}

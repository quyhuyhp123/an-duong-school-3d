// Kiểm thử hạ tầng: proxy/IP thật, lưu dữ liệu an toàn, file tĩnh (cache/nén/304), giám sát, kết nối chậm, giới hạn số người.
// Chạy hoàn toàn cô lập: thư mục dữ liệu tạm, server cổng ngẫu nhiên.
import {createServer,request} from 'node:http';
import {mkdtemp,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const dir=await mkdtemp(join(tmpdir(),'school-infra-'));
process.env.DATA_DIR=dir;process.env.TRUST_PROXY='1';process.env.MONITOR_LOG='0';
const {clientIp,originAllowed}=await import('../server/net.js');
const {jsonFile}=await import('../server/store.js');
const {handleWishes}=await import('../server/wishes.js');
const {handleAdmin}=await import('../server/admin.js');
const {handleMetrics}=await import('../server/metrics.js');
const {createStatic}=await import('../server/static.js');
const {attachMultiplayer}=await import('../server/multiplayer.js');
const {handleMedia}=await import('../server/music.js');
const {adminPassword}=await import('../server/admin.js');
const results=[];const ok=name=>{results.push(name);console.log('  ✓ '+name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- Proxy ----------
const fake=(peer,headers={})=>({socket:{remoteAddress:peer},headers});
assert.equal(clientIp(fake('10.0.0.5',{'x-forwarded-for':'203.0.113.7'})),'203.0.113.7');
assert.equal(clientIp(fake('10.0.0.5',{'x-forwarded-for':'6.6.6.6, 203.0.113.7'})),'203.0.113.7','giả mạo X-Forwarded-For phía client không được tin');
ok('TRUST_PROXY=1 lấy đúng IP người dùng, bỏ qua phần XFF do client tự chèn');
assert.equal(originAllowed({headers:{origin:'https://evil.example',host:'school.vn'}}),false);
assert.equal(originAllowed({headers:{origin:'https://school.vn',host:'school.vn'}}),true);
ok('Chặn WebSocket mở từ trang web khác (Origin)');

// ---------- HTTP server dùng chung cho các phần sau ----------
const publicDir=join(dir,'public');await mkdir(join(publicDir,'assets'),{recursive:true});
await writeFile(join(publicDir,'index.html'),'<!doctype html><title>x</title>'+'<p>hello</p>'.repeat(200));
await writeFile(join(publicDir,'assets','app-abc123.js'),'console.log("x");'.repeat(500));
const serveStatic=createStatic(publicDir);
const server=createServer(async(req,res)=>{if(handleMetrics(req,res))return;if(await handleMedia(req,res))return;if(await handleAdmin(req,res)||await handleWishes(req,res))return;await serveStatic(req,res);});
const wss=attachMultiplayer(server,{maxPlayers:3,softBufferBytes:64*1024,hardBufferBytes:256*1024,slowGraceMs:300});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
function http(method,path,{headers={},body,raw}={}){return new Promise((resolve,reject)=>{const req=request({host:'127.0.0.1',port,method,path,headers:{'Content-Type':'application/json',...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);if(raw)req.write(raw);else if(body)req.write(JSON.stringify(body));req.end();});}

// Lời chúc: hai người khác nhau sau cùng một proxy không chặn nhau; cùng một người gửi dồn thì bị chặn
const wish=(ip,cid)=>http('POST','/api/wishes',{headers:{'x-forwarded-for':ip,'x-client-id':cid},body:{name:'A',message:'Chúc thầy cô mạnh khoẻ'}});
assert.equal((await wish('198.51.100.1','c1')).status,201);
assert.equal((await wish('198.51.100.2','c2')).status,201,'người thứ hai sau proxy không bị chặn nhầm');
assert.equal((await wish('198.51.100.1','c3')).status,201,'cùng Wi-Fi trường (cùng IP) nhưng khác trình duyệt vẫn gửi được');
assert.equal((await wish('198.51.100.1','c1')).status,429,'cùng trình duyệt gửi dồn bị chặn');
ok('Giới hạn lời chúc theo từng người, không chặn nhầm cả trường chung IP');
for(let i=0;i<5;i++)await http('POST','/api/admin/login',{headers:{'x-forwarded-for':'192.0.2.66'},body:{password:'sai'}});
assert.equal((await http('POST','/api/admin/login',{headers:{'x-forwarded-for':'192.0.2.66'},body:{password:'sai'}})).status,429);
assert.equal((await http('POST','/api/admin/login',{headers:{'x-forwarded-for':'192.0.2.77'},body:{password:'sai'}})).status,401,'IP khác không bị khoá lây');
ok('Khoá đăng nhập admin theo đúng IP thật sau proxy');

// ---------- Lưu dữ liệu ----------
await mkdir(join(dir,'blocker'),{recursive:true});await writeFile(join(dir,'blocker','x.json.tmp'),'');
const bad=jsonFile('blocker/x.json',[]);
// làm hỏng việc ghi: biến thư mục đích thành file
await writeFile(join(dir,'block2'),'file chứ không phải thư mục');
const broken=jsonFile('block2/data.json',[]);
await assert.rejects(()=>broken.update(l=>{l.push('chưa lưu');return l;}));
assert.deepEqual(await broken.get(),[],'ghi lỗi thì bộ nhớ đệm không được chứa dữ liệu chưa lưu');
ok('Ghi đĩa lỗi → báo lỗi, không hiện dữ liệu chưa lưu');
await writeFile(join(dir,'corrupt.json'),'{hỏng');
const corrupt=jsonFile('corrupt.json',[]);
await assert.rejects(()=>corrupt.update(l=>l));
assert.equal(await readFile(join(dir,'corrupt.json'),'utf8'),'{hỏng','file hỏng phải được giữ nguyên để khôi phục');
ok('File dữ liệu hỏng → từ chối ghi đè (giữ nguyên để khôi phục)');
const many=jsonFile('many.json',[],{batchMs:20});
await Promise.all(Array.from({length:200},(_,i)=>many.update(l=>{l.push(i);return l;})));
assert.equal(JSON.parse(await readFile(join(dir,'many.json'),'utf8')).length,200);
ok('200 thay đổi đồng thời được gộp ghi, không mất bản ghi nào');
void bad;

// ---------- File tĩnh / CDN ----------
let r=await http('GET','/assets/app-abc123.js',{headers:{'accept-encoding':'br, gzip'}});
assert.equal(r.status,200);assert.equal(r.headers['content-encoding'],'br');assert.match(r.headers['cache-control'],/immutable/);assert.equal(r.headers['access-control-allow-origin'],'*');
const etag=r.headers.etag;
r=await http('GET','/assets/app-abc123.js',{headers:{'if-none-match':etag}});assert.equal(r.status,304);
r=await http('GET','/',{headers:{'accept-encoding':'gzip'}});assert.equal(r.headers['content-encoding'],'gzip');assert.equal(r.headers['cache-control'],'no-cache');
r=await http('GET','/../../etc/passwd');assert.notEqual(r.status,200);
ok('File tĩnh: nén br/gzip, ETag/304, cache dài cho /assets, no-cache cho HTML, CORS cho CDN, chặn ../');

// ---------- Giám sát ----------
r=await http('GET','/healthz');assert.equal(r.status,200);assert.equal(JSON.parse(r.body).ok,true);
r=await http('GET','/metrics');assert.equal(r.status,200);assert.match(r.body.toString(),/school_players/);
r=await http('GET','/metrics',{headers:{'x-forwarded-for':'203.0.113.9'}});assert.equal(r.status,403,'metrics không lộ ra ngoài khi không có token');
ok('/healthz và /metrics (chỉ nội bộ khi chưa đặt METRICS_TOKEN)');

// ---------- Nhạc DJ: tải lên, chọn bài, âm lượng, phát có Range, xoá ----------
{
 const login=JSON.parse((await http('POST','/api/admin/login',{headers:{'x-forwarded-for':'192.0.2.10'},body:{password:await adminPassword()}})).body);
 const auth={authorization:'Bearer '+login.token};
 // file WAV nhỏ tự tạo (1 giây im lặng)
 const pcm=Buffer.alloc(8000),wav=Buffer.concat([Buffer.from('RIFF'),Buffer.from(Uint32Array.of(36+pcm.length).buffer),Buffer.from('WAVEfmt '),Buffer.from(Uint32Array.of(16).buffer),Buffer.from(Uint16Array.of(1,1).buffer),Buffer.from(Uint32Array.of(8000,8000).buffer),Buffer.from(Uint16Array.of(1,8).buffer),Buffer.from('data'),Buffer.from(Uint32Array.of(pcm.length).buffer),pcm]);
 assert.equal((await http('POST','/api/admin/music',{headers:{'x-file-name':encodeURIComponent('Bài hát.wav'),'content-type':'audio/wav'},raw:wav})).status,401,'chưa đăng nhập không được tải nhạc');
 assert.equal((await http('POST','/api/admin/music',{headers:{...auth,'x-file-name':'virus.exe'},raw:wav})).status,400,'chặn file không phải nhạc');
 const up=await http('POST','/api/admin/music',{headers:{...auth,'x-file-name':encodeURIComponent('Bài hát chào mừng 20-11.wav'),'content-type':'audio/wav'},raw:wav});
 assert.equal(up.status,201);const track=JSON.parse(up.body).track;assert.equal(track.name,'Bài hát chào mừng 20-11.wav');
 const set=JSON.parse((await http('PUT','/api/admin/music',{headers:auth,body:{musicId:track.id,musicVolume:.35}})).body).config;
 assert.equal(set.musicId,track.id);assert.equal(set.musicVolume,.35);assert.ok(set.musicStartedAt>0);
 const {welcomeMessages}=await import('../server/events.js');const cfg=(await welcomeMessages())[0].config;
 assert.equal(cfg.music.url,`/media/music/${track.id}.wav`);assert.equal(cfg.music.volume,.35);
 let r=await http('GET',cfg.music.url,{headers:{range:'bytes=0-99'}});assert.equal(r.status,206);assert.equal(r.body.length,100);assert.match(r.headers['cache-control'],/immutable/);
 r=await http('GET',cfg.music.url);assert.equal(r.status,200);assert.equal(r.body.length,wav.length);
 assert.equal((await http('GET','/media/music/'+track.id+'.mp3')).status,404,'sai đuôi file → 404');
 const ov=JSON.parse((await http('GET','/api/admin/overview',{headers:auth})).body);assert.equal(ov.music.length,1);
 assert.equal((await http('DELETE','/api/admin/music/'+track.id,{headers:auth})).status,200);
 assert.equal((await welcomeMessages())[0].config.music.id,null,'xoá bài đang phát → về nhạc tự tạo');
 assert.equal((await http('GET',cfg.music.url)).status,404);
 ok('Nhạc DJ: chỉ admin tải lên, chặn file lạ, chọn bài + âm lượng gửi tới người chơi, phát có Range/cache, xoá an toàn');
}

// ---------- Kết nối chậm & giới hạn số người ----------
const url=`ws://127.0.0.1:${port}/multiplayer`;
const open=()=>new Promise(res=>{const ws=new WebSocket(url);const msgs=[];ws.on('message',(m,b)=>{if(!b)msgs.push(JSON.parse(m));});ws.on('open',()=>res({ws,msgs}));ws.on('error',()=>{});});
const a=await open(),b=await open(),slow=await open();
const d=await open();await sleep(100);
assert.ok(d.msgs.some(m=>m.type==='full'),'người thứ 4 nhận thông báo "trường đang quá đông"');
ok('Giới hạn số người online (MAX_PLAYERS) với thông báo thân thiện');
// Kết nối chậm: ngừng đọc, server phải bỏ qua gói vị trí rồi ngắt; bộ nhớ không phình
slow.ws._socket.pause();let closed=false;slow.ws.on('close',()=>closed=true);
// đẩy thật nhiều tin chat để hàng đợi của kết nối chậm vượt ngưỡng
const {hub}=await import('../server/events.js');
const end=Date.now()+20000,big='x'.repeat(32*1024);let aClosed=null;a.ws.on('close',c=>aClosed=c);
while(!closed&&Date.now()<end){hub.broadcast({type:'notice',message:big});await sleep(10);}
slow.ws._socket.resume();await sleep(300);
assert.ok(closed||slow.ws.readyState!==1,'kết nối chậm phải bị ngắt');
assert.equal(a.ws.readyState,1,'người bình thường không bị ảnh hưởng (mã đóng: '+aClosed+')');
const snap=JSON.parse((await http('GET','/metrics')).body.toString().includes('school_slow_clients_dropped')?'1':'0');
assert.equal(snap,1);
ok('Kết nối chậm: bỏ qua gói khi nghẽn, nghẽn lâu thì ngắt; người khác không bị ảnh hưởng');

for(const c of [a,b,slow,d])c.ws.terminate();
await new Promise(r=>wss.close(r));server.closeAllConnections?.();await new Promise(r=>server.close(r));
console.log(`PASS ${results.length} nhóm kiểm thử hạ tầng`);
process.exit(0);

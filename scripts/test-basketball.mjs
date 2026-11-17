// Kiểm tra bảng xếp hạng ném bóng rổ: lưu điểm cao nhất mỗi người, chặn điểm gian lận & gửi dồn dập,
// sang ngày mới (giờ Việt Nam) reset bảng hôm nay nhưng giữ top 5 ngày trước.
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
process.env.DATA_DIR=mkdtempSync(join(tmpdir(),'bb-'));
const {handleBasketball,vnDay}=await import('../server/basketball.js');

let clock=Date.UTC(2026,10,19,9,0,0);          // 16:00 giờ Việt Nam ngày 19/11
const realNow=Date.now;Date.now=()=>clock;
const server=createServer(async(req,res)=>{if(!await handleBasketball(req,res))res.writeHead(404).end();});
await new Promise(r=>server.listen(0,r));
const base=`http://127.0.0.1:${server.address().port}/api/basketball`;
let ip=0;
const post=(cid,body)=>fetch(base,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Id':cid,'X-Forwarded-For':'10.0.0.'+(++ip)},body:JSON.stringify(body)}).then(async r=>({status:r.status,...await r.json()}));
const get=cid=>fetch(base,{headers:{'X-Client-Id':cid}}).then(r=>r.json());

assert.equal(vnDay(Date.UTC(2026,10,19,17,30)),'2026-11-20','sau 0:00 giờ VN là ngày mới');
// 7 người chơi, mỗi người 1 điểm khác nhau
for(let i=0;i<7;i++){const r=await post('p'+i,{score:10+i*5,name:'Người '+i,cls:'12A'+i,role:'student'});assert.equal(r.status,201);}
let b=await get('p6');
assert.deepEqual(b.today.map(e=>e.score),[40,35,30,25,20,15,10],'xếp hạng giảm dần');
assert.deepEqual(b.me,{best:40,rank:1});
// gửi dồn dập bị chặn; sau 20 giây gửi điểm thấp hơn không ghi đè điểm cao nhất
assert.equal((await post('p6',{score:5,name:'Người 6'})).status,429,'chặn gửi liên tục');
clock+=21000;let r=await post('p6',{score:5,name:'Người 6'});assert.equal(r.improved,false);assert.equal(r.me.best,40);
clock+=21000;r=await post('p0',{score:99,name:'Người 0'});assert.equal(r.improved,true);assert.equal(r.me.rank,1,'phá kỷ lục lên hạng 1');
// điểm gian lận / sai kiểu
assert.equal((await post('x1',{score:999})).status,400);assert.equal((await post('x2',{score:12.5})).status,400);assert.equal((await post('x3',{score:-1})).status,400);
// sang ngày mới: bảng hôm nay trống, giữ top 5 hôm trước
clock=Date.UTC(2026,10,19,17,5);
b=await get('p0');
assert.equal(b.day,'2026-11-20');assert.equal(b.today.length,0,'bảng hôm nay đã reset');
assert.equal(b.yesterday.day,'2026-11-19');assert.deepEqual(b.yesterday.top.map(e=>e.score),[99,40,35,30,25],'giữ đúng top 5 hôm trước');
assert.equal(b.yesterday.top[0].name,'Người 0');assert.equal(b.me,null);
// chơi tiếp hôm nay vẫn giữ top 5 hôm qua
clock+=30000;await post('p3',{score:12,name:'Người 3'});b=await get('p3');assert.equal(b.today[0].score,12);assert.equal(b.yesterday.top.length,5);
// game "flap" có bảng riêng, không lẫn với game ném bóng
const fl=(cid,score)=>fetch(base+'?game=flap',{method:'POST',headers:{'Content-Type':'application/json','X-Client-Id':cid},body:JSON.stringify({score,name:cid})}).then(r=>r.json());
clock+=30000;await fl('f1',7);clock+=5000;await fl('f2',300);b=await fetch(base+'?game=flap').then(r=>r.json());
assert.deepEqual(b.today.map(e=>e.score),[300,7],'bảng chạm bay riêng');b=await get('p3');assert.equal(b.today.length,1,'bảng ném bóng không bị lẫn');
Date.now=realNow;server.close();
console.log('PASS basketball leaderboard: ranking, best-of-day, rate limit, cheat rejection, daily reset keeps yesterday top 5, separate flap board');

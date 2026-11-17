// Bảng xếp hạng 2 mini-game bóng rổ (mỗi game một bảng riêng):
//   ?game=shoot (mặc định) — ném bóng 45 giây ở rổ gần căng tin;  ?game=flap — chạm cho bóng bay vào rổ ở rổ gần xích đu.
//   GET  /api/basketball?game=…      → {day, today:[top 10], yesterday:{day, top:[top 5]} | null, me:{best,rank} | null}
//   POST /api/basketball?game=… {score,name,cls,role} (header X-Client-Id) → lưu điểm cao nhất trong ngày của người chơi đó
// Ngày tính theo giờ Việt Nam (UTC+7). Sang ngày mới: bảng hôm nay reset, giữ lại top 5 của ngày trước.
// Lưu vào data/basketball.json (ném bóng) và data/basketball-flap.json (chạm bay).
import {jsonFile,clean,json,readJson} from './store.js';
import {clientIp,BoundedMap,takeToken} from './net.js';

// shoot: 45 giây, mỗi quả tối đa 4 điểm → trên 200 là gian lận; mỗi lượt dài 45 giây nên tối đa 1 lần gửi / 20 giây.
// flap: không giới hạn thời gian (rơi xuống sàn là hết) → trần 999 điểm; lượt chơi có thể rất ngắn → 1 lần gửi / 4 giây.
const GAMES={
 shoot:{store:jsonFile('basketball.json',{day:null,scores:{},yesterday:null}),max:200,gap:20000,clients:new BoundedMap(50000,60000)},
 flap:{store:jsonFile('basketball-flap.json',{day:null,scores:{},yesterday:null}),max:999,gap:4000,clients:new BoundedMap(50000,60000)},
};
const byIp=new BoundedMap(20000,10*60000);

export const vnDay=(t=Date.now())=>new Date(t+7*3600e3).toISOString().slice(0,10);
const ranked=scores=>Object.values(scores??{}).sort((a,b)=>b.score-a.score||a.at-b.at);
const pub=e=>({name:e.name,cls:e.cls,role:e.role,score:e.score});

// Sang ngày mới → chốt top 5 ngày cũ thành "hôm trước", xoá bảng hôm nay
function rollover(data,today){
 const d=data&&typeof data==='object'?data:{day:null,scores:{},yesterday:null};
 if(d.day===today)return d;
 const top=ranked(d.scores).slice(0,5).map(pub);
 return {day:today,scores:{},yesterday:d.day&&top.length?{day:d.day,top}:d.yesterday??null};
}
export async function basketballBoard(cid,game='shoot'){
 const {store}=GAMES[game]??GAMES.shoot,today=vnDay();let d=await store.get();
 if(d?.day!==today)d=await store.update(x=>rollover(x,today));
 const list=ranked(d.scores),i=cid?list.findIndex(e=>e.cid===cid):-1;
 return {day:today,today:list.slice(0,10).map(pub),total:list.length,yesterday:d.yesterday??null,me:i>=0?{best:list[i].score,rank:i+1}:null};
}

export async function handleBasketball(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/api/basketball')return false;
 const cid=String(req.headers['x-client-id']??'').slice(0,64),game=GAMES[url.searchParams.get('game')]?url.searchParams.get('game'):'shoot',cfg=GAMES[game];
 try{
  if(req.method==='GET'){json(res,200,await basketballBoard(cid,game));return true;}
  if(req.method==='POST'){
   const ip=clientIp(req),now=Date.now();
   if(!cid){json(res,400,{error:'Thiếu mã trình duyệt.'});return true;}
   if(now-(cfg.clients.get(cid)??0)<cfg.gap||!takeToken(byIp,ip,1,30)){json(res,429,{error:'Bạn gửi điểm hơi nhanh, đợi chút rồi thử lại nhé.'});return true;}
   const data=await readJson(req,2048);if(!data){json(res,400,{error:'Dữ liệu không hợp lệ.'});return true;}
   const score=Number(data.score);
   if(!Number.isInteger(score)||score<0||score>cfg.max){json(res,400,{error:'Điểm không hợp lệ.'});return true;}
   cfg.clients.set(cid,now);
   const name=clean(data.name,40)||'Ẩn danh',cls=clean(data.cls,12),role=data.role==='teacher'?'teacher':'student',today=vnDay();
   let improved=false;
   await cfg.store.update(x=>{const d=rollover(x,today),old=d.scores[cid];
    if(!old||score>old.score){d.scores[cid]={cid,name,cls,role,score,at:now};improved=true;}
    else{old.name=name;old.cls=cls;old.role=role;}   // đổi tên nhân vật → cập nhật tên trên bảng
    return d;});
   json(res,201,{improved,...await basketballBoard(cid,game)});return true;
  }
  res.writeHead(405,{Allow:'GET, POST'}).end();return true;
 }catch(e){console.error('[basketball]',e);json(res,500,{error:'Máy chủ đang lỗi, thử lại sau nhé.'});return true;}
}

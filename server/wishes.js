// Lời chúc 20/11.  GET /api/wishes → danh sách,  POST /api/wishes {name,to,message} → thêm mới.
// Lưu vào data/wishes.json. Trang quản lý dùng listWishes / deleteWish.
import {randomUUID} from 'node:crypto';
import {jsonFile,clean,json,readJson} from './store.js';
import {clientIp,BoundedMap,takeToken} from './net.js';

const store=jsonFile('wishes.json',[]);
const LIMITS={name:40,to:60,message:500},MAX_WISHES=2000,COOLDOWN_MS=8000;
// Giới hạn theo từng trình duyệt (8 s/lần) + theo IP (rộng, vì cả trường có thể chung một IP Wi-Fi)
const byClient=new BoundedMap(50000,60000),byIp=new BoundedMap(20000,10*60000);

export async function listWishes(){const list=await store.get();return Array.isArray(list)?list:[];}
export async function deleteWish(id){let found=false;await store.update(list=>{const next=(Array.isArray(list)?list:[]).filter(w=>w.id!==id);found=next.length!==list.length;return next;});return found;}

// Trả về true nếu request đã được xử lý
export async function handleWishes(req,res){
 const url=new URL(req.url,'http://localhost');
 if(url.pathname!=='/api/wishes')return false;
 try{
  if(req.method==='GET'){const list=await listWishes();json(res,200,{wishes:list.slice(-300).reverse(),total:list.length});return true;}
  if(req.method==='POST'){
   const ip=clientIp(req),cid=String(req.headers['x-client-id']??'').slice(0,64)||ip,now=Date.now();
   if(now-(byClient.get(cid)??0)<COOLDOWN_MS||!takeToken(byIp,ip,1,60)){json(res,429,{error:'Bạn gửi hơi nhanh, đợi vài giây rồi gửi tiếp nhé.'});return true;}
   const data=await readJson(req,4096);if(!data){json(res,400,{error:'Dữ liệu không hợp lệ.'});return true;}
   const wish={id:randomUUID(),name:clean(data.name,LIMITS.name)||'Ẩn danh',to:clean(data.to,LIMITS.to),message:clean(data.message,LIMITS.message),createdAt:new Date().toISOString()};
   if(wish.message.length<2){json(res,400,{error:'Bạn hãy viết lời chúc trước khi gửi nhé.'});return true;}
   byClient.set(cid,now);
   await store.update(list=>{const next=Array.isArray(list)?list:[];next.push(wish);if(next.length>MAX_WISHES)next.splice(0,next.length-MAX_WISHES);return next;});
   json(res,201,{wish});return true;
  }
  res.writeHead(405,{Allow:'GET, POST'}).end();return true;
 }catch(e){console.error('[wishes]',e);json(res,500,{error:'Máy chủ đang lỗi, thử lại sau nhé.'});return true;}
}

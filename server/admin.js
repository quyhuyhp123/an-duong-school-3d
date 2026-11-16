// API trang quản lý: /api/admin/*  (cần đăng nhập bằng mật khẩu quản trị)
// Mật khẩu lấy từ biến môi trường ADMIN_PASSWORD; nếu không có thì tự tạo một lần và lưu ở data/admin-password.txt.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {DATA_DIR,json,readJson} from './store.js';
import {clientIp,BoundedMap} from './net.js';
import {metrics,rateSnapshot} from './metrics.js';
import {listWishes,deleteWish} from './wishes.js';
import {EVENTS,SCHEDULES,CHAT_MODES,getConfig,setConfig,setMusic,chatHistory,deleteChat,clearChat,hub} from './events.js';
import {listMusic,uploadMusic,deleteMusic,musicUrl,MAX_MUSIC_BYTES} from './music.js';

const SESSION_MS=12*3600*1000,sessions=new BoundedMap(1000,SESSION_MS),failures=new BoundedMap(20000,15*60000);
let passwordPromise;

export function adminPassword(){
 passwordPromise??=(async()=>{
  if(process.env.ADMIN_PASSWORD)return process.env.ADMIN_PASSWORD;
  const file=resolve(DATA_DIR,'admin-password.txt');
  try{const saved=(await readFile(file,'utf8')).trim();if(saved)return saved;}catch{}
  const created=randomBytes(6).toString('base64url');
  await mkdir(DATA_DIR,{recursive:true});await writeFile(file,created+'\n');
  return created;
 })();
 return passwordPromise;
}
export async function announceAdmin(port){
 const pw=await adminPassword();
 console.log(`\n  Trang quản lý: http://localhost:${port??5173}/admin`+(process.env.ADMIN_PASSWORD?'  (mật khẩu: biến ADMIN_PASSWORD)':`\n  Mật khẩu quản lý: ${pw}   (lưu ở data/admin-password.txt — đổi bằng cách sửa file hoặc đặt ADMIN_PASSWORD)`)+'\n');
}

const digest=s=>createHash('sha256').update(String(s)).digest();
function authorized(req){
 const token=(req.headers.authorization??'').replace(/^Bearer\s+/i,'');
 return !!token&&sessions.get(token)===true;
}

export async function handleAdmin(req,res){
 const url=new URL(req.url,'http://localhost'),path=url.pathname;
 if(!path.startsWith('/api/admin'))return false;
 try{
  if(path==='/api/admin/login'&&req.method==='POST'){
   const ip=clientIp(req),f=failures.get(ip)??{n:0,until:0};
   if(f.until>Date.now()){json(res,429,{error:'Sai mật khẩu nhiều lần, hãy đợi 1 phút.'});return true;}
   const body=await readJson(req,1024);
   if(!body||!timingSafeEqual(digest(body.password??''),digest(await adminPassword()))){
    f.n++;if(f.n>=5){f.until=Date.now()+60000;f.n=0;}failures.set(ip,f);
    json(res,401,{error:'Mật khẩu không đúng.'});return true;
   }
   failures.delete(ip);const token=randomBytes(24).toString('base64url');sessions.set(token,true);
   json(res,200,{token});return true;
  }
  if(!authorized(req)){json(res,401,{error:'Phiên đăng nhập đã hết hạn.'});return true;}

  if(path==='/api/admin/logout'&&req.method==='POST'){sessions.delete((req.headers.authorization??'').replace(/^Bearer\s+/i,''));json(res,200,{ok:true});return true;}
  if(path==='/api/admin/overview'&&req.method==='GET'){
   const wishes=await listWishes();
   json(res,200,{config:await getConfig(),music:(await listMusic()).map(t=>({...t,url:musicUrl(t)})).reverse(),maxMusicMB:MAX_MUSIC_BYTES/1024/1024,options:{events:EVENTS,schedules:SCHEDULES,chat:CHAT_MODES},wishes:[...wishes].reverse(),chat:[...(await chatHistory(500))].reverse(),online:hub.online(),system:{...metrics.snapshot(),...rateSnapshot()}});return true;
  }
  if(path==='/api/admin/config'&&req.method==='PUT'){const body=await readJson(req,2048);if(!body){json(res,400,{error:'Dữ liệu không hợp lệ.'});return true;}json(res,200,{config:await setConfig(body)});return true;}
  // Nhạc DJ: tải file lên / chọn bài & âm lượng / xoá bài
  if(path==='/api/admin/music'&&req.method==='POST'){const r=await uploadMusic(req);json(res,r.status,r.body);return true;}
  if(path==='/api/admin/music'&&req.method==='PUT'){const body=await readJson(req,1024);if(!body){json(res,400,{error:'Dữ liệu không hợp lệ.'});return true;}try{json(res,200,{config:await setMusic(body)});}catch(e){json(res,e.status??500,{error:e.message});}return true;}
  let m;
  if((m=path.match(/^\/api\/admin\/music\/([\w-]{1,64})$/))&&req.method==='DELETE'){const cfg=await getConfig();if(cfg.musicId===m[1])await setMusic({musicId:null});json(res,(await deleteMusic(m[1]))?200:404,{ok:true});return true;}
  if((m=path.match(/^\/api\/admin\/wishes\/([\w-]{1,64})$/))&&req.method==='DELETE'){json(res,(await deleteWish(m[1]))?200:404,{ok:true});return true;}
  if((m=path.match(/^\/api\/admin\/chat\/([\w-]{1,64})$/))&&req.method==='DELETE'){await deleteChat(m[1]);json(res,200,{ok:true});return true;}
  if(path==='/api/admin/chat'&&req.method==='DELETE'){await clearChat();json(res,200,{ok:true});return true;}
  json(res,404,{error:'Không tìm thấy.'});return true;
 }catch(e){console.error('[admin]',e);json(res,500,{error:'Máy chủ đang lỗi.'});return true;}
}

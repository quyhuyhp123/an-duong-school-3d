// Thư viện nhạc cho Đêm nhạc DJ: admin tải file lên, chọn bài đang phát, chỉnh âm lượng.
//   POST   /api/admin/music          (body = file nhạc, header X-File-Name)  → thêm bài
//   DELETE /api/admin/music/:id                                              → xoá bài
//   GET    /media/music/:id.:ext     (công khai, hỗ trợ Range, cache dài)    → phát nhạc
// File lưu ở DATA_DIR/music/, danh sách ở DATA_DIR/music.json.
import {createWriteStream,createReadStream} from 'node:fs';
import {mkdir,rename,unlink,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DATA_DIR,jsonFile,clean,json} from './store.js';

export const MAX_MUSIC_BYTES=Number(process.env.MAX_MUSIC_MB??40)*1024*1024;
const TYPES={'.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.oga':'audio/ogg','.opus':'audio/ogg','.wav':'audio/wav','.webm':'audio/webm','.flac':'audio/flac'};
const DIR=resolve(DATA_DIR,'music');
const library=jsonFile('music.json',[]);

export async function listMusic(){const l=await library.get();return Array.isArray(l)?l:[];}
export async function findMusic(id){return (await listMusic()).find(t=>t.id===id)??null;}
export const musicUrl=t=>t?`/media/music/${t.id}${t.ext}`:null;

// Nhận file từ admin: ghi dần ra đĩa (không nạp cả file vào RAM), chặn quá dung lượng
export async function uploadMusic(req){
 const name=clean(decodeURIComponent(String(req.headers['x-file-name']??'')),120)||'Bài hát';
 const ext=extname(name).toLowerCase();
 if(!TYPES[ext])return {status:400,body:{error:'Chỉ nhận file nhạc: mp3, m4a, aac, ogg, opus, wav, webm, flac.'}};
 const declared=Number(req.headers['content-length']??0);
 if(declared>MAX_MUSIC_BYTES)return {status:413,body:{error:`File quá lớn (tối đa ${MAX_MUSIC_BYTES/1024/1024} MB).`}};
 await mkdir(DIR,{recursive:true});
 const id=randomUUID(),tmp=resolve(DIR,id+'.part'),final=resolve(DIR,id+ext);
 let size=0,tooBig=false;
 await new Promise((ok,fail)=>{
  const out=createWriteStream(tmp);
  req.on('data',chunk=>{size+=chunk.length;if(size>MAX_MUSIC_BYTES&&!tooBig){tooBig=true;req.unpipe(out);out.destroy();req.resume();ok();}});
  req.on('error',fail);out.on('error',fail);out.on('finish',ok);
  req.pipe(out);
 });
 if(tooBig||size<1024){await unlink(tmp).catch(()=>{});return {status:tooBig?413:400,body:{error:tooBig?`File quá lớn (tối đa ${MAX_MUSIC_BYTES/1024/1024} MB).`:'File rỗng hoặc lỗi khi tải lên.'}};}
 await rename(tmp,final);
 const track={id,name,ext,type:TYPES[ext],size,uploadedAt:new Date().toISOString()};
 await library.update(l=>{const next=Array.isArray(l)?l:[];next.push(track);return next;});
 return {status:201,body:{track}};
}
export async function deleteMusic(id){
 const t=await findMusic(id);if(!t)return false;
 await library.update(l=>(Array.isArray(l)?l:[]).filter(x=>x.id!==id));
 await unlink(resolve(DIR,t.id+t.ext)).catch(()=>{});
 return true;
}

// Phát file nhạc cho trình duyệt: hỗ trợ Range (tua, tải dần), cache 1 năm vì mỗi bài có id riêng
export async function handleMedia(req,res){
 const m=new URL(req.url,'http://localhost').pathname.match(/^\/media\/music\/([0-9a-f-]{36})(\.[a-z0-9]{2,5})$/);
 if(!m)return false;
 const t=await findMusic(m[1]);
 if(!t||t.ext!==m[2]){res.writeHead(404,{'Cache-Control':'no-store'}).end();return true;}
 const path=resolve(DIR,t.id+t.ext),info=await stat(path).catch(()=>null);
 if(!info){res.writeHead(404).end();return true;}
 const headers={'Content-Type':t.type,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable','Access-Control-Allow-Origin':'*'};
 const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range??'');
 if(range){
  let start=range[1]===''?info.size-Number(range[2]):Number(range[1]),end=range[1]!==''&&range[2]!==''?Number(range[2]):info.size-1;
  if(!(start>=0&&start<info.size&&end>=start)){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return true;}
  end=Math.min(end,info.size-1);
  res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});
  if(req.method==='HEAD')return res.end(),true;
  createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);return true;
 }
 res.writeHead(200,{...headers,'Content-Length':info.size});
 if(req.method==='HEAD')return res.end(),true;
 createReadStream(path).on('error',()=>res.destroy()).pipe(res);return true;
}
export {json};

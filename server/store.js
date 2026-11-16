// Tiện ích dùng chung cho server: file JSON lưu bền, đọc body, trả JSON.
//
// An toàn dữ liệu:
//  - Ghi nguyên tử: ghi file tạm → fsync → đổi tên. Mất điện giữa chừng không làm hỏng file cũ.
//  - Bộ nhớ đệm CHỈ đổi sau khi ghi đĩa thành công (ghi lỗi thì dữ liệu chưa lưu không "hiện ra" với người khác).
//  - File hỏng / không đọc được (khác với "chưa có file") → từ chối ghi đè, báo lỗi, để có thể khôi phục thủ công.
//  - Giữ bản sao .bak (cập nhật tối đa mỗi 10 phút) để khôi phục khi cần.
//  - Gộp nhiều thay đổi đến cùng lúc (VD: 50 tin chat trong 1 giây) thành một lần ghi.
import {readFile,open,mkdir,rename,copyFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {metrics} from './metrics.js';

export const DATA_DIR=resolve(process.env.DATA_DIR??'data');
const BACKUP_EVERY_MS=10*60*1000;

export function jsonFile(name,fallback,{batchMs=0}={}){
 const file=resolve(DATA_DIR,name);
 let cache,loadError=null,pending=[],timer=null,writing=Promise.resolve(),lastBackup=0;
 async function load(){
  if(cache!==undefined)return cache;
  if(loadError)throw loadError;
  try{cache=JSON.parse(await readFile(file,'utf8'));}
  catch(e){
   if(e.code==='ENOENT'){cache=structuredClone(fallback);}
   else{loadError=new Error(`Không đọc được ${file} (${e.code??e.message}). Đã dừng ghi để tránh mất dữ liệu — hãy kiểm tra/khôi phục từ ${file}.bak`);console.error('[store]',loadError.message);metrics.count('storageErrors');throw loadError;}
  }
  return cache;
 }
 async function persist(value){
  await mkdir(dirname(file),{recursive:true});
  if(Date.now()-lastBackup>BACKUP_EVERY_MS){try{await stat(file);await copyFile(file,file+'.bak');}catch{}lastBackup=Date.now();}
  const tmp=file+'.tmp',fh=await open(tmp,'w');
  try{await fh.writeFile(JSON.stringify(value));await fh.sync();}finally{await fh.close();}
  await rename(tmp,file);
 }
 function flush(){
  timer=null;const batch=pending;pending=[];
  writing=writing.then(async()=>{
   let base;try{base=await load();}catch(e){batch.forEach(b=>b.reject(e));return;}
   let next=structuredClone(base);const results=[];
   for(const b of batch){try{const r=await b.fn(next);if(r!==undefined)next=r;results.push({ok:true});}catch(e){results.push({ok:false,e});}}
   try{await persist(next);cache=next;batch.forEach((b,i)=>results[i].ok?b.resolve(next):b.reject(results[i].e));}
   catch(e){metrics.count('storageErrors');console.error('[store] ghi thất bại',file,e.message);batch.forEach(b=>b.reject(e));}
  });
 }
 return {
  get:load,
  // fn nhận BẢN SAO dữ liệu, sửa/trả về giá trị mới. Promise hoàn thành khi đã ghi xuống đĩa.
  update(fn){return new Promise((resolve,reject)=>{pending.push({fn,resolve,reject});if(!timer)timer=setTimeout(flush,batchMs);});},
 };
}

export const clean=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').trim().slice(0,max):'';
export function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
export function readBody(req,limit=8192){return new Promise((ok,fail)=>{let size=0;const chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){fail(new Error('too large'));req.destroy();}else chunks.push(c);});req.on('end',()=>ok(Buffer.concat(chunks).toString('utf8')));req.on('error',fail);});}
export async function readJson(req,limit){try{return JSON.parse(await readBody(req,limit));}catch{return null;}}

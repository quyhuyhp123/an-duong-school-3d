// Phục vụ file tĩnh (thư mục dist/) cho môi trường thật, sẵn sàng đặt sau CDN (Cloudflare, Bunny, CloudFront…).
//  - /assets/* (tên có mã băm)  → Cache-Control: 1 năm, immutable — CDN giữ mãi, đổi bản build là đổi tên file.
//  - /models/*, ảnh, font…       → cache 7 ngày (URL model có ?v=MODEL_VERSION nên đổi model là đổi URL).
//  - *.html                      → no-cache (luôn hỏi lại, nhận 304 nếu không đổi) để bản build mới lên ngay.
//  - Nén Brotli/Gzip một lần rồi giữ trong bộ nhớ; ETag + 304; CORS cho tài nguyên khi tải từ tên miền CDN.
//  - File lớn không nén được đọc theo luồng (stream) thay vì nạp cả vào RAM mỗi lần.
import {stat,readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {brotliCompress,gzip,constants as Z} from 'node:zlib';
import {promisify} from 'node:util';

const br=promisify(brotliCompress),gz=promisify(gzip);
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.wasm':'application/wasm','.ktx2':'image/ktx2','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const COMPRESSIBLE=new Set(['.html','.js','.mjs','.css','.json','.svg','.glb','.gltf','.txt','.wasm']);
const MAX_CACHED=64*1024*1024; // tổng dung lượng bản nén giữ trong RAM

export function createStatic(rootDir){
 const root=resolve(rootDir);
 const cache=new Map();let cachedBytes=0; // path → {mtime, size, etag, br, gz}
 // Nhiều người cùng tải lần đầu chỉ nén một lần
 const inflight=new Map();
 function compressed(path,info){
  const c=cache.get(path);
  if(c&&c.mtime===info.mtimeMs)return c;
  const key=path+':'+info.mtimeMs;
  if(!inflight.has(key))inflight.set(key,build(path,info).finally(()=>inflight.delete(key)));
  return inflight.get(key);
 }
 async function build(path,info){
  let c;
  const raw=await readFile(path);
  const [b,g]=await Promise.all([br(raw,{params:{[Z.BROTLI_PARAM_QUALITY]:raw.length>2e6?5:9}}),gz(raw,{level:raw.length>2e6?6:9})]);
  c={mtime:info.mtimeMs,etag:`"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`,raw:raw.length<256*1024?raw:null,br:b.length<raw.length*.95?b:null,gz:g.length<raw.length*.95?g:null};
  if(c.raw===null&&!c.br&&!c.gz)c.uncompressible=true;
  const size=(c.raw?.length??0)+(c.br?.length??0)+(c.gz?.length??0);
  cachedBytes+=size;cache.set(path,c);
  while(cachedBytes>MAX_CACHED&&cache.size>1){const [k,v]=cache.entries().next().value;cache.delete(k);cachedBytes-=(v.raw?.length??0)+(v.br?.length??0)+(v.gz?.length??0);}
  return c;
 }
 const cacheControl=urlPath=>urlPath.startsWith('/assets/')?'public, max-age=31536000, immutable':/\.html?$/.test(urlPath)||urlPath==='/'?'no-cache':'public, max-age=604800';

 return async function serve(req,res){
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
  let urlPath;try{urlPath=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  let path=resolve(root,'.'+urlPath);
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  let info=await stat(path).catch(()=>null);
  if(info?.isDirectory()){path=resolve(path,'index.html');info=await stat(path).catch(()=>null);}
  if(!info?.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-cache'}).end('Not found');return;}
  const ext=extname(path).toLowerCase();
  const headers={'Content-Type':MIME[ext]??'application/octet-stream','Cache-Control':cacheControl(urlPath),'Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff','Vary':'Accept-Encoding'};
  const etag=`"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;headers.ETag=etag;
  if(req.headers['if-none-match']===etag){res.writeHead(304,headers).end();return;}
  const accept=String(req.headers['accept-encoding']??'');
  if(COMPRESSIBLE.has(ext)){
   const c=await compressed(path,info);
   const body=accept.includes('br')&&c.br?(headers['Content-Encoding']='br',c.br):accept.includes('gzip')&&c.gz?(headers['Content-Encoding']='gzip',c.gz):c.raw;
   if(body){headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);return;}
  }
  headers['Content-Length']=info.size;res.writeHead(200,headers);
  if(req.method==='HEAD'){res.end();return;}
  createReadStream(path).on('error',()=>res.destroy()).pipe(res);
 };
}

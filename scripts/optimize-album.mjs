// Nén ảnh album nhật ký (thư mục image/) cho web: ảnh gốc ~25 MB → bản WebP nhẹ + ảnh nhỏ cho dải chọn ảnh.
//   npm run album        (chạy lại mỗi khi thêm / đổi ảnh trong image/; ảnh đã nén và không đổi sẽ được bỏ qua)
// Kết quả: public/album/<mã>.webp (cạnh dài ≤ 1800 px), public/album/thumb/<mã>.webp (144×144), src/albumManifest.json.
// MemoryAlbum.jsx dùng bản nén nếu có trong manifest; ảnh chưa nén vẫn hiện bằng file gốc (không bao giờ mất ảnh).
// Cần thư viện sharp trong node_modules của máy chạy lệnh (không cần trên Cloudflare / Render vì kết quả đã được commit).
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readdirSync,statSync,mkdirSync,writeFileSync,readFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
const sharp=createRequire(join(process.cwd(),'x.js'))('sharp');
const SRC='image',OUT='public/album',TH=join(OUT,'thumb'),MANIFEST='src/albumManifest.json';
mkdirSync(TH,{recursive:true});
const old=existsSync(MANIFEST)?JSON.parse(readFileSync(MANIFEST,'utf8')):{};
const manifest={};let made=0,kept=0,before=0,after=0;
for(const file of readdirSync(SRC).filter(f=>/\.(jpe?g|png|webp)$/i.test(f)).sort()){
 const src=join(SRC,file),buf=readFileSync(src),id=createHash('sha1').update(buf).digest('hex').slice(0,12);
 const full=`album/${id}.webp`,thumb=`album/thumb/${id}.webp`;before+=buf.length;
 if(old[file]?.full===full&&existsSync(join('public',full))&&existsSync(join('public',thumb))){manifest[file]=old[file];kept++;after+=statSync(join('public',full)).size;continue;}
 const img=sharp(buf).rotate(),meta=await img.metadata();
 const info=await img.clone().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).webp({quality:78,effort:5}).toFile(join('public',full));
 await img.clone().resize(144,144,{fit:'cover',position:'attention'}).webp({quality:70}).toFile(join('public',thumb));
 manifest[file]={full,thumb,w:info.width,h:info.height};made++;after+=info.size;
 void meta;
}
// xoá bản nén của ảnh đã bị xoá khỏi image/
const live=new Set(Object.values(manifest).flatMap(m=>[m.full,m.thumb]));
for(const dir of ['album','album/thumb'])for(const f of readdirSync(join('public',dir)).filter(f=>f.endsWith('.webp'))){const rel=`${dir}/${f}`;if(!live.has(rel))unlinkSync(join('public',rel));}
writeFileSync(MANIFEST,JSON.stringify(manifest,null,1)+'\n');
console.log(`Album: ${made} ảnh nén mới, ${kept} giữ nguyên · ${(before/1048576).toFixed(1)} MB → ${(after/1048576).toFixed(1)} MB`);

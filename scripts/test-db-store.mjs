// Kiểm tra chế độ lưu vào cơ sở dữ liệu (DATABASE_URL) bằng một cơ sở dữ liệu giả trong bộ nhớ:
//  - dữ liệu ghi xong còn nguyên sau khi "khởi động lại" (tạo store mới cùng tên, ổ đĩa trống)
//  - lần đầu cơ sở dữ liệu trống → lấy file có sẵn trong DATA_DIR làm dữ liệu ban đầu
//  - file nhạc: tải lên → xoá khỏi ổ đĩa (giống Render khởi động lại) → phát nhạc vẫn được (tự khôi phục từ cơ sở dữ liệu)
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createServer} from 'node:http';
const dir=mkdtempSync(join(tmpdir(),'dbstore-'));
process.env.DATA_DIR=dir;process.env.DATABASE_URL='postgres://fake-for-tests';
writeFileSync(join(dir,'events.json'),JSON.stringify({event:'dj'}));
const {setDbForTests,dbEnabled}=await import('../server/db.js');
const rows=new Map(),files=new Map();let puts=0;
setDbForTests({
 async get(k){return rows.has(k)?{value:structuredClone(rows.get(k))}:null;},
 async put(k,v){puts++;rows.set(k,structuredClone(v));},
 async getFile(k){return files.get(k)??null;},async putFile(k,d){files.set(k,Buffer.from(d));},async deleteFile(k){files.delete(k);},
});
const {jsonFile}=await import('../server/store.js');
assert.equal(dbEnabled,true);
// ghi rồi "khởi động lại"
const a=jsonFile('wishes.json',[]);assert.deepEqual(await a.get(),[]);
await a.update(l=>{l.push({id:1,message:'Chúc thầy cô'});return l;});
assert.deepEqual(rows.get('wishes.json'),[{id:1,message:'Chúc thầy cô'}],'đã ghi vào cơ sở dữ liệu');
assert.ok(!existsSync(join(dir,'wishes.json')),'không ghi file khi dùng cơ sở dữ liệu');
const b=jsonFile('wishes.json',[]);assert.deepEqual(await b.get(),[{id:1,message:'Chúc thầy cô'}],'còn nguyên sau khi khởi động lại');
// gộp nhiều thay đổi cùng lúc thành 1 lần ghi
const c=jsonFile('chat.json',[],{batchMs:30});const before=puts;
await Promise.all(Array.from({length:20},(_,i)=>c.update(l=>{l.push(i);return l;})));
assert.equal(puts-before,1,'20 tin chat gộp thành 1 lần ghi');assert.equal(rows.get('chat.json').length,20);
// dữ liệu ban đầu lấy từ file có sẵn
assert.deepEqual(await jsonFile('events.json',{event:'none'}).get(),{event:'dj'},'lần đầu lấy events.json trong repo');
// nhạc: tải lên → mất file trên đĩa → vẫn phát được
const {uploadMusic,handleMedia,musicUrl}=await import('../server/music.js');
const audio=Buffer.alloc(5000,7),req=Readable.from([audio]);req.headers={'x-file-name':encodeURIComponent('bai-hat.mp3'),'content-length':String(audio.length)};
const up=await uploadMusic(req);assert.equal(up.status,201);const url=musicUrl(up.body.track);
assert.equal(files.size,1,'file nhạc đã lưu vào cơ sở dữ liệu');
rmSync(join(dir,'music'),{recursive:true,force:true});   // giống ổ đĩa trống sau khi Render khởi động lại
const srv=createServer(async(q,s)=>{if(!await handleMedia(q,s))s.writeHead(404).end();});await new Promise(r=>srv.listen(0,r));
const r=await fetch(`http://127.0.0.1:${srv.address().port}${url}`);const got=Buffer.from(await r.arrayBuffer());
assert.equal(r.status,200);assert.equal(got.length,audio.length);assert.ok(got.equals(audio),'nội dung nhạc khôi phục đúng');
assert.ok(readdirSync(join(dir,'music')).length===1,'đã ghi lại file ra đĩa');
srv.close();
console.log('PASS database store: persists across restart, batches writes, seeds from repo file, restores DJ music after disk wipe');

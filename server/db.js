// Lưu dữ liệu bền vào PostgreSQL (VD Neon miễn phí) khi có biến môi trường DATABASE_URL.
// Dùng cho hosting có ổ đĩa không bền (Render Free: khởi động lại là mất file trong data/).
//  - app_store: mỗi "file" JSON (wishes.json, chat.json, events.json, basketball*.json, music.json) là 1 dòng (key → jsonb).
//  - app_files: file nhạc DJ admin tải lên (bytea) để khôi phục lại ra đĩa sau khi máy chủ khởi động lại.
// Không đặt DATABASE_URL → mọi thứ vẫn lưu file trong DATA_DIR như cũ.
import pg from 'pg';

const URL=process.env.DATABASE_URL?.trim();
export const dbEnabled=!!URL;
let pool=null,ready=null;

function getPool(){
 if(!pool){
  pool=new pg.Pool({connectionString:URL,max:4,idleTimeoutMillis:30000,connectionTimeoutMillis:15000,
   ssl:/sslmode=disable/.test(URL)?false:{rejectUnauthorized:false}});
  pool.on('error',e=>console.error('[db] lỗi kết nối nền:',e.message)); // Neon tự ngắt kết nối nhàn rỗi → pool tự mở lại
 }
 return pool;
}
function init(){
 ready??=getPool().query(`
  CREATE TABLE IF NOT EXISTS app_store(key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE IF NOT EXISTS app_files(key text PRIMARY KEY, data bytea NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
 `).then(()=>console.log('[db] đã kết nối PostgreSQL — dữ liệu lưu bền trong cơ sở dữ liệu')).catch(e=>{ready=null;throw e;});
 return ready;
}

// Cho phép kiểm thử thay bằng bộ nhớ giả (không cần PostgreSQL thật)
let impl={
 async get(key){await init();const r=await getPool().query('SELECT value FROM app_store WHERE key=$1',[key]);return r.rowCount?{value:r.rows[0].value}:null;},
 async put(key,value){await init();await getPool().query('INSERT INTO app_store(key,value,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()',[key,JSON.stringify(value)]);},
 async getFile(key){await init();const r=await getPool().query('SELECT data FROM app_files WHERE key=$1',[key]);return r.rowCount?r.rows[0].data:null;},
 async putFile(key,data){await init();await getPool().query('INSERT INTO app_files(key,data,updated_at) VALUES($1,$2,now()) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data, updated_at=now()',[key,data]);},
 async deleteFile(key){await init();await getPool().query('DELETE FROM app_files WHERE key=$1',[key]);},
};
export const db={
 get:k=>impl.get(k),put:(k,v)=>impl.put(k,v),
 getFile:k=>impl.getFile(k),putFile:(k,d)=>impl.putFile(k,d),deleteFile:k=>impl.deleteFile(k),
};
export function setDbForTests(fake){impl=fake;}
// Kiểm tra kết nối lúc khởi động để lỗi cấu hình (sai mật khẩu, sai địa chỉ) hiện ngay trong log
export async function checkDb(){if(!dbEnabled)return;try{await init();}catch(e){console.error('[db] KHÔNG kết nối được PostgreSQL:',e.message,'— kiểm tra lại DATABASE_URL');}}

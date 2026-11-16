// Xác định IP thật của người dùng khi chạy sau proxy/CDN, kiểm tra Origin, và bảng giới hạn tốc độ có giới hạn kích thước.
//
// Biến môi trường:
//  TRUST_PROXY       Số proxy tin cậy đứng trước server (0 = không có proxy — mặc định).
//                    VD: Cloudflare → Nginx → Node  thì TRUST_PROXY=2. Chỉ khi đặt biến này mới đọc X-Forwarded-For.
//  CLIENT_IP_HEADER  Header chứa IP thật do proxy tin cậy đặt (VD: cf-connecting-ip, x-real-ip). Chỉ dùng khi TRUST_PROXY>0.
//  ALLOWED_ORIGINS   Danh sách origin được phép mở WebSocket, cách nhau dấu phẩy (VD: https://anduong.edu.vn).
//                    Bỏ trống = chỉ cho phép trang cùng host với server.
const TRUST_PROXY=Math.max(0,Number.parseInt(process.env.TRUST_PROXY??'0',10)||0);
const IP_HEADER=(process.env.CLIENT_IP_HEADER??'').toLowerCase().trim();
const ALLOWED=(process.env.ALLOWED_ORIGINS??'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);

const normalize=ip=>String(ip??'').trim().replace(/^::ffff:/,'');

export function clientIp(req){
 const peer=normalize(req.socket?.remoteAddress);
 if(!TRUST_PROXY)return peer||'?';
 if(IP_HEADER){const v=req.headers[IP_HEADER];if(typeof v==='string'&&v.trim())return normalize(v.split(',')[0]);}
 // X-Forwarded-For: "client, proxy1, proxy2" — với N proxy tin cậy, IP thật là phần tử thứ N tính từ phải (tính cả peer)
 const chain=String(req.headers['x-forwarded-for']??'').split(',').map(normalize).filter(Boolean);chain.push(peer);
 return chain[Math.max(0,chain.length-1-TRUST_PROXY)]||peer||'?';
}

function requestHost(req){
 if(TRUST_PROXY&&typeof req.headers['x-forwarded-host']==='string')return req.headers['x-forwarded-host'].split(',')[0].trim().toLowerCase();
 return String(req.headers.host??'').toLowerCase();
}
export function originAllowed(req){
 const origin=req.headers.origin;
 if(!origin)return true; // công cụ không phải trình duyệt (kiểm thử tải, giám sát)
 if(ALLOWED.length)return ALLOWED.includes(origin.replace(/\/$/,''));
 try{return new URL(origin).host.toLowerCase()===requestHost(req);}catch{return false;}
}

// Map có giới hạn số khoá và tự xoá mục hết hạn — dùng cho giới hạn tốc độ để không phình bộ nhớ khi bị dò quét
export class BoundedMap{
 constructor(max=20000,ttlMs=10*60*1000){this.max=max;this.ttl=ttlMs;this.map=new Map();}
 get(k){const e=this.map.get(k);if(!e)return undefined;if(e.exp<Date.now()){this.map.delete(k);return undefined;}return e.v;}
 set(k,v){this.map.delete(k);this.map.set(k,{v,exp:Date.now()+this.ttl});if(this.map.size>this.max){const first=this.map.keys().next().value;this.map.delete(first);}return this;}
 delete(k){return this.map.delete(k);}
 get size(){return this.map.size;}
}

// Token bucket: cho phép `burst` lần liên tiếp, hồi `perSec` lần/giây
export function takeToken(map,key,perSec,burst){
 const now=Date.now(),b=map.get(key)??{t:burst,at:now};
 b.t=Math.min(burst,b.t+(now-b.at)/1000*perSec);b.at=now;
 const ok=b.t>=1;if(ok)b.t-=1;map.set(key,b);return ok;
}

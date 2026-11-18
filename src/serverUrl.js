// Địa chỉ máy chủ thời gian thực (WebSocket, /api, /media).
//  - Mặc định (bỏ trống): cùng tên miền với trang web — chạy local, hoặc Render tự phục vụ cả trang.
//  - Trang web đặt trên Cloudflare Pages, máy chủ ở Render: build với biến môi trường
//      VITE_SERVER_URL=https://ten-dich-vu.onrender.com
//    (máy chủ phải có ALLOWED_ORIGINS chứa tên miền Pages để cho phép kết nối chéo).
export const SERVER_URL=String(import.meta.env.VITE_SERVER_URL??'').trim().replace(/\/+$/,'');
// '/api/…' → 'https://máy-chủ/api/…'; địa chỉ tuyệt đối (http…) giữ nguyên
export const serverUrl=path=>!path||/^https?:\/\//i.test(path)||!SERVER_URL?path:SERVER_URL+(path.startsWith('/')?path:'/'+path);
export function websocketUrl(path='/multiplayer'){
 if(SERVER_URL)return SERVER_URL.replace(/^http/i,'ws')+path;
 return `${location.protocol==='https:'?'wss':'ws'}://${location.host}${path}`;
}

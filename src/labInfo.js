// Thông tin nhẹ về máy tính phòng tin học (tách khỏi LabGames.jsx để gói tải đầu trang không phải kèm mã 3 game).
export const CREDITS_SEAT='lab-11';   // máy số 12 (cuối hàng 2)
export const LAB_GAMES={
 plane:{title:'Máy bay giấy',icon:'✈️',hint:'Space / chạm màn hình để bay lên · luồn qua khe giữa các chồng sách'},
 merge:{title:'Ghép số',icon:'🔢',hint:'Phím mũi tên / WASD hoặc vuốt · 2 ô cùng số chạm nhau sẽ ghép thành 1'},
 tower:{title:'Xếp nhà cao tầng',icon:'🏗️',hint:'Space / chạm để thả tầng nhà · thả lệch quá sẽ rơi (3 mạng), tháp nghiêng quá sẽ đổ'},
};
const KEYS=Object.keys(LAB_GAMES);
const vnDay=()=>new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
/** Game của 1 máy: ngẫu nhiên theo ngày (giờ VN) — cùng ngày thì máy nào cũng giữ nguyên game, ai vào cũng thấy giống nhau. */
export function gameForSeat(id){return KEYS[hash(vnDay()+'|'+id)%KEYS.length];}
export const machineNo=id=>String((Number(id.split('-')[1])|0)+1).padStart(2,'0');


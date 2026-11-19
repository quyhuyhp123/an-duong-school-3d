import {WHEELIE_FLAG,BIKE_FIRE_FLAG} from './bikeWheelie.js';
// Giao thức mạng nhị phân dùng chung cho server (Node) và trình duyệt.
// Vị trí người chơi đi bằng gói nhị phân nhỏ; các sự kiện hiếm (ngồi, mời, chat…) vẫn là JSON.
//
// Client → server  MOVE      : u8 type=1 | i16 x | i16 y | i16 z | u8 yaw | u8 mode              (9 byte)
// Server → client  SNAPSHOT  : u8 type=2 | u32 serverTimeMs | u16 count | count × ENTITY          (7 + 10n byte)
//                  ENTITY    : u16 id | i16 x | i16 y | i16 z | u8 yaw | u8 mode                  (10 byte)
// Toạ độ lượng tử hoá 2 cm (x50), góc quay 256 mức. Tất cả little-endian.
export const TICK_HZ=10;
export const MSG_MOVE=1,MSG_SNAPSHOT=2;
export const POS_SCALE=50,POS_LIMIT=600;
export const MOVE_BYTES=9,HEADER_BYTES=7,ENTITY_BYTES=10;
export const MODES=['stand','normal','relaxed','stretch'];
export const GROUND_FLAG=4; // bit 2: đang ngồi bệt dưới đất (không phải ghế)
export const DANCE_SHIFT=3;  // bit 3-5: điệu nhảy đang nhảy (0 = không nhảy, 1..3 quẩy sàn nhảy, 4 = múa trên sân khấu)
export const danceOf=code=>(code>>DANCE_SHIFT)&7;

const TAU=Math.PI*2;
export const quantPos=v=>Math.max(-32767,Math.min(32767,Math.round(v*POS_SCALE)));
export const quantYaw=y=>Math.round((((y%TAU)+TAU)%TAU)/TAU*256)&255;
export const yawOf=q=>q/256*TAU;
// 'bench' và các tư thế ngồi khác không có trong danh sách → coi là ngồi ngay ngắn
export const modeCode=(mode,ground,dance=0)=>{const i=MODES.indexOf(mode),base=i>=0?i:(mode&&mode!=='stand'?1:0);return base|(ground&&base?GROUND_FLAG:0)|(base?0:(dance&7)<<DANCE_SHIFT);};
export const modeName=code=>MODES[code&3]??'stand';

export function encodeMove(x,y,z,yaw,code){
 const buf=new ArrayBuffer(MOVE_BYTES),v=new DataView(buf);
 v.setUint8(0,MSG_MOVE);v.setInt16(1,quantPos(x),true);v.setInt16(3,quantPos(y),true);v.setInt16(5,quantPos(z),true);v.setUint8(7,quantYaw(yaw));v.setUint8(8,code&255);
 return buf;
}
// Trả về null nếu gói không hợp lệ
export function decodeMove(view){
 if(view.byteLength!==MOVE_BYTES||view.getUint8(0)!==MSG_MOVE)return null;
 const x=view.getInt16(1,true)/POS_SCALE,y=view.getInt16(3,true)/POS_SCALE,z=view.getInt16(5,true)/POS_SCALE;
 if(Math.abs(x)>POS_LIMIT||Math.abs(y)>POS_LIMIT||Math.abs(z)>POS_LIMIT)return null;
 const code=view.getUint8(8),mode=((code>>3)&7)===7?code:code&~(WHEELIE_FLAG|BIKE_FIRE_FLAG);
 return {x,y,z,yaw:view.getUint8(7),mode};
}
// Gọi onEntity(id,x,y,z,yawQ,mode) cho mỗi người trong gói; trả về thời điểm server gửi
export function decodeSnapshot(view,onEntity){
 if(view.byteLength<HEADER_BYTES||view.getUint8(0)!==MSG_SNAPSHOT)return null;
 const time=view.getUint32(1,true),count=view.getUint16(5,true);
 if(view.byteLength!==HEADER_BYTES+count*ENTITY_BYTES)return null;
 for(let i=0,o=HEADER_BYTES;i<count;i++,o+=ENTITY_BYTES)onEntity(view.getUint16(o,true),view.getInt16(o+2,true)/POS_SCALE,view.getInt16(o+4,true)/POS_SCALE,view.getInt16(o+6,true)/POS_SCALE,view.getUint8(o+8),view.getUint8(o+9));
 return {time,count};
}

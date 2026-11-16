// Sự kiện ban đêm (DJ / lửa trại) + phòng trò chuyện chung.
// Cấu hình do trang quản lý đặt, lưu ở data/events.json và được đẩy tới mọi người chơi qua WebSocket.
import {randomUUID} from 'node:crypto';
import {jsonFile,clean} from './store.js';
import {metrics} from './metrics.js';
import {findMusic,musicUrl} from './music.js';

export const EVENTS={none:'Không có sự kiện',dj:'Đêm nhạc DJ',campfire:'Lửa trại giữa sân'};
export const SCHEDULES={night:'Chỉ khi trời tối (18:30 – 05:00)',always:'Bật ngay, cả ban ngày'};
export const CHAT_MODES={event:'Mở trong lúc sự kiện diễn ra',always:'Luôn mở',off:'Tắt'};
// musicId: bài admin chọn cho Đêm nhạc DJ (null = nhạc điện tử tự tạo); musicVolume 0..1; musicStartedAt: mốc để mọi người nghe cùng đoạn
const DEFAULT_CONFIG={event:'none',schedule:'night',chat:'event',note:'',updatedAt:null,musicId:null,musicVolume:.8,musicStartedAt:0};

const configStore=jsonFile('events.json',DEFAULT_CONFIG),chatStore=jsonFile('chat.json',[],{batchMs:500}); // chat ghi gộp mỗi 0,5 s
const MAX_CHAT=500,HISTORY=60,CHAT_GAP_MS=1200;

// Kênh phát tới tất cả người chơi — multiplayer.js gắn hàm broadcast thật vào đây khi khởi động
export const hub={broadcast:()=>{},online:()=>0};

export async function getConfig(){return {...DEFAULT_CONFIG,...(await configStore.get())};}
// Cấu hình gửi cho người chơi: kèm tên & đường dẫn bài nhạc đang chọn
export async function publicConfig(config){
 const c=config??await getConfig(),t=c.musicId?await findMusic(c.musicId):null;
 return {...c,music:t?{id:t.id,name:t.name,url:musicUrl(t),volume:c.musicVolume,startedAt:c.musicStartedAt}:{id:null,volume:c.musicVolume,startedAt:0}};
}
async function save(next){await configStore.update(()=>next);hub.broadcast({type:'config',config:await publicConfig(next)});return next;}
// Lưu phần sự kiện/chat (giữ nguyên cài đặt nhạc)
export async function setConfig(input){
 const cur=await getConfig();
 return save({...cur,
  event:Object.hasOwn(EVENTS,input?.event)?input.event:'none',
  schedule:Object.hasOwn(SCHEDULES,input?.schedule)?input.schedule:'night',
  chat:Object.hasOwn(CHAT_MODES,input?.chat)?input.chat:'event',
  note:clean(input?.note,120),
  updatedAt:new Date().toISOString()});
}
// Chọn bài / chỉnh âm lượng — áp dụng ngay cho mọi người
export async function setMusic(input){
 const cur=await getConfig(),next={...cur};
 if('musicId' in (input??{})){
  const id=input.musicId===null?null:(await findMusic(String(input.musicId)))?.id;
  if(id===undefined)throw Object.assign(new Error('Không tìm thấy bài nhạc.'),{status:404});
  if(id!==cur.musicId){next.musicId=id;next.musicStartedAt=Date.now();}
 }
 if(Number.isFinite(input?.musicVolume))next.musicVolume=Math.max(0,Math.min(1,+input.musicVolume));
 return save(next);
}

// Tin gần đây giữ trong bộ nhớ để phát ngay; việc ghi đĩa chạy nền theo lô
let recent=null;
async function recentChat(){if(!recent){const list=await chatStore.get().catch(()=>[]);recent=(Array.isArray(list)?list:[]).slice(-MAX_CHAT);}return recent;}
export async function chatHistory(limit=HISTORY){return (await recentChat()).slice(-limit);}
export async function deleteChat(id){await recentChat();recent=recent.filter(m=>m.id!==id);hub.broadcast({type:'chat-delete',id});await chatStore.update(list=>(Array.isArray(list)?list:[]).filter(m=>m.id!==id));}
export async function clearChat(){recent=[];hub.broadcast({type:'chat-clear'});await chatStore.update(()=>[]);}

// Gọi từ multiplayer.js khi một người chơi gửi tin nhắn. Trả về lỗi (chuỗi) hoặc null.
const lastChat=new WeakMap();
export async function postChat(player,m){
 const config=await getConfig();
 if(config.chat==='off')return 'Phòng trò chuyện đang tắt.';
 const now=Date.now();if(now-(lastChat.get(player)??0)<CHAT_GAP_MS)return 'Bạn gửi hơi nhanh, chậm lại chút nhé.';
 const text=clean(m.text,200);if(!text)return null;
 lastChat.set(player,now);
 const message={id:randomUUID(),name:clean(m.name,24)||'Khách',text,at:new Date().toISOString()};
 const list=await recentChat();list.push(message);if(list.length>MAX_CHAT)list.splice(0,list.length-MAX_CHAT);
 hub.broadcast({type:'chat',message});metrics.count('chatMessages');
 chatStore.update(saved=>{const next=Array.isArray(saved)?saved:[];next.push(message);if(next.length>MAX_CHAT)next.splice(0,next.length-MAX_CHAT);return next;}).catch(e=>console.error('[chat] không lưu được',e.message));
 return null;
}

// Gửi cho người chơi vừa kết nối: cấu hình sự kiện + lịch sử trò chuyện gần đây
export async function welcomeMessages(){return [{type:'config',config:await publicConfig()},{type:'chat-history',messages:await chatHistory()}];}

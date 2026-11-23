// Trạng thái "sống" từ server: sự kiện ban đêm đang chọn + phòng trò chuyện.
import {useEffect,useState} from 'react';
import {network} from './multiplayer';
import {isEventNight,msUntilEventBoundary} from './eventSchedule';

// Vị trí sự kiện trong sân (toạ độ three.js, mặt sân y≈0)
export const CAMPFIRE_POS=[0,0,-10]; // giữa sân, thẳng trục cổng chính → sân khấu (cả hai đều ở x = 0)
// Sàn nhảy 11 × 11 m ngay trước sân khấu (ô đỏ) và vùng tham gia nhạc hội (ô vàng, rộng hơn sàn)
export const DJ_FLOOR=[0,0,-19.6];
export const DJ_ZONE={minX:-8,maxX:8,minZ:-26,maxZ:-10.8};
export const inDJZone=(x,y,z)=>x>=DJ_ZONE.minX&&x<=DJ_ZONE.maxX&&z>=DJ_ZONE.minZ&&z<=DJ_ZONE.maxZ&&y<2.6;
export const EVENT_INFO={
 teachers:{title:'Ngày Nhà giáo Việt Nam 20/11',icon:'🌸',where:'sân trường và nhà đa năng',spot:[0,0.98,-22]},
 dj:{title:'Đêm nhạc DJ',icon:'🎧',where:'trước sân khấu xanh',spot:[0,0.98,-12.2]},
 campfire:{title:'Lửa trại',icon:'🔥',where:'sân trước sân khấu',spot:[CAMPFIRE_POS[0],0.98,CAMPFIRE_POS[2]+6]},
};
export function useLive(){
 const [,tick]=useState(0);
 useEffect(()=>{
  const on=()=>tick(n=>n+1);
  window.addEventListener('school-live',on);
  let timer;
  const refreshSchedule=()=>{
   clearTimeout(timer);
   const now=Date.now();
   timer=setTimeout(refreshSchedule,msUntilEventBoundary(now));
   on();
  };
  document.addEventListener('visibilitychange',refreshSchedule);
  refreshSchedule();
  return()=>{
   window.removeEventListener('school-live',on);
   document.removeEventListener('visibilitychange',refreshSchedule);
   clearTimeout(timer);
  };
 },[]);
 const config=network.config;
 const active=!!config&&config.event!=='none'&&(config.schedule==='always'||isEventNight());
 const chatOpen=!!config&&(config.chat==='always'||(config.chat==='event'&&active));
 return {config,event:active?config.event:null,note:config?.note??'',chatOpen,chat:network.chat};
}

// Trống trường: mỗi 15 phút, chỉ 08:00–12:00 và 14:00–17:00 theo giờ Việt Nam (kể cả mốc 12:00 và 17:00).
//  - Âm thanh tổng hợp bằng Web Audio (tiếng "tùng" trầm của trống da, không dùng file).
//  - Một hồi: dồn nhanh dần (hồi trống) rồi 3 tiếng "tùng… tùng… tùng" chắc.
//  - Đứng gần trống nghe to, xa vẫn nghe được (cả sân trường); tuân theo nút tắt tiếng chung của trang.
//  - Hiện dòng thông báo nhỏ "🥁 Tùng! Tùng! Tùng!" khi trống đánh.
//  Thử ngay: thêm ?drum vào địa chỉ trang → trống đánh sau 3 giây nếu đang trong khung giờ cho phép.
import React,{useEffect,useState} from 'react';
import {isMuted} from './eventAudio';
import {localPlayer} from './localPlayer';
import {DRUM_TIME_ZONE,isSchoolDrumTime} from './drumSchedule';

export const DRUM_POS=[-36.45,1,-20.96];   // toạ độ three.js của trống (khớp school_drum trong scripts/interiors.py)
const QUARTER=15*60*1000;

let ctx=null,noiseBuf=null;
function audio(){
 if(!ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C();}
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 return ctx;
}
// trình duyệt chỉ cho phát âm thanh sau thao tác của người dùng → mở khoá AudioContext ở lần bấm / chạm / gõ phím đầu tiên
function unlockOnce(){const go=()=>{audio();window.removeEventListener('pointerdown',go);window.removeEventListener('keydown',go);};window.addEventListener('pointerdown',go);window.addEventListener('keydown',go);}

/** 1 tiếng "tùng": thân trống trầm (sóng sin trượt xuống) + tiếng da căng + tiếng dùi gõ */
function hit(c,out,at,strength=1){
 const body=(f,f2,dur,vol)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(f,at);o.frequency.exponentialRampToValueAtTime(f2,at+dur*.6);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(vol*strength,at+.006);g.gain.exponentialRampToValueAtTime(.0001,at+dur);o.connect(g).connect(out);o.start(at);o.stop(at+dur+.05);};
 body(105,52,1.3,.95);body(172,88,.55,.35);body(260,150,.18,.12);
 if(!noiseBuf){noiseBuf=c.createBuffer(1,c.sampleRate/2,c.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
 const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=noiseBuf;f.type='lowpass';f.frequency.value=900;
 g.gain.setValueAtTime(.45*strength,at);g.gain.exponentialRampToValueAtTime(.0001,at+.09);s.connect(f).connect(g).connect(out);s.start(at);s.stop(at+.1);
}
/** Một hồi trống (~9 giây). Trả về thời lượng (giây). */
export function playDrumRoll(){
 const c=audio();if(!c||isMuted())return 0;
 const d=localPlayer.ready?Math.hypot(localPlayer.x-DRUM_POS[0],localPlayer.y-DRUM_POS[1],localPlayer.z-DRUM_POS[2]):40;
 const out=c.createGain();out.gain.value=Math.max(.28,Math.min(1,14/Math.max(d,1)))*.9;   // gần trống: to; xa: vẫn nghe rõ
 const comp=c.createDynamicsCompressor();out.connect(comp).connect(c.destination);
 let t=c.currentTime+.05;
 // hồi trống: dồn nhanh dần, mạnh dần
 for(let i=0,gap=.62;i<16;i++){hit(c,out,t,.55+i*.03);t+=gap;gap=Math.max(.13,gap*.84);}
 t+=.7;
 // 3 tiếng chắc
 for(let i=0;i<3;i++){hit(c,out,t,1.05);t+=1.1;}
 return t-c.currentTime+1.2;
}

export function SchoolDrum(){
 const [show,setShow]=useState(false);
 useEffect(()=>{
  unlockOnce();
  let timer,hide;
  const ring=()=>{if(isSchoolDrumTime()&&document.visibilityState==='visible'){const dur=playDrumRoll();setShow(true);clearTimeout(hide);hide=setTimeout(()=>setShow(false),Math.max(4000,dur*1000));}schedule();};
  // hẹn tới mốc 15 phút kế tiếp theo đồng hồ thật (mọi người chơi nghe cùng lúc)
  const schedule=()=>{const now=Date.now();timer=setTimeout(ring,QUARTER-now%QUARTER+200);};
  if(/[?&]drum(&|=|$)/.test(location.search))timer=setTimeout(ring,3000);else schedule();
  return()=>{clearTimeout(timer);clearTimeout(hide);};
 },[]);
 return show?<div className="drum-toast" role="status">🥁 Tùng! Tùng! Tùng! <small>Trống trường báo {new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:DRUM_TIME_ZONE})}</small></div>:null;
}

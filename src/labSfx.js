// Hiệu ứng âm thanh cho 3 game phòng tin học — tổng hợp trực tiếp bằng Web Audio (không cần file âm thanh, không bản quyền).
// Tôn trọng nút tắt tiếng chung của trang (eventAudio). AudioContext chỉ tạo khi người chơi bấm / chạm (trình duyệt yêu cầu).
import {isMuted} from './eventAudio';

let ctx=null,out=null,noiseBuf=null;
// Âm lượng 0–100 (thanh loa trên màn hình game). 50 = mức mặc định (hệ số .55); 100 = gấp đôi; 0 = tắt. Lưu trên máy.
const VOL_KEY='lab-sfx-volume';
let volume=(()=>{try{const v=Number(localStorage.getItem(VOL_KEY));return localStorage.getItem(VOL_KEY)!=null&&Number.isFinite(v)?Math.max(0,Math.min(100,v)):50;}catch{return 50;}})();
const gainOf=v=>.55*v/50;
export function getVolume(){return volume;}
export function setVolume(v){
 volume=Math.max(0,Math.min(100,Math.round(v)));try{localStorage.setItem(VOL_KEY,String(volume));}catch{}
 if(out&&ctx)out.gain.setTargetAtTime(gainOf(volume),ctx.currentTime,.02);
}
function ac(){
 if(isMuted()||volume<=0)return null;
 if(!ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C();out=ctx.createGain();out.gain.value=gainOf(volume);out.connect(ctx.destination);}
 if(ctx.state==='suspended')ctx.resume().catch(()=>{});
 return ctx;
}
/** 1 nốt: tần số f → f2 (trượt), dạng sóng, độ dài, âm lượng; t = trễ (giây) */
function tone({f=440,f2=f,type='sine',t=0,dur=.15,vol=.2,attack=.005}){
 const c=ac();if(!c)return;const at=c.currentTime+t,o=c.createOscillator(),g=c.createGain();
 o.type=type;o.frequency.setValueAtTime(f,at);if(f2!==f)o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),at+dur);
 g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(vol,at+attack);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
 o.connect(g).connect(out);o.start(at);o.stop(at+dur+.02);
}
/** tiếng ồn lọc: gió vù, tiếng đập, tiếng đổ */
function noise({t=0,dur=.15,vol=.2,type='bandpass',f=1000,f2=f,q=1}){
 const c=ac();if(!c)return;const at=c.currentTime+t;
 if(!noiseBuf){noiseBuf=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
 const s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=noiseBuf;
 fl.type=type;fl.Q.value=q;fl.frequency.setValueAtTime(f,at);if(f2!==f)fl.frequency.exponentialRampToValueAtTime(Math.max(30,f2),at+dur);
 g.gain.setValueAtTime(vol,at);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
 s.connect(fl).connect(g).connect(out);s.start(at,Math.random()*Math.max(0,1.9-dur));s.stop(at+dur+.02);
}

export const sfx={
 // ✈️ Máy bay giấy
 flap(){noise({dur:.13,vol:.22,f:1400,f2:500,q:.8});tone({f:520,f2:780,type:'sine',dur:.08,vol:.05});},          // vút cánh giấy
 point(){tone({f:988,type:'square',dur:.07,vol:.07});tone({f:1319,type:'square',t:.07,dur:.13,vol:.07});},      // "ting-ting" qua chồng sách
 hit(){tone({f:200,f2:60,type:'square',dur:.2,vol:.16});noise({dur:.14,vol:.35,type:'lowpass',f:900,f2:200});},  // va vào sách
 fall(){tone({f:700,f2:110,type:'sine',t:.16,dur:.55,vol:.1});},                                                    // rơi xuống mặt bàn
 // 🔢 Ghép số
 slide(){noise({dur:.07,vol:.09,f:2600,f2:1200,q:2});},                                                                // ô trượt
 merge(v=4){const k=Math.log2(v);const f=262*Math.pow(2,(k-1)*2/12);tone({f,f2:f*1.5,type:'triangle',dur:.14,vol:.16});tone({f:f*2,type:'sine',t:.02,dur:.1,vol:.05});
  if(v>=2048)[523,659,784,1047].forEach((n,i)=>tone({f:n,type:'triangle',t:.12+i*.09,dur:.25,vol:.12}));},          // "pop" cao dần theo số ô; 2048 có kèn chiến thắng
 // 🏗️ Xếp nhà cao tầng
 drop(){tone({f:950,f2:380,type:'sine',dur:.32,vol:.06});noise({dur:.25,vol:.05,f:1800,f2:600});},                  // tầng nhà rơi (vèo)
 land(){tone({f:150,f2:48,type:'sine',dur:.22,vol:.4});noise({dur:.1,vol:.25,type:'lowpass',f:500});},              // "bịch" đặt tầng
 perfect(combo=1){const b=660*Math.pow(2,Math.min(combo-1,7)/12);[1,1.26,1.5,2].forEach((m,i)=>tone({f:b*m,type:'triangle',t:i*.055,dur:.2,vol:.12}));}, // khớp hoàn hảo: arpeggio cao dần theo combo
 miss(){tone({f:320,f2:70,type:'sawtooth',dur:.5,vol:.08});noise({t:.45,dur:.35,vol:.3,type:'lowpass',f:700,f2:150});}, // trượt → rơi xuống đất
 collapse(){noise({dur:1.4,vol:.55,type:'lowpass',f:320,f2:60});tone({f:90,f2:35,type:'sawtooth',dur:1.2,vol:.12});[0,.25,.5,.8].forEach(t=>noise({t,dur:.2,vol:.2,type:'lowpass',f:900,f2:200}));}, // tháp đổ ầm ầm
 // chung
 over(){[523,392,330,262].forEach((n,i)=>tone({f:n,type:'triangle',t:i*.13,dur:.2,vol:.12}));},                     // hết lượt
 record(){[523,659,784,1047,1319].forEach((n,i)=>tone({f:n,type:'square',t:i*.08,dur:i===4?.4:.12,vol:.06}));},      // kỷ lục mới
};

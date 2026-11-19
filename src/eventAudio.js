import {serverUrl} from './serverUrl';
// Âm thanh sự kiện tổng hợp bằng Web Audio (không cần file nhạc):
//  - DJ: nhạc điện tử 124 BPM (trống kick, clap, hi-hat, bass, arpeggio) — to dần khi lại gần sân khấu
//  - Lửa trại: tiếng lửa tí tách — nghe rõ khi đứng gần đống lửa
// Trình duyệt chỉ cho phát âm thanh sau khi người dùng bấm/nhấn phím, nên AudioContext được mở ở lần tương tác đầu tiên.
export const BPM=124;
const SPB=60/BPM; // giây mỗi nhịp
let ctx=null,master=null,djBus=null,fireBus=null,noise=null,timer=null,nextStep=0,step=0,startTime=0;
let wanted=null,listener=[0,0,0],muted=(()=>{try{return localStorage.getItem('school-muted')==='1'}catch{return false}})();
let albumOpen=false;
const listeners=new Set();

function ensure(){
 if(ctx)return ctx;
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
 ctx=new AC();master=ctx.createGain();master.gain.value=muted?0:1;master.connect(ctx.destination);
 djBus=ctx.createGain();djBus.gain.value=0;djBus.connect(master);
 fireBus=ctx.createGain();fireBus.gain.value=0;fireBus.connect(master);
 const len=ctx.sampleRate*2,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;noise=buf;
 return ctx;
}
// Mở khoá âm thanh ở lần tương tác đầu
function unlock(){
 const c=ensure();
 if(c&&c.state!=='running')c.resume().then(apply).catch(()=>{});
 apply();
}
if(typeof window!=='undefined'){for(const ev of ['pointerdown','keydown','touchstart'])window.addEventListener(ev,unlock,{passive:true});}

function noiseSrc(t,dur,type,freq,q,gain){
 const s=ctx.createBufferSource();s.buffer=noise;const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
 const g=ctx.createGain();g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
 s.connect(f).connect(g);return {s,g,out:g};
}
const BASS=[45,45,48,43]; // A1, A1, C2, G1 (MIDI)
const ARP=[[57,60,64,69],[53,57,60,65],[48,52,55,60],[55,59,62,67]]; // Am F C G
const hz=n=>440*Math.pow(2,(n-69)/12);
function scheduleDJ(t,i){
 const beat=i%4===0,bar=Math.floor(i/16)%4;
 if(beat){ // kick
  const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);
  g.gain.setValueAtTime(1,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.connect(g).connect(djBus);o.start(t);o.stop(t+.36);
 }
 if(i%8===4){const n=noiseSrc(t,.18,'bandpass',1500,.8,.5);n.out.connect(djBus);n.s.start(t);n.s.stop(t+.2);} // clap
 if(i%4===2){const n=noiseSrc(t,.05,'highpass',8000,.5,.35);n.out.connect(djBus);n.s.start(t);n.s.stop(t+.06);} // hi-hat mở
 if(i%2===1){const n=noiseSrc(t,.025,'highpass',9500,.5,.15);n.out.connect(djBus);n.s.start(t);n.s.stop(t+.03);} // hi-hat đóng
 if(i%4===2||i%4===3){ // bass lệch nhịp
  const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sawtooth';o.frequency.value=hz(BASS[bar]);
  f.type='lowpass';f.frequency.setValueAtTime(900,t);f.frequency.exponentialRampToValueAtTime(180,t+SPB/4);
  g.gain.setValueAtTime(.35,t);g.gain.exponentialRampToValueAtTime(.001,t+SPB/4*.95);o.connect(f).connect(g).connect(djBus);o.start(t);o.stop(t+SPB/4);
 }
 { // arpeggio
  const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='square';o.frequency.value=hz(ARP[bar][i%4]+12);
  f.type='lowpass';f.frequency.value=1800+1200*Math.sin(i/32*Math.PI);
  g.gain.setValueAtTime(.06,t);g.gain.exponentialRampToValueAtTime(.001,t+.14);o.connect(f).connect(g).connect(djBus);o.start(t);o.stop(t+.15);
 }
}
function scheduleFire(t){
 // vài tiếng "tách" ngẫu nhiên mỗi bước
 if(Math.random()<.55){const tt=t+Math.random()*SPB/4,n=noiseSrc(tt,.02+Math.random()*.05,'bandpass',1200+Math.random()*3000,1.5,.25+Math.random()*.5);n.out.connect(fireBus);n.s.start(tt);n.s.stop(tt+.1);}
}
let fireBed=null;
function startFireBed(){ // tiếng lửa cháy rì rầm nền
 if(fireBed)return;const s=ctx.createBufferSource();s.buffer=noise;s.loop=true;const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=500;const g=ctx.createGain();g.gain.value=.25;
 s.connect(f).connect(g).connect(fireBus);s.start();fireBed=s;
}
function stopFireBed(){if(fireBed){try{fireBed.stop()}catch{}fireBed=null;}}

function tickScheduler(){
 if(!ctx||!wanted)return;
 if(nextStep<ctx.currentTime-.12)nextStep=ctx.currentTime+.03;
 while(nextStep<ctx.currentTime+.12){
  if(wanted.type==='dj'){if(!albumOpen&&!useMusic())scheduleDJ(nextStep,step);} // có file nhạc của admin → không phát nhạc tự tạo (đồng hồ nhịp vẫn chạy cho đèn)
  else scheduleFire(nextStep);
  nextStep+=SPB/4;step++;
 }
}
function apply(){
 if(!ctx)return;
 if(wanted&&!timer){startTime=Math.ceil((ctx.currentTime+.05)/SPB)*SPB;nextStep=startTime;step=0;timer=setInterval(tickScheduler,25);}
 if(!wanted&&timer){clearInterval(timer);timer=null;}
 if(wanted?.type==='campfire')startFireBed();else stopFireBed();
 syncMusic();
 updateVolume();
}
function updateVolume(){
 if(!ctx)return;const now=ctx.currentTime;
 const d=wanted?Math.hypot(listener[0]-wanted.pos[0],listener[2]-wanted.pos[2]):1e9;
 // âm lượng DJ = độ gần sân khấu × âm lượng admin đặt (áp dụng cho cả file nhạc lẫn nhạc tự tạo)
 const dj=wanted?.type==='dj'?Math.pow(Math.max(0,1-d/70),1.6)*(useMusic()?1:.6)*music.volume:0;
 const fire=wanted?.type==='campfire'?Math.pow(Math.max(0,1-d/20),1.4)*.8:0;
 if(albumOpen){djBus.gain.cancelScheduledValues(now);djBus.gain.setValueAtTime(0,now);}
 else djBus.gain.setTargetAtTime(dj,now,.3);
 fireBus.gain.setTargetAtTime(fire,now,.3);
}

// ---------- File nhạc do admin chọn ----------
// Phát bằng thẻ <audio> (tải dần, không nạp cả bài vào RAM) nối vào cùng bộ chỉnh âm lượng theo khoảng cách.
let music={url:null,volume:.8,startedAt:0},musicEl=null,musicSrc=null,mediaFailed=false;
const useMusic=()=>!!music.url&&!mediaFailed&&wanted?.type==='dj';
function syncMusic(){
 if(!ctx)return;
 if(albumOpen||!useMusic()){if(musicEl&&!musicEl.paused)musicEl.pause();return;}
 if(!musicEl||musicEl.dataset.url!==music.url){
  if(musicEl){musicEl.pause();musicSrc?.disconnect();}
  musicEl=new Audio();musicEl.crossOrigin='anonymous';musicEl.loop=true;musicEl.preload='auto';musicEl.dataset.url=music.url;musicEl.src=serverUrl(music.url);
  musicSrc=ctx.createMediaElementSource(musicEl);
  // Bộ phân tích đặt TRƯỚC bộ chỉnh âm lượng theo khoảng cách → người đứng xa hay tắt tiếng vẫn thấy đèn nháy đúng nhạc
  analyser??=Object.assign(ctx.createAnalyser(),{fftSize:2048,smoothingTimeConstant:.35});
  musicSrc.connect(analyser);analyser.connect(djBus);resetBeatTracker();
  // Mọi người nghe gần cùng một đoạn: tua tới (thời gian từ lúc admin chọn bài) mod độ dài bài
  const track=musicEl;
  track.addEventListener('loadedmetadata',()=>{if(track===musicEl)seekMusic(music.startedAt);},{once:true});
  track.addEventListener('error',()=>{if(track===musicEl){mediaFailed=true;updateVolume();}});
 }
 if(musicEl.paused&&ctx.state==='running'){
  const track=musicEl;
  track.play().catch(error=>{if(track===musicEl&&!albumOpen&&error.name!=='AbortError'){mediaFailed=true;updateVolume();}});
 }
 // Đo nhịp bằng bộ hẹn giờ riêng (~100 lần/giây), không phụ thuộc tốc độ vẽ khung hình
 // → máy yếu chỉ vẽ 20 FPS vẫn bắt được các cú kick ngắn ~0,1 s
 analyseTimer??=setInterval(()=>{if(!useMusic()){clearInterval(analyseTimer);analyseTimer=null;return;}analyse();},10);
}
function seekMusic(startedAt){
 const duration=musicEl?.duration;
 if(startedAt&&Number.isFinite(duration)&&duration>0)musicEl.currentTime=(Math.max(0,Date.now()-startedAt)/1000)%duration;
}
export function setAlbumAudio(open){
 albumOpen=open;
 if(!open&&musicEl?.dataset.url===music.url)seekMusic(music.startedAt);
 syncMusic();updateVolume();
}
export function setMusic(cfg){
 const next={url:cfg?.url??null,volume:Number.isFinite(cfg?.volume)?cfg.volume:.8,startedAt:cfg?.startedAt??0};
 const changed=next.url!==music.url||next.startedAt!==music.startedAt;music=next;
 if(changed){
  if(mediaFailed&&musicEl){musicEl.pause();musicSrc?.disconnect();musicEl=null;musicSrc=null;}
  mediaFailed=false;
  if(musicEl?.dataset.url===next.url)seekMusic(next.startedAt);
 }
 syncMusic();updateVolume();
}

// API cho giao diện
export function setEventSound(type,pos){const next=type?{type,pos}:null;if(next?.type===wanted?.type)return void(wanted=next,updateVolume());wanted=next;if(timer){clearInterval(timer);timer=null;}apply();}
export function setListenerPosition(p){listener=p;updateVolume();}
export function isMuted(){return muted;}
export function setMuted(v){muted=v;try{localStorage.setItem('school-muted',v?'1':'0')}catch{}if(master)master.gain.setTargetAtTime(v?0:1,ctx.currentTime,.05);listeners.forEach(fn=>fn(v));}
export function onMuteChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}
// ---------- Phân tích nhịp từ bài nhạc thật ----------
// Mỗi khung hình: đo năng lượng dải bass (kick, trống) → phát hiện "nhịp" khi bass bật lên đột ngột so với mức trung bình gần đây
// → ước lượng tempo từ khoảng cách giữa các nhịp → khoá pha để đồng hồ nhịp trùng với nhạc.
let analyser=null,freq=null,lastAnalyse=0,analyseTimer=null;
const hist=new Float32Array(48);let histN=0,histI=0;
let level=.8,peakLevel=.05,pulse=0,onsets=[],period=SPB,anchorBeat=0,anchorTime=0,locked=false,lastOnset=0,detectedBpm=0;
function resetBeatTracker(){histN=histI=0;pulse=0;level=.8;peakLevel=.05;onsets=[];period=SPB;anchorBeat=0;anchorTime=performance.now()/1000;locked=false;lastOnset=0;detectedBpm=0;}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1];};
function analyse(){
 const nowMs=performance.now();if(nowMs-lastAnalyse<8)return;lastAnalyse=nowMs;
 if(!analyser||!useMusic()||!musicEl||musicEl.paused)return;
 freq??=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(freq);
 const hz=ctx.sampleRate/analyser.fftSize,lo=Math.max(1,Math.floor(35/hz)),hi=Math.ceil(160/hz);
 let bass=0;for(let i=lo;i<=hi;i++)bass+=freq[i];bass/=(hi-lo+1)*255;          // 0..1
 let all=0;for(let i=1;i<freq.length/2;i++)all+=freq[i];all/=(freq.length/2)*255;
 // mức to tương đối so với trung bình ~8 s gần nhất của chính bài → bài nào cũng quanh mức 0,8; đoạn drop sáng rực, đoạn lặng dịu lại
 peakLevel+=(Math.max(all,.01)-peakLevel)*.0013; // (dùng làm trung bình chậm)
 level+=(all/(peakLevel*1.25)-level)*.2;
 // phát hiện nhịp: bass vượt trung bình + 1,3 độ lệch chuẩn của ~0,6 s gần nhất
 let mean=0,sd=0;const n=Math.min(histN,hist.length);for(let i=0;i<n;i++)mean+=hist[i];mean/=n||1;for(let i=0;i<n;i++)sd+=(hist[i]-mean)**2;sd=Math.sqrt(sd/(n||1));
 hist[histI]=bass;histI=(histI+1)%hist.length;histN++;
 const t=nowMs/1000;pulse*=Math.exp(-(nowMs-(analyse.prev??nowMs))/120);analyse.prev=nowMs;
 if(n>20&&bass>mean+1.3*sd+.02&&bass>.12&&t-lastOnset>.28){
  lastOnset=t;pulse=1;onsets.push(t);if(onsets.length>24)onsets.shift();
  // tempo: khoảng cách giữa các nhịp gần nhất, gập về vùng 0,35–0,75 s (80–170 BPM), lấy trung vị
  if(onsets.length>=6){
   const iv=[];for(let i=1;i<onsets.length;i++){let d=onsets[i]-onsets[i-1];if(d>2)continue;while(d<.35)d*=2;while(d>.75)d/=2;iv.push(d);}
   if(iv.length>=4){const m=median(iv);period+=(m-period)*(locked?.15:.6);detectedBpm=Math.round(60/period);}
  }
  // khoá pha: nếu nhịp mới rơi gần một nhịp dự đoán thì "neo" đồng hồ vào đó
  const predicted=anchorBeat+(t-anchorTime)/period,k=Math.round(predicted);
  if(!locked||Math.abs(predicted-k)<.3){anchorBeat=locked?k:Math.ceil(predicted);anchorTime=t;locked=onsets.length>=6;}
 }
}
const musicActive=()=>!!analyser&&useMusic()&&musicEl&&!musicEl.paused;
// Nhịp hiện tại (số thập phân) — đèn, sàn nhảy, điệu nhảy dùng để chạy theo nhạc
export function beatNow(){
 analyse();
 if(musicActive())return anchorBeat+(performance.now()/1000-anchorTime)/period;
 return ctx&&timer?(ctx.currentTime-startTime)/SPB:performance.now()/1000/SPB;
}
// Độ "đập" 0..1: với bài thật là cú bass vừa xảy ra (tắt dần); với nhạc tự tạo là theo nhịp 124 BPM
export function pulseNow(sharp=2){
 const b=beatNow();
 if(musicActive())return Math.max(pulse,locked?Math.pow(1-(b%1),sharp)*.6:0);
 return Math.pow(1-(b%1),sharp);
}
// Mức to tổng thể 0..1 (chỉ có ý nghĩa với bài thật; nhạc tự tạo trả 1)
export function levelNow(){analyse();return musicActive()?Math.max(.3,Math.min(1.3,level)):1;}
export function bpmNow(){return musicActive()&&locked?detectedBpm:BPM;}
// Chẩn đoán (dùng trong console / kiểm thử): trạng thái bộ âm thanh và bộ dò nhịp
export function audioDebug(){return {ctx:ctx?.state,music:music.url,el:musicEl?{paused:musicEl.paused,time:+musicEl.currentTime.toFixed(2),ready:musicEl.readyState,err:musicEl.error?.code}:null,analyser:!!analyser,onsets:onsets.length,locked,bpm:detectedBpm,level:+level.toFixed(3)};}

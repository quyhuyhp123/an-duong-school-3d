// "Làm nóng" cảnh 3D trước khi người chơi bước vào trường — chạy ngay khi mô hình tải xong (thường lúc người chơi còn ở màn hình chào).
// Nguyên nhân giật khi mới đi từ cổng vào: trình duyệt chỉ biên dịch shader, đưa texture & dữ liệu hình khối lên card đồ hoạ
// vào lần ĐẦU TIÊN một vật xuất hiện trong khung nhìn → đi tới đâu khựng tới đó. Ở đây làm hết 1 lần, trước:
//   1. tạm hiện mọi cụm đang ẩn vì ở xa (useNearVisible) và tắt cắt bỏ ngoài khung nhìn (frustum culling)
//   2. biên dịch toàn bộ shader — compileAsync (song song, không khoá trình duyệt nếu card hỗ trợ)
//   3. đưa mọi texture lên card đồ hoạ
//   4. vẽ thử 1 khung toàn trường (đưa dữ liệu hình khối lên card, biên dịch cả shader đổ bóng)
//   5. trả lại trạng thái ẩn / cắt bỏ như cũ
import {useEffect,useRef,useState} from 'react';
import {useThree} from '@react-three/fiber';

const frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));

// pass: đổi giá trị → chạy thêm 1 lượt (VD lúc bấm "Vào trường": phủ cả những cụm vừa được tạo sau lượt đầu; lượt sau rất nhanh vì phần lớn đã sẵn).
export function Prewarm({ready,pass=0,onProgress,onDone}){
 const {gl,scene,camera}=useThree(),done=useRef(null),running=useRef(false),latest=useRef(pass),[tick,setTick]=useState(0);latest.current=pass;
 useEffect(()=>{
  if(!ready||running.current||done.current===pass)return;running.current=true;done.current=pass;
  (async()=>{
   const t0=performance.now();
   await frame();await frame();onProgress?.(.15);   // chờ các cụm gộp mảnh (mergeStatic) chạy xong
   const shown=[],culled=[];
   scene.traverse(o=>{
    // vật liệu trong suốt 2 mặt: three.js mặc định vẽ 2 lượt (mặt sau rồi mặt trước), mỗi lượt đặt needsUpdate → tốn CPU mỗi khung. Vẽ 1 lượt.
    for(const m of (o.material?(Array.isArray(o.material)?o.material:[o.material]):[]))if(m.transparent&&m.side===2&&!m.forceSinglePass)m.forceSinglePass=true;
    if(!o.visible&&!o.isLight&&!o.userData.mergedAway){o.visible=true;shown.push(o);}
    if((o.isMesh||o.isLine||o.isPoints||o.isSprite)&&o.frustumCulled){o.frustumCulled=false;culled.push(o);}
   });
   try{if(gl.compileAsync)await gl.compileAsync(scene,camera);else gl.compile(scene,camera);}catch(e){console.warn('[prewarm] compile',e);}
   onProgress?.(.55);await frame();
   const seen=new Set();
   scene.traverse(o=>{const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];
    for(const m of ms)for(const k of Object.keys(m)){const t=m[k];if(t?.isTexture&&!seen.has(t)){seen.add(t);try{gl.initTexture(t);}catch{}}}});
   onProgress?.(.7);await frame();
   // hiện lại NGAY trước khi vẽ thử: trong lúc chờ biên dịch, các cụm ở xa đã bị useNearVisible / lịch biểu diễn ẩn lại
   // → nếu không, dữ liệu hình khối của chúng không được đưa lên card và sẽ nạp (giật) khi người chơi đi tới
   for(const o of shown)o.visible=true;for(const o of culled)o.frustumCulled=false;
   try{gl.render(scene,camera);}catch(e){console.warn('[prewarm] render',e);}
   onProgress?.(.9);
   for(const o of shown)o.visible=false;for(const o of culled)o.frustumCulled=true;
   await frame();await frame();
   const info=gl.info;console.info(`[prewarm] ${info.programs?.length??'?'} shader, ${seen.size} texture, ${info.memory.geometries} khối hình — ${Math.round(performance.now()-t0)} ms`);
   if(window.__three){const ids=new Set();scene.traverse(o=>{if(o.geometry)ids.add(o.geometry.uuid);});window.__prewarmGeoms=ids;}   // ?perf: công cụ đo xem khối hình nào xuất hiện sau bước chuẩn bị
   running.current=false;
   if(latest.current!==done.current){setTick(t=>t+1);return;}   // có yêu cầu lượt mới trong lúc đang chạy → chạy tiếp
   onProgress?.(1);onDone?.();
  })();
 },[ready,pass,tick,gl,scene,camera,onProgress,onDone]);
 return null;
}

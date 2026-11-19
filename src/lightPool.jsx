// Bể đèn chung cho cả trường.
// Mỗi đèn điểm (pointLight) trong cảnh bắt MỌI bề mặt ở MỌI nơi phải tính thêm ánh sáng mỗi khung hình — kể cả đèn ở rất xa
// hay đang tắt (độ sáng 0). Trước đây có ~26 đèn cố định (đèn sân, nhà xe, đèn đường, phòng photo, sân khấu…).
// Nay các cụm đèn chỉ ĐĂNG KÝ nguồn sáng (vị trí, màu, độ sáng theo giờ, tầm chiếu); bể giữ số đèn thật CỐ ĐỊNH
// (8 trên máy tính, 5 trên điện thoại) và cứ 0,2 s dời chúng tới các nguồn đang bật gần camera nhất.
// Ở xa vẫn thấy đèn sáng nhờ bóng đèn phát sáng + vầng sáng vẽ sẵn; số đèn không bao giờ đổi → không biên dịch lại shader.
import React,{useEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {IS_TOUCH} from './device';

const SOURCES=new Set();
/** Đăng ký nguồn sáng: [{p:[x,y,z], color, power:()=>độ sáng (0 = tắt), distance, decay}] — trả về hàm huỷ đăng ký. */
export function addLightSources(list){for(const s of list)SOURCES.add(s);return()=>{for(const s of list)SOURCES.delete(s);};}
export function useLightSources(list){useEffect(()=>addLightSources(list),[list]);}

export const POOL_SIZE=IS_TOUCH?5:8;

export function LightPool(){
 const refs=useRef([]),slot=useRef(new Array(POOL_SIZE).fill(null)),t=useRef(0);
 useFrame(({camera},dt)=>{
  t.current-=dt;if(t.current>0)return;t.current=.2;
  const c=camera.position,cand=[];
  for(const s of SOURCES){const pw=s.power();if(pw<=.001)continue;
   const d=Math.hypot(c.x-s.p[0],c.y-s.p[1],c.z-s.p[2])-s.distance*.5;   // ưu tiên nguồn gần & tầm chiếu rộng
   cand.push({s,pw,d});}
  cand.sort((a,b)=>a.d-b.d);
  const want=new Map(cand.slice(0,POOL_SIZE).map(x=>[x.s,x.pw])),cur=slot.current,free=[];
  for(let i=0;i<POOL_SIZE;i++){if(cur[i]&&want.has(cur[i]))continue;cur[i]=null;free.push(i);}   // nguồn vẫn được chọn → giữ nguyên đèn (không nháy)
  for(const s of want.keys()){if(cur.includes(s))continue;const i=free.shift();if(i==null)break;cur[i]=s;}
  for(let i=0;i<POOL_SIZE;i++){const l=refs.current[i];if(!l)continue;const s=cur[i];
   if(!s){l.intensity=0;continue;}
   if(l.userData.src!==s){l.userData.src=s;l.position.set(s.p[0],s.p[1],s.p[2]);l.color.set(s.color);l.distance=s.distance;l.decay=s.decay;}
   l.intensity=want.get(s);}
 });
 return <>{Array.from({length:POOL_SIZE},(_,i)=><pointLight key={i} ref={el=>refs.current[i]=el} intensity={0} distance={10} decay={1.7}/>)}</>;
}

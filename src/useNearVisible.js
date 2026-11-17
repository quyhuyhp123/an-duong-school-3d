// Ẩn cả một cụm đồ vật khi camera ở xa (không vẽ, không đổ bóng) — VD nội thất nhà đa năng, dãy quán ngoài cổng.
// Kiểm tra 4 lần/giây theo khoảng cách ngang từ camera tới tâm cụm.
import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
export function useNearVisible(center,radius){
 const ref=useRef(),t=useRef(0);
 useFrame(({camera},dt)=>{
  t.current-=dt;if(t.current>0||!ref.current)return;t.current=.25;
  const dx=camera.position.x-center[0],dz=camera.position.z-center[2],v=dx*dx+dz*dz<radius*radius;
  if(ref.current.visible!==v)ref.current.visible=v;
 });
 return ref;
}

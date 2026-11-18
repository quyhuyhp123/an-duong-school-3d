export function classroomLayout(rooms){
 const boards=[],seats=[];
 for(const r of rooms){
  if(!r.aisle)continue;const dx=r.aisle[0]-r.door[0],dz=r.aisle[2]-r.door[2],l=Math.hypot(dx,dz),fx=dx/l,fz=dz/l,rx=-fz,rz=fx,floor=r.door[1]-.98;
  const point=(x,y,z)=>[r.door[0]+rx*x+fx*z,floor+y,r.door[2]+rz*x+fz*z];
  boards.push({id:r.id,position:point(1.45,1.8,7.48),approach:point(0,.98,6.2),yaw:Math.atan2(-fx,-fz)});
  for(const x of [-.3,1.55])for(const y of [.8,2.4,4])seats.push({id:`class-${r.id}-${x}-${y}`,label:`ghế lớp ${r.id}`,position:point(1.45+x,.945,y+1.4),exit:point(0,.98,y+1.4),yaw:Math.atan2(fx,fz)});
 }
 return {boards,seats};
}

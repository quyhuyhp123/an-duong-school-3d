// Xe đạp điện: các ô đỗ trong nhà xe nhỏ và nhà xe chính 2 tầng, và trạng thái ô nào đang có xe.
// Trạng thái lưu trên máy từng người chơi (mỗi người thấy xe của riêng mình); người khác chỉ thấy bạn đang đạp xe.
export const RIDE=7; // mã "điệu" dùng cho tư thế đạp xe trong gói mạng (xem protocol.js / dances.js)
export const RIDE_SPEED=7; // m/s — nhanh hơn chạy bộ (6)

const BAY_W=.9;
export const BAY_SIZE={w:BAY_W,d:2};
// Mỗi ô: tâm (x, z), mặt sàn floorY, hướng đầu xe yaw (0 = +z), nhóm
export const BAYS=[];

// Nhà xe nhỏ: khu để xe x 32.6 → 40.3, z 11.8 → 17.6; 2 hàng × 8 ô, đầu xe quay ra lối giữa (z ≈ 14.7)
for(let i=0;i<8;i++){
 const x=33.25+i*BAY_W;
 BAYS.push({id:'n'+i,x,z:12.95,yaw:0,floorY:.12,group:'shed'});
 BAYS.push({id:'s'+i,x,z:16.45,yaw:Math.PI,floorY:.12,group:'shed'});
}
// Nhà xe chính 2 tầng: sàn x 43.9 → 51.5, z -36 → 18 (tầng 1 mặt sàn 0.17, tầng 2 mặt sàn 3.34).
// Hai hàng dọc theo chiều dài nhà xe, đầu xe quay ra lối giữa (x 46 → 49.4). Chừa chỗ:
//  - tầng 1 hàng tây z > 9 (lối nối sang nhà xe nhỏ & cửa vào phía nam), hàng đông z > -6 (chân đường dốc);
//  - tầng 2 hàng đông z -16 → -2 (chỗ đường dốc lên tới sàn).
function row(prefix,x,yaw,floorY,z0,z1,step=1){for(let z=z0,i=0;z<=z1+1e-6;z+=step,i++)BAYS.push({id:prefix+i,x,z,yaw,floorY,group:'main'});}
row('a',45,Math.PI/2,.17,-34,9);           // tầng 1 – hàng tây
row('b',50.4,-Math.PI/2,.17,-34,-6);       // tầng 1 – hàng đông
// Upper east rows are inset from the widened ramp: keep all bay IDs and capacity.
row('c',45,Math.PI/2,3.34,-34,16);         // tầng 2 – hàng tây
row('d',49.05,-Math.PI/2,3.34,-34,-16);     // tầng 2 – hàng đông (trước đường dốc)
row('e',49.05,-Math.PI/2,3.34,-2,16);       // tầng 2 – hàng đông (sau đường dốc)

// Ô nào có xe lúc đầu: khoảng 3/4 có xe (chọn cố định theo id để ai cũng giống nhau), chừa ô trống để đỗ
const hash=s=>[...s].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
for(let i=0;i<10;i++){
 BAYS.push({id:`shop-left-${i}`,x:-10+i*BAY_W,z:57.1,yaw:-Math.PI,floorY:.03,group:'shop-left'});
 BAYS.push({id:`shop-right-${i}`,x:22+i*BAY_W,z:57.1,yaw:-Math.PI,floorY:.03,group:'shop-right'});
}
const state=new Map(BAYS.map(b=>[b.id,false]));
const listeners=new Set();
export const bayHasBike=id=>state.get(id)===true;
export function setBay(id,has){state.set(id,has);listeners.forEach(f=>f());}
export function onBaysChange(f){listeners.add(f);return()=>listeners.delete(f);}

// Ô gần nhất trong bán kính 2 m, cùng tầng với người chơi (tâm thân cao hơn mặt sàn ~0.85 m), thoả điều kiện có xe / trống
export function nearestBay(x,y,z,wantBike){
 let best=null,bd=2*2; // người đứng giữa lối đi cách tâm ô ~1.75 m
 for(const b of BAYS){if(bayHasBike(b.id)!==wantBike||Math.abs(y-(b.floorY+.85))>1)continue;const d=(b.x-x)**2+(b.z-z)**2;if(d<bd){bd=d;best=b;}}
 return best;
}

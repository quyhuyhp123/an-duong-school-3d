// Vị trí múa trên 2 sân khấu — dùng chung cho server (giữ chỗ) và trình duyệt (vẽ vũ công, gợi ý).
//  - Ô 0 → 9: sân khấu xanh ngoài sân. Mặt sàn y = 0.96 → tâm thân y ≈ 1.80. Khán giả ở phía +z → quay mặt yaw = 0.
//    Bố trí tránh: bàn DJ (x 0, z -29), loa (x ±5.6, z -28), bồn hoa mép trước (z -26.8), tượng Bác (x ≈ -5.2, phía sau trái).
//  - Ô 10 → 19: sân khấu trong nhà đa năng (x 56.5 → 71.5, z 39.65 → 45.15, mặt sàn y 1.2 → tâm thân y ≈ 2.04).
//    Khán giả ở phía -z → quay mặt yaw = π. Hàng sau tránh tượng Bác (x 69.5, z 43.6).
// Mỗi sân khấu 10 chỗ riêng; người chơi chỉ được xếp vào ô của sân khấu mình đang đứng.
export const STAGE_BODY_Y=1.8;
const HALL_BODY_Y=2.04;
export const STAGE_SLOTS=[
 // ngoài sân — hàng trước (6 người)
 [-4.5,STAGE_BODY_Y,-27.6],[-2.7,STAGE_BODY_Y,-27.6],[-0.9,STAGE_BODY_Y,-27.6],[0.9,STAGE_BODY_Y,-27.6],[2.7,STAGE_BODY_Y,-27.6],[4.5,STAGE_BODY_Y,-27.6],
 // ngoài sân — hàng sau (4 người, so le, chừa giữa cho bàn DJ)
 [-3.2,STAGE_BODY_Y,-30.2],[-1.6,STAGE_BODY_Y,-30.2],[1.6,STAGE_BODY_Y,-30.2],[3.2,STAGE_BODY_Y,-30.2],
 // nhà đa năng — hàng trước (6 người)
 ...[58.5,60.7,62.9,65.1,67.3,69.5].map(x=>[x,HALL_BODY_Y,41.0]),
 // nhà đa năng — hàng sau (4 người)
 ...[59.8,62.6,65.4,68.2].map(x=>[x,HALL_BODY_Y,42.7]),
];
export const STAGES=[
 {name:'sân khấu ngoài sân',from:0,to:10,yaw:0,
  inside:(x,y,z)=>Math.abs(x)<=8.4&&z<=-26.3&&z>=-33.6&&y>1.4&&y<3},
 {name:'sân khấu nhà đa năng',from:10,to:20,yaw:Math.PI,
  inside:(x,y,z)=>x>=56.4&&x<=71.6&&z>=39.5&&z<=45.3&&y>1.6&&y<3.4},
];
export const STAGE_CAPACITY=10;                       // số chỗ mỗi sân khấu
export const stageOf=slot=>STAGES.findIndex(s=>slot>=s.from&&slot<s.to);
export const slotYaw=slot=>STAGES[stageOf(slot)]?.yaw??0;
// Ô mà chính người chơi trên máy này đang đứng (để ẩn vũ công ô đó ngay, kể cả khi chơi offline)
export const localStage={slot:null};
// Đang đứng trên sân khấu nào? -1 nếu không đứng trên sân khấu
export const stageAt=(x,y,z)=>STAGES.findIndex(s=>s.inside(x,y,z));
export const onStage=(x,y,z)=>stageAt(x,y,z)>=0;
// Ô trống gần người chơi nhất trên sân khấu người đó đang đứng; -1 nếu đã đủ (hoặc không đứng trên sân khấu)
export function nearestFreeSlot(pos,taken){
 const st=STAGES[stageAt(...pos)];if(!st)return -1;
 let best=-1,bd=Infinity;
 for(let i=st.from;i<st.to;i++){if(taken.has(i))continue;const [x,,z]=STAGE_SLOTS[i],d=(x-pos[0])**2+(z-pos[2])**2;if(d<bd){bd=d;best=i;}}
 return best;
}

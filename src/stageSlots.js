// 10 vị trí múa trên sân khấu xanh — dùng chung cho server (giữ chỗ) và trình duyệt (vẽ ô trống, gợi ý).
// Mặt sàn sân khấu y = 0.96 → tâm thân nhân vật y ≈ 1.80. Khán giả ở phía +z, nên người múa quay mặt về +z (yaw = 0).
// Bố trí tránh: bàn DJ (x 0, z -29), loa (x ±5.6, z -28), bồn hoa mép trước (z -26.8), tượng Bác (x ≈ -5.2, phía sau trái).
export const STAGE_BODY_Y=1.8;
export const STAGE_SLOTS=[
 // hàng trước (6 người)
 [-4.5,STAGE_BODY_Y,-27.6],[-2.7,STAGE_BODY_Y,-27.6],[-0.9,STAGE_BODY_Y,-27.6],[0.9,STAGE_BODY_Y,-27.6],[2.7,STAGE_BODY_Y,-27.6],[4.5,STAGE_BODY_Y,-27.6],
 // hàng sau (4 người, so le, chừa giữa cho bàn DJ)
 [-3.2,STAGE_BODY_Y,-30.2],[-1.6,STAGE_BODY_Y,-30.2],[1.6,STAGE_BODY_Y,-30.2],[3.2,STAGE_BODY_Y,-30.2],
];
export const STAGE_CAPACITY=STAGE_SLOTS.length;
// Ô mà chính người chơi trên máy này đang đứng (để ẩn vũ công ô đó ngay, kể cả khi chơi offline)
export const localStage={slot:null};
// Đang đứng trên sân khấu? (mặt sàn cao ~1 m nên tâm thân > 1.4)
export const onStage=(x,y,z)=>Math.abs(x)<=8.4&&z<=-26.3&&z>=-33.6&&y>1.4&&y<3;
// Ô trống gần người chơi nhất; -1 nếu đã đủ
export function nearestFreeSlot(pos,taken){
 let best=-1,bd=Infinity;
 STAGE_SLOTS.forEach(([x,,z],i)=>{if(taken.has(i))return;const d=(x-pos[0])**2+(z-pos[2])**2;if(d<bd){bd=d;best=i;}});
 return best;
}

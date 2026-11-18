// Nén mô hình 3D cho web: models-src/an-duong-school.glb (Blender xuất, ~22 MB) → public/models/an-duong-school.glb.
// Meshopt (EXT_meshopt_compression) + lượng tử hoá toạ độ: nhỏ hơn nhiều lần, trình duyệt giải nén rất nhanh
// (bộ giải nén có sẵn trong drei/three-stdlib, không phải tải từ ngoài).
//   npm run model:compress        (chạy sau mỗi lần dựng lại mô hình bằng Blender)
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import {stat} from 'node:fs/promises';

const SRC='models-src/an-duong-school.glb',DST='public/models/an-duong-school.glb';
await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const t0=performance.now();
const doc=await io.read(SRC);
// QUAN TRỌNG: các khối gộp theo chất liệu (VD Campus_cream = toàn bộ tường) giữ phép phóng to của vật đầu tiên (×68…).
// Lượng tử hoá trong hệ đã phóng to làm toạ độ X lệch tới ~0,5 m (bịt cửa, hở tường). → nướng biến đổi vào đỉnh trước,
// rồi lượng tử hoá 16 bit theo khung bao thật của khuôn viên (sai số ~2 mm).
// Nướng tay: mỗi primitive được SAO CHÉP riêng POSITION / NORMAL rồi mới nhân ma trận — file Blender xuất có khi dùng chung
// dữ liệu toạ độ giữa các khối, sửa thẳng vào dữ liệu chung sẽ dời khối khác (từng làm mất tường cửa nhà vệ sinh).
// Bỏ qua khối dùng chung giữa nhiều nút (VD lá cau nhân bản) — chúng nhỏ, phép phóng to thấp nên không bị lỗi làm tròn.
for(const node of doc.getRoot().listNodes()){
 const mesh=node.getMesh();if(!mesh||mesh.listParents().filter(p=>p.propertyType==='Node').length!==1)continue;
 const M=node.getMatrix();if(M.every((v,i)=>Math.abs(v-(i%5===0?1:0))<1e-9))continue;
 // ma trận pháp tuyến = nghịch đảo chuyển vị của phần 3×3
 const a=[M[0],M[1],M[2],M[4],M[5],M[6],M[8],M[9],M[10]],det=a[0]*(a[4]*a[8]-a[5]*a[7])-a[3]*(a[1]*a[8]-a[2]*a[7])+a[6]*(a[1]*a[5]-a[2]*a[4]);
 const N=[(a[4]*a[8]-a[5]*a[7])/det,(a[5]*a[6]-a[3]*a[8])/det,(a[3]*a[7]-a[4]*a[6])/det,(a[2]*a[7]-a[1]*a[8])/det,(a[0]*a[8]-a[2]*a[6])/det,(a[1]*a[6]-a[0]*a[7])/det,(a[1]*a[5]-a[2]*a[4])/det,(a[2]*a[3]-a[0]*a[5])/det,(a[0]*a[4]-a[1]*a[3])/det];
 for(const prim of mesh.listPrimitives()){
  const pos=prim.getAttribute('POSITION')?.clone(),nor=prim.getAttribute('NORMAL')?.clone(),e=[0,0,0];
  if(pos){for(let i=0;i<pos.getCount();i++){pos.getElement(i,e);const [x,y,z]=e;pos.setElement(i,[M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14]]);}prim.setAttribute('POSITION',pos);}
  if(nor){for(let i=0;i<nor.getCount();i++){nor.getElement(i,e);const [x,y,z]=e;let nx=N[0]*x+N[1]*y+N[2]*z,ny=N[3]*x+N[4]*y+N[5]*z,nz=N[6]*x+N[7]*y+N[8]*z;const l=Math.hypot(nx,ny,nz)||1;nor.setElement(i,[nx/l,ny/l,nz/l]);}prim.setAttribute('NORMAL',nor);}
 }
 node.setTranslation([0,0,0]).setRotation([0,0,0,1]).setScale([1,1,1]);
}
await doc.transform(dedup(),prune(),weld(),meshopt({encoder:MeshoptEncoder,level:'medium',quantizePosition:16,quantizeNormal:10}));
await io.write(DST,doc);
const mb=async f=>((await stat(f)).size/1048576).toFixed(1);
console.log(`Đã nén ${SRC} (${await mb(SRC)} MB) → ${DST} (${await mb(DST)} MB) trong ${((performance.now()-t0)/1000).toFixed(1)} s`);

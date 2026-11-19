// Gộp các mảnh tĩnh cùng chất liệu thành 1 khối để giảm số lệnh vẽ (draw call) — hình ảnh giữ nguyên tuyệt đối:
// cùng hình dạng, vị trí, màu, độ bóng; chỉ là card đồ hoạ nhận 1 lệnh thay vì vài chục lệnh.
//
//  useMergeStatic(ref,'deep')  — cả cụm đứng yên (cột đèn, chậu hoa, nhà quán…): gộp mọi mảnh trong cụm theo chất liệu.
//  useMergeStatic(ref,'joint') — nhân vật có khớp cử động: chỉ gộp các mảnh là con TRỰC TIẾP của cùng một nút
//                                (thân, từng khớp tay/chân…), nên đi / ngồi / múa vẫn đúng.
// Mảnh khác màu nhưng cùng loại chất liệu (độ bóng, kim loại…) vẫn gộp được: màu được ghi vào từng đỉnh (vertex color) đúng giá trị cũ.
// Chất liệu dùng chung cho nhiều mảnh (VD bóng đèn sáng dần theo giờ) giữ nguyên đối tượng → hiệu ứng vẫn chạy.
// Mảnh có hoạt ảnh riêng (xoay, đổi vị trí bằng ref) → đặt userData={{noMerge:true}} để giữ nguyên.
// Nhóm có userData.dynamic (VD tà áo dài bay theo nhịp) không bị gộp lẫn vào nút cha trong chế độ 'deep'.
// Mảnh gốc được ẩn (không xoá) để React vẫn quản lý; khi deps đổi (VD đổi trang phục) thì gộp lại từ đầu.
import {useLayoutEffect} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const KEEP=new Set(['position','normal','uv']);
const inv=new THREE.Matrix4(),rel=new THREE.Matrix4();

// khoá gộp: mọi thông số chất liệu TRỪ màu (màu ghi vào đỉnh); vật liệu có ảnh dán / đã dùng màu đỉnh thì giữ cả màu trong khoá
function matKey(m,withColor){
 return [m.type,withColor?m.color?.getHexString?.():'',m.emissive?.getHexString?.(),m.emissiveIntensity,m.roughness,m.metalness,m.transparent,m.opacity,
  m.side,m.map?.uuid,m.flatShading,m.toneMapped,m.vertexColors,m.depthWrite,m.depthTest,m.blending,m.alphaTest,m.wireframe].join('|');
}
const mergeable=o=>o.isMesh&&!o.isInstancedMesh&&!o.isSkinnedMesh&&!o.userData.noMerge&&!o.userData.merged&&o.visible&&
 !Array.isArray(o.material)&&o.geometry?.attributes?.position&&!o.geometry.morphAttributes?.position;

function prepare(mesh,root,tint){
 const g=mesh.geometry,geo=g.index?g.toNonIndexed():g.clone();
 for(const k of Object.keys(geo.attributes))if(!KEEP.has(k))geo.deleteAttribute(k);
 if(tint){const c=mesh.material.color,n=geo.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=c.r;a[i*3+1]=c.g;a[i*3+2]=c.b;}geo.setAttribute('color',new THREE.BufferAttribute(a,3));}
 for(const k of Object.keys(geo.attributes)){const a=geo.attributes[k];if(a.normalized||!(a.array instanceof Float32Array)){geo.setAttribute(k,new THREE.BufferAttribute(Float32Array.from({length:a.count*a.itemSize},(_,i)=>a.getComponent?a.getComponent(Math.floor(i/a.itemSize),i%a.itemSize):a.array[i]),a.itemSize));}}
 if(!geo.attributes.normal)geo.computeVertexNormals();
 if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
 geo.morphAttributes={};geo.clearGroups();
 rel.multiplyMatrices(inv,mesh.matrixWorld);geo.applyMatrix4(rel);
 return geo;
}

function mergeInto(root,meshes,created){
 if(meshes.length<2)return;
 inv.copy(root.matrixWorld).invert();
 const uses=new Map();for(const m of meshes)uses.set(m.material,(uses.get(m.material)??0)+1);
 const buckets=new Map();
 for(const m of meshes){
  const mat=m.material,shared=uses.get(mat)>1,canTint=!shared&&mat.color&&!mat.map&&!mat.vertexColors;
  // chất liệu dùng chung → gộp theo đúng đối tượng (giữ hiệu ứng); chất liệu riêng → gộp theo thông số, màu ghi vào đỉnh
  const k=(shared?'obj:'+mat.uuid:canTint?'tint:'+matKey(mat,false):'mat:'+matKey(mat,true))+'|'+m.castShadow+'|'+m.receiveShadow;
  (buckets.get(k)??buckets.set(k,[]).get(k)).push(m);
 }
 for(const [k,list] of buckets){
  if(list.length<2)continue;
  const tint=k.startsWith('tint:');
  const geos=list.map(m=>prepare(m,root,tint)),merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());
  if(!merged)continue;
  merged.computeBoundingSphere();
  let material=list[0].material;
  if(tint){material=material.clone();material.vertexColors=true;material.color.setRGB(1,1,1);created.materials.push(material);}
  const mesh=new THREE.Mesh(merged,material);
  mesh.castShadow=list[0].castShadow;mesh.receiveShadow=list[0].receiveShadow;mesh.userData.merged=true;mesh.name='merged';
  root.add(mesh);created.push(mesh);
  for(const m of list){m.visible=false;m.userData.mergedAway=true;m.matrixAutoUpdate=false;m.matrixWorldAutoUpdate=false;created.hidden.push(m);}   // mảnh gốc đã gộp: ẩn, không tính lại ma trận mỗi khung (tiết kiệm CPU); Prewarm bỏ qua   // mergedAway: Prewarm bỏ qua mảnh gốc đã gộp
 }
}

export function mergeStatic(root,mode='deep'){
 const created=[];created.hidden=[];created.materials=[];
 root.updateWorldMatrix(true,true);
 if(mode==='deep'){
  const meshes=[];
  const walk=o=>{for(const c of o.children){if(!c.visible||c.userData.dynamic||c.userData.merged)continue;if(mergeable(c))meshes.push(c);if(c.children.length)walk(c);}};
  walk(root);mergeInto(root,meshes,created);
 }else{
  const nodes=[];root.traverse(o=>{if(!o.isMesh)nodes.push(o);});
  for(const n of nodes)mergeInto(n,n.children.filter(mergeable),created);
 }
 return ()=>{for(const m of created){m.parent?.remove(m);m.geometry.dispose();}for(const m of created.materials)m.dispose();for(const m of created.hidden){m.visible=true;m.userData.mergedAway=false;m.matrixAutoUpdate=true;m.matrixWorldAutoUpdate=true;}};
}

export function useMergeStatic(ref,mode='deep',deps=[]){
 useLayoutEffect(()=>{if(!ref.current)return;return mergeStatic(ref.current,mode);},deps); // eslint-disable-line react-hooks/exhaustive-deps
}

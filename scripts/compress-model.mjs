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
await doc.transform(dedup(),prune(),weld(),meshopt({encoder:MeshoptEncoder,level:'medium'}));
await io.write(DST,doc);
const mb=async f=>((await stat(f)).size/1048576).toFixed(1);
console.log(`Đã nén ${SRC} (${await mb(SRC)} MB) → ${DST} (${await mb(DST)} MB) trong ${((performance.now()-t0)/1000).toFixed(1)} s`);

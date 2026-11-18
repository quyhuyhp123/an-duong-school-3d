// Bắn tia trong file mô hình đã nén (public/models/an-duong-school.glb) — kiểm tra lỗ cửa / vật chắn mà không cần trình duyệt.
//   node scripts/raycast-glb.mjs "x,y,z" "dx,dy,dz"  (toạ độ three.js; có thể truyền nhiều cặp)
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(process.env.GLB??'public/models/an-duong-school.glb');
const tris=[];
for(const node of doc.getRoot().listNodes()){
 const mesh=node.getMesh();if(!mesh)continue;const m=node.getWorldMatrix();
 for(const prim of mesh.listPrimitives()){
  const pos=prim.getAttribute('POSITION'),idx=prim.getIndices(),mat=prim.getMaterial()?.getName()??'-';
  const n=idx?idx.getCount():pos.getCount(),el=[0,0,0];
  const P=i=>{pos.getElement(i,el);const [x,y,z]=el;return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];};
  for(let t=0;t<n;t+=3){const a=idx?idx.getScalar(t):t,b=idx?idx.getScalar(t+1):t+1,c=idx?idx.getScalar(t+2):t+2;tris.push([P(a),P(b),P(c),mat,node.getName()]);}
 }
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function cast(o,d){let best=null;for(const [a,b,c,mat,name] of tris){const e1=sub(b,a),e2=sub(c,a),p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-9)continue;const inv=1/det,s=sub(o,a),u=dot(s,p)*inv;if(u<0||u>1)continue;const q=cross(s,e1),v=dot(d,q)*inv;if(v<0||u+v>1)continue;const t=dot(e2,q)*inv;if(t>1e-4&&(!best||t<best.t))best={t,mat,name};}return best;}
const args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){const o=args[i].split(',').map(Number),d0=args[i+1].split(',').map(Number),l=Math.hypot(...d0),d=d0.map(x=>x/l);const h=cast(o,d);
 console.log(`${args[i]} → ${h?`chạm "${h.name}" (${h.mat}) cách ${h.t.toFixed(2)} m tại (${o.map((x,k)=>(x+d[k]*h.t).toFixed(2)).join(', ')})`:'không chạm'}`);}

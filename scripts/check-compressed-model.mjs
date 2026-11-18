// So sánh hình học mô hình đã nén với bản thô Blender: bắn cùng một loạt tia vào cả hai, sai lệch khoảng cách phải ~vài mm.
// Chạy sau `npm run model:compress` để chắc bước nén không làm lệch tường / bịt cửa.
//   node scripts/check-compressed-model.mjs [số tia]
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
async function load(file){
 const doc=await io.read(file),tris=[];
 for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;const m=node.getWorldMatrix();
  for(const prim of mesh.listPrimitives()){const pos=prim.getAttribute('POSITION'),idx=prim.getIndices(),el=[0,0,0];
   const n=idx?idx.getCount():pos.getCount(),P=i=>{pos.getElement(i,el);const [x,y,z]=el;return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];};
   const tag=node.getName()+' ('+(prim.getMaterial()?.getName()??'-')+')';
   for(let t=0;t<n;t+=3){const tr=[P(idx?idx.getScalar(t):t),P(idx?idx.getScalar(t+1):t+1),P(idx?idx.getScalar(t+2):t+2)];tr.tag=tag;tris.push(tr);}}}
 return tris;
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function cast(tris,o,d){let best=Infinity;cast.tag='-';for(const tr of tris){const [a,b,c]=tr;const e1=sub(b,a),e2=sub(c,a),p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-12)continue;const inv=1/det,s=sub(o,a),u=dot(s,p)*inv;if(u<0||u>1)continue;const q=cross(s,e1),v=dot(d,q)*inv;if(v<0||u+v>1)continue;const t=dot(e2,q)*inv;if(t>1e-4&&t<best){best=t;cast.tag=tr.tag;}}return best;}
const raw=await load('models-src/an-duong-school.glb'),opt=await load('public/models/an-duong-school.glb');
let seed=5;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const N=Number(process.argv[2]??300);let worst=0,bad=0,where='';
const rays=[[[33.5,1.4,36],[0,0,1]],[[33.0,.8,36],[0,0,1]]];   // cửa phòng photo
for(let i=0;i<N;i++){const a=rnd()*Math.PI*2,o=[-45+rnd()*115,.4+rnd()*9,-50+rnd()*100],d=[Math.cos(a),(rnd()-.6)*.6,Math.sin(a)],l=Math.hypot(...d);rays.push([o,d.map(x=>x/l)]);}
const lost=new Map();
for(const [o,d] of rays){const a=cast(raw,o,d),ta=cast.tag,b=cast(opt,o,d),tb=cast.tag;if(Math.abs(a-b)>.02)lost.set(ta+' → '+tb,(lost.get(ta+' → '+tb)??0)+1);const e=(a===Infinity&&b===Infinity)?0:Math.abs(a-b);if(e>worst){worst=e;where=`${o.map(v=>v.toFixed(1))} → thô ${a.toFixed(3)} / nén ${b.toFixed(3)}`;}if(e>.02)bad++;}
console.log(`${rays.length} tia · sai lệch lớn nhất ${(worst*1000).toFixed(1)} mm · số tia lệch > 2 cm: ${bad}${worst>.02?'\n  tệ nhất: '+where:''}`);
for(const [k,v] of lost)console.log('  lệch:',v,'tia ·',k);
process.exit(bad?1:0);

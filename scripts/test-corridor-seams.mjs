import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;await RAPIER.init();
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read('public/models/an-duong-school.glb');
const meshes=[],material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
for(const node of doc.getRoot().listNodes())for(const prim of node.getMesh()?.listPrimitives()??[]){
 if(prim.getMaterial()?.getName()!=='trim')continue;
 const src=prim.getAttribute('POSITION'),a=new Float32Array(src.getCount()*3),p=[0,0,0];for(let i=0;i<src.getCount();i++){src.getElement(i,p);a.set(p,i*3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a,3));const idx=prim.getIndices();if(idx)g.setIndex(Array.from(idx.getArray()));
 const mesh=new THREE.Mesh(g,material);mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()));mesh.updateMatrixWorld(true);meshes.push(mesh);
}
assert(meshes.length,'floor meshes exist in compressed model');
const world=new RAPIER.World({x:0,y:-16,z:0}),data=JSON.parse(readFileSync('public/models/campus-data.json','utf8'));
for(const c of data.colliders){if(!/room slab|stair corridor|stair front landing|curved stair floor segment/.test(c.name))continue;const[x,y,z]=c.position,[qx,qy,qz,qw]=c.quaternion;world.createCollider(RAPIER.ColliderDesc.cuboid(...c.halfExtents).setTranslation(x,y,z).setRotation({x:qx,y:qy,z:qz,w:qw}));}world.step();
const down=new THREE.Vector3(0,-1,0),ray=new THREE.Raycaster();
function visual([x,y,z]){ray.set(new THREE.Vector3(x,y+.05,z),down);ray.near=0;ray.far=.2;return ray.intersectObjects(meshes,false)[0]?.point.y;}
function physical([x,y,z]){const h=world.castRay(new RAPIER.Ray({x,y:y+.05,z},{x:0,y:-1,z:0}),.2,true);return h?y+.05-h.timeOfImpact:null;}
const wings=[{name:'A right',cx:0,cy:40,angle:0,sx:21,floors:3,base:0,main:true},{name:'A left',cx:0,cy:40,angle:0,sx:-21,floors:3,base:0,main:true},{name:'B',cx:-36,cy:19,angle:Math.PI/2,sx:0,floors:3,base:0},{name:'C',cx:36,cy:13,angle:-Math.PI/2,sx:0,floors:3,base:0},{name:'D',cx:-23,cy:-41,angle:Math.PI,sx:0,floors:2,base:.6}];
let checks=0,maxVisualStep=0,maxPhysicalStep=0;
for(const b of wings)for(let floor=0;floor<b.floors;floor++){
 const top=b.base+floor*3.6+.1,toWorld=(u,v)=>[b.cx+u*Math.cos(b.angle)-v*Math.sin(b.angle),top,-(b.cy+u*Math.sin(b.angle)+v*Math.cos(b.angle))];
 const ref=toWorld(b.sx+4.5,-3),vy=visual(ref),py=physical(ref);assert(vy!=null&&py!=null,`reference floor ${b.name}/${floor}`);
 const points=[];
 for(const dx of [-3,-1.65,0,1.65,3])for(const v of [-2.8,-2.7,-2.65,-2.55,-2.45,-2.3])points.push(toWorld(b.sx+dx,v));
 if(b.main)for(const dx of [-3.5,-2,-.5,0,.5,2,3.5])for(const inset of [.12,.3,.6,.85])points.push(toWorld(b.sx+dx,-6.15-.9*Math.max(0,1-(dx/5)**2)+inset));
 for(const p of points){const v=visual(p),c=physical(p);assert(v!=null&&c!=null,`missing floor ${b.name}/${floor} at ${p}`);const dv=Math.abs(v-vy),dc=Math.abs(c-py);assert(dv<.003,`visible floor must be flush ${dv}`);assert(dc<.0001,`collision floor must be flush ${dc}`);maxVisualStep=Math.max(maxVisualStep,dv);maxPhysicalStep=Math.max(maxPhysicalStep,dc);checks++;}
 console.log(`PASS ${b.name} level ${floor+1}: former seam and curved edge are closed and flush`);
}
world.free();for(const m of meshes)m.geometry.dispose();material.dispose();
console.log(JSON.stringify({samples:checks,maxVisibleStepMm:maxVisualStep*1000,maxCollisionStepMm:maxPhysicalStep*1000}));

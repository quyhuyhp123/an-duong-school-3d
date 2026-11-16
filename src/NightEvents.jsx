import React,{useMemo,useRef,useEffect} from 'react';
import {useFrame} from '@react-three/fiber';
import {RigidBody,CylinderCollider,CuboidCollider} from '@react-three/rapier';
import * as THREE from 'three';
import {CAMPFIRE_POS,DJ_FLOOR,DJ_ZONE} from './live';
import {beatNow,pulseNow,levelNow} from './eventAudio';

// ---------- Lửa trại ----------
const LOG_RADIUS=3.3,LOG_COUNT=7;
// Chỗ ngồi quanh lửa — cùng định dạng với data.seats để Player dùng được phím F
export const CAMPFIRE_SEATS=Array.from({length:LOG_COUNT},(_,i)=>{
 const a=i/LOG_COUNT*Math.PI*2+.3,[cx,,cz]=CAMPFIRE_POS,x=cx+Math.sin(a)*LOG_RADIUS,z=cz+Math.cos(a)*LOG_RADIUS;
 return {id:'campfire-'+i,label:'bên lửa trại',position:[x,.89,z],yaw:Math.atan2(cx-x,cz-z),exit:[cx+Math.sin(a)*(LOG_RADIUS+1.1),.98,cz+Math.cos(a)*(LOG_RADIUS+1.1)],angle:a};
});

const flameMat=c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false});
function Campfire(){
 const [cx,,cz]=CAMPFIRE_POS,flames=useRef([]),light=useRef(),sparks=useRef();
 const mats=useMemo(()=>[flameMat('#ff5a1f'),flameMat('#ff9a2e'),flameMat('#ffd25a')],[]);
 const sparkData=useMemo(()=>{const n=70,pos=new Float32Array(n*3),speed=new Float32Array(n);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*.8;pos[i*3+1]=Math.random()*3;pos[i*3+2]=(Math.random()-.5)*.8;speed[i]=.6+Math.random()*1.2;}return {pos,speed,n};},[]);
 useEffect(()=>()=>mats.forEach(m=>m.dispose()),[mats]);
 useFrame((state,dt)=>{
  const t=state.clock.elapsedTime;
  flames.current.forEach((f,i)=>{if(!f)return;const k=i*1.7;f.scale.set(1+.12*Math.sin(t*9+k),1+.25*Math.sin(t*7.3+k)+.1*Math.sin(t*17+k),1+.12*Math.cos(t*8+k));f.rotation.y=t*.6+k;});
  if(light.current)light.current.intensity=26+5*Math.sin(t*11)+3*Math.sin(t*23.7);
  const p=sparks.current?.geometry.attributes.position;
  if(p){for(let i=0;i<sparkData.n;i++){let y=p.array[i*3+1]+sparkData.speed[i]*dt;if(y>3.2){y=.4;p.array[i*3]=(Math.random()-.5)*.6;p.array[i*3+2]=(Math.random()-.5)*.6;}p.array[i*3+1]=y;p.array[i*3]+=Math.sin(t*2+i)*dt*.15;}p.needsUpdate=true;}
 });
 return <group>
  <group position={[cx,0,cz]}>
   {/* vòng đá */}
   {Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return <mesh key={i} castShadow position={[Math.sin(a)*1.05,.12,Math.cos(a)*1.05]} rotation={[i,i*2,0]}><dodecahedronGeometry args={[.22,0]}/><meshStandardMaterial color="#6f6a64" roughness={1}/></mesh>})}
   {/* than hồng */}
   <mesh position={[0,.05,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.85,24]}/><meshStandardMaterial color="#2a1408" emissive="#ff4a10" emissiveIntensity={.9}/></mesh>
   {/* củi dựng hình chóp */}
   {Array.from({length:5},(_,i)=>{const a=i/5*Math.PI*2;return <mesh key={i} castShadow position={[Math.sin(a)*.35,.42,Math.cos(a)*.35]} rotation={[Math.cos(a)*.5,0,-Math.sin(a)*.5]}><cylinderGeometry args={[.07,.09,1.1,7]}/><meshStandardMaterial color="#5b3a22" roughness={1}/></mesh>})}
   {/* ngọn lửa */}
   {[[.55,1.5,0,mats[0]],[.42,1.25,.25,mats[1]],[.4,1.1,-.25,mats[1]],[.28,.9,0,mats[2]]].map(([r,h,off,m],i)=><mesh key={i} ref={el=>flames.current[i]=el} position={[off*.6,h/2+.12,off*.4]} material={m}><coneGeometry args={[r,h,10,1,true]}/></mesh>)}
   <pointLight ref={light} position={[0,1.4,0]} color="#ff8a3d" intensity={26} distance={24} decay={1.7}/>
   <points ref={sparks}><bufferGeometry><bufferAttribute attach="attributes-position" args={[sparkData.pos,3]}/></bufferGeometry><pointsMaterial color="#ffb347" size={.07} transparent opacity={.9} blending={THREE.AdditiveBlending} depthWrite={false}/></points>
  </group>
  {/* khúc gỗ để ngồi */}
  {CAMPFIRE_SEATS.map(s=><group key={s.id} position={[s.position[0],0,s.position[2]]} rotation={[0,s.angle,0]}>
   <mesh castShadow receiveShadow position={[0,.2,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.21,.23,1.5,10]}/><meshStandardMaterial color="#7a5434" roughness={.95}/></mesh>
   {[-1,1].map(e=><mesh key={e} position={[e*.755,.2,0]} rotation={[0,0,Math.PI/2]}><circleGeometry args={[.21,10]}/><meshStandardMaterial color="#c49a6c" side={THREE.DoubleSide}/></mesh>)}
  </group>)}
  {/* không cho đi xuyên qua đống lửa */}
  <RigidBody type="fixed" colliders={false}><CylinderCollider args={[.6,1.15]} position={[cx,.6,cz]}/></RigidBody>
 </group>;
}

// ---------- Đêm nhạc DJ (trên sân khấu xanh) ----------
const STAGE_Y=.96,BOOTH_Z=-29,PALETTE=['#ff2e88','#20d5ff','#9b5cff','#ffd400','#2bff88'];
function beamMaterial(color){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color(color)},strength:{value:1}},
 vertexShader:'varying float vY;void main(){vY=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 color;uniform float strength;varying float vY;void main(){gl_FragColor=vec4(color*strength,pow(vY,1.6)*.32*strength);}'});}

function MovingHead({x,color,phase}){
 const head=useRef(),spot=useRef(),target=useMemo(()=>new THREE.Object3D(),[]),mat=useMemo(()=>beamMaterial(color),[color]);
 useEffect(()=>()=>mat.dispose(),[mat]);
 useFrame(state=>{
  // đèn sáng theo cú bass vừa đánh × độ to của đoạn nhạc (drop rực, đoạn êm dịu)
  const t=state.clock.elapsedTime,lv=levelNow(),pulse=pulseNow(1)*lv;
  head.current.rotation.set(-.55+.35*Math.sin(t*.9+phase),.7*Math.sin(t*.6+phase*2),0);
  mat.uniforms.strength.value=.3+.25*lv+.45*pulse;
  // đèn spot chiếu theo hướng chùm sáng (target cùng cha với đầu đèn nên dùng ma trận cục bộ)
  head.current.updateMatrix();target.position.set(0,-14,0).applyMatrix4(head.current.matrix);target.updateMatrixWorld();
  if(spot.current)spot.current.intensity=60+60*pulse;
 });
 return <group position={[x,6.3,-27]}>
  <mesh><boxGeometry args={[.35,.3,.35]}/><meshStandardMaterial color="#1b1b22"/></mesh>
  <group ref={head}>
   <mesh position={[0,-.2,0]}><cylinderGeometry args={[.16,.2,.35,12]}/><meshStandardMaterial color="#222" emissive={color} emissiveIntensity={.6}/></mesh>
   {/* chùm sáng nhìn thấy được */}
   <mesh position={[0,-7.2,0]} material={mat}><cylinderGeometry args={[.12,1.8,14,20,1,true]}/></mesh>
  </group>
  <primitive object={target}/>
  <spotLight ref={spot} color={color} angle={.22} penumbra={.6} distance={30} decay={1.5} intensity={80} target={target}/>
 </group>;
}

// Sàn nhảy 9 × 9 ô (≈ 11 × 11 m), mỗi ô đổi màu theo nhịp — vẽ bằng 1 InstancedMesh (1 lệnh vẽ)
function DanceFloor(){
 const cols=9,rows=9,size=1.25,ref=useRef();
 const c=useMemo(()=>new THREE.Color(),[]),palette=useMemo(()=>PALETTE.map(x=>new THREE.Color(x)),[]);
 useEffect(()=>{const d=new THREE.Object3D();for(let i=0;i<cols*rows;i++){d.position.set((i%cols-(cols-1)/2)*size,0,(Math.floor(i/cols)-(rows-1)/2)*size);d.rotation.set(-Math.PI/2,0,0);d.updateMatrix();ref.current.setMatrixAt(i,d.matrix);ref.current.setColorAt(i,c.set('#111'));}ref.current.instanceMatrix.needsUpdate=true;},[c]);
 useFrame(()=>{
  const b=beatNow(),beat=Math.floor(b),bar=Math.floor(b/4),lv=levelNow(),pulse=pulseNow(2)*lv,m=ref.current;
  const cx=(cols-1)/2,cz=(rows-1)/2,pattern=bar%3;
  for(let i=0;i<cols*rows;i++){
   const x=i%cols,z=Math.floor(i/cols),ring=Math.max(Math.abs(x-cx),Math.abs(z-cz));
   // 3 kiểu hoa văn đổi mỗi ô nhịp: bàn cờ, vòng lan toả từ tâm, sọc chạy
   const lit=pattern===0?(x+z+beat)%2===0:pattern===1?(ring===beat%5):((x+beat)%3===0);
   const k=(pattern===1?ring:x+z+bar)%palette.length;
   c.copy(palette[k]).multiplyScalar(lit?.2+.25*lv+1.1*pulse:.06+.08*lv);m.setColorAt(i,c);
  }
  m.instanceColor.needsUpdate=true;
 });
 return <group position={[DJ_FLOOR[0],.025,DJ_FLOOR[2]]}>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,0]} receiveShadow><planeGeometry args={[cols*size+.3,rows*size+.3]}/><meshStandardMaterial color="#0d0d12" roughness={.4}/></mesh>
  <instancedMesh ref={ref} args={[undefined,undefined,cols*rows]}><planeGeometry args={[size*.92,size*.92]}/><meshBasicMaterial toneMapped={false}/></instancedMesh>
 </group>;
}

// Viền phát sáng đánh dấu vùng tham gia nhạc hội (bước vào là hiện "F · Tham gia nhạc hội")
function ZoneOutline(){
 const mat=useRef();
 const geo=useMemo(()=>{const {minX,maxX,minZ,maxZ}=DJ_ZONE;const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(minX,0,minZ),new THREE.Vector3(maxX,0,minZ),new THREE.Vector3(maxX,0,maxZ),new THREE.Vector3(minX,0,maxZ),new THREE.Vector3(minX,0,minZ)]);return g;},[]);
 useEffect(()=>()=>geo.dispose(),[geo]);
 useFrame(()=>{if(mat.current)mat.current.opacity=.4+.45*pulseNow(2);});
 return <line position={[0,.04,0]} geometry={geo}><lineBasicMaterial ref={mat} color="#ffd400" transparent toneMapped={false}/></line>;
}

function Speaker({x}){
 const woofer=useRef();
 useFrame(()=>{const p=pulseNow(4)*levelNow();woofer.current.scale.setScalar(1+.14*p);}); // màng loa rung theo bass
 return <group position={[x,STAGE_Y,-28]}>
  <mesh castShadow position={[0,1.1,0]}><boxGeometry args={[1.1,2.2,.9]}/><meshStandardMaterial color="#141418" roughness={.6}/></mesh>
  <mesh ref={woofer} position={[0,.75,.46]}><circleGeometry args={[.38,24]}/><meshStandardMaterial color="#2a2a30" emissive="#20d5ff" emissiveIntensity={.25}/></mesh>
  <mesh position={[0,1.65,.46]}><circleGeometry args={[.18,20]}/><meshStandardMaterial color="#2a2a30"/></mesh>
 </group>;
}

function DJBooth(){
 const discs=useRef([]),led=useRef(),dj=useRef();
 useFrame((state,dt)=>{
  const b=beatNow(),pulse=pulseNow(1)*levelNow();
  discs.current.forEach(d=>d&&(d.rotation.y+=dt*3.5));
  if(led.current)led.current.emissive.set(PALETTE[Math.floor(b)%PALETTE.length]),led.current.emissiveIntensity=.6+1.2*pulse;
  if(dj.current){dj.current.position.y=Math.abs(Math.sin(b*Math.PI))*.08;dj.current.rotation.z=Math.sin(b*Math.PI/2)*.06;}
 });
 return <group position={[0,STAGE_Y,BOOTH_Z]}>
  <mesh castShadow position={[0,.55,0]}><boxGeometry args={[3.2,1.1,1]}/><meshStandardMaterial color="#121216"/></mesh>
  <mesh position={[0,.55,.505]}><planeGeometry args={[3,.8]}/><meshStandardMaterial ref={led} color="#000" emissive="#ff2e88"/></mesh>
  {[-.9,.9].map((x,i)=><group key={x} position={[x,1.12,0]}><mesh><boxGeometry args={[.9,.06,.7]}/><meshStandardMaterial color="#2b2b33"/></mesh><mesh ref={el=>discs.current[i]=el} position={[0,.05,0]}><cylinderGeometry args={[.3,.3,.02,24]}/><meshStandardMaterial color="#0c0c0c" emissive="#333"/></mesh></group>)}
  <mesh position={[0,1.14,0]}><boxGeometry args={[.6,.08,.55]}/><meshStandardMaterial color="#3a3a44" emissive="#20d5ff" emissiveIntensity={.3}/></mesh>
  {/* DJ */}
  <group ref={dj} position={[0,0,-.75]}>
   <mesh castShadow position={[0,1.15,0]}><capsuleGeometry args={[.25,.36,6,12]}/><meshStandardMaterial color="#1d1d24"/></mesh>
   <mesh castShadow position={[0,1.67,0]}><sphereGeometry args={[.225,18,14]}/><meshStandardMaterial color="#dcad88"/></mesh>
   <mesh position={[0,1.72,0]} rotation={[0,0,Math.PI/2]}><torusGeometry args={[.25,.035,8,20,Math.PI]}/><meshStandardMaterial color="#ff2e88"/></mesh>
   {[-1,1].map(s=><mesh key={s} position={[s*.24,1.66,0]}><sphereGeometry args={[.08,10,8]}/><meshStandardMaterial color="#111"/></mesh>)}
   {[-.14,.14].map(x=><mesh key={x} position={[x,.4,0]}><capsuleGeometry args={[.1,.5,5,8]}/><meshStandardMaterial color="#2c4059"/></mesh>)}
  </group>
  <RigidBody type="fixed" colliders={false}><CuboidCollider args={[1.6,.55,.5]} position={[0,.55,0]}/></RigidBody>
 </group>;
}

function DJParty(){
 return <group>
  <DJBooth/>
  <Speaker x={-5.6}/><Speaker x={5.6}/>
  {[-6,-2,2,6].map((x,i)=><MovingHead key={x} x={x} color={PALETTE[i]} phase={i*1.3}/>)}
  <DanceFloor/>
  <ZoneOutline/>
  <pointLight position={[DJ_FLOOR[0],3,DJ_FLOOR[2]]} color="#9b5cff" intensity={20} distance={20} decay={1.6}/>
 </group>;
}

export function NightEvents({event}){
 if(event==='campfire')return <Campfire/>;
 if(event==='dj')return <DJParty/>;
 return null;
}

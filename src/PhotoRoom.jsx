import React from 'react';
import {RigidBody,CuboidCollider} from '@react-three/rapier';
import {AvatarBody} from './Avatar';
import {useNearVisible} from './useNearVisible';
import {useLightSources} from './lightPool';
const PHOTO_LIGHT=[{p:[33.5,2.7,44],color:'#fff3dc',power:()=>22,distance:8,decay:1.5}];   // đèn trần phòng photo (bể đèn chung)
const Box=({p,s,c='#e4e8e9',...props})=><mesh position={p} castShadow receiveShadow {...props}><boxGeometry args={s}/><meshStandardMaterial color={c} roughness={.65}/></mesh>;
export function PhotoRoom(){
 const visible=useNearVisible([33.5,0,44],35);useLightSources(PHOTO_LIGHT);
 return <><group ref={visible}>
  {/* Full-size copier against the rear wall, front facing the doorway. */}
  <group position={[32,.26,45.9]}>
   <Box p={[0,.53,0]} s={[1.3,1.06,.94]}/>
   <Box p={[0,1.12,0]} s={[1.38,.14,1.02]} c="#303b44"/>
   <Box p={[0,1.22,.12]} s={[1.2,.09,.7]} c="#cddce0"/>
   <Box p={[.17,1.3,.23]} s={[.85,.08,.48]} c="#f2f4f1"/>
   <Box p={[-.43,1.2,-.4]} s={[.38,.11,.24]} c="#35434e" rotation={[.2,0,0]}/>
   <Box p={[-.43,1.265,-.43]} s={[.25,.02,.14]} c="#5bbadd"/>
   {[.23,.5,.77].map(y=><group key={y}><Box p={[0,y,-.478]} s={[1.16,.2,.025]} c="#c2cbd0"/><Box p={[0,y+.06,-.5]} s={[.3,.035,.025]} c="#384550"/></group>)}
   <Box p={[.38,.98,-.51]} s={[.5,.06,.25]} c="#303b44"/>
   <Box p={[.38,1.025,-.51]} s={[.42,.025,.23]} c="#ffffff"/>
  </group>
  {/* Desk against the right wall; screen faces into the room (-x). */}
  <group position={[35.95,.26,43.4]} rotation={[0,Math.PI/2,0]}>
   <Box p={[0,.76,0]} s={[1.85,.1,.85]} c="#c6a579"/>
   {[-.78,.78].map(x=><Box key={x} p={[x,.36,.24]} s={[.1,.72,.5]} c="#687884"/>)}
  </group>
  <group position={[35.75,1.08,43.4]} rotation={[0,Math.PI/2,0]}>
   <Box p={[0,.035,0]} s={[.9,.05,.45]} c="#252e36"/>
   <Box p={[0,.23,.12]} s={[.08,.4,.08]} c="#35434e"/>
   <Box p={[0,.51,.12]} s={[.95,.58,.07]} c="#242f3b"/>
   <mesh position={[0,.51,.078]}><planeGeometry args={[.84,.46]}/><meshStandardMaterial color="#7ac5e1" emissive="#4788ad" emissiveIntensity={.5} side={2}/></mesh>
   <Box p={[0,.078,-.19]} s={[.67,.045,.2]} c="#aab5bb"/>
   <Box p={[.46,.08,-.2]} s={[.1,.045,.14]} c="#303b44"/>
   <Box p={[.92,.3,.07]} s={[.3,.6,.5]} c="#3b4651"/>
   <Box p={[-.85,.08,.03]} s={[.35,.15,.45]} c="#ffffff"/>
  </group>
  {/* Turn the original brown counter into a low document cupboard. */}
  <group position={[34.6,.26,42.6]}>
   {[-.57,.57].map(x=><group key={x}><Box p={[x,.47,.365]} s={[1.08,.91,.045]} c="#d7dfe0"/><Box p={[x+.37,.5,.4]} s={[.04,.23,.045]} c="#43535c"/></group>)}
   <Box p={[0,.94,.36]} s={[2.3,.04,.055]} c="#75838c"/>
  </group>
  {/* Tall filing cabinets cover the old solid shelf, doors face the central aisle. */}
  <group position={[35.95,.26,45.4]} rotation={[0,Math.PI/2,0]}>
   <Box p={[0,.98,0]} s={[2,1.96,.72]} c="#dce1dc"/>
   {[-.51,.51].map(x=><group key={x}>
    <Box p={[x,1,-.38]} s={[.93,1.83,.05]} c="#afbfc3"/>
    <Box p={[x+.27,1,-.425]} s={[.045,.28,.04]} c="#344650"/>
    <Box p={[x,1.65,-.42]} s={[.4,.12,.025]} c="#fff7db"/>
    {[1.35,1.43,1.51].map(y=><Box key={y} p={[x,y,-.42]} s={[.38,.018,.02]} c="#52636c"/>)}
   </group>)}
  </group>
  {/* Second compact laser printer on the document cupboard. */}
  <group position={[34.5,1.21,42.6]}>
   <Box p={[0,.18,0]} s={[.68,.36,.5]} c="#e6ebed"/>
   <Box p={[0,.38,0]} s={[.71,.05,.52]} c="#35434e"/>
   <Box p={[0,.28,.265]} s={[.46,.065,.09]} c="#27333c"/>
   <Box p={[0,.24,.37]} s={[.46,.035,.26]} c="#ffffff"/>
   <Box p={[.22,.42,-.08]} s={[.13,.02,.1]} c="#76c4e5"/>
   <Box p={[0,.45,-.15]} s={[.42,.08,.25]} c="#ffffff"/>
  </group>
  <group position={[33.35,.26,45.6]} rotation={[0,-.5,0]}><AvatarBody look={1}/></group>
  <Box p={[33.5,3.18,44]} s={[1.2,.08,.3]} c="#fff6d4"/>
 </group><RigidBody type="fixed" colliders={false}><CuboidCollider position={[32,.79,45.9]} args={[.65,.53,.47]}/><CuboidCollider position={[33.35,1.1,45.6]} args={[.3,.84,.28]}/><CuboidCollider position={[35.95,.64,43.4]} args={[.425,.38,.925]}/></RigidBody></>;
}

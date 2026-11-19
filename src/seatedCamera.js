export function seatedCamera(yaw,pitch,distance,clearance){
 const d=Math.max(3.4,distance),p=Math.max(.22,pitch);
 const preferred={yaw,pitch:p,distance:Math.min(d,clearance(yaw,p,d))};
 if(preferred.distance>=3.2)return preferred;
 let best=preferred;
 for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]){
  for(const lift of [.08,p,Math.max(.55,p)]){
   const candidate={yaw:yaw+turn,pitch:lift,distance:Math.min(d,clearance(yaw+turn,lift,d))};
   if(candidate.distance>=3.2)return candidate;
   if(candidate.distance>best.distance)best=candidate;
  }
 }
 return best;
}

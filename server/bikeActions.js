export function bikeActions({players,send,setPos}){
 const requests=new Map();
 const broadcast=m=>{for(const q of players.values())send(q,m);};
 const sync=p=>send(p,{type:'bike-links',links:[...players.values()].filter(q=>q.bikeDriver).map(q=>[q.id,q.bikeDriver])});
 const isRider=p=>p&&((p.mode>>3)&7)===7;
 function detach(p){if(!p)return;const d=players.get(p.bikeDriver);if(d)d.bikePassenger=null;p.bikeDriver=null;broadcast({type:'bike-link',passenger:p.id,driver:null});send(p,{type:'bike-exit'});}
 function handle(p,m){
  if(m.type==='leave'&&p.bikeDriver)detach(p);
  if(m.type==='bike-bell'){if(isRider(p)&&Date.now()-(p.bellAt??0)>700){p.bellAt=Date.now();for(const q of players.values())if(q.id!==p.id&&Math.hypot(q.position[0]-p.position[0],q.position[2]-p.position[2])<25)send(q,{type:'bike-bell'});}return true;}
  if(m.type==='bike-join'){const d=players.get(Number(m.driver));if(d&&d.id!==p.id&&isRider(d)&&!d.bikePassenger&&!p.bikeDriver&&!p.seat&&p.stageSlot==null&&!isRider(p)&&Math.hypot(p.position[0]-d.position[0],p.position[2]-d.position[2])<3){requests.set(p.id,{driver:d.id,expires:Date.now()+15000});send(d,{type:'bike-request',passenger:p.id});}return true;}
  if(m.type==='bike-answer'){const id=Number(m.passenger),r=requests.get(id),q=players.get(id);if(r?.driver===p.id){requests.delete(id);if(m.accept&&r.expires>Date.now()&&q&&isRider(p)&&!p.bikePassenger&&!q.bikeDriver&&!q.seat&&q.stageSlot==null&&Math.hypot(q.position[0]-p.position[0],q.position[2]-p.position[2])<3){p.bikePassenger=q.id;q.bikeDriver=p.id;broadcast({type:'bike-link',passenger:q.id,driver:p.id});send(q,{type:'bike-mounted',driver:p.id});}else send(q,{type:'notice',message:'Không thể lên xe hoặc lời mời đã bị từ chối.'});}return true;}
  if(m.type==='bike-dismount'){detach(p);return true;}
  return false;
 }
 const timer=setInterval(()=>{for(const [id,r] of requests)if(r.expires<Date.now())requests.delete(id);for(const p of players.values()){if(p.bikePassenger&&!players.has(p.bikePassenger))p.bikePassenger=null;if(!p.bikeDriver)continue;const d=players.get(p.bikeDriver);if(!isRider(d)){detach(p);continue;}const pos=[d.position[0]-Math.sin(d.yaw)*.65,d.position[1]-.05,d.position[2]-Math.cos(d.yaw)*.65];setPos(p,...pos,d.yaw,1);send(p,{type:'bike-follow',position:pos,yaw:d.yaw});}},80);timer.unref();
 return {handle,sync,close(){clearInterval(timer)}};
}

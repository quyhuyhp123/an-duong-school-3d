import {WebSocketServer} from 'ws';
import {randomUUID} from 'node:crypto';
export function attachMultiplayer(server){
 const wss=new WebSocketServer({noServer:true,maxPayload:4096}),players=new Map(),invites=new Map();
 const send=(p,m)=>{if(p?.socket.readyState===1)p.socket.send(JSON.stringify(m))};
 const broadcast=()=>{const list=[...players.values()].map(({socket,...p})=>p);for(const p of players.values())send(p,{type:'state',players:list})};
 function end(p){if(!p)return;const partner=players.get(p.partner);p.partner=null;p.action=null;if(partner){partner.partner=null;partner.action=null;}for(const [id,i] of invites)if(i.from===p.id||i.to===p.id)invites.delete(id);}
 server.on('upgrade',(req,socket,head)=>{if(new URL(req.url,'http://localhost').pathname==='/multiplayer')wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
 wss.on('connection',socket=>{
  const p={id:randomUUID(),socket,position:[8,1,17],yaw:0,mode:'stand',seat:null,partner:null,action:null};players.set(p.id,p);send(p,{type:'welcome',id:p.id});broadcast();
  socket.on('message',raw=>{try{const m=JSON.parse(raw);
   if(m.type==='move'&&Array.isArray(m.position)&&m.position.length===3&&m.position.every(v=>Number.isFinite(v)&&Math.abs(v)<500)&&!p.seat){p.position=m.position;p.yaw=Number.isFinite(m.yaw)?m.yaw:0;p.mode=['stand','normal','relaxed','stretch'].includes(m.mode)?m.mode:'stand';}
   if(m.type==='sit'&&[0,1].includes(m.swing)){
    const x=[16.5,23.5][m.swing];if(Math.hypot(p.position[0]-x,p.position[2]-11.6)>4||p.position[1]>2.5)return;
    const slot=[0,1].find(slot=>![...players.values()].some(q=>q.seat?.swing===m.swing&&q.seat.slot===slot));
    if(slot===undefined){send(p,{type:'error',message:'Xích đu đã đủ hai người.'});return;}
    end(p);p.seat={swing:m.swing,slot};p.position=[x+(slot===0?-.43:.43),1.32,11.6];p.yaw=0;p.mode='normal';send(p,{type:'seated',seat:p.seat,position:p.position});
   }
   if(m.type==='leave'){end(p);if(p.seat)p.position=[p.position[0],1.14,13.1];p.seat=null;p.mode='stand';}
   if(m.type==='invite'&&['hand','lean','kiss'].includes(m.action)&&p.seat&&!p.partner){const q=[...players.values()].find(q=>q.id!==p.id&&q.seat?.swing===p.seat.swing);if(q&&!q.partner){for(const i of invites.values())if(i.from===p.id||i.to===p.id)return;const id=randomUUID();invites.set(id,{from:p.id,to:q.id,action:m.action,expires:Date.now()+20000});send(q,{type:'invite',id,action:m.action});send(p,{type:'notice',message:'Đã gửi lời mời, đang chờ người kia đồng ý.'});}}
   if(m.type==='respond'){const i=invites.get(m.id);if(i&&i.to===p.id){invites.delete(m.id);const q=players.get(i.from);if(m.accept===true&&i.expires>Date.now()&&q?.seat&&p.seat?.swing===q.seat.swing&&!p.partner&&!q.partner){p.partner=q.id;q.partner=p.id;p.action=q.action=i.action;}else send(q,{type:'notice',message:'Lời mời đã bị từ chối hoặc hết hạn.'});}}
   if(m.type==='stop')end(p);
   broadcast();
  }catch{}});
  socket.on('close',()=>{end(p);players.delete(p.id);broadcast()});
 });
 const timer=setInterval(()=>{for(const [id,i] of invites)if(i.expires<Date.now())invites.delete(id);},1000);timer.unref();
 wss.on('close',()=>clearInterval(timer));return wss;
}

import {createServer} from 'node:http';
import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {attachMultiplayer} from '../server/multiplayer.js';
const server=createServer(),wss=attachMultiplayer(server);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const clients=[];
async function client(){const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/multiplayer`),messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));await new Promise(r=>ws.on('open',r));const c={ws,messages,send:m=>ws.send(JSON.stringify(m))};clients.push(c);return c;}
async function until(fn){for(let i=0;i<100;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out');}
try{
 const a=await client(),b=await client(),c=await client();
 for(const p of [a,b,c]){p.send({type:'move',position:[16.5,1,13],yaw:0});p.send({type:'sit',swing:0});}
 const sa=await until(()=>a.messages.find(m=>m.type==='seated')),sb=await until(()=>b.messages.find(m=>m.type==='seated'));assert.notEqual(sa.seat.slot,sb.seat.slot);await until(()=>c.messages.find(m=>m.type==='error'));
 a.send({type:'invite',action:'hand'});const i=await until(()=>b.messages.find(m=>m.type==='invite'));assert(!a.messages.at(-1).players?.some(p=>p.action));
 b.send({type:'respond',id:i.id,accept:false});await until(()=>a.messages.find(m=>m.type==='notice'&&m.message.includes('từ chối')));
 a.send({type:'invite',action:'lean'});const j=await until(()=>b.messages.find(m=>m.type==='invite'&&m.id!==i.id));
 c.send({type:'respond',id:j.id,accept:true});await new Promise(r=>setTimeout(r,30));assert(!a.messages.filter(m=>m.type==='state').at(-1).players.some(p=>p.action));
 b.send({type:'respond',id:j.id,accept:true});await until(()=>a.messages.filter(m=>m.type==='state').at(-1)?.players.filter(p=>p.action==='lean').length===2);
 b.send({type:'leave'});await until(()=>a.messages.filter(m=>m.type==='state').at(-1)?.players.every(p=>!p.action));
 c.send({type:'sit',swing:0});await until(()=>c.messages.find(m=>m.type==='seated'));c.ws.close();await until(()=>a.messages.filter(m=>m.type==='state').at(-1)?.players.length===2);
 console.log('PASS distinct seats, full seat rejection, consent, refusal, forged acceptance rejection, paired action, leave cancellation, disconnect cleanup');
}finally{for(const c of clients)c.ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));}

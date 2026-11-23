import React,{useEffect,useRef,useState} from 'react';
import {network} from './multiplayer';

export function PrivateChat({position,enabled}){
 const [open,setOpen]=useState(false),[threads,setThreads]=useState({}),[peer,setPeer]=useState(null);
 const [draft,setDraft]=useState(''),[error,setError]=useState('');
 const list=useRef(null);
 const thread=threads[peer];

 useEffect(()=>{
  function receive({detail:m}){
   if(m.type==='private-opened'){
    setThreads(previous=>({...previous,[m.peer]:{name:m.name,lines:[],unread:0}}));
    if(m.initiated){setPeer(m.peer);setOpen(true);}
    setError('');
   }else if(m.type==='private-line'){
    setThreads(previous=>{
     const current=previous[m.peer];
     if(!current)return previous;
     const unread=current.unread+(!m.message.mine&&!(enabled&&open&&peer===m.peer)?1:0);
     return {...previous,[m.peer]:{...current,unread,lines:[...current.lines,m.message].slice(-150)}};
    });
   }else if(m.type==='private-closed'||m.type==='gone'){
    const departed=m.type==='gone'?m.ids:[m.peer];
    setThreads(previous=>{
     if(!departed.some(id=>previous[id]))return previous;
     const next={...previous};
     for(const id of departed)delete next[id];
     return next;
    });
    setPeer(previous=>departed.includes(previous)?null:previous);
   }else if(m.type==='disconnected'){
    setThreads({});setPeer(null);setOpen(false);setError('');
   }else if(m.type==='private-error')setError(m.message);
  }
  window.addEventListener('school-network',receive);
  return ()=>window.removeEventListener('school-network',receive);
 },[enabled,open,peer]);
 useEffect(()=>{
  if(!enabled||!open||peer==null)return;
  setThreads(previous=>previous[peer]?.unread
   ?{...previous,[peer]:{...previous[peer],unread:0}}
   :previous);
 },[enabled,open,peer]);
 useEffect(()=>{setDraft('');setError('');},[peer]);
 useEffect(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;},[thread,open]);

 if(!enabled)return null;
 const nearby=[];
 if(open&&!thread){
  for(const [id,p] of network.remotes){
   const name=network.identities.get(id)?.name;
   const distance=Math.hypot(p.tx-position.x,p.tz-position.z);
   if(name&&!threads[id]&&distance<=4&&Math.abs(p.ty-position.y)<=1.5)nearby.push({id,name,distance});
  }
  nearby.sort((a,b)=>a.distance-b.distance);
 }
 function send(e){
  e.preventDefault();
  const text=draft.trim();
  if(!text||!thread)return;
  if(network.send({type:'private-message',to:peer,text})){setDraft('');setError('');}
  else setError('Chưa kết nối máy chủ.');
 }
 const unread=Object.values(threads).reduce((total,t)=>total+t.unread,0);
 if(!open)return <button className="chat-fab private-chat-toggle" onClick={()=>setOpen(true)}>💬 <span>Trò chuyện riêng</span>{unread>0&&<b className="chat-unread">{unread>5?'5+':unread}</b>}</button>;
 return <section className="chat-panel private-chat-panel" aria-label="Trò chuyện riêng">
  <header>
   {thread&&<button onClick={()=>setPeer(null)} aria-label="Danh sách trò chuyện">‹</button>}
   <b>{thread?`Trò chuyện cùng ${thread.name}`:'Trò chuyện riêng'}</b>
   <button onClick={()=>setOpen(false)} aria-label="Thu nhỏ trò chuyện riêng">–</button>
  </header>
  <div className="chat-list" ref={list}>
   {thread?thread.lines.length?thread.lines.map(m=><div key={m.id} className={`chat-msg${m.mine?' mine':''}`}><p>{m.text}</p></div>):<p className="chat-empty">Chưa có tin nhắn.</p>:<>
    {Object.entries(threads).map(([id,t])=><button key={id} onClick={()=>setPeer(Number(id))}>{t.name}{t.unread>0&&<> <b className="chat-unread">{t.unread>5?'5+':t.unread}</b></>}</button>)}
    {nearby.map(({id,name})=><button key={id} onClick={()=>{if(!network.send({type:'private-open',to:id}))setError('Chưa kết nối máy chủ.');}}>Trò chuyện cùng {name}</button>)}
    {!nearby.length&&!Object.keys(threads).length&&<p className="chat-empty">Đến gần một người chơi để bắt đầu trò chuyện.</p>}
   </>}
  </div>
  {error&&<p className="chat-error" role="status">{error}</p>}
  {thread&&<form className="chat-form" onSubmit={send}><input aria-label="Tin nhắn riêng" placeholder="Nhập tin nhắn…" maxLength={200} value={draft} onChange={e=>setDraft(e.target.value)}/><button type="submit" disabled={!draft.trim()}>Gửi</button></form>}
 </section>;
}

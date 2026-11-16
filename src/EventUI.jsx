import React,{useEffect,useRef,useState} from 'react';
import {network} from './multiplayer';
import {EVENT_INFO} from './live';
import {isMuted,setMuted,onMuteChange} from './eventAudio';

// Thẻ nhỏ báo sự kiện đang diễn ra + nút "Đến ngay" + bật/tắt âm thanh
export function EventPill({event,note,onGo}){
 const [muted,setM]=useState(isMuted());
 useEffect(()=>onMuteChange(setM),[]);
 const info=EVENT_INFO[event];if(!info)return null;
 return <div className={'event-pill event-'+event} role="status">
  <span className="event-icon" aria-hidden="true">{info.icon}</span>
  <span className="event-text"><b>{info.title} đang diễn ra</b><small>{note||`Ở ${info.where}`}</small></span>
  <button onClick={onGo}>Đến ngay</button>
  <button className="event-mute" onClick={()=>setMuted(!muted)} aria-label={muted?'Bật âm thanh':'Tắt âm thanh'} title={muted?'Bật âm thanh':'Tắt âm thanh'}>{muted?'🔇':'🔊'}</button>
 </div>;
}

const NAME_KEY='school-chat-name';
const fmtTime=iso=>{try{return new Date(iso).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}catch{return ''}};

// Cửa sổ trò chuyện chung (mọi người đang ở trường đều thấy)
export function ChatPanel({messages,title}){
 const [open,setOpen]=useState(false),[text,setText]=useState(''),[error,setError]=useState(null),[unread,setUnread]=useState(0);
 const [name,setName]=useState(()=>{try{return localStorage.getItem(NAME_KEY)??''}catch{return ''}});
 const list=useRef(),input=useRef(),seen=useRef(messages.length);
 useEffect(()=>{try{localStorage.setItem(NAME_KEY,name)}catch{}},[name]);
 // Đếm tin chưa đọc khi đang thu nhỏ; tự cuộn xuống tin mới nhất khi đang mở
 useEffect(()=>{
  if(open){seen.current=messages.length;setUnread(0);requestAnimationFrame(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight});}
  else{setUnread(Math.max(0,messages.length-seen.current));if(messages.length<seen.current)seen.current=messages.length;}
 },[messages,open]);
 useEffect(()=>{const on=e=>{if(e.detail?.type==='chat-error'){setError(e.detail.message);setTimeout(()=>setError(null),3000);}};window.addEventListener('school-live',on);return()=>window.removeEventListener('school-live',on)},[]);
 // Nhấn Enter để mở khung chat, Esc để thu nhỏ
 useEffect(()=>{const on=e=>{if(e.target?.closest?.('input,textarea,select'))return;if(e.code==='Enter'&&!open){e.preventDefault();setOpen(true);setTimeout(()=>input.current?.focus(),0);}};window.addEventListener('keydown',on);return()=>window.removeEventListener('keydown',on)},[open]);
 function send(e){
  e.preventDefault();const t=text.trim();if(!t)return;
  if(!network.send({type:'chat',name:name.trim(),text:t})){setError('Chưa kết nối máy chủ.');setTimeout(()=>setError(null),3000);return;}
  setText('');
 }
 if(!open)return <button className="chat-fab" onClick={()=>{setOpen(true);setTimeout(()=>input.current?.focus(),0)}} aria-label="Mở trò chuyện chung">💬 <span>Trò chuyện</span>{unread>0&&<b className="chat-unread">{unread>99?'99+':unread}</b>}</button>;
 return <section className="chat-panel" aria-label="Trò chuyện chung">
  <header><div><b>{title}</b><small>{network.online} người đang ở trường · Enter để mở</small></div><button onClick={()=>setOpen(false)} aria-label="Thu nhỏ">–</button></header>
  <div className="chat-list" ref={list}>
   {messages.length===0?<p className="chat-empty">Chưa có tin nhắn. Chào mọi người một câu nhé!</p>:
    messages.map(m=><div key={m.id} className={'chat-msg'+(m.name===(name.trim()||'Khách')?' mine':'')}><span className="chat-name">{m.name}</span><span className="chat-time">{fmtTime(m.at)}</span><p>{m.text}</p></div>)}
  </div>
  {error&&<p className="chat-error">{error}</p>}
  <form onSubmit={send} className="chat-form">
   <input className="chat-name-input" value={name} onChange={e=>setName(e.target.value.slice(0,24))} placeholder="Tên bạn" aria-label="Tên hiển thị"/>
   <input ref={input} value={text} onChange={e=>setText(e.target.value.slice(0,200))} onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.blur();setOpen(false);}}} placeholder="Nhập tin nhắn…" aria-label="Tin nhắn"/>
   <button type="submit" disabled={!text.trim()}>Gửi</button>
  </form>
 </section>;
}

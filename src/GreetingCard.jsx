import React,{useEffect,useState} from 'react';
import {serverUrl} from './serverUrl';

// Bông hoa trang trí vẽ bằng SVG (không cần ảnh ngoài)
function Flower({size=40,color='#d9485f',center='#f6c453'}){
 return <svg width={size} height={size} viewBox="-20 -20 40 40" aria-hidden="true">
  {[0,72,144,216,288].map(r=><ellipse key={r} cx="0" cy="-9" rx="6.5" ry="9.5" fill={color} transform={`rotate(${r})`} opacity=".92"/>)}
  <circle r="5" fill={center}/><circle r="2" fill="#c98a1c"/>
 </svg>;
}

const REMINDER_KEY='school-greeting-reminder';
const MINUTE=60000;
const REMINDER_DURATION=8000;

export function GreetingBadge({onOpen}){
 const [reminder,setReminder]=useState(()=>{
  try{return JSON.parse(localStorage.getItem(REMINDER_KEY))??{at:Date.now(),opened:false};}
  catch{return {at:Date.now(),opened:false};}
 });
 const [showHint,setShowHint]=useState(false);
 useEffect(()=>{
  try{localStorage.setItem(REMINDER_KEY,JSON.stringify(reminder));}catch{}
  const elapsed=Date.now()-reminder.at;
  const visible=!reminder.dismissed&&elapsed<REMINDER_DURATION;
  setShowHint(visible);
  const hide=visible?setTimeout(()=>setShowHint(false),REMINDER_DURATION-elapsed):null;
  const next=setTimeout(()=>setReminder({at:Date.now(),opened:reminder.opened}),Math.max(0,(reminder.opened?20:5)*MINUTE-elapsed));
  return()=>{clearTimeout(hide);clearTimeout(next);};
 },[reminder]);
 function openGreeting(){
  setShowHint(false);
  setReminder({at:Date.now(),opened:true,dismissed:true});
  onOpen();
 }
 return <button className="greet-badge" onClick={openGreeting} aria-label="Mở thiệp 20/11 để gửi lời chúc đến các thầy cô">
  <span className="greet-badge-flower"><Flower size={34}/></span>
  <span className="greet-badge-text"><b>20/11</b><small>Chúc mừng Ngày Nhà giáo</small></span>
  {showHint&&<span className="greet-badge-hint"><span className="greet-pointing-hand" aria-hidden="true">👈</span>Gửi lời chúc đến các thầy cô</span>}
 </button>;
}

// Mã ngẫu nhiên riêng cho trình duyệt này — giúp server giới hạn spam theo từng người thay vì theo IP (cả trường có thể chung 1 IP Wi-Fi)
function clientId(){try{let id=localStorage.getItem('school-client-id');if(!id){id=crypto.randomUUID();localStorage.setItem('school-client-id',id);}return id;}catch{return '';}}
const fmt=iso=>{try{return new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return ''}};

export function GreetingModal({onClose}){
 const [tab,setTab]=useState('card'),[wishes,setWishes]=useState([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(true);
 const [form,setForm]=useState({name:'',to:'',message:''}),[status,setStatus]=useState(null),[sending,setSending]=useState(false);
 async function refresh(){
  try{const r=await fetch(serverUrl('/api/wishes'));const d=await r.json();setWishes(d.wishes??[]);setTotal(d.total??0);}catch{}finally{setLoading(false)}
 }
 // Tải danh sách khi mở, và cập nhật lời chúc mới của người khác mỗi 10 giây
 useEffect(()=>{refresh();const t=setInterval(refresh,10000);return()=>clearInterval(t)},[]);
 useEffect(()=>{const esc=e=>{if(e.code==='Escape')onClose()};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[onClose]);
 async function submit(e){
  e.preventDefault();if(sending)return;setSending(true);setStatus(null);
  try{
   const r=await fetch(serverUrl('/api/wishes'),{method:'POST',headers:{'Content-Type':'application/json','X-Client-Id':clientId()},body:JSON.stringify(form)});const d=await r.json();
   if(!r.ok)throw new Error(d.error??'Gửi chưa được, thử lại nhé.');
   setWishes(w=>[d.wish,...w]);setTotal(n=>n+1);setForm(f=>({...f,message:''}));setStatus({ok:true,text:'Đã gửi lời chúc! Cảm ơn bạn ❤'});setTab('list');
  }catch(err){setStatus({ok:false,text:err.message||'Không kết nối được máy chủ.'});}
  finally{setSending(false)}
 }
 const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
 return <div className="modal greet-modal" role="dialog" aria-modal="true" aria-label="Thiệp chúc mừng 20/11" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="greet-panel">
   <button className="close" onClick={onClose} aria-label="Đóng">×</button>
   <div className="greet-tabs" role="tablist">
    {[['card','Thiệp chúc mừng'],['write','Gửi lời chúc'],['list',`Sổ lời chúc${total?` (${total})`:''}`]].map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}
   </div>

   {tab==='card'&&<div className="greet-card">
    <div className="greet-flowers top"><Flower size={56}/><Flower size={38} color="#ef8aa0"/><Flower size={30} color="#f4a259"/></div>
    <small>THPT AN DƯƠNG · HẢI PHÒNG</small>
    <h2>Chúc mừng<br/><span>Ngày Nhà giáo Việt Nam</span></h2>
    <div className="greet-date">20 · 11</div>
    <p className="greet-message">Kính chúc các thầy cô giáo luôn mạnh khỏe, hạnh phúc và tràn đầy nhiệt huyết trên hành trình ươm mầm tri thức.<br/>Cảm ơn thầy cô — những người lái đò thầm lặng — đã đưa bao thế hệ học trò cập bến tương lai.</p>
    <p className="greet-sign">Học trò An Dương tri ân</p>
    <div className="greet-flowers bottom"><Flower size={30} color="#f4a259"/><Flower size={44} color="#ef8aa0"/><Flower size={56}/></div>
    <button className="greet-cta" onClick={()=>setTab('write')}>Viết lời chúc gửi thầy cô →</button>
   </div>}

   {tab==='write'&&<form className="greet-form" onSubmit={submit}>
    <h3>Gửi lời chúc tới thầy cô</h3>
    <label>Tên của bạn<input value={form.name} onChange={set('name')} maxLength={40} placeholder="VD: Minh Anh – lớp 12A1 (để trống = Ẩn danh)"/></label>
    <label>Gửi tới<input value={form.to} onChange={set('to')} maxLength={60} placeholder="VD: Cô Lan dạy Văn, hoặc tất cả thầy cô"/></label>
    <label>Lời chúc<textarea value={form.message} onChange={set('message')} maxLength={500} rows={5} required placeholder="Viết đôi lời tri ân…"/><span className="greet-count">{form.message.length}/500</span></label>
    {status&&<p className={'greet-status '+(status.ok?'ok':'err')}>{status.text}</p>}
    <button className="greet-cta" type="submit" disabled={sending||form.message.trim().length<2}>{sending?'Đang gửi…':'Gửi lời chúc'}</button>
   </form>}

   {tab==='list'&&<div className="greet-list">
    {status?.ok&&<p className="greet-status ok">{status.text}</p>}
    {loading?<p className="greet-empty">Đang tải lời chúc…</p>:wishes.length===0?<p className="greet-empty">Chưa có lời chúc nào. Hãy là người đầu tiên! <button className="link" onClick={()=>setTab('write')}>Viết lời chúc</button></p>:
     <ul>{wishes.map(w=><li key={w.id}><p className="greet-text">“{w.message}”</p><div className="greet-meta"><b>{w.name}</b>{w.to&&<> gửi <b>{w.to}</b></>}<span>{fmt(w.createdAt)}</span></div></li>)}</ul>}
   </div>}
  </section>
 </div>;
}

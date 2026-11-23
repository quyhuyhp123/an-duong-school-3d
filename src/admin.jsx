// Trang quản lý: chọn sự kiện ban đêm, quản lý lời chúc 20/11 và tin nhắn trò chuyện.
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './admin.css';
import {serverUrl} from './serverUrl';

const TOKEN_KEY='school-admin-token';
const getToken=()=>{try{return sessionStorage.getItem(TOKEN_KEY)}catch{return null}};
const saveToken=t=>{try{t?sessionStorage.setItem(TOKEN_KEY,t):sessionStorage.removeItem(TOKEN_KEY)}catch{}};
async function api(path,{method='GET',body,token}={}){
 const r=await fetch(serverUrl(path),{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(data.error??'Có lỗi xảy ra.');e.status=r.status;throw e;}
 return data;
}
const fmt=iso=>{try{return new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return ''}};
import {isEventNight as isNight} from './eventSchedule';

const EVENT_CARDS=[
 {id:'teachers',icon:'🌸',title:'Ngày Nhà giáo Việt Nam 20/11',desc:'Hoa, bóng bay và 10 học sinh múa tại mỗi sân khấu.'},
 {id:'none',icon:'🌙',title:'Không có sự kiện',desc:'Sân trường yên tĩnh như bình thường.'},
 {id:'dj',icon:'🎧',title:'Đêm nhạc DJ',desc:'Bàn DJ trên sân khấu xanh, loa, đèn quét nhiều màu và sàn nhảy phát sáng theo nhạc.'},
 {id:'campfire',icon:'🔥',title:'Lửa trại',desc:'Đống lửa giữa sân, 7 khúc gỗ để mọi người đến ngồi quây quần (nhấn F).'},
];

function Login({onLogin}){
 const [pw,setPw]=useState(''),[err,setErr]=useState(null),[busy,setBusy]=useState(false);
 async function submit(e){e.preventDefault();setBusy(true);setErr(null);try{const {token}=await api('/api/admin/login',{method:'POST',body:{password:pw}});saveToken(token);onLogin(token);}catch(e){setErr(e.message)}finally{setBusy(false)}}
 return <div className="login-wrap"><form className="login-card" onSubmit={submit}>
  <div className="brand"><span className="seal">AD</span><div><small>THPT AN DƯƠNG</small><h1>Trang quản lý</h1></div></div>
  <label>Mật khẩu quản trị<input type="password" autoFocus value={pw} onChange={e=>setPw(e.target.value)} placeholder="Nhập mật khẩu"/></label>
  {err&&<p className="alert err">{err}</p>}
  <button className="btn primary" disabled={busy||!pw}>{busy?'Đang kiểm tra…':'Đăng nhập'}</button>
  <p className="hint">Mật khẩu được in ra cửa sổ terminal khi chạy server và lưu trong <code>data/admin-password.txt</code>.</p>
 </form></div>;
}

// ---------- Nhạc cho Đêm nhạc DJ ----------
const fmtSize=b=>b>1048576?(b/1048576).toFixed(1)+' MB':Math.round(b/1024)+' KB';
function SpeakerIcon({level}){ // biểu tượng loa: số vạch sóng theo âm lượng
 return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/>
  {level===0?<><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></>:<>
   {level>0&&<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>}
   {level>.4&&<path d="M18.5 7a7 7 0 0 1 0 10"/>}
   {level>.75&&<path d="M21 4.5a10.5 10.5 0 0 1 0 15"/>}</>}
 </svg>;
}
function MusicCard({data,token,onChanged,notify}){
 const cfg=data.config,tracks=data.music??[];
 const [upload,setUpload]=useState(null),[volume,setVolume]=useState(Math.round((cfg.musicVolume??.8)*100)),[preview,setPreview]=useState(null);
 const fileRef=useRef(),timer=useRef(),lastVol=useRef(80);
 useEffect(()=>{setVolume(Math.round((cfg.musicVolume??.8)*100));},[cfg.musicVolume]);
 const put=async body=>{try{await api('/api/admin/music',{method:'PUT',body,token});onChanged();}catch(e){notify(e.message,true)}};
 // Kéo thanh âm lượng: đợi 250 ms rồi mới gửi để không gửi dồn liên tục
 const changeVolume=v=>{setVolume(v);if(v>0)lastVol.current=v;clearTimeout(timer.current);timer.current=setTimeout(()=>put({musicVolume:v/100}),250);};
 function pick(file){
  if(!file)return;
  if(file.size>data.maxMusicMB*1048576){notify(`File quá lớn (tối đa ${data.maxMusicMB} MB).`,true);return;}
  const xhr=new XMLHttpRequest();
  xhr.open('POST',serverUrl('/api/admin/music'));xhr.setRequestHeader('Authorization','Bearer '+token);xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
  xhr.upload.onprogress=e=>setUpload({name:file.name,pct:e.lengthComputable?Math.round(e.loaded/e.total*100):0});
  xhr.onload=async()=>{setUpload(null);let d={};try{d=JSON.parse(xhr.responseText)}catch{}
   if(xhr.status>=300){notify(d.error??'Tải lên thất bại.',true);return;}
   notify('Đã tải lên "'+d.track.name+'".');
   if(!cfg.musicId)await put({musicId:d.track.id});else onChanged(); // bài đầu tiên tự được chọn phát
  };
  xhr.onerror=()=>{setUpload(null);notify('Mất kết nối khi tải lên.',true);};
  setUpload({name:file.name,pct:0});xhr.send(file);
 }
 async function remove(t){if(!confirm(`Xoá bài "${t.name}"?`))return;try{await api('/api/admin/music/'+t.id,{method:'DELETE',token});notify('Đã xoá bài nhạc.');onChanged();}catch(e){notify(e.message,true)}}
 return <section className="card music-card">
  <div className="card-head"><div><h3>🎧 Nhạc cho Đêm nhạc DJ</h3><p>Chọn bài sẽ phát ở sân khấu. Đổi bài hay âm lượng là mọi người nghe thấy ngay.</p></div>
   <div className="volume" title="Âm lượng nhạc cho mọi người">
    <button className="speaker" onClick={()=>changeVolume(volume?0:lastVol.current)} aria-label={volume?'Tắt tiếng':'Bật tiếng'}><SpeakerIcon level={volume/100}/></button>
    <input type="range" min="0" max="100" value={volume} onChange={e=>changeVolume(+e.target.value)} aria-label="Âm lượng"/>
    <b>{volume}%</b>
   </div>
  </div>
  <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.webm,.flac" hidden onChange={e=>{pick(e.target.files[0]);e.target.value='';}}/>
  <div className="music-actions">
   <button className="btn primary" disabled={!!upload} onClick={()=>fileRef.current.click()}>📁 Chọn file nhạc…</button>
   <span className="muted">mp3, m4a, ogg, wav… tối đa {data.maxMusicMB} MB</span>
  </div>
  {upload&&<div className="upload"><span>Đang tải lên "{upload.name}"… {upload.pct}%</span><div className="bar"><i style={{width:upload.pct+'%'}}/></div></div>}
  <ul className="tracks">
   <li className={!cfg.musicId?'active':''}><label className="radio"><input type="radio" name="track" checked={!cfg.musicId} onChange={()=>put({musicId:null})}/><span><b>Nhạc điện tử tự tạo</b><small>Mặc định · không cần tải file</small></span></label></li>
   {tracks.map(t=><li key={t.id} className={cfg.musicId===t.id?'active':''}>
    <label className="radio"><input type="radio" name="track" checked={cfg.musicId===t.id} onChange={()=>put({musicId:t.id})}/><span><b>{t.name}</b><small>{fmtSize(t.size)} · tải lên {fmt(t.uploadedAt)}{cfg.musicId===t.id&&' · đang phát'}</small></span></label>
    <button className="btn sm" onClick={()=>setPreview(preview===t.id?null:t.id)}>{preview===t.id?'Đóng':'▶ Nghe thử'}</button>
    <button className="btn danger sm" onClick={()=>remove(t)}>Xoá</button>
    {preview===t.id&&<audio className="preview" src={serverUrl(t.url)} controls autoPlay/>}
   </li>)}
  </ul>
 </section>;
}

function EventsTab({data,token,onSaved,notify}){
 const [form,setForm]=useState(data.config);const [saving,setSaving]=useState(false);
 // chỉ nạp lại form khi cấu hình thực sự đổi (không xoá phần đang sửa mỗi lần tự làm mới)
 useEffect(()=>setForm(data.config),[data.config.updatedAt]);
 const pickEv=c=>JSON.stringify([c.event,c.schedule,c.chat,c.note]);const dirty=pickEv(form)!==pickEv(data.config);
 async function save(){setSaving(true);try{await api('/api/admin/config',{method:'PUT',body:form,token});notify('Đã áp dụng — mọi người trong trường thấy ngay.');onSaved();}catch(e){notify(e.message,true)}finally{setSaving(false)}}
 const live=form.event!=='none'&&(form.schedule==='always'||isNight());
 return <div className="stack">
  <section className="card">
   <div className="card-head"><div><h2>Sự kiện</h2><p>Chọn sự kiện diễn ra ở sân trường.</p></div>
    <span className={'status '+(data.config.event==='none'?'idle':(data.config.schedule==='always'||isNight())?'on':'wait')}>{data.config.event==='none'?'Không có sự kiện':(data.config.schedule==='always'||isNight())?'● Đang diễn ra':'Chờ trời tối (18:30)'}</span>
   </div>
   <div className="event-grid">{EVENT_CARDS.map(c=><button key={c.id} className={'event-card'+(form.event===c.id?' selected':'')+' ev-'+c.id} onClick={()=>setForm(f=>({...f,event:c.id,schedule:c.id==='teachers'?'always':f.schedule}))} aria-pressed={form.event===c.id}>
    <span className="ev-icon">{c.icon}</span><b>{c.title}</b><span className="ev-desc">{c.desc}</span>{form.event===c.id&&<span className="ev-check">✓</span>}
   </button>)}</div>
  </section>
  <div className="two-col">
   <section className="card"><h3>Thời gian diễn ra</h3>
    {Object.entries(data.options.schedules).map(([id,label])=><label key={id} className="radio"><input type="radio" name="schedule" checked={form.schedule===id} disabled={form.event==='teachers'} onChange={()=>setForm(f=>({...f,schedule:id}))}/><span>{label}</span></label>)}
    <p className="muted">Lịch buổi tối chạy từ 18:30 đến 05:00 theo giờ Việt Nam (UTC+7).</p>
   </section>
   <section className="card"><h3>Phòng trò chuyện chung</h3>
    {Object.entries(data.options.chat).map(([id,label])=><label key={id} className="radio"><input type="radio" name="chat" checked={form.chat===id} onChange={()=>setForm(f=>({...f,chat:id}))}/><span>{label}</span></label>)}
   </section>
  </div>
  <MusicCard data={data} token={token} onChanged={onSaved} notify={notify}/>
  <section className="card"><h3>Lời nhắn hiển thị cho người chơi <span className="muted">(tuỳ chọn)</span></h3>
   <input className="text" value={form.note} maxLength={120} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="VD: Lửa trại khối 12 — 20h tối nay, mời cả trường!"/>
  </section>
  <div className="savebar">
   <span className="muted">{live?'Sau khi lưu, sự kiện sẽ hiện ngay với mọi người.':form.event==='none'?'Sau khi lưu, sân trường trở lại bình thường.':'Sau khi lưu, sự kiện tự bắt đầu lúc 18:30.'}{data.config.updatedAt&&` · Lần lưu trước: ${fmt(data.config.updatedAt)}`}</span>
   <button className="btn ghost" disabled={!dirty||saving} onClick={()=>setForm(data.config)}>Hoàn tác</button>
   <button className="btn primary" disabled={!dirty||saving} onClick={save}>{saving?'Đang lưu…':'Lưu & áp dụng'}</button>
  </div>
 </div>;
}

function WishesTab({data,token,onChanged,notify}){
 const [q,setQ]=useState('');
 const list=useMemo(()=>{const s=q.trim().toLowerCase();return s?data.wishes.filter(w=>[w.name,w.to,w.message].some(v=>v?.toLowerCase().includes(s))):data.wishes;},[q,data.wishes]);
 async function remove(w){if(!confirm(`Xoá lời chúc của "${w.name}"?\n\n“${w.message.slice(0,120)}”`))return;try{await api('/api/admin/wishes/'+w.id,{method:'DELETE',token});notify('Đã xoá lời chúc.');onChanged();}catch(e){notify(e.message,true)}}
 return <section className="card">
  <div className="card-head"><div><h2>Lời chúc 20/11</h2><p>{data.wishes.length} lời chúc · mới nhất ở trên</p></div><input className="text search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm theo tên, người nhận, nội dung…"/></div>
  {list.length===0?<p className="empty">{q?'Không tìm thấy lời chúc phù hợp.':'Chưa có lời chúc nào.'}</p>:
   <ul className="rows">{list.map(w=><li key={w.id}><div className="row-main"><p className="quote">“{w.message}”</p><span className="meta"><b>{w.name}</b>{w.to&&<> → {w.to}</>} · {fmt(w.createdAt)}</span></div><button className="btn danger sm" onClick={()=>remove(w)}>Xoá</button></li>)}</ul>}
 </section>;
}

function ChatTab({data,token,onChanged,notify}){
 async function remove(m){try{await api('/api/admin/chat/'+m.id,{method:'DELETE',token});onChanged();}catch(e){notify(e.message,true)}}
 async function clearAll(){if(!confirm('Xoá toàn bộ lịch sử trò chuyện? Người chơi cũng sẽ không còn thấy các tin nhắn cũ.'))return;try{await api('/api/admin/chat',{method:'DELETE',token});notify('Đã xoá toàn bộ tin nhắn.');onChanged();}catch(e){notify(e.message,true)}}
 return <section className="card">
  <div className="card-head"><div><h2>Trò chuyện chung</h2><p>{data.chat.length} tin nhắn gần nhất · tin bị xoá sẽ biến mất ngay trên màn hình người chơi</p></div><button className="btn danger" disabled={!data.chat.length} onClick={clearAll}>Xoá tất cả</button></div>
  {data.chat.length===0?<p className="empty">Chưa có tin nhắn nào.</p>:
   <ul className="rows compact">{data.chat.map(m=><li key={m.id}><div className="row-main"><span className="meta"><b>{m.name}</b> · {fmt(m.at)}</span><p>{m.text}</p></div><button className="btn danger sm" onClick={()=>remove(m)}>Xoá</button></li>)}</ul>}
 </section>;
}

// Giám sát nhanh tình trạng server (tự làm mới 15 giây/lần)
function SystemTab({data}){
 const s=data.system??{};
 const level=(v,warn,bad)=>v>=bad?'bad':v>=warn?'warn':'good';
 const cards=[
  ['Người đang online',s.players??data.online,`tối đa cấu hình: xem MAX_PLAYERS`,'good'],
  ['Nhịp cập nhật',`${s.tickHz??10} Hz`,s.tickHz<10?'Server đang tự giảm tải':'Bình thường (10 Hz)',s.tickHz<10?'warn':'good'],
  ['Độ trễ vòng lặp (p95)',`${s.eventLoopP95Ms??0} ms`,'< 50 ms là tốt',level(s.eventLoopP95Ms??0,50,150)],
  ['Thời gian xử lý 1 tick (p95)',`${s.tickP95Ms??0} ms`,`lát dài nhất ${s.sliceMaxMs??0} ms`,level(s.sliceMaxMs??0,30,80)],
  ['Băng thông gửi đi',`${((s.bytesOutPerSec??0)/1e6).toFixed(2)} MB/s`,`nhận ${((s.bytesInPerSec??0)/1e3).toFixed(0)} KB/s`,'good'],
  ['Bộ nhớ (RSS)',`${s.rssMB??0} MB`,`heap ${s.heapMB??0} MB`,level(s.rssMB??0,800,1500)],
  ['Gói bỏ qua do mạng chậm',s.snapshotsSkippedBackpressure??0,`đã ngắt ${s.slowClientsDropped??0} kết nối quá chậm`,(s.slowClientsDropped??0)>20?'warn':'good'],
  ['Bị từ chối',`${s.rejectedFull??0} đầy · ${s.rejectedOrigin??0} sai nguồn`,`${s.rateLimitedMessages??0} tin bị chặn do gửi dồn`,(s.rejectedFull??0)>0?'warn':'good'],
  ['Lỗi lưu dữ liệu',s.storageErrors??0,'phải luôn là 0',(s.storageErrors??0)>0?'bad':'good'],
 ];
 return <section className="card">
  <div className="card-head"><div><h2>Hệ thống</h2><p>Tình trạng server · chạy được {Math.floor((s.uptimeSec??0)/3600)} giờ {Math.floor((s.uptimeSec??0)%3600/60)} phút · tự làm mới mỗi 15 giây</p></div></div>
  <div className="sys-grid">{cards.map(([label,value,hint,lv])=><div key={label} className={'sys-card '+lv}><span>{label}</span><b>{value}</b><small>{hint}</small></div>)}</div>
  {s.http&&Object.keys(s.http).length>0&&<><h3 style={{marginTop:20}}>API</h3><ul className="rows compact">{Object.entries(s.http).map(([k,h])=><li key={k}><div className="row-main"><b>{k}</b><span className="meta"> · {h.count} lượt · p95 {h.p95Ms} ms · {h.errors} lỗi</span></div></li>)}</ul></>}
  <p className="muted" style={{marginTop:16}}>Số liệu chi tiết cho Grafana / Uptime Kuma: <code>/metrics</code> (cần METRICS_TOKEN) và <code>/healthz</code>.</p>
 </section>;
}

function Dashboard({token,onLogout}){
 const [data,setData]=useState(null),[tab,setTab]=useState('events'),[toast,setToast]=useState(null),[error,setError]=useState(null);
 const load=useCallback(async()=>{try{setData(await api('/api/admin/overview',{token}));setError(null);}catch(e){if(e.status===401){saveToken(null);onLogout();}else setError(e.message);}},[token,onLogout]);
 useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[load]);
 const notify=(text,bad)=>{setToast({text,bad});setTimeout(()=>setToast(null),3200)};
 async function logout(){try{await api('/api/admin/logout',{method:'POST',token})}catch{}saveToken(null);onLogout();}
 if(!data)return <div className="login-wrap"><p className="muted">{error??'Đang tải…'}</p></div>;
 const current=EVENT_CARDS.find(c=>c.id===data.config.event);
 const tabs=[['events','Sự kiện',current?.icon],['wishes','Lời chúc 20/11',data.wishes.length],['chat','Trò chuyện',data.chat.length],['system','Hệ thống',data.online]];
 return <div className="layout">
  <aside className="side">
   <div className="brand"><span className="seal">AD</span><div><small>THPT AN DƯƠNG</small><b>Quản lý</b></div></div>
   <nav>{tabs.map(([id,label,badge])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}<span className="badge">{badge}</span></button>)}</nav>
   <div className="side-foot">
    <div className="stat"><b>{data.online}</b><span>người đang ở trường</span></div>
    <a className="btn ghost" href="/" target="_blank" rel="noreferrer">Mở sân trường ↗</a>
    <button className="btn ghost" onClick={logout}>Đăng xuất</button>
   </div>
  </aside>
  <main className="content">
   {error&&<p className="alert err">{error}</p>}
   {tab==='events'&&<EventsTab data={data} token={token} onSaved={load} notify={notify}/>}
   {tab==='wishes'&&<WishesTab data={data} token={token} onChanged={load} notify={notify}/>}
   {tab==='chat'&&<ChatTab data={data} token={token} onChanged={load} notify={notify}/>}
   {tab==='system'&&<SystemTab data={data}/>}
  </main>
  {toast&&<div className={'toast'+(toast.bad?' bad':'')} role="status">{toast.text}</div>}
 </div>;
}

function Admin(){
 const [token,setToken]=useState(getToken);
 const logout=useCallback(()=>setToken(null),[]);
 return token?<Dashboard token={token} onLogout={logout}/>:<Login onLogin={setToken}/>;
}
createRoot(document.getElementById('root')).render(<Admin/>);

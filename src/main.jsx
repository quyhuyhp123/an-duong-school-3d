import {entryFor} from './transport';
import React,{Suspense,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas} from '@react-three/fiber';
import {World} from './World';
import {DayCycle} from './DayCycle';
import {GreetingBadge,GreetingModal} from './GreetingCard';
import {useLive,EVENT_INFO,CAMPFIRE_POS} from './live';
import {EventPill,ChatDock,ChatPanel} from './EventUI';
import {PrivateChat} from './PrivateChat';
import {setEventSound,setListenerPosition,setMusic} from './eventAudio';
import './style.css';
import {Onboarding} from './Onboarding';
// mini-game bóng rổ: tải khi mở game (không nằm trong gói tải đầu trang)
const BasketballGame=React.lazy(()=>import('./Basketball').then(m=>({default:m.BasketballGame})));
import {MemoryAlbum,startAlbumMusic} from './MemoryAlbum';
import {LabComputer} from './LabComputer';
import {SchoolDrum} from './SchoolDrum';
import {Prewarm} from './Prewarm';
import {PerformanceMonitor} from '@react-three/drei';
import {IS_TOUCH} from './device';
import {TouchControls} from './TouchControls';
import {useProfile,describeProfile,getProfile} from './profile';

function CampusMap({position}){
  return <svg className="campus-map" viewBox="-48 -58 130 116" role="img" aria-label="Sơ đồ khuôn viên: nhà gần cổng, ba dãy lớp, cổng phụ, nhà xe và nhà đa năng">
    <rect x="-44" y="-52" width="120" height="108" rx="2" fill="#e3e9d1"/>
    <path d="M44 45V-44M59 55V43" stroke="#c3c7bf" strokeWidth="5" fill="none"/>
    <rect x="-34" y="-45.5" width="68" height="11" fill="#d6ae66"/>
    <rect x="-41.5" y="-34" width="11" height="30" fill="#d6ae66"/>
    <rect x="30.5" y="-34" width="11" height="42" fill="#d6ae66"/>
    <rect x="-36" y="35.5" width="26" height="11" fill="#d6ae66"/>
    <rect x="55" y="17" width="18" height="24" fill="#b9c8c5"/>
    <rect x="43.8" y="-36" width="9.4" height="54" fill="#b9c8c5"/>
    <rect x="-8" y="-33" width="16" height="6" fill="#518cba"/>
    <rect x="-31.8" y="9" width="27.6" height="26" fill="#a4bd78"/>
    <rect x="-41" y="0" width="10" height="8" fill="#d6ae66"/>
    <circle cx="-23" cy="-14" r="2.45" fill="#58a8c2" stroke="#738173" strokeWidth=".4"/>
    {[-3,5].flatMap(x=>[-31.125,-23.75,-16.375,-9].map(y=><circle key={`${x}-${y}`} cx={x} cy={-y} r=".7" fill="#317947"/>))}
    <rect x="5.9" y="16" width="23.6" height="24" fill="#899588" stroke="white" strokeWidth=".35"/>
    <path d="M17.7 16V40M5.9 28H29.5" stroke="white" strokeWidth=".3"/>
    <rect x="11" y="41" width="18" height="6" fill="#d6ae66"/><rect x="12" y="6.5" width="16" height="8" fill="#b3728c" opacity=".8"/>
    <g fontSize="3" fill="#354434" textAnchor="middle" fontFamily="sans-serif">
      <text x="0" y="-39">A · DÃY CHÍNH</text><text x="-36" y="-17" transform="rotate(-90 -36 -17)">B · DÃY TRÁI</text>
      <text x="36" y="-6" transform="rotate(-90 36 -6)">C · DÃY PHẢI</text><text x="-23" y="42">D · NHÀ GẦN CỔNG</text>
      <text x="63" y="20">NHÀ ĐA NĂNG</text><text x="48.5" y="-12">NHÀ XE</text><text x="0" y="51">CỔNG CHÍNH</text>
      <text x="49" y="49">CỔNG PHỤ</text><text x="0" y="-19">SÂN TRƯỜNG</text>
      <text x="-36" y="5">NHÀ NƯỚC</text><text x="18" y="35">BÓNG RỔ</text><text x="20" y="11">GIÀN HOA</text>
    </g><circle cx={position.x} cy={position.z} r="1.7" fill="#a7462c" stroke="white" strokeWidth=".65"/>
  </svg>
}
class ErrorBoundary extends React.Component{
  state={error:null};static getDerivedStateFromError(error){return {error}}
  render(){return this.state.error?<div className="load-error">Không tải được cảnh 3D.<p>{this.state.error.message}</p><button onClick={()=>location.reload()}>Tải lại</button></div>:this.props.children}
}
function OnlineCount(){
  const [count,setCount]=useState(null);
  useEffect(()=>{
    function update({detail}){
      if(detail.type==='disconnected')setCount(null);
      else if(Number.isInteger(detail.online))setCount(detail.online);
    }
    window.addEventListener('school-network',update);
    return ()=>window.removeEventListener('school-network',update);
  },[]);
  return <span className="online-count" title="Số người đang kết nối với trường">{count??'—'} online</span>;
}
function App(){
  // không còn cảnh nhìn toàn trường từ trên cao lúc mở trang (camera bay xuống làm giật): luôn ở góc nhìn nhân vật
  const [overview,setOverview]=useState(false),[album,setAlbum]=useState(false),[map,setMap]=useState(false),[near,setNear]=useState(false),[greet,setGreet]=useState(false);
  const [basket,setBasket]=useState(false); // mini-game ném bóng rổ
  const [lab,setLab]=useState(false); // đang mở màn hình máy tính phòng tin học
  // chuẩn bị cảnh (Prewarm: biên dịch shader, nạp texture…) — lần đầu vào trường chờ ít nhất 2,5 s và tới khi chuẩn bị xong
  const [warm,setWarm]=useState(false),[warmPct,setWarmPct]=useState(0),[prep,setPrep]=useState(0),entered=React.useRef(false);
  const onWarmDone=React.useCallback(()=>setWarm(true),[]);
  useEffect(()=>{if(!prep)return;const left=Math.max(0,2500-(Date.now()-prep));if(warm&&!left){setPrep(0);return;}const t=setTimeout(()=>{if(warm)setPrep(0);},left||250);return()=>clearTimeout(t);},[prep,warm]);
  // độ phân giải: điện thoại màn hình mật độ cao (2–3x) → vẽ tối đa 2x, bắt đầu 1.75 (trước đây 1.25 → ảnh vỡ hạt);
  // máy tính 1.5. Khung hình tụt thì tự hạ nhưng không dưới 1 (dưới 1 ảnh bị nhoè, răng cưa)
  const MAX_DPR=IS_TOUCH?Math.min(2,Math.max(1,window.devicePixelRatio||1)):1.5,[dpr,setDpr]=useState(()=>IS_TOUCH?Math.min(1.75,MAX_DPR):MAX_DPR),[compact,setCompact]=useState(IS_TOUCH); // compact: thu gọn khung tên trường
  useEffect(()=>{const open=e=>{setBasket(e.detail==='flap'?'flap':'shoot');setMap(false);setAlbum(false);};window.addEventListener('open-basketball',open);return()=>window.removeEventListener('open-basketball',open);},[]);
  const profile=useProfile(),[onboard,setOnboard]=useState('welcome'); // màn hình chào / chọn nhân vật (null = đang chơi)
  const [data,setData]=useState(null),[position,setPosition]=useState({x:8,y:1,z:17}),[destination,setDestination]=useState(()=>({position:entryFor(getProfile()?.transport==='bike'?'bike':'walk'),yaw:0,time:0})); // ngay từ đầu nhân vật đứng ở cổng (sau màn hình chào camera đã khoá sẵn sau lưng)
  useEffect(()=>{const fn=e=>{if(e.repeat||greet||onboard||prep||basket||lab||e.target?.closest?.('input,textarea,select'))return;if(e.code==='KeyE'&&near&&!map){if(!album)startAlbumMusic().catch(()=>{});setAlbum(!album);}if(e.code==='Escape'){setAlbum(false);setMap(false)}if(e.code==='KeyM'){setMap(v=>!v);setAlbum(false)}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[album,near,map,greet,onboard,prep,basket,lab]);
  // Sự kiện ban đêm do trang quản lý chọn (DJ / lửa trại) + phòng trò chuyện
  const live=useLive();
  useEffect(()=>{setEventSound(live.event,live.event==='dj'?[0,0,-28]:live.event==='campfire'?CAMPFIRE_POS:null)},[live.event]);
  // Bài nhạc & âm lượng admin chọn cho Đêm nhạc DJ (đổi là áp dụng ngay)
  const m=live.config?.music;
  useEffect(()=>{setMusic(m)},[m?.url,m?.volume,m?.startedAt]);
  useEffect(()=>{setListenerPosition(overview?[1e4,0,1e4]:[position.x,position.y,position.z])},[position,overview]);
  function visit(p){setDestination({position:p,yaw:0,time:Date.now()});setOverview(false);setMap(false)}
  // chọn nhân vật xong: đứng yên trên vỉa hè trước cổng chính, quay mặt vào trường (người chơi tự đi vào)
  function enterSchool(p=profile){document.activeElement?.blur?.();const bike=p?.transport==='bike';setLab(false);setBasket(false);setGreet(false);setOnboard(null);if(!entered.current||!warm){entered.current=true;setWarm(false);setWarmPct(0);setPrep(Date.now());/* lượt chuẩn bị thứ 2 (Prewarm pass=1) phải xong mới vào */}setDestination({position:entryFor(bike?'bike':'walk'),transport:bike?'bike':'walk',yaw:0,time:Date.now()});setOverview(false);setMap(false);setAlbum(false)}
  const currentRoom=data?.rooms.find(r=>{
    if(Math.abs(r.inside[1]-position.y)>.75||!r.aisle)return false;
    const dx=r.aisle[0]-r.door[0],dz=r.aisle[2]-r.door[2],length2=dx*dx+dz*dz;
    const t=((position.x-r.door[0])*dx+(position.z-r.door[2])*dz)/length2;
    return t>.2&&t<1.12&&Math.hypot(position.x-r.door[0]-t*dx,position.z-r.door[2]-t*dz)<2.5;
  });
  return <main>
    <ErrorBoundary><Canvas frameloop={lab||basket||album||greet?"demand":"always"} shadows camera={{position:[0,3.7,55],fov:48,near:.2,far:450}} dpr={dpr} gl={{powerPreference:'high-performance',antialias:true}} onCreated={st=>{if(/[?&]perf(&|=|$)/.test(location.search))window.__three=st;/* ?perf: công cụ đo hiệu năng đọc cảnh 3D */}}>
      {/* chỉnh độ nét tự động chỉ khi đang chơi — lúc màn hình chào / chuẩn bị máy đang bận biên dịch, đo sẽ sai và hạ độ nét oan */}
      {!onboard&&!prep&&<PerformanceMonitor onDecline={()=>setDpr(d=>Math.max(1,d-.5))} flipflops={2}/>}{/* chỉ HẠ độ nét khi máy yếu (bước .5, tối đa 1–2 lần): mỗi lần đổi độ nét là 1 lần cấp phát lại khung vẽ → khựng; không tăng/giảm qua lại */}
      <color attach="background" args={['#c8dce6']}/><fog attach="fog" args={['#c8dce6',170,320]}/>
      <DayCycle/>
      <Suspense fallback={null}>
        <World event={live.event} overview={overview} paused={album||map||greet||basket||lab||!!prep||!!onboard} destination={destination} onPosition={setPosition} onNear={setNear} onData={setData}/>
        <Prewarm ready={!!data} pass={prep?1:0} onProgress={setWarmPct} onDone={onWarmDone}/>
      </Suspense>
    </Canvas></ErrorBoundary>
    {!!prep&&!onboard&&<div className="prep-screen" role="status" aria-live="polite">
     <div className="prep-card">
      <div className="prep-seal">AD</div>
      <h2>Đang chuẩn bị sân trường…</h2>
      <p>{!data?'Đang tải khuôn viên và các lớp học':warmPct<.55?'Đang chuẩn bị ánh sáng và vật liệu':warmPct<1?'Đang sắp xếp bàn ghế, cây xanh':'Sắp xong rồi — chào mừng bạn trở lại trường!'}</p>
      <div className="prep-bar"><i style={{width:`${Math.round(Math.max(.05,data?(.3+.7*warmPct):.15)*100)}%`}}/></div>
     </div>
    </div>}
    {!data&&<div className="loading loading-overlay">Đang mở khuôn viên và các lớp học…</div>/* chữ chờ tải nằm ngoài Canvas (Html trong fallback của Suspense bị gỡ giữa lúc render → lỗi removeChild) */}
    {/* góc trái trên: tên trường (bấm để thu gọn chỉ còn vòng tròn AD) → thiệp 20/11 → sự kiện đang diễn ra */}
    <div className="hud-left">
     <header className={compact?'compact':''} onClick={()=>setCompact(v=>!v)} title={compact?'Hiện tên trường':'Thu gọn'}><div className="seal">AD</div><div className="hdr-text"><small>HẢI PHÒNG · KHÔNG GIAN KỶ NIỆM</small><h1>THPT An Dương</h1><p>Ký ức sân trường</p></div></header>
     {live.event==='teachers'&&<GreetingBadge onOpen={()=>{setGreet(true);setAlbum(false);setMap(false)}}/>}
     {live.event&&<EventPill event={live.event} note={live.note} onGo={()=>visit(EVENT_INFO[live.event].spot)}/>}
    </div>
    {/* góc phải trên: nhân vật & bản đồ (điện thoại: chỉ biểu tượng) */}
    <nav className="top-nav"><OnlineCount/><button onClick={()=>setOnboard('creator')} title={describeProfile(profile)} aria-label="Nhân vật"><span className="ico" aria-hidden="true">👤</span><span className="lbl">Nhân vật</span></button><button onClick={()=>{setMap(true);setAlbum(false)}} aria-label="Bản đồ"><span className="ico" aria-hidden="true">🗺️</span><span className="lbl">Bản đồ</span><kbd>M</kbd></button></nav>
    {IS_TOUCH&&!onboard&&!prep&&!overview&&!basket&&!lab&&!map&&!album&&!greet&&<TouchControls near={near}/>}
    {!overview&&near&&!album&&!map&&!onboard&&!prep&&!greet&&!basket&&!lab&&<div className="prompt memory-prompt"><kbd>E</kbd> Mở kỷ niệm sân trường</div>}
    <ChatDock>
     <PrivateChat position={position} enabled={!onboard&&!prep&&!overview&&!map&&!album&&!greet&&!basket&&!lab}/>
     {live.chatOpen&&<ChatPanel messages={live.chat} title={live.event?`Trò chuyện · ${EVENT_INFO[live.event].title}`:'Trò chuyện chung'}/>}
    </ChatDock>
    {greet&&<GreetingModal onClose={()=>setGreet(false)}/>}
    {map&&<div className="modal" role="dialog" aria-modal="true" aria-label="Bản đồ trường"><section className="map-panel"><button className="close" onClick={()=>setMap(false)} aria-label="Đóng bản đồ">×</button><small>KHUÔN VIÊN THEO ẢNH THAM CHIẾU</small><h2>Từ cổng trường qua hai hàng cau.</h2><div className="map-grid"><CampusMap position={position}/><div className="place-list"><p>Chọn điểm bắt đầu khám phá. Cầu thang đi bộ nối các tầng.</p>{data?.places.map(p=><button key={p.id} onClick={()=>visit(p.position)}>{p.label}<span>→</span></button>)}<button onClick={()=>visit(data?.spawn??[8,1,17])}>Về sân trường <span>→</span></button></div></div><p>Các vị trí và kích thước đang được ước lượng từ ảnh. Bàn ghế, phòng và cầu thang là bố trí cơ bản để khám phá, chưa phải bản đo hiện trạng.</p></section></div>}
    {album&&<MemoryAlbum onClose={()=>setAlbum(false)}/>}
    {basket&&<Suspense fallback={null}><BasketballGame game={basket} onClose={()=>setBasket(false)}/></Suspense>}
    {!onboard&&!overview&&<LabComputer onOpenChange={setLab}/>}
    <SchoolDrum/>{/* luôn gắn: bắt cú bấm đầu tiên (kể cả ở màn hình chào) để trình duyệt cho phát tiếng trống */}
    {onboard&&<Onboarding key={onboard} start={onboard} onEnter={enterSchool}/>}
  </main>
}
createRoot(document.getElementById('root'),{
 onUncaughtError(error){
  console.error(error);
  window.showStartupError();
 },
}).render(<App/>);

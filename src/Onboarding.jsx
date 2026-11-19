// Màn hình mở đầu: (1) chào mừng & giới thiệu chức năng, nền là ảnh sân khấu trường; (2) chọn nhân vật (xem trước 3D).
// Chọn xong → nhân vật xuất hiện ở cổng chính và tự đi vào sân trường.
import React,{useRef,useState} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import {AvatarBody} from './Avatar';
import {lookCode,getProfile,saveProfile,describeProfile,AO_DAI_COLORS,VEST_COLORS} from './profile';
import bg from './assets/welcome-stage.jpg';   // ảnh nền màn hình chào (tách khỏi thư mục ảnh nhật ký image/)

const YEARS=Array.from({length:30},(_,i)=>{const y=2026-i;return `${y-3} – ${y}`;});
const Key=({children})=><kbd className="ob-key">{children}</kbd>;

function Welcome({onNext,onContinue}){
 const saved=getProfile();
 return <section className="ob-card" aria-labelledby="ob-title">
  <small className="ob-eyebrow">CHÀO MỪNG VỀ TRƯỜNG</small>
  <h1 id="ob-title">THPT An Dương</h1>
  <p className="ob-sub">Ký ức sân trường · Hải Phòng</p>
  <p>Dạo quanh khuôn viên Trường THPT An Dương được dựng lại bằng 3D: sân trường, ba dãy lớp học, nhà đa năng, nhà xe, vườn STEM — và gặp lại bạn bè, thầy cô đang online.</p>
  <div className="ob-features">
   <p><b>🌸 20/11:</b> mở thiệp chúc mừng ở góc trái, gửi lời chúc tới thầy cô và xem sổ lời chúc của mọi người.</p>
   <p><b>💃 Sân khấu:</b> bước lên sân khấu ngoài sân hoặc trong nhà đa năng, nhấn <Key>F</Key> để thay chỗ một vũ công áo dài (mỗi nơi 10 chỗ).</p>
   <p><b>🪑 Ngồi nghỉ:</b> <Key>F</Key> ở ghế đá, xích đu, ghế nhà đa năng (bàn đại biểu dành cho thầy cô), bàn họp phòng giáo viên dãy B (chỉ thầy cô), ghế quán xôi.</p>
   <p><b>💻 Phòng tin học:</b> lên tầng 3 dãy B, <Key>F</Key> ngồi vào máy rồi nhấn <Key>G</Key> chơi game (Máy bay giấy, Ghép số, Xếp nhà cao tầng) — bảng xếp hạng chung mỗi ngày.</p>
   <p><b>🚲 Xe đạp điện:</b> <Key>F</Key> lấy xe trong nhà xe, đi ra cổng phụ rồi quay về đỗ vào ô trống.</p>
   <p><b>🏫 Cổng trường:</b> bác bảo vệ & đội Sao đỏ chào đón (6:00–8:00, 13:00–13:30) — đi muộn sẽ bị hỏi đấy! Bên kia đường có quán bánh mì, quán nước, quán xôi.</p>
   <p><b>🌙 Buổi tối:</b> trời tối theo giờ thật; có đêm nhạc DJ hoặc lửa trại do nhà trường tổ chức, kèm phòng trò chuyện chung.</p>
  </div>
  <ul className="ob-controls">
   <li><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> di chuyển · <Key>Shift</Key> chạy · <Key>Space</Key> nhảy</li>
   <li>Kéo chuột để xoay camera, lăn chuột để phóng to / thu nhỏ</li>
   <li><Key>F</Key> ngồi / tương tác · <Key>E</Key> xem ký ức sân trường · <Key>M</Key> bản đồ</li>
   <li>📱 Điện thoại: cần điều khiển góc trái dưới để đi (đẩy hết cỡ = chạy), kéo màn hình để xoay, nút <Key>F</Key> và nút nhảy ở góc phải dưới</li>
  </ul>
  {saved&&<p className="ob-saved">Chơi tiếp với nhân vật đã lưu: <b>{describeProfile(saved)}</b></p>}
  <div className="ob-actions">
   {saved?<>
    <button className="ob-secondary" onClick={onNext}>Đổi nhân vật</button>
    <button className="ob-primary" onClick={onContinue}>Vào trường</button>
   </>:<button className="ob-primary wide" onClick={onNext}>Tạo nhân vật →</button>}
  </div>
 </section>;
}

function Turntable({look}){
 const g=useRef();useFrame((_,dt)=>{if(g.current)g.current.rotation.y+=dt*.6;});
 return <group ref={g} position={[0,-.95,0]}><AvatarBody look={look}/></group>;
}
const Seg=({value,options,onChange,label})=><div className="ob-seg" role="radiogroup" aria-label={label}>
 {options.map(([v,t])=><button type="button" key={v} role="radio" aria-checked={value===v} className={value===v?'on':''} onClick={()=>onChange(v)}>{t}</button>)}
</div>;

function Creator({onBack,onEnter}){
 const saved=getProfile();
 const [f,setF]=useState(()=>saved??{role:'student',gender:'m',season:'summer',color:0,beard:true,name:'',cls:'',year:YEARS[0],subject:''});
 const set=(k,v)=>setF(x=>({...x,[k]:v}));
 const teacher=f.role==='teacher',look=lookCode(f),ok=f.name.trim().length>=2;
 const palette=f.gender==='f'?AO_DAI_COLORS:VEST_COLORS,colorName=(palette[f.color|0]??palette[0])[1].toLowerCase();
 const note=teacher?(f.gender==='f'?`Cô giáo: áo dài màu ${colorName}, tay ôm giáo án.`:`Thầy giáo: áo vest màu ${colorName}, cà vạt, tay xách cặp${f.beard!==false?', để râu':''}.`)
  :f.season==='winter'?'Đồng phục mùa đông: áo khoác xanh than phối sọc trắng, quần kaki.':'Đồng phục mùa hè: áo sơ mi trắng, quần xanh đậm.';
 return <section className="ob-card ob-creator" aria-labelledby="ob-c-title">
  <small className="ob-eyebrow">BƯỚC 2/2</small>
  <h2 id="ob-c-title">Nhân vật của bạn</h2>
  <div className="ob-grid">
   <div className="ob-preview"><Canvas camera={{position:[0,.15,3.3],fov:34}} dpr={[1,1.5]}>
    <ambientLight intensity={.9}/><directionalLight position={[2,3,4]} intensity={1.6}/><Turntable look={look}/>
   </Canvas></div>
   <form className="ob-form" onSubmit={e=>{e.preventDefault();if(ok)onEnter(saveProfile(f));}}>
    <Seg label="Vai trò" value={f.role} onChange={v=>set('role',v)} options={[['student','Học sinh'],['teacher','Giáo viên']]}/>
    <Seg label="Giới tính" value={f.gender} onChange={v=>set('gender',v)} options={[['m','Nam'],['f','Nữ']]}/>
    {teacher&&<div className="ob-swatches" role="radiogroup" aria-label={f.gender==='f'?'Màu áo dài':'Màu áo vest'}>
     <span>{f.gender==='f'?'Màu áo dài':'Màu áo vest'}</span>
     {palette.map(([c,n],i)=><button type="button" key={c} role="radio" aria-checked={(f.color|0)===i} aria-label={n} title={n} className={(f.color|0)===i?'on':''} style={{background:c}} onClick={()=>set('color',i)}/>)}
    </div>}
    {teacher&&f.gender==='m'&&<Seg label="Râu" value={f.beard!==false?'yes':'no'} onChange={v=>set('beard',v==='yes')} options={[['yes','Có râu'],['no','Không râu']]}/>}
    {!teacher&&<Seg label="Đồng phục" value={f.season} onChange={v=>set('season',v)} options={[['summer','Mùa hè'],['winter','Mùa đông']]}/>}
    <Seg label="Phương tiện đi lại" value={f.transport??'walk'} onChange={v=>set('transport',v)} options={[["walk","Đi bộ · Cổng chính"],["bike","Xe đạp · Cổng phụ"]]}/>
    <p className="ob-note">{note}</p>
    <label>Họ và tên<input value={f.name} onChange={e=>set('name',e.target.value)} maxLength={40} placeholder="VD: Nguyễn Văn An" autoFocus/></label>
    {teacher
     ?<label>Môn dạy<input value={f.subject} onChange={e=>set('subject',e.target.value)} maxLength={30} placeholder="VD: Ngữ văn (không bắt buộc)"/></label>
     :<div className="ob-row">
      <label>Lớp<input value={f.cls} onChange={e=>set('cls',e.target.value)} maxLength={12} placeholder="VD: 12A1"/></label>
      <label>Niên khóa<select value={f.year} onChange={e=>set('year',e.target.value)}>{YEARS.map(y=><option key={y}>{y}</option>)}</select></label>
     </div>}
    <p className="ob-summary">{ok?describeProfile(f):'Nhập họ và tên (ít nhất 2 ký tự) để vào trường'}</p>
    <div className="ob-actions">
     <button type="button" className="ob-secondary" onClick={onBack}>Quay lại</button>
     <button type="submit" className="ob-primary" disabled={!ok}>Vào trường</button>
    </div>
    <p className="ob-fine">Thông tin nhân vật được lưu trên máy bạn — lần sau vào lại không cần nhập lại. Người chơi khác ở gần sẽ thấy trang phục của bạn.</p>
   </form>
  </div>
 </section>;
}

export function Onboarding({start='welcome',onEnter}){
 const [step,setStep]=useState(start);
 return <div className="ob-screen" style={{backgroundImage:`linear-gradient(#1a0f0acc,#1a0f0ab3),url(${bg})`}}>
  {step==='welcome'
   ?<Welcome onNext={()=>setStep('creator')} onContinue={()=>onEnter(getProfile())}/>
   :<Creator onBack={()=>setStep('welcome')} onEnter={onEnter}/>}
 </div>;
}

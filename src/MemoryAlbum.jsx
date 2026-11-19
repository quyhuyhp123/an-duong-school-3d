// Album "Nhật ký sân trường" (nhấn E ở điểm ký ức): ảnh lấy từ thư mục image/ ở gốc dự án.
//  - Khung ảnh cố định (16:10): ảnh nào cũng cùng kích thước khung, chuyển ảnh không nhảy bố cục.
//  - Ảnh hiện trọn (không cắt) trên nền tối trơn; không có chữ chú thích (theo yêu cầu: chỉ để ảnh).
//  - Chuyển ảnh: nút ‹ ›, phím ← →, vuốt trên điện thoại, dải ảnh nhỏ bên dưới. Ảnh kề bên được tải trước.
// Chú thích: tên file ("Góc phố Việt trong nắng chiều-1.png" → "Góc phố Việt trong nắng chiều"); "Image (5).jpg" → "Kỷ niệm 6".
import React,{useEffect,useRef,useState} from 'react';
import song from '../music/GiacMoThanTien.mp3?url';
import {isMuted,onMuteChange,setAlbumAudio} from './eventAudio';
import manifest from './albumManifest.json';   // bản nén WebP do `npm run album` tạo (scripts/optimize-album.mjs)

// Nhạc nền album: phát khi mở hồi ức (nhấn E = thao tác người dùng nên trình duyệt cho phép phát), tắt khi đóng.
// Tôn trọng nút tắt tiếng chung của trang.
function useAlbumMusic(){
 useEffect(()=>{
  setAlbumAudio(true);
  const a=new Audio(song);a.loop=true;a.volume=.6;a.muted=isMuted();
  a.play().catch(()=>{});
  const off=onMuteChange(v=>{a.muted=v;});
  return()=>{off();a.pause();a.removeAttribute('src');a.load();setAlbumAudio(false);};
 },[]);
}

const files=Object.entries(import.meta.glob('../image/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',{eager:true,query:'?url',import:'default'}));
const num=s=>{const m=/(\d+)\D*$/.exec(s);return m?Number(m[1]):0;};
// tên file tiếng Việt có thể khác chuẩn Unicode (NFC/NFD) giữa hệ điều hành → so khớp sau khi chuẩn hoá
const packed=Object.fromEntries(Object.entries(manifest).map(([k,v])=>[k.normalize('NFC'),v]));
const BASE=import.meta.env.BASE_URL;
export const PHOTOS=files.map(([path,original])=>{
 const file=decodeURIComponent(path.split('/').pop()).normalize('NFC'),base=file.replace(/\.[^.]+$/,'');
 const generic=/^image(\s*\(\d+\))?$/i.test(base),m=packed[file];
 // ảnh đã nén: ~200 KB thay vì 1–3 MB; ảnh mới chưa chạy `npm run album` vẫn hiện bằng file gốc
 const url=m?BASE+m.full:original,thumb=m?BASE+m.thumb:original;
 return {url,thumb,file,generic,order:generic?(/\((\d+)\)/.exec(base)?.[1]|0):num(base),
  caption:generic?null:base.replace(/[-_\s]*\d+$/,'').trim()};
}).sort((a,b)=>(a.generic-b.generic)||(a.order-b.order)||a.file.localeCompare(b.file))
 .map((p,i,all)=>({...p,caption:p.caption??`Kỷ niệm ${all.filter(q=>q.generic).indexOf(p)+1}`}));

export function MemoryAlbum({onClose}){
 const [i,setI]=useState(0),n=PHOTOS.length,thumbs=useRef(),swipe=useRef(null);
 const go=d=>setI(v=>(v+d+n)%n);
 useAlbumMusic();
 useEffect(()=>{const k=e=>{if(e.code==='ArrowRight'){e.preventDefault();go(1);}if(e.code==='ArrowLeft'){e.preventDefault();go(-1);}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[n]);
 // tải trước ảnh kề bên → chuyển ảnh không phải chờ
 useEffect(()=>{for(const d of [1,-1,2]){const p=PHOTOS[(i+d+n)%n];if(p){const im=new Image();im.src=p.url;}}},[i,n]);
 // dải ảnh nhỏ: cuộn ảnh đang xem vào giữa
 useEffect(()=>{thumbs.current?.children[i]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});},[i]);
 if(!n)return <div className="modal" role="dialog" aria-modal="true" aria-label="Nhật ký sân trường"><section className="ma-card"><button className="close" onClick={onClose} aria-label="Đóng">×</button><h2>Chưa có ảnh nhật ký</h2><p>Thêm ảnh vào thư mục image/ của dự án.</p></section></div>;
 const p=PHOTOS[i];
 return <div className="modal ma-modal" role="dialog" aria-modal="true" aria-label="Nhật ký sân trường" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="ma-card">
   <header className="ma-head">
    <div><small>KÝ ỨC THPT AN DƯƠNG</small><h2>Nhật ký sân trường</h2></div>
    <span className="ma-count">{i+1} / {n}</span>
    <button className="close" onClick={onClose} aria-label="Đóng">×</button>
   </header>
   <div className="ma-stage"
    onPointerDown={e=>{swipe.current=e.clientX;}}
    onPointerUp={e=>{if(swipe.current==null)return;const dx=e.clientX-swipe.current;swipe.current=null;if(Math.abs(dx)>40)go(dx<0?1:-1);}}>
    <img key={i} className="ma-photo" src={p.url} alt={p.caption} draggable={false}/>
    {n>1&&<><button className="ma-nav prev" onClick={()=>go(-1)} aria-label="Ảnh trước">‹</button><button className="ma-nav next" onClick={()=>go(1)} aria-label="Ảnh tiếp theo">›</button></>}
   </div>
   <div className="ma-thumbs" ref={thumbs} role="tablist" aria-label="Chọn ảnh">
    {PHOTOS.map((q,k)=><button key={q.url} role="tab" aria-selected={k===i} aria-label={q.caption} className={k===i?'on':''} onClick={()=>setI(k)}><img src={q.thumb} alt="" loading="lazy" decoding="async" draggable={false}/></button>)}
   </div>
  </section>
 </div>;
}

// Điều khiển trên điện thoại: cần điều khiển góc trái dưới để đi (đẩy hết cỡ = chạy), nút góc phải dưới:
// F tương tác (ngồi, lấy xe, múa, chơi bóng rổ…), nhảy, chạy, và nút xem ký ức khi đứng ở điểm ký ức.
// Kéo phần còn lại của màn hình để xoay camera (xử lý trong World → Player).
import React,{useEffect,useRef,useState} from 'react';
import {touch,pressKey,resetTouch} from './device';

const R=46;   // bán kính hành trình núm điều khiển (px)

function Joystick(){
 const base=useRef(),[knob,setKnob]=useState([0,0]),origin=useRef(null);
 const update=e=>{const o=origin.current;if(!o)return;let dx=e.clientX-o.x,dy=e.clientY-o.y;const d=Math.hypot(dx,dy);if(d>R){dx*=R/d;dy*=R/d;}
  touch.x=dx/R;touch.y=dy/R;touch.active=d>6;setKnob([dx,dy]);};
 const down=e=>{e.preventDefault();base.current.setPointerCapture(e.pointerId);const r=base.current.getBoundingClientRect();origin.current={x:r.left+r.width/2,y:r.top+r.height/2};
  pressKey('KeyW');pressKey('KeyW','keyup');   // như bấm phím di chuyển: đang ngồi / múa thì đứng dậy, thôi tự đi
  update(e);};
 const up=()=>{origin.current=null;touch.x=touch.y=0;touch.active=false;setKnob([0,0]);};
 useEffect(()=>{window.addEventListener('blur',up);window.addEventListener('pagehide',up);document.addEventListener('visibilitychange',up);return()=>{window.removeEventListener('blur',up);window.removeEventListener('pagehide',up);document.removeEventListener('visibilitychange',up);resetTouch();};},[]);
 return <div ref={base} className="tc-stick" onPointerDown={down} onPointerMove={update} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} aria-label="Cần điều khiển di chuyển" role="application">
  <div className="tc-knob" style={{transform:`translate(${knob[0]}px,${knob[1]}px)`}}/>
 </div>;
}

function HoldButton({code,className,label,children}){
 const down=e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pressKey(code);},up=()=>pressKey(code,'keyup');
 return <button className={'tc-btn '+className} aria-label={label} onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onContextMenu={e=>e.preventDefault()}>{children}</button>;
}

export function TouchControls({near}){
 const [run,setRun]=useState(false);
 useEffect(()=>{const clear=()=>{resetTouch();setRun(false);pressKey('Space','keyup');pressKey('KeyF','keyup');pressKey('KeyE','keyup');};window.addEventListener('pagehide',clear);window.addEventListener('pageshow',clear);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);return()=>{clear();window.removeEventListener('pagehide',clear);window.removeEventListener('pageshow',clear);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};},[]);
 return <div className="tc-layer">
  <Joystick/>
  <div className="tc-buttons">
   {near&&<HoldButton code="KeyE" className="tc-small" label="Xem ký ức sân trường">📷</HoldButton>}
   <button className={'tc-btn tc-small'+(run?' on':'')} aria-pressed={run} aria-label="Chạy" onClick={()=>{touch.run=!run;setRun(!run);}}>🏃</button>
   <HoldButton code="Space" className="tc-jump" label="Nhảy">⤒</HoldButton>
   <HoldButton code="KeyF" className="tc-act" label="Tương tác (F)">F</HoldButton>
  </div>
 </div>;
}

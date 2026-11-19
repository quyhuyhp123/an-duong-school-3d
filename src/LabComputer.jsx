// Nút "Chơi game" khi ngồi ở ghế phòng tin học. Mã 3 game (LabGames.jsx) chỉ được tải khi người chơi bật máy.
import React,{Suspense,lazy,useEffect,useState} from 'react';
import {CREDITS_SEAT,LAB_GAMES,gameForSeat,machineNo} from './labInfo';
const GameScreen=lazy(()=>import('./LabGames').then(m=>({default:m.GameScreen})));
const CreditsScreen=lazy(()=>import('./LabGames').then(m=>({default:m.CreditsScreen})));
const isTyping=e=>e.target?.closest?.('input,textarea,select');
const Loading=()=><div className="modal lab-modal"><div className="lab-prompt" style={{position:'static',transform:'none'}}><span className="lab-led"/>Đang khởi động máy…</div></div>;

/** Đặt trong App: theo dõi ghế đang ngồi; ở ghế phòng tin học thì hiện nút bật máy và màn hình game. */
export function LabComputer({onOpenChange}){
 const [seat,setSeat]=useState(null),[open,setOpen]=useState(false);
 useEffect(()=>{const f=e=>{const id=e.detail;setSeat(typeof id==='string'&&id.startsWith('lab-')?id:null);if(!id)setOpen(false);};window.addEventListener('seat-change',f);return()=>window.removeEventListener('seat-change',f);},[]);
 useEffect(()=>{onOpenChange?.(open);},[open,onOpenChange]);
 useEffect(()=>{if(!seat||open)return;const k=e=>{if(isTyping(e)||e.repeat)return;if(e.code==='KeyG'){e.preventDefault();setOpen(true);}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[seat,open]);
 if(!seat)return null;
 const credits=seat===CREDITS_SEAT,game=gameForSeat(seat),machine=machineNo(seat),close=()=>setOpen(false);
 if(open)return <Suspense fallback={<Loading/>}>{credits?<CreditsScreen machine={machine} onClose={close}/>:<GameScreen game={game} machine={machine} onClose={close}/>}</Suspense>;
 return <div className="lab-prompt" role="status">
  <span className="lab-led"/><span>Máy {machine} · <b>{credits?'Màn hình đặc biệt':`${LAB_GAMES[game].icon} ${LAB_GAMES[game].title}`}</b></span>
  <button className="lab-btn" onClick={()=>setOpen(true)}>{credits?'Bật màn hình':'▶ Chơi game'} <kbd>G</kbd></button>
 </div>;
}

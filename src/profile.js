// Hồ sơ nhân vật của người chơi trên máy này (lưu trong trình duyệt, lần sau vào lại không cần nhập lại).
// {role:'student'|'teacher', gender:'m'|'f', season:'summer'|'winter', color (0-5, màu áo dài / vest của giáo viên), beard (thầy giáo có râu, mặc định có), name, cls, year, subject}
// Mã ngoại hình gửi lên server (1 số 0 → 127) để người khác thấy đúng trang phục:
//   bit 0 = giáo viên, bit 1 = nữ, bit 2 = đồng phục mùa đông (chỉ học sinh), bit 3-5 = màu áo giáo viên (0-5),
//   bit 6 = thầy giáo KHÔNG để râu (mặc định có râu → bit 0).
//   0 = học sinh nam mùa hè (mặc định).
import {useEffect,useState} from 'react';
import {setRole} from './role';

const KEY='an-duong-profile';
export const AO_DAI_COLORS=[['#6d5bd0','Tím'],['#c8102e','Đỏ'],['#1d6fb8','Xanh dương'],['#e75480','Hồng'],['#f2c14e','Vàng'],['#f4f1ea','Trắng']];
export const VEST_COLORS=[['#2b3240','Đen than'],['#1f2f5c','Xanh navy'],['#6b7078','Xám'],['#5a3e2b','Nâu'],['#3f5a3a','Xanh rêu'],['#b9a27e','Be']];
export const lookCode=p=>p?((p.role==='teacher'?1:0)|(p.gender==='f'?2:0)|(p.role!=='teacher'&&p.season==='winter'?4:0)|(p.role==='teacher'?(Math.min(5,Math.max(0,p.color|0))<<3):0)|(p.role==='teacher'&&p.gender!=='f'&&p.beard===false?64:0)):0;
export const decodeLook=c=>({teacher:!!(c&1),female:!!(c&2),winter:!!(c&4),color:(c>>3)&7,beard:!(c&64)});

let profile=(()=>{try{const p=JSON.parse(localStorage.getItem(KEY)||'null');return p&&p.name?p:null}catch{return null}})();
if(profile)setRole(profile.role);
const subs=new Set();
export const getProfile=()=>profile;
export function saveProfile(p){
 profile={transport:p.transport==='bike'?'bike':'walk',role:p.role==='teacher'?'teacher':'student',gender:p.gender==='f'?'f':'m',season:p.season==='winter'?'winter':'summer',color:Math.min(5,Math.max(0,p.color|0)),beard:p.beard!==false,
  name:String(p.name||'').trim().slice(0,40),cls:String(p.cls||'').trim().slice(0,12),year:String(p.year||''),subject:String(p.subject||'').trim().slice(0,30)};
 try{localStorage.setItem(KEY,JSON.stringify(profile))}catch{}
 setRole(profile.role);subs.forEach(f=>f(profile));return profile;
}
export function useProfile(){const [p,set]=useState(profile);useEffect(()=>{subs.add(set);return()=>{subs.delete(set)}},[]);return p;}
export const describeProfile=p=>!p?'':p.role==='teacher'
 ?`${p.gender==='f'?'Cô':'Thầy'} ${p.name}${p.subject?' · dạy '+p.subject:''}`
 :`${p.name}${p.cls?' · Lớp '+p.cls:''}${p.year?' · Niên khóa '+p.year:''}`;

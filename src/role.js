// Vai trò nhân vật của người chơi trên máy này: 'student' (học sinh) hoặc 'teacher' (thầy cô). Lưu trong trình duyệt.
import {useEffect,useState} from 'react';
const KEY='an-duong-role';
let role=(()=>{try{return localStorage.getItem(KEY)==='teacher'?'teacher':'student'}catch{return 'student'}})();
const subs=new Set();
export const getRole=()=>role;
export function setRole(r){role=r==='teacher'?'teacher':'student';try{localStorage.setItem(KEY,role)}catch{}subs.forEach(f=>f(role));}
export function useRole(){const [r,set]=useState(role);useEffect(()=>{subs.add(set);return()=>{subs.delete(set)}},[]);return r;}

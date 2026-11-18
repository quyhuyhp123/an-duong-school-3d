const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
export function characterIdentity(profile){const teacher=profile?.role==='teacher';return {name:clean(profile?.name,40),role:teacher?'teacher':'student',subject:teacher?clean(profile?.subject,30):'',cls:teacher?'':clean(profile?.cls,12),year:teacher?'':clean(profile?.year,24)};}

export function identityLabel(profile){
 const p=characterIdentity(profile);if(!p.name)return '';
 if(p.role==='teacher')return [`Giáo viên · ${p.name}`,p.subject?`Môn dạy: ${p.subject}`:''].filter(Boolean).join(' · ');
 return [p.name,p.cls?`Lớp ${p.cls}`:'',p.year?`Niên khóa ${p.year}`:''].filter(Boolean).join(' · ');
}

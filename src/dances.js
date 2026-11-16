// 3 điệu "quẩy bar" tự chế, nhảy theo nhịp nhạc DJ (beatNow() từ eventAudio).
// Mỗi điệu trả về góc các khớp: đùi (thigh), cẳng chân (shin), tay (arm, xoay quanh vai), độ nhún và xoay người.
// Quy ước khớp (cùng cách dựng nhân vật): rotation.x âm = đưa ra trước/lên trên; rotation.z cùng dấu với phía (s = -1 trái, +1 phải) = dang ra ngoài.
export const DANCES=[
 null,
 {name:'Bơm tay',hint:'Một tay đấm lên trời theo nhịp, nhún gối'},
 {name:'Lướt chân',hint:'Đá chân lướt hai bên, tay đánh theo'},
 {name:'Vỗ tay xoay vòng',hint:'Hai tay trên cao vỗ theo nhịp, xoay người'},
 {name:'Múa chào mừng',hint:'Bài múa tập thể trên sân khấu'},
];
export const STAGE_DANCE=4;
// Bài múa sân khấu: 4 động tác × 8 nhịp, lặp lại mỗi 32 nhịp — mọi người múa đồng loạt vì cùng theo nhịp nhạc
export const STAGE_MOVES=['Vẫy chào','Bông hoa nở','Sóng lúa','Xoay vòng cúi chào'];
export const stageMoveOf=b=>STAGE_MOVES[Math.floor((((b%32)+32)%32)/8)];
export const DANCE_COUNT=3;
export const randomDance=(except=0)=>{let d;do{d=1+Math.floor(Math.random()*DANCE_COUNT);}while(d===except&&DANCE_COUNT>1);return d;};

const P=Math.PI,TAU=Math.PI*2;
// Tư thế cho một bên (s = -1 trái, +1 phải) tại nhịp b
export function dancePose(id,b,out){
 const bounce=Math.abs(Math.sin(P*b));       // nhún mỗi nhịp
 const beat=Math.floor(b),t=b-beat;
 out.y=0;out.yaw=0;out.roll=0;out.sway=0;out.pitch=0;
 for(const s of [-1,1]){const k=s<0?'L':'R';out['thighX'+k]=0;out['thighZ'+k]=0;out['shin'+k]=0;out['armX'+k]=0;out['armZ'+k]=0;}
 if(id===1){ // BƠM TAY: tay "chính" đổi bên mỗi 8 nhịp, đấm lên trời; tay kia chống hông
  const main=Math.floor(b/8)%2?-1:1,pump=Math.pow(Math.sin(P*t),2);
  out.y=-.07*bounce;out.roll=.04*Math.sin(P*b);
  for(const s of [-1,1]){const k=s<0?'L':'R';
   out['thighX'+k]=-.28*bounce;out['shin'+k]=.55*bounce;
   if(s===main){out['armX'+k]=-2.5-.45*pump;out['armZ'+k]=s*.18;}
   else{out['armX'+k]=-.35;out['armZ'+k]=s*.75;}
  }
 }else if(id===2){ // LƯỚT CHÂN: mỗi nửa nhịp đá một chân chéo ra ngoài, người lắc theo, tay đánh trước-sau
  const half=Math.floor(b*2),side=half%2?1:-1,kick=Math.sin(P*((b*2)%1));
  out.y=-.05*Math.abs(Math.sin(TAU*b));out.sway=.09*side*kick;out.roll=-.07*side*kick;
  for(const s of [-1,1]){const k=s<0?'L':'R',active=s===side;
   out['thighX'+k]=active?-.55*kick:-.1;out['thighZ'+k]=active?s*.4*kick:0;out['shin'+k]=active?.25*kick:.2;
   out['armX'+k]=.8*Math.sin(P*b+(s<0?0:P));out['armZ'+k]=s*.25;
  }
 }else if(id===3){ // VỖ TAY XOAY VÒNG: hai tay trên cao, khép lại vỗ mỗi nhịp, xoay hông; cứ 8 nhịp quay một vòng
  const clap=Math.pow(1-t,6),phrase=b%8;
  out.y=-.06*bounce;
  out.yaw=phrase>=6?(phrase-6)/2*TAU:.45*Math.sin(P*b/2);
  for(const s of [-1,1]){const k=s<0?'L':'R';
   out['thighX'+k]=-.2*bounce;out['shin'+k]=.4*bounce;out['thighZ'+k]=s*.12;
   out['armX'+k]=-2.75;out['armZ'+k]=s*(.55-.5*clap)+.25*Math.sin(P*b/2);
  }
 }else if(id===4){ // MÚA CHÀO MỪNG (sân khấu)
  const lb=((b%32)+32)%32,phase=Math.floor(lb/8),pb=lb-phase*8; // nhịp trong động tác 0..8
  if(phase===0){ // VẪY CHÀO: hai tay dang cao vẫy luân phiên, người đung đưa
   out.sway=.06*Math.sin(P*b/2);out.y=-.04*bounce;
   for(const s of [-1,1]){const k=s<0?'L':'R',w=Math.sin(P*b+(s<0?0:P));
    out['armZ'+k]=s*(1.9+.5*w);out['armX'+k]=-.2;out['thighX'+k]=-.15*bounce;out['shin'+k]=.3*bounce;}
  }else if(phase===1){ // BÔNG HOA NỞ: tay từ khép trước ngực nở dần thành chữ V trên đầu, hạ gối rồi vươn lên
   const k01=(1-Math.cos(P*pb/2))/2; // 0→1→0 mỗi 2 nhịp
   out.y=-.1*(1-k01);out.yaw=.25*Math.sin(P*pb/4);
   for(const s of [-1,1]){const k=s<0?'L':'R';out['armX'+k]=-.5-2.3*k01;out['armZ'+k]=s*(.1+.5*k01);out['thighX'+k]=-.35*(1-k01);out['shin'+k]=.7*(1-k01);}
  }else if(phase===2){ // SÓNG LÚA: hai tay dang ngang uốn sóng, bước chéo trái phải
   const side=Math.sin(P*b/2);
   out.sway=.14*side;out.roll=-.08*side;out.y=-.03*bounce;
   for(const s of [-1,1]){const k=s<0?'L':'R';
    out['armZ'+k]=s*1.45;out['armX'+k]=.4*Math.sin(P*b+s*P/2);
    out['thighZ'+k]=s*Math.max(0,s*side)*.3;out['thighX'+k]=-.1;}
  }else{ // XOAY VÒNG CÚI CHÀO: 4 nhịp xoay một vòng tay dang, 4 nhịp cúi chào khán giả
   if(pb<4){out.yaw=pb/4*TAU;for(const s of [-1,1]){const k=s<0?'L':'R';out['armZ'+k]=s*1.3;out['armX'+k]=-.3;}}
   else{const bow=Math.sin(P*(pb-4)/4);out.pitch=.5*bow;for(const s of [-1,1]){const k=s<0?'L':'R';out['armX'+k]=s<0?-.9*bow:-.2;out['armZ'+k]=s<0?.35*bow:s*.25;out['thighX'+k]=-.1*bow;}}
  }
 }
 return out;
}

// Áp tư thế lên một nhân vật có các group tên 'thigh', 'shin', 'arm' (bên trái có position.x < 0). weight 0..1 để chuyển mượt.
export function applyDance(root,pose,weight){
 root.traverse(o=>{
  if(o.name!=='thigh'&&o.name!=='shin'&&o.name!=='arm')return;
  const k=(o.name==='shin'?o.parent.position.x:o.position.x)<0?'L':'R';
  if(o.name==='thigh'){o.rotation.x=o.rotation.x*(1-weight)+pose['thighX'+k]*weight;o.rotation.z=o.rotation.z*(1-weight)+pose['thighZ'+k]*weight;}
  else if(o.name==='shin')o.rotation.x=o.rotation.x*(1-weight)+pose['shin'+k]*weight;
  else{o.rotation.x=pose['armX'+k]*weight;o.rotation.z=pose['armZ'+k]*weight;}
 });
}

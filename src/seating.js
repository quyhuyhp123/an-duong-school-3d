export const isSharedBench=seat=>!!seat&&/^(bench|iron)-/.test(seat.id);
export const seatCapacity=seat=>seat?.id?.startsWith('iron-')?3:2;
export const seatOffset=(seat,slot)=>(slot-(seatCapacity(seat)-1)/2)*.86;
export function sameSeat(a,b){
 if(!a||!b)return false;
 return a.id!=null||b.id!=null?a.id!=null&&a.id===b.id:a.swing!=null&&a.swing===b.swing;
}

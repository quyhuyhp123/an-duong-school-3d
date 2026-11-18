export const WHEELIE_FLAG=64;
export const isWheelie=mode=>!!(mode&WHEELIE_FLAG)&&((mode>>3)&7)===7;
// Rotate bike and rider together around the rear tire contact axis (+Z is forward).
export function wheelieTransform(amount,out={}){
 const pitch=-.52*amount,s=Math.sin(pitch),c=Math.cos(pitch);
 out.pitch=pitch;out.y=.3-.3*c-.58*s;out.z=-.58-.3*s+.58*c;return out;
}

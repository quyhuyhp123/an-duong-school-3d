export const WHEELIE_FLAG=64;
export const BIKE_FIRE_FLAG=128;
// Bit 2 is used for ground sitting only outside the bicycle mode.
export const BIKE_SPIN_FLAG=4;
export const BIKE_SPIN_SPEED=4.2;
export const isBikeSpinning=mode=>((mode>>3)&7)===7&&!!(mode&BIKE_SPIN_FLAG);
export const hasBikeFire=mode=>!!(mode&BIKE_FIRE_FLAG)&&((mode>>3)&7)===7;
export const isWheelie=mode=>!!(mode&WHEELIE_FLAG)&&((mode>>3)&7)===7;
// Shift the bike's centre so its rear wheel stays on the original ground point.
export function rearWheelSpinOffset(yaw,anchorYaw,out={}){
 out.x=.58*(Math.sin(yaw)-Math.sin(anchorYaw));
 out.z=.58*(Math.cos(yaw)-Math.cos(anchorYaw));return out;
}
// Rotate bike and rider together around the rear tire contact axis (+Z is forward).
export function wheelieTransform(amount,out={}){
 const pitch=-.52*amount,s=Math.sin(pitch),c=Math.cos(pitch);
 out.pitch=pitch;out.y=.3-.3*c-.58*s;out.z=-.58-.3*s+.58*c;return out;
}

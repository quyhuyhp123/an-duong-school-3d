// Vị trí nhân vật của chính người chơi trên máy này (cập nhật mỗi khung hình trong World → Player).
// Dùng cho các nhân vật/điểm tương tác cần biết người chơi đang ở đâu (VD: bác bảo vệ nhà xe).
export const localPlayer={x:0,y:0,z:0,ready:false};
export function setLocalPlayer(x,y,z){localPlayer.x=x;localPlayer.y=y;localPlayer.z=z;localPlayer.ready=true;}

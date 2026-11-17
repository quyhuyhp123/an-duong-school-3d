// Nhận biết thiết bị cảm ứng (điện thoại / máy tính bảng) để: hiện cần điều khiển ảo, giảm chất lượng đồ hoạ cho nhẹ.
export const IS_TOUCH=typeof window!=='undefined'&&(window.matchMedia?.('(pointer: coarse)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
// Trạng thái cần điều khiển ảo (TouchControls ghi, Player đọc mỗi bước vật lý). x/y trong khoảng -1 → 1 (y âm = đi tới).
export const touch={x:0,y:0,active:false,run:false};
// Bắn phím ảo để các nút cảm ứng dùng chung đường xử lý với bàn phím (F tương tác, Space nhảy, E xem ký ức…)
export function pressKey(code,type='keydown'){window.dispatchEvent(new KeyboardEvent(type,{code,key:code.replace(/^Key/,'').toLowerCase()}));}

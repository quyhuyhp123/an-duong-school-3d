# THPT An Dương — khuôn viên 3D có thể đi vào phòng và lên mái

## Chạy

```sh
npm install
npm run dev
```

Mở địa chỉ Vite in ra. Chọn **Vào sân trường** để đi dạo; **Xem toàn cảnh** để xoay cả mô hình.

- WASD / phím mũi tên: đi; Shift: chạy; Space: nhảy ở mọi tầng.
- Kéo chuột: xoay camera; cuộn: thu/phóng. Camera tự thu gần khi gặp tường hoặc trần.
- M: bản đồ. Chọn một dãy để bắt đầu ở phía trước lối cầu thang của dãy đó.
- R: về sân. E: xem album khi gần sân khấu; Escape: đóng bảng.
- Vào lớp bằng cửa mở. Dãy A có cầu thang dưới vòm **TIÊN HỌC LỄ - HẬU HỌC VĂN**, hành lang ở khoang này nới rộng ra phía sân. Dãy B có cầu thang ở giữa phần tòa nhà còn lại. Đi lên vế đầu, qua chiếu nghỉ, quay lại vế tiếp theo và đi tiếp lên mái.

## Bản 0.2

- Bổ sung nhà gần cổng, đường phía sau dãy phải, cổng phụ, nhà xe và nhà đa năng.
- Thay mái đỏ bằng mái bằng có lan can, chừa lỗ cầu thang lên mái.
- Dãy chính có nhịp vòm, cột, cửa gỗ, song cửa, biển trường, hai mảng khẩu hiệu cong, mái đón bằng.
- Khẩu hiệu trên vòm đã tăng cỡ chữ, đưa ra phía trước và cao hơn viền mái; viền mái tại dãy chính dùng màu kem.
- Rút ngắn dãy trái theo ảnh đánh dấu, bổ sung nhà lấy nước một tầng và hòn non bộ có đài phun nước phía trước. Vườn gần cổng không còn cây dừa; hai hàng cau thẳng được đặt ngoài vườn, cạnh sân bóng chuyền.
- Vườn và sân bóng chuyền được nới sát hai hàng cau; tán cau dùng lá kép mảnh. Phía sau sân bóng có giàn hoa giấy và hai xích đu theo ô xanh trong ảnh đánh dấu.
- Biển trường và phông sân khấu sử dụng UV từ ảnh thực tế `image/stage-detail.jpg`, đã nhúng vào GLB và đóng gói trong Blender. Phông là mặt ảnh trên hình học 3D, không phải toàn bộ ảnh chụp dựng thành vật thể nổi.
- 77 phòng mô phỏng phân bố trong bốn dãy A/B/C/D. Đây là số phòng của mô hình, không phải số phòng thực tế được xác nhận.
- Phòng có bảng và bàn ghế cơ bản; có lối đi từ cửa tới cuối lớp.
- Cầu thang thực nối từng tầng và mái của A/B/C/D; nhà đa năng có cửa vào, sân trong và cầu thang ngoài lên mái.
- Va chạm xuất cùng mô hình từ các sàn, tường, bậc và đồ nội thất. Không còn dùng khối hộp kín bao cả tòa nhà.
- Chuyển điều khiển sang Rapier kinematic character controller, có bước bậc, bám nền và nhảy trên tầng cao.

## File

- `blender/an-duong-school.blend`: bản chỉnh sửa Blender.
- `public/models/an-duong-school.glb`: model web.
- `public/models/campus-data.json`: collider, cửa lớp, tuyến cầu thang và điểm bản đồ, cùng hệ tọa độ web Y-up.
- `scripts/build_school.py`: dựng cảnh và xuất model/dữ liệu.
- `scripts/interiors.py`: dựng các dãy có nội thất và cầu thang.
- `src/World.jsx`: tải model, va chạm và camera.
- `src/character-controller.js`: xử lý di chuyển dùng chung với kiểm thử.
- `preview/campus-overview.png`, `preview/courtyard.png`, `preview/classroom.png`, `preview/stage-detail.png`, `preview/stair-bay.png`: render toàn cảnh và cận cảnh.
- `preview/traversal-results.json`: kết quả kiểm thử đường đi.
- `image/`: ảnh gốc và hai ảnh tham chiếu mới.
- `blender/*-v1.*`, `scripts/build_school_v1.py`: bản trước khi sửa để đối chiếu.

## Dựng lại và kiểm tra

```powershell
& 'D:/Blender/blender.exe' --background --factory-startup --python D:/AD_3D/scripts/build_school.py
npm run test:traversal
npm run build
```

Script thay thế các file đầu ra. Nếu chuyển thư mục, sửa `ROOT` ở đầu script. Khi xuất model mới, tăng `MODEL_VERSION` trong `src/World.jsx` để tránh cache model/collider cũ.

Kiểm thử tự động dùng chính collider và bộ điều khiển của web: qua cửa vào/ra cả 86 phòng, đi sâu vào lối đi trong lớp, leo các tầng đến mái rồi xuống ở bốn dãy, vào nhà đa năng, lên mái nhà đa năng, qua cổng phụ, nhảy và hạ xuống cùng tầng.

## Mức độ khớp ảnh

Bố cục mới dựa trên ảnh khoanh khuôn viên và mô tả vị trí các công trình. Khoảng cách, số nhịp, số phòng và nội thất còn là ước lượng. Phòng và cầu thang được bố trí để trải nghiệm đi lại; chưa có ảnh nội thất hoặc số đo để xác nhận vị trí đúng hiện trạng. Chế độ đi bộ hiện dành cho bàn phím/chuột; chưa có multiplayer/chat hay hệ thống nhiệm vụ.


## Multiplayer và tương tác đôi

- Chạy `npm run dev` để thử trong mạng nội bộ. Hai người phải mở cùng địa chỉ IP của máy chủ (không dùng localhost trên máy người thứ hai).
- Sau khi build, `npm start` phục vụ cả website và WebSocket trên cổng 5173. Triển khai công khai cần máy chủ hỗ trợ WebSocket và HTTPS; hosting chỉ chứa file tĩnh sẽ không chạy multiplayer.
- Mỗi xích đu có hai chỗ được máy chủ giữ độc quyền. Đến gần, nhấn F để ngồi vào chỗ trống.
- Khi có người bên cạnh, chọn nắm tay, tựa đầu hoặc hôn nhẹ. Người kia phải đồng ý; lời mời hết hạn sau 20 giây. Đứng lên, đổi tư thế, ngắt kết nối hoặc bấm Dừng tương tác đều kết thúc tư thế đôi.
- Đây là phiên multiplayer trong bộ nhớ, chưa có tài khoản hoặc lưu trạng thái. Các tư thế đôi là hoạt ảnh cách điệu cơ bản.
- Kiểm tra giao thức: `npm run test:multiplayer`.

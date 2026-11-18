# Khả năng phục vụ người chơi qua Cloudflare

Kiểm tra ngày 18/11/2026, giờ Việt Nam (UTC+7).

## Cách triển khai đang chạy

Tiến trình trên máy dùng `cloudflared tunnel --url http://localhost:5173`.
Đây là **Quick Tunnel**, chuyển tiếp về máy chủ Node trên máy tính này, không phải toàn bộ game chạy trên Workers/Pages.

Cloudflare công bố Quick Tunnel giới hạn **200 yêu cầu đang xử lý đồng thời**, vượt giới hạn trả HTTP 429 và không có cam kết uptime. Mỗi người chơi duy trì một WebSocket; tải trang/model/API cũng tạo thêm yêu cầu. Vì vậy **không thể coi 200 yêu cầu là 200 người chơi ổn định**, và không nên dùng link thử nghiệm này để tổ chức 500 người cùng chơi.

Nguồn: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/

WebSocket có trên mọi gói Cloudflare. Tài liệu WebSocket hiện không đưa ra một số người chơi tối đa cố định cho gói Free. Tunnel có tên miền cố định cũng không tự tăng CPU hay tốc độ upload của máy chủ gốc.

Nguồn: https://developers.cloudflare.com/network/websockets/

## Kết quả đo máy chủ cục bộ

Máy: Intel Core i5-14600KF, 20 luồng logic. Máy chủ riêng và dữ liệu tạm; không tạo tải lên link công khai hoặc thay đổi dữ liệu người dùng. Bốn tiến trình giả lập người chơi, gửi vị trí 10 lần/giây, mỗi mức đo 10 giây sau khởi động ổn định.

| Kịch bản | CPU máy chủ (% một lõi) | RAM | Băng thông gửi | Độ trễ cập nhật p95 | Cập nhật 10 người gần nhất |
|---|---:|---:|---:|---:|---:|
| 100 người rải khắp trường | 4,5% | 69 MB | 1,09 MB/s (~8,7 Mbps) | 1 ms | 9,70 lần/s |
| 200 người rải khắp trường | 6,9% | 81 MB | 3,30 MB/s (~26,4 Mbps) | 1 ms | 9,60 lần/s |
| 500 người rải khắp trường | 19,2% | 103 MB | 11,23 MB/s (~89,8 Mbps) | 3 ms | 9,00 lần/s |
| 500 người tập trung, 2% giả lập kết nối chậm | 21,7% | 169 MB | 10,45 MB/s (~83,6 Mbps) | 3 ms | 9,03 lần/s |

Đạt 44/44 tiêu chí của bài đo. Báo cáo gốc nằm tại `preview/load-capacity-2026-11-18.json` (tên dùng UTC, tương ứng 18/11 tại Việt Nam).

Đây là **kiểm thử ngắn trên localhost**, không phải cam kết 500 người qua Internet. Chưa đo độ trễ Cloudflare, upload thực tế, tải đồng thời model/ảnh/nhạc, FPS của 500 trình duyệt thật hoặc toàn bộ tương tác đôi. Các con số băng thông ở trên chưa tính lượt tải tài nguyên ban đầu và overhead mạng. Máy chủ hiện mặc định chặn ở `MAX_PLAYERS=800`; đó là cấu hình giới hạn, không phải năng lực đã được chứng minh.

## Mức sử dụng thực tế

- Với Quick Tunnel hiện tại: bắt đầu thử nhóm 50–100 người, theo dõi 429 và chất lượng mạng; đây là mức thử đề xuất, không phải bảo đảm dung lượng.
- Muốn tổ chức vài trăm người: dùng máy chủ luôn bật, tên miền/Tunnel cố định hoặc Cloudflare proxy, CDN cho model/ảnh/nhạc, và kiểm thử tải Internet trước sự kiện. Riêng 500 người theo bài đo cần khoảng 90 Mbps upload liên tục chỉ cho vị trí, cộng tài nguyên và phần dự phòng.
- Không có cơ sở để trả lời một con số tối đa chính xác chỉ dựa vào chữ “Cloudflare Free”.

Tái hiện bài đo trong PowerShell:

```powershell
$env:LOAD_STEPS='100,200,500'
$env:LOAD_HOLD_MS='10000'
node scripts/load-test.mjs
```

# Kết quả kiểm thử tải sau tối ưu (16/11/2026)

Chạy bằng `npm run test:load` (giữ mỗi mức 20 s). Server chạy trong tiến trình riêng, cổng ngẫu nhiên, dữ liệu tạm. Người chơi ảo chạy trong 4 tiến trình khác **trên cùng máy** (Intel Core Ultra 7 155H, Windows). Mỗi người ảo gửi vị trí nhị phân 10 lần/giây, giải mã mọi gói nhận được, có chat; ở pha sân khấu có 2% kết nối ngừng đọc. Báo cáo JSON đầy đủ nằm ở `.tools/load-test/`.

## 500 người: đạt 44/44 tiêu chí

| Kịch bản | CPU server (1 lõi) | Vòng lặp p95 | Lát tick dài nhất | Ra (server) | Tải xuống / người | Độ trễ cập nhật p95 | 10 người gần nhất | Thấy được |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 · rải khắp trường | 9% | 24 ms | 2 ms | 0,8 MB/s | 7 KB/s | 2 ms | 9,8 lần/s | 100% |
| 250 · rải khắp trường | 16% | 24 ms | 4 ms | 3,7 MB/s | 15 KB/s | 3 ms | 9,7 lần/s | 100% |
| 500 · rải khắp trường | 36% | 29 ms | 6 ms | 9,3 MB/s | 18 KB/s | 6 ms | 9,3 lần/s | 100% |
| 500 · **dồn về sân khấu** | 46% | 42 ms | 18 ms | 8,5 MB/s | 17 KB/s | 8 ms | 9,0 lần/s | 97,8%* |

\* Người ở sân khấu thấy 100% người đang di chuyển. Phần còn thiếu là 10 kết nối "chậm" bị dừng đọc có chủ đích.

Trong đám đông sân khấu, những người cách 10–20 m được cập nhật khoảng 2,9 lần/giây (được nội suy mượt trên màn hình). Người gần nhất vẫn ~9 lần/giây.

So với trước tối ưu (CAPACITY-REVIEW.md): server cũ bão hoà ở khoảng **55–60 người**, tốn 128 MB/s ở 55 người.

## 700 người: server tự giảm tải, không sập

| Kịch bản | CPU | Nhịp tick | Độ trễ p95 | 10 người gần nhất | Kết quả |
|---|---:|---:|---:|---:|---|
| 700 · rải khắp trường | 72% | tự hạ 6,7 Hz | 14 ms | 7,5 lần/s | Hoạt động, vòng lặp p95 54 ms (vượt nhẹ ngưỡng 50 ms) |
| 700 · dồn về sân khấu | 57% | tự hạ 8 Hz | 9 ms | 7,1 lần/s | Hoạt động |

Profile CPU ở 700 người: khoảng **64% thời gian bận nằm ở lệnh gửi socket của hệ điều hành** (`writev`), không phải code xử lý. Máy chủ Linux thường rẻ hơn Windows ở bước này, nhưng **chưa đo được**. Cần chạy lại kiểm thử trên máy staging Linux thật.

## Biến động giữa các lần chạy

Cùng cấu hình 500 người, ba lần chạy cho vòng lặp p95 là 36 / 49 / 62 ms và CPU 40–67%. Lý do: máy tạo tải và server dùng chung CPU, cộng với độ phân giải hẹn giờ ~15,6 ms của Windows. Các chỉ số chất lượng cho người dùng (độ trễ cập nhật, tần suất, băng thông, độ phủ) ổn định giữa các lần.

## Những gì CHƯA được kiểm thử

- **Đồ hoạ trên trình duyệt** (FPS khi vẽ 500 nhân vật): đã chuyển sang instancing 3 mức chi tiết (~3 lệnh vẽ cho cả đám đông + tối đa 16 nhân vật chi tiết), nhưng chưa đo FPS thật trên điện thoại hay laptop.
- Mạng Internet thật (độ trễ, mất gói, 4G), TLS, CDN, Nginx.
- Chạy liên tục 30–60 phút, nhiều người vào/ra cùng lúc khi server khởi động lại.
- Máy chủ Linux thật.

Xem hướng dẫn chạy trên staging trong [DEPLOY.md](DEPLOY.md#kiểm-thử-trước-khi-mở-cho-cả-trường).

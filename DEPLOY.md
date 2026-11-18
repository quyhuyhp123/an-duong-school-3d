# Triển khai cho 500–700 người cùng lúc

> **Cài nhanh, miễn phí trên Oracle Cloud + Cloudflare:** xem [deploy/oracle/README.md](deploy/oracle/README.md) (script tự động `deploy/oracle/setup.sh`).

## Kiến trúc

```
Người dùng ──► CDN (Cloudflare/Bunny…) ──► Nginx (TLS, proxy) ──► Node: server/start.mjs  (1 tiến trình)
                 │ cache: /assets, /models, ảnh                    │ website + /api + /multiplayer (WebSocket)
                 └ KHÔNG cache: /api, /multiplayer, /metrics        └ data/ (đĩa bền, có sao lưu)
```

Một khuôn viên chung cho tất cả mọi người chạy trên **một tiến trình Node**. Không chạy nhiều bản (cluster/PM2 nhiều instance), vì mỗi bản sẽ là một "trường" riêng, không thấy nhau.

## Máy chủ đề xuất (điểm khởi đầu, cần đo lại trên máy thật)

- 4 vCPU, 4–8 GB RAM, Linux. Node chỉ dùng 1 lõi cho phần thời gian thực; các lõi còn lại lo nén file, TLS (Nginx) và hệ điều hành.
- Băng thông ra: khoảng **10–15 MB/s (80–120 Mbit/s) khi có 500–700 người**, đo trong kiểm thử tải, chưa tính TLS. Chọn gói có cổng mạng ≥ 200 Mbit/s và đủ lưu lượng tháng.
- Model 3D (~20 MB) và ảnh phải đi qua CDN. Nếu không, 500 người tải lần đầu sẽ kéo khoảng 10 GB từ máy chủ.

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | 5173 | Cổng Node |
| `ADMIN_PASSWORD` | tự tạo | Mật khẩu trang quản lý (nên đặt khi chạy thật) |
| `DATA_DIR` | `data` | Thư mục lưu lời chúc, chat, cấu hình sự kiện. Đặt trên **đĩa bền** |
| `MAX_PLAYERS` | 800 | Số người online tối đa. Người tiếp theo nhận thông báo "trường đang quá đông" và tự thử lại |
| `TRUST_PROXY` | 0 | Số proxy tin cậy phía trước: chỉ Nginx = `1`, Cloudflare + Nginx = `2` |
| `CLIENT_IP_HEADER` | — | Header chứa IP thật do proxy đặt, ví dụ `cf-connecting-ip`. Chỉ có tác dụng khi `TRUST_PROXY>0` |
| `ALLOWED_ORIGINS` | cùng host | Tên miền được phép mở WebSocket, ví dụ `https://anduong.example.vn` |
| `METRICS_TOKEN` | — | Bật `/metrics` từ xa (Bearer token). Không đặt thì chỉ localhost đọc được |
| `ASSET_BASE_URL` | `/` | **Lúc build**: URL CDN cho JS/CSS/ảnh/model, ví dụ `https://cdn.anduong.example.vn/` |
| `PER_TICK_BUDGET` / `FULL_RATE_BUDGET` | 160 / 48 | Số người tối đa trong mỗi gói / số người gần nhất được cập nhật 10 lần/giây |
| `MAX_MUSIC_MB` | 40 | Dung lượng tối đa một file nhạc admin tải lên (lưu ở `DATA_DIR/music/`) |
| `MONITOR_LOG` | 1 | `0` để tắt dòng log `[monitor]` mỗi phút |

> **Vì sao phải đặt `TRUST_PROXY`:** khi chạy sau proxy, mọi request đều đến từ IP của proxy. Nếu không đặt, giới hạn chống spam lời chúc và khoá đăng nhập admin sẽ chặn nhầm **cả trường**. Ngược lại, chỉ đặt khi thật sự có proxy; nếu không, người dùng có thể giả mạo IP qua header.

## Các bước

```bash
npm ci
ASSET_BASE_URL=https://cdn.anduong.example.vn/ npm run build   # bỏ ASSET_BASE_URL nếu CDN proxy cả tên miền chính
ADMIN_PASSWORD='…' TRUST_PROXY=1 DATA_DIR=/var/lib/anduong ALLOWED_ORIGINS=https://anduong.example.vn npm start
```

Chạy như một dịch vụ (systemd), tự khởi động lại khi lỗi. Server tự tắt êm khi nhận SIGTERM.

## Proxy (Nginx)

Mẫu cấu hình: [deploy/nginx.conf](deploy/nginx.conf). Những điểm bắt buộc:
- `/multiplayer`: `proxy_http_version 1.1`, header `Upgrade`/`Connection`, `proxy_read_timeout` ≥ 60 s (server ping mỗi 20 s), `proxy_buffering off`.
- Truyền `X-Forwarded-For`, rồi đặt `TRUST_PROXY=1`.
- `/metrics` chỉ mở cho máy giám sát.

## CDN

**Cách đơn giản (Cloudflare proxy cả tên miền):** bật proxy (mây cam) cho tên miền và đặt `TRUST_PROXY=2` (hoặc `CLIENT_IP_HEADER=cf-connecting-ip`). Server đã gửi sẵn header cache phù hợp:

| Đường dẫn | Cache-Control | Ghi chú |
|---|---|---|
| `/assets/*` | 1 năm, `immutable` | Tên file có mã băm, build mới là tên mới |
| `/models/*`, ảnh | 7 ngày | URL model có `?v=MODEL_VERSION`. **Đổi `MODEL_VERSION` trong World.jsx mỗi khi đổi model** |
| `*.html` | `no-cache` | Luôn kiểm tra lại (304 nếu không đổi) |
| `/api/*`, `/multiplayer`, `/metrics`, `/healthz` | `no-store` | Tạo Cache Rule "Bypass cache" cho các đường dẫn này |

**Nhạc DJ** phát từ `/media/music/<id>.<đuôi>` với cache 1 năm (mỗi bài có id riêng). Cloudflare tự cache theo đuôi mp3/ogg/wav/m4a, nên 500 người nghe chỉ tải từ máy chủ gốc một lần. Nếu dùng tên miền CDN riêng, thêm `/media/*` vào pull-zone. Tải lên qua Nginx cần `client_max_body_size` lớn cho `/api/admin/music` (đã có trong mẫu).

Cloudflare tự hỗ trợ WebSocket; Network → WebSockets phải đang bật.

**Cách tách tên miền CDN (Bunny/CloudFront):** tạo pull-zone trỏ về máy chủ gốc, rồi build với `ASSET_BASE_URL=https://cdn…/`. Trang HTML, API và WebSocket vẫn ở tên miền chính. Server đã gửi `Access-Control-Allow-Origin: *` cho file tĩnh để tải chéo tên miền.

**Nên làm thêm:** ảnh trong `image/` đang là PNG 3–6 MB mỗi ảnh. Chuyển sang WebP/AVIF ~300 KB sẽ giảm mạnh dung lượng tải và chi phí CDN.

## Lưu dữ liệu

- File JSON trong `DATA_DIR`. Ghi nguyên tử (file tạm → fsync → đổi tên), bộ nhớ đệm chỉ đổi khi ghi đĩa thành công.
- File hỏng thì server **từ chối ghi đè** và in lỗi, để bạn khôi phục từ file `.bak` (sao lưu tự động tối đa 10 phút/lần).
- Chat được ghi gộp mỗi 0,5 giây. Sự kiện và lời chúc ghi ngay, trả lời người dùng sau khi đã lưu.
- **Sao lưu ngoài máy:** chép `DATA_DIR` sang nơi khác mỗi ngày (cron + rclone/S3) và thử khôi phục ít nhất một lần.
- Giới hạn còn lại: phù hợp cho một tiến trình và vài nghìn lời chúc. Nếu cần chạy nhiều máy hoặc lưu lâu dài nhiều dữ liệu, chuyển sang PostgreSQL/SQLite.

## Giám sát

- **Trang quản lý → Hệ thống:** số người online, nhịp tick (10 Hz, hoặc thấp hơn khi server đang tự giảm tải), độ trễ vòng lặp, băng thông, bộ nhớ, kết nối chậm bị ngắt, lỗi lưu dữ liệu.
- **`/healthz`:** cho bộ kiểm tra của hosting hoặc Uptime Kuma (báo khi server chết).
- **`/metrics`:** định dạng Prometheus cho Grafana. Các chỉ số nên đặt cảnh báo:

| Chỉ số | Cảnh báo khi |
|---|---|
| `school_event_loop_p95_ms` | > 100 trong 5 phút |
| `school_tick_hz` | < 10 kéo dài (server đang quá tải, cân nhắc giảm `MAX_PLAYERS`) |
| `school_slow_clients_dropped` | tăng nhanh (mạng người dùng hoặc máy chủ nghẽn) |
| `school_storage_errors` | > 0 (lỗi đĩa, cần xử lý ngay) |
| `school_rss_mb` | > 1500 |

- Log `[monitor]` mỗi phút trong output của tiến trình.

## Kiểm thử trước khi mở cho cả trường

1. `npm test`: kiểm thử chức năng + hạ tầng.
2. `npm run test:load`: chạy một server riêng trên máy của bạn và tăng tải 100 → 250 → 500 người, kèm kịch bản cả trường dồn về sân khấu.
3. **Trên máy staging thật**, chạy từ một máy khác:
   `LOAD_URL=wss://staging…/multiplayer LOAD_STEPS=100,250,500,700 LOAD_HOLD_MS=600000 node scripts/load-test.mjs`.
   **Không** bắn vào server đang có người dùng thật.
4. Mở thử bằng điện thoại và laptop yếu khi có 500 người ảo để đo FPS thật. Phần đồ hoạ chưa được đo trong kiểm thử tự động.

# Đưa An Dương 3D lên Oracle Cloud (miễn phí)

Kiến trúc: **Người dùng → Cloudflare (miễn phí: https, lưu đệm mô hình 3D, chống tấn công) → 1 máy ảo Oracle "Always Free"**
chạy Caddy (https) + Node `server/start.mjs` (trang web, API, WebSocket, dữ liệu JSON trong `/var/lib/anduong`).

Chi phí: 0 đồng (trừ tên miền nếu mua, ~200–300 nghìn/năm).

---

## Phần 1 — Bạn tự làm trên web (khoảng 30–45 phút)

### 1. Tạo tài khoản Oracle Cloud
1. Vào <https://www.oracle.com/cloud/free/> → **Start for free**.
2. **Home Region**: chọn **Singapore** (gần Việt Nam nhất). *Không đổi được về sau.*
3. Cần thẻ Visa/Mastercard để xác minh (Oracle tạm giữ ~1 USD rồi hoàn lại, **không trừ tiền** nếu chỉ dùng tài nguyên Always Free).

### 2. Tạo máy ảo
**Compute → Instances → Create instance**
- **Image**: Canonical **Ubuntu 22.04** (hoặc 24.04).
- **Shape**: *Change shape* → **Ampere** → `VM.Standard.A1.Flex` → **2 OCPU, 12 GB RAM** (tối đa miễn phí 4 OCPU / 24 GB).
  - Nếu báo *"Out of capacity"*: thử lại sau vài giờ, hoặc đổi *Availability domain*. Đây là lỗi thường gặp với gói miễn phí.
- **Networking**: để mặc định (tạo VCN mới), bật **Assign a public IPv4 address**.
- **SSH keys**: chọn *Generate a key pair* → **tải cả 2 file khoá về** (mất là không vào được máy).
- Bấm **Create**, đợi trạng thái **Running**, ghi lại **Public IP address**.

### 3. Mở cổng 80 / 443 trên Oracle
Trang máy ảo → **Primary VNIC → Subnet → Security Lists → Default Security List → Add Ingress Rules**, thêm 2 dòng:

| Source CIDR | IP Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Tường lửa bên trong máy ảo do script tự mở.)

### 4. Tên miền + Cloudflare
1. Có tên miền (mua ở Mắt Bão, PA Việt Nam, Namecheap…) → thêm vào **Cloudflare** (gói Free), đổi nameserver theo hướng dẫn của Cloudflare.
2. **DNS → Add record**: `A` · tên `@` (hoặc `3d`) · giá trị = **Public IP** máy ảo · **Proxied (mây cam)**.
3. **SSL/TLS → Overview**: chọn **Full** (không chọn *Flexible*, không cần *Full (strict)*).
4. **Network**: đảm bảo **WebSockets = On**.

---

## Phần 2 — Cài đặt trên máy ảo (1 lệnh)

Mở PowerShell trên máy tính (thay đường dẫn khoá & IP):

```powershell
ssh -i C:\đường\dẫn\ssh-key.key ubuntu@<PUBLIC_IP>
```

Trên máy ảo:

```bash
curl -fsSL https://raw.githubusercontent.com/quyhuyhp123/an-duong-school-3d/main/deploy/oracle/setup.sh -o setup.sh
sudo DOMAIN=tenmiencuaban.vn bash setup.sh
```

- Repo GitHub **riêng tư**: thêm `REPO=https://<token>@github.com/quyhuyhp123/an-duong-school-3d.git` trước `bash`
  (token tạo ở GitHub → Settings → Developer settings → Personal access tokens, quyền *Contents: Read*). Lệnh `curl` tải
  `setup.sh` cũng cần token, hoặc chép nội dung file sang máy ảo.
- Muốn tự đặt mật khẩu trang quản lý: thêm `ADMIN_PASSWORD=...` trước `bash`. Không đặt thì script tự tạo và **in ra cuối** — hãy ghi lại.
- Script cài Node 22, Caddy, mở tường lửa, tải mã nguồn, build, tạo dịch vụ tự khởi động, sao lưu hằng ngày.

Xong: mở `https://tenmiencuaban.vn` và `https://tenmiencuaban.vn/admin`.

---

## Vận hành

| Việc | Lệnh (trên máy ảo) |
|---|---|
| Cập nhật bản mới (sau khi push code lên GitHub) | `sudo bash /opt/an-duong-school-3d/deploy/oracle/update.sh` |
| Xem log | `journalctl -u an-duong -f` |
| Khởi động lại | `sudo systemctl restart an-duong` |
| Đổi mật khẩu / cấu hình | `sudo nano /etc/anduong.env` rồi khởi động lại |
| Sao lưu thủ công | `sudo /usr/local/bin/anduong-backup` (file ở `/var/backups/anduong`) |
| Tải bản sao lưu về máy | `scp -i khoá.key ubuntu@<IP>:/var/backups/anduong/*.tar.gz .` |

**Chuyển dữ liệu đang có ở máy bạn lên (tuỳ chọn)** — lời chúc, bảng xếp hạng… trong thư mục `data/`:
```powershell
scp -i khoá.key data\wishes.json data\basketball.json data\basketball-flap.json ubuntu@<IP>:/tmp/
```
```bash
sudo systemctl stop an-duong && sudo cp /tmp/*.json /var/lib/anduong/ && sudo chown anduong: /var/lib/anduong/*.json && sudo systemctl start an-duong
```

## Lưu ý
- **Máy ảo nhàn rỗi có thể bị thu hồi:** Oracle có thể thu hồi máy Always Free nếu trong 7 ngày CPU, mạng và RAM đều dùng rất ít
  (dưới ~20%). Có học sinh truy cập thường xuyên thì không sao. Muốn chắc chắn: nâng tài khoản lên **Pay As You Go** (vẫn không
  trừ tiền nếu chỉ dùng tài nguyên miễn phí) — máy sẽ không bị thu hồi.
- Mỗi lần đổi mô hình 3D nhớ tăng `MODEL_VERSION` trong `src/World.jsx` (Cloudflare lưu đệm mô hình 7 ngày theo URL).
- Chỉ chạy **1 tiến trình** Node (một khuôn viên chung cho mọi người) — đừng chạy nhiều bản.

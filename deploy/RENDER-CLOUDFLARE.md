# Chạy miễn phí: Cloudflare Pages (trang web) + Render (máy chủ thời gian thực)

```
Học sinh ──► Cloudflare Pages  (trang web, mô hình 3D 3 MB, ảnh — máy chủ đặt ngay tại Việt Nam, tải rất nhanh)
        └──► Render, vùng Singapore  (WebSocket di chuyển nhân vật, chat, lời chúc, bảng xếp hạng, nhạc DJ)
```

Render chỉ còn làm phần nhẹ, nên gói Free 0,1 CPU đỡ bị nghẽn hơn nhiều so với khi phải gửi cả mô hình 3D cho từng người.

---

## Bước A — Tạo lại dịch vụ Render ở vùng Singapore

Vùng (Region) **không đổi được** sau khi tạo, nên cần tạo dịch vụ mới:

1. <https://dashboard.render.com> → **New + → Web Service** → chọn repo GitHub `an-duong-school-3d`.
2. Điền:

| Mục | Giá trị |
|---|---|
| Name | ví dụ `anduong-server` (địa chỉ sẽ là `https://anduong-server.onrender.com`) |
| **Region** | **Singapore (Southeast Asia)** |
| Branch | `main` |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |

3. **Environment Variables** (mục *Advanced* hoặc tab *Environment* sau khi tạo):

| Key | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `ADMIN_PASSWORD` | mật khẩu trang quản lý do bạn đặt |
| `ALLOWED_ORIGINS` | `https://<tên-dự-án>.pages.dev` *(điền sau khi có địa chỉ Pages ở bước B — nhiều địa chỉ thì cách nhau dấu phẩy)* |
| `TRUST_PROXY` | `1` |
| `CLIENT_IP_HEADER` | `cf-connecting-ip` |

4. **Health Check Path** (tab *Settings*): `/healthz`.
5. Bấm **Create Web Service**, đợi log báo `School server listening on port …`.
6. Khi dịch vụ mới chạy ổn → **xoá dịch vụ cũ** (vùng khác) để không bị tính trùng giờ chạy miễn phí.

## Bước B — Đưa trang web lên Cloudflare Pages

1. Tạo tài khoản miễn phí <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages → Create → Pages → Connect to Git** → cho phép Cloudflare đọc GitHub → chọn repo `an-duong-school-3d`.
3. Cấu hình build:

| Mục | Giá trị |
|---|---|
| Production branch | `main` |
| Framework preset | `None` (hoặc `Vite`) |
| Build command | `npm run build` |
| Build output directory | `dist` |

4. **Environment variables**:

| Key | Value |
|---|---|
| `VITE_SERVER_URL` | `https://anduong-server.onrender.com` *(địa chỉ Render ở bước A, không có dấu `/` cuối)* |
| `NODE_VERSION` | `22` |

5. **Save and Deploy** → nhận địa chỉ `https://<tên-dự-án>.pages.dev`.
6. Quay lại Render → thêm địa chỉ này vào `ALLOWED_ORIGINS` → Render tự khởi động lại.

Từ giờ mỗi lần push code lên GitHub, **cả Render và Pages tự build lại**.

Học sinh vào: `https://<tên-dự-án>.pages.dev` · Trang quản lý: `https://<tên-dự-án>.pages.dev/admin`.

---

## Lưu ý về gói Free của Render

- **Tự ngủ sau 15 phút không có ai kết nối.** Người vào đầu tiên sau đó đợi khoảng 50 giây (trang web vẫn hiện ngay vì nằm trên
  Cloudflare; chỉ phần online chờ máy chủ thức dậy, game tự kết nối lại).
  Muốn máy chủ luôn thức: tạo kiểm tra miễn phí trên <https://uptimerobot.com> gọi `https://anduong-server.onrender.com/healthz`
  mỗi 5 phút (gói Free có 750 giờ/tháng — đủ cho 1 dịch vụ chạy cả tháng).
- **Ổ đĩa không bền:** mỗi lần Render khởi động lại / deploy bản mới, thư mục `data/` trở về trạng thái trong Git →
  **lời chúc, chat, bảng xếp hạng, nhạc admin tải lên sẽ mất**. Giữ lâu dài cần ổ đĩa bền (Render Starter + Disk, có phí)
  hoặc chuyển phần lưu trữ sang cơ sở dữ liệu miễn phí bên ngoài (làm sau nếu cần).
- Đông người (vài trăm người cùng lúc) mà vẫn giật → nâng Render lên **Starter (~7 USD/tháng)**: CPU gấp 5 lần, không ngủ.

## Khi đổi mô hình 3D (Blender)

Blender xuất bản thô ra `models-src/an-duong-school.glb`, sau đó chạy:

```bash
npm run model:compress     # nén → public/models/an-duong-school.glb (~3 MB)
```

và tăng `MODEL_VERSION` trong `src/World.jsx`.

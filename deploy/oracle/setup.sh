#!/usr/bin/env bash
# Cài đặt An Dương 3D lên máy ảo Oracle Cloud "Always Free" (Ubuntu 22.04 / 24.04, ARM Ampere A1 hoặc x86).
# Chạy MỘT lần trên máy ảo (chạy lại cũng an toàn):
#
#   curl -fsSL https://raw.githubusercontent.com/quyhuyhp123/an-duong-school-3d/main/deploy/oracle/setup.sh -o setup.sh
#   sudo DOMAIN=anduong.example.com bash setup.sh
#
# Biến tuỳ chọn:
#   DOMAIN          tên miền đã trỏ về IP máy ảo (bắt buộc để có https/wss)
#   REPO            địa chỉ git (mặc định repo GitHub của dự án; repo riêng tư thì dùng https://<token>@github.com/…)
#   BRANCH          nhánh (mặc định main)
#   ADMIN_PASSWORD  mật khẩu trang quản lý (bỏ trống → tự tạo ngẫu nhiên, in ra cuối script)
#   BEHIND_CLOUDFLARE  1 (mặc định) nếu tên miền bật proxy Cloudflare (mây cam); 0 nếu trỏ thẳng
set -euo pipefail

DOMAIN="${DOMAIN:?Hãy đặt DOMAIN, ví dụ: sudo DOMAIN=anduong.example.com bash setup.sh}"
REPO="${REPO:-https://github.com/quyhuyhp123/an-duong-school-3d.git}"
BRANCH="${BRANCH:-main}"
BEHIND_CLOUDFLARE="${BEHIND_CLOUDFLARE:-1}"
APP_DIR=/opt/an-duong-school-3d
DATA_DIR=/var/lib/anduong
APP_USER=anduong
ENV_FILE=/etc/anduong.env
PORT=8080

[ "$(id -u)" = 0 ] || { echo "Hãy chạy bằng sudo"; exit 1; }
echo "==> Cập nhật hệ thống & cài gói cần thiết"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

echo "==> Node.js 22 LTS"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Caddy (proxy, tự lấy & gia hạn chứng chỉ https)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "==> Mở cổng 80/443 trong tường lửa của máy ảo (ảnh Ubuntu của Oracle chặn sẵn mọi cổng trừ 22)"
for p in 80 443; do
  iptables -C INPUT -p tcp -m state --state NEW --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp -m state --state NEW --dport $p -j ACCEPT
done
netfilter-persistent save

echo "==> Người dùng chạy dịch vụ & thư mục dữ liệu"
id -u $APP_USER >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin $APP_USER
mkdir -p $DATA_DIR && chown -R $APP_USER:$APP_USER $DATA_DIR

echo "==> Tải mã nguồn"
if [ -d $APP_DIR/.git ]; then git -C $APP_DIR fetch --depth 1 origin $BRANCH && git -C $APP_DIR reset --hard origin/$BRANCH
else git clone --depth 1 --branch $BRANCH "$REPO" $APP_DIR; fi
chown -R $APP_USER:$APP_USER $APP_DIR
# cấu hình sự kiện có sẵn trong repo → chép sang thư mục dữ liệu nếu chưa có
for f in events.json; do [ -f $DATA_DIR/$f ] || { [ -f $APP_DIR/data/$f ] && install -o $APP_USER -g $APP_USER -m 640 $APP_DIR/data/$f $DATA_DIR/$f; }; done

echo "==> Cài thư viện & build"
sudo -u $APP_USER bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && npm run build"

echo "==> Biến môi trường ($ENV_FILE)"
if [ ! -f $ENV_FILE ]; then
  PW="${ADMIN_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 16)}"
  if [ "$BEHIND_CLOUDFLARE" = 1 ]; then PROXY_LINES=$'TRUST_PROXY=2\nCLIENT_IP_HEADER=cf-connecting-ip'; else PROXY_LINES='TRUST_PROXY=1'; fi
  cat > $ENV_FILE <<EOF
NODE_ENV=production
PORT=$PORT
DATA_DIR=$DATA_DIR
ADMIN_PASSWORD=$PW
ALLOWED_ORIGINS=https://$DOMAIN
MAX_PLAYERS=800
$PROXY_LINES
EOF
  chmod 600 $ENV_FILE
  NEW_PASSWORD=$PW
fi

echo "==> Dịch vụ systemd"
install -m 644 $APP_DIR/deploy/oracle/an-duong.service /etc/systemd/system/an-duong.service
systemctl daemon-reload
systemctl enable an-duong
systemctl restart an-duong

echo "==> Caddy cho $DOMAIN"
if [ "$BEHIND_CLOUDFLARE" = 1 ]; then TLS="tls internal"; else TLS="# chứng chỉ Let's Encrypt tự động"; fi
sed "s/{{DOMAIN}}/$DOMAIN/g; s/{{PORT}}/$PORT/g; s/{{TLS}}/$TLS/" $APP_DIR/deploy/oracle/Caddyfile.template > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

echo "==> Sao lưu dữ liệu hằng ngày lúc 2:30 (giữ 14 bản trong /var/backups/anduong)"
install -m 755 $APP_DIR/deploy/oracle/backup.sh /usr/local/bin/anduong-backup
echo "30 2 * * * root /usr/local/bin/anduong-backup" > /etc/cron.d/anduong-backup

sleep 3
if curl -fsS -o /dev/null http://127.0.0.1:$PORT/; then echo "✔ Server Node đang chạy (cổng $PORT)"; else echo "✘ Server chưa trả lời — xem: journalctl -u an-duong -n 50"; fi
echo
echo "Xong! Mở https://$DOMAIN  ·  Trang quản lý: https://$DOMAIN/admin"
[ -n "${NEW_PASSWORD:-}" ] && echo "Mật khẩu quản lý: $NEW_PASSWORD   (lưu trong $ENV_FILE — hãy ghi lại)"
echo "Cập nhật bản mới sau này:  sudo bash $APP_DIR/deploy/oracle/update.sh"

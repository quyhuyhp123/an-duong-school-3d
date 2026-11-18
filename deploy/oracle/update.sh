#!/usr/bin/env bash
# Cập nhật bản mới từ GitHub rồi khởi động lại (dữ liệu trong /var/lib/anduong giữ nguyên).
#   sudo bash /opt/an-duong-school-3d/deploy/oracle/update.sh
set -euo pipefail
APP_DIR=/opt/an-duong-school-3d
BRANCH="${BRANCH:-main}"
[ "$(id -u)" = 0 ] || { echo "Hãy chạy bằng sudo"; exit 1; }
/usr/local/bin/anduong-backup || true            # sao lưu trước khi cập nhật
git -C $APP_DIR fetch --depth 1 origin $BRANCH
git -C $APP_DIR reset --hard origin/$BRANCH
chown -R anduong:anduong $APP_DIR
sudo -u anduong bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && npm run build"
install -m 644 $APP_DIR/deploy/oracle/an-duong.service /etc/systemd/system/an-duong.service
systemctl daemon-reload
systemctl restart an-duong
sleep 3
systemctl --no-pager --lines=5 status an-duong
echo "Đã cập nhật lên: $(git -C $APP_DIR log -1 --format='%h %s')"

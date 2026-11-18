#!/usr/bin/env bash
# Nén thư mục dữ liệu (lời chúc, chat, bảng xếp hạng, nhạc, cấu hình sự kiện) — giữ 14 bản gần nhất.
# Cron chạy hằng ngày lúc 2:30 (/etc/cron.d/anduong-backup). Nên chép thêm thư mục này ra ngoài máy (Google Drive, máy cá nhân…).
set -euo pipefail
DATA_DIR=/var/lib/anduong
OUT=/var/backups/anduong
mkdir -p $OUT
tar -czf "$OUT/anduong-$(date +%Y%m%d-%H%M).tar.gz" -C "$DATA_DIR" .
ls -1t $OUT/anduong-*.tar.gz | tail -n +15 | xargs -r rm -f

#!/bin/bash
# Runs on the server (update.ps1 sends it). Builds the new version beside the live one and swaps only if it builds.
set -euo pipefail
ROOT=/var/www/techiova.serieux.in
APP=$ROOT/app
NEW=$ROOT/app.new
SITE=$ROOT/site
PREV=/root/fixzy-previous
BACKUP=/root/fixzy-backup
export PATH=/opt/worksuite-node/bin:$PATH

# One update at a time.
exec 9>/run/fixzy-update.lock
flock -n 9 || { echo "Another update is already running."; exit 1; }

healthy() {
  for _ in $(seq 1 30); do
    # Healthy only if it answers AND listens on localhost alone: the server has no firewall.
    if curl -fs http://127.0.0.1:4001/api/services >/dev/null; then
      [ "$(ss -ltnH 'sport = :4001' | awk '{print $4}')" = "127.0.0.1:4001" ] && return 0
    fi
    sleep 1
  done
  return 1
}

rm -rf "$NEW" "$SITE.new"
mkdir -m 755 "$NEW"
tar -xzf /root/fixzy-update.tar.gz -C "$NEW" --no-same-owner

cd "$NEW/backend"
npm ci --no-audit --no-fund
npx prisma generate
npx nest build
test -f dist/main.js

cd "$NEW"
npm ci --no-audit --no-fund
npx vite build
node scripts-vercel.mjs

cd "$NEW/admin"
npm ci --no-audit --no-fund
npx vite build --base=/admin/

mkdir -m 755 "$SITE.new"
cp -r "$NEW/dist/." "$SITE.new/"
mkdir "$SITE.new/admin"
cp -r "$NEW/admin/dist/." "$SITE.new/admin/"
chmod -R a+rX "$SITE.new"

# Database copy before the migrations touch it. Keeps the last 5.
mkdir -p "$BACKUP" && chmod 700 "$BACKUP"
(cd /tmp && runuser -u postgres -- pg_dump -Fc fixzy) > "$BACKUP/db-$(date +%Y%m%d-%H%M%S).dump"
ls -1t "$BACKUP"/db-*.dump | tail -n +6 | xargs -r rm --

# Database changes are not undone if the switch below is rolled back.
(cd "$NEW/backend" && set -a && . /etc/fixzy.env && set +a && npx prisma migrate deploy)

cd /
rm -rf "$PREV"
mkdir -m 700 "$PREV"
mv "$APP" "$PREV/app"
mv "$SITE" "$PREV/site"
mv "$NEW" "$APP"
mv "$SITE.new" "$SITE"
systemctl restart fixzy

if healthy; then
  rm -f /root/fixzy-update.tar.gz
  echo "Update is live."
else
  echo "The new version did not start. Restoring the previous code."
  journalctl -u fixzy -n 20 --no-pager
  mv "$APP" "$NEW"
  mv "$SITE" "$SITE.new"
  mv "$PREV/app" "$APP"
  mv "$PREV/site" "$SITE"
  systemctl restart fixzy
  healthy && echo "Previous version is running again (database changes were kept)." || echo "Previous version did not start either."
  exit 1
fi

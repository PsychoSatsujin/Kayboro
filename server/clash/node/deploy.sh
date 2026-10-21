#!/usr/bin/env bash
# Ships the Fandom Clash API to its Linode and restarts it (Git Bash or any POSIX shell, from the repo root):
#   bash server/clash/node/deploy.sh                  code only
#   bash server/clash/node/deploy.sh --snapshot FILE  code + a new snapshot (e.g. .cache/clash/snapshot.json)
# Uses the deploy key in .cache/clash-deploy/ (git-ignored). Server: kaybo-clash (see server/clash/README.md).
# Also refreshes the systemd unit and the Caddyfile (validated before Caddy reloads), then waits for
# GET /v1/health to answer 200.
set -euo pipefail
HOST_IP="${CLASH_HOST_IP:-45.33.87.79}"
URL="${CLASH_URL:-https://45-33-87-79.ip.linodeusercontent.com}"
DNS="${URL#https://}"; DNS="${DNS%%/*}"
K=.cache/clash-deploy
O=(-i "$K/id_ed25519" -o "UserKnownHostsFile=$K/known_hosts" -o ConnectTimeout=15)
SNAP=""
[ "${1:-}" = "--snapshot" ] && SNAP="${2:?snapshot file}"

# The code the server needs, at the same relative paths as in the repo.
tar -czf "$K/clash.tgz" server/clash/src server/clash/node server/clash/schema.sql tools/clash/matchmaking.js src/main/clash-matchmaking.js
scp -q "${O[@]}" "$K/clash.tgz" "root@$HOST_IP:/tmp/clash.tgz"
ssh "${O[@]}" "root@$HOST_IP" 'set -e; rm -rf /opt/kayboro-clash.new; mkdir -p /opt/kayboro-clash.new; tar -xzf /tmp/clash.tgz -C /opt/kayboro-clash.new; rm -rf /opt/kayboro-clash; mv /opt/kayboro-clash.new /opt/kayboro-clash; rm /tmp/clash.tgz'

if [ -n "$SNAP" ]; then
  ID="$(node -e "console.log(require(require('path').resolve(process.argv[1])).generatedAt)" "$SNAP")"
  FILE="$(node -e "console.log(encodeURIComponent('snapshot:' + process.argv[1]))" "$ID")"
  gzip -c "$SNAP" > "$K/snapshot.json.gz"
  scp -q "${O[@]}" "$K/snapshot.json.gz" "root@$HOST_IP:/tmp/snapshot.json.gz"
  ssh "${O[@]}" "root@$HOST_IP" "set -e; cd /var/lib/kayboro-clash/kv; gunzip -c /tmp/snapshot.json.gz > '$FILE.tmp' && mv '$FILE.tmp' '$FILE'; printf %s '$ID' > snapshot%3Acurrent; chown clash:clash snapshot*; rm /tmp/snapshot.json.gz"
  echo "snapshot $ID uploaded"
fi

# systemd unit + Caddyfile from the repo; Caddy only reloads a config that validates.
ssh "${O[@]}" "root@$HOST_IP" "set -e
  install -m 644 /opt/kayboro-clash/server/clash/node/kayboro-clash.service /etc/systemd/system/kayboro-clash.service
  systemctl daemon-reload
  sed 's/__HOST__/$DNS/' /opt/kayboro-clash/server/clash/node/Caddyfile > /etc/caddy/Caddyfile.new
  caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile >/dev/null 2>&1 || { echo 'Caddyfile does not validate; keeping the old one'; caddy validate --config /etc/caddy/Caddyfile.new --adapter caddyfile; exit 1; }
  cmp -s /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile && rm /etc/caddy/Caddyfile.new || { mv /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile; systemctl reload caddy; echo 'caddy reloaded'; }
  systemctl restart kayboro-clash && sleep 1 && systemctl is-active kayboro-clash"

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS -o /dev/null "$URL/v1/health"; then
    curl -sS -w "\ncheck: $URL/v1/health -> %{http_code}\n" "$URL/v1/health"
    exit 0
  fi
  sleep 1
done
curl -sS -w "\ncheck: $URL/v1/health -> %{http_code}\n" "$URL/v1/health"
exit 1

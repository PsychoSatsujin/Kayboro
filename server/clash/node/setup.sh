#!/usr/bin/env bash
# One-time setup of a fresh Debian 12 Linode for the Fandom Clash API (run as root; idempotent).
#   HOST=<the Linode's rDNS name, e.g. 45-33-87-79.ip.linodeusercontent.com> bash setup.sh
# Run it from a copy of server/clash/node/ (it installs kayboro-clash.service and Caddyfile from there).
# Installs Node 22 (NodeSource) and Caddy (HTTPS via Let's Encrypt), a "clash" system user, the systemd
# service kayboro-clash (code in /opt/kayboro-clash, data in /var/lib/kayboro-clash), and a firewall that
# allows only SSH, HTTP and HTTPS. SSH becomes key-only.
set -euo pipefail
: "${HOST:?set HOST to the DNS name of this server}"
export DEBIAN_FRONTEND=noninteractive

apt-get update -q
apt-get install -yq curl ca-certificates gnupg ufw debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades

if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -yq caddy
fi

id clash >/dev/null 2>&1 || useradd --system --home /var/lib/kayboro-clash --shell /usr/sbin/nologin clash
mkdir -p /opt/kayboro-clash /var/lib/kayboro-clash/kv
chown -R clash:clash /var/lib/kayboro-clash && chmod 750 /var/lib/kayboro-clash

# The unit and the Caddyfile live next to this script (deploy.sh refreshes both on every deploy).
HERE="$(cd "$(dirname "$0")" && pwd)"
install -m 644 "$HERE/kayboro-clash.service" /etc/systemd/system/kayboro-clash.service
sed "s/__HOST__/${HOST}/" "$HERE/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd || true
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

systemctl daemon-reload
systemctl enable kayboro-clash caddy
systemctl restart caddy
echo "setup done: node $(node -v), caddy $(caddy version | cut -d' ' -f1)"

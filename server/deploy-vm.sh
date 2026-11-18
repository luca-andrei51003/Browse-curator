#!/usr/bin/env bash
# BrowseCurator alert server - installer for a Debian/Ubuntu VM.
#
# 1. Copy server.js, gmail-smtp.js, package.json, browse-curator.service and
#    this script into one folder on the VM (do NOT copy config.json).
# 2. From that folder:  sudo bash deploy-vm.sh
#
# Safe to re-run: keeps existing secrets, updates code, restarts the service.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash $0"; exit 1; }

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR=/opt/browse-curator-server
ENV_FILE=/etc/browse-curator.env
SVC_USER=browsecurator
PORT=3001

for f in server.js gmail-smtp.js package.json browse-curator.service; do
  [ -f "$SRC_DIR/$f" ] || { echo "Missing $f next to this script"; exit 1; }
done

echo "==> Checking Node.js"
if [ ! -x /usr/bin/node ]; then
  apt-get update -y
  apt-get install -y nodejs
fi
NODE_MAJOR=$(/usr/bin/node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 14 ] || { echo "Node $NODE_MAJOR too old (need >=14)"; exit 1; }
echo "    node $(/usr/bin/node -v)"
/usr/bin/node --check "$SRC_DIR/server.js"

echo "==> Installing files"
id -u "$SVC_USER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin "$SVC_USER"
mkdir -p "$APP_DIR"
install -m 644 -o root -g root "$SRC_DIR/server.js" "$SRC_DIR/gmail-smtp.js" "$SRC_DIR/package.json" "$APP_DIR/"
install -m 644 -o root -g root "$SRC_DIR/browse-curator.service" /etc/systemd/system/browse-curator.service
rm -f "$APP_DIR/config.json"   # secrets come only from $ENV_FILE

echo "==> Secrets"
if [ -f "$ENV_FILE" ] && grep -q '^API_KEY=.' "$ENV_FILE" && grep -q '^SENDER_EMAIL=.' "$ENV_FILE"; then
  echo "    Keeping existing $ENV_FILE"
else
  API_KEY=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  read -rp  "    Sender Gmail address: " SENDER
  read -rsp "    Gmail app password (input hidden): " GMAIL_PW; echo
  { [ -n "$SENDER" ] && [ -n "$GMAIL_PW" ]; } || { echo "Both values are required"; exit 1; }
  umask 077
  printf 'PORT=%s\nAPI_KEY=%s\nSENDER_EMAIL=%s\nGMAIL_APP_PASSWORD=%s\n' \
    "$PORT" "$API_KEY" "$SENDER" "$GMAIL_PW" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

echo "==> Starting service"
systemctl daemon-reload
systemctl enable browse-curator >/dev/null 2>&1
systemctl restart browse-curator
sleep 2

if ! systemctl is-active --quiet browse-curator; then
  echo "!! Service failed to start. Logs:"
  journalctl -u browse-curator -n 30 --no-pager
  exit 1
fi

echo "==> Self-test"
HEALTH=$(curl -fsS "http://127.0.0.1:$PORT/health" || true)
NOKEY=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/notify" -d '{}' || true)
echo "    /health          -> $HEALTH"
echo "    notify (no key)  -> HTTP $NOKEY (expect 401)"

KEY=$(grep '^API_KEY=' "$ENV_FILE" | cut -d= -f2-)
EXT_IP=$(curl -fsS -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip' \
  2>/dev/null || echo VM_EXTERNAL_IP)

cat <<EOF

==========================================================
 Done. Paste this into the extension popup (server endpoint):

   http://$EXT_IP:$PORT/api/notify?key=$KEY

 If that URL doesn't respond from outside, open the GCP firewall
 (Console: VPC network > Firewall > allow ingress tcp:$PORT), or:
   gcloud compute firewall-rules create allow-browse-curator --allow=tcp:$PORT

 Logs:  sudo journalctl -u browse-curator -f
==========================================================
EOF

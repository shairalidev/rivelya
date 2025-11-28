#!/bin/bash
set -euo pipefail

TURN_USER="turnuser"
TURN_PASS="$(openssl rand -hex 16)"
TURN_PORT="3478"
DOMAIN="rivelya.duckdns.org"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

if ! command -v apt-get >/dev/null; then
  echo "This script assumes an Ubuntu/Debian environment. Exiting."
  exit 1
fi

echo "Installing coturn..."
sudo apt-get update -qq
sudo apt-get install -y coturn

echo "Enabling coturn service at boot..."
if ! sudo grep -q '^TURNSERVER_ENABLED=1' /etc/default/coturn 2>/dev/null; then
  echo 'TURNSERVER_ENABLED=1' | sudo tee -a /etc/default/coturn >/dev/null
fi

echo "Writing configuration to /etc/turnserver.conf..."
sudo tee /etc/turnserver.conf >/dev/null <<EOF
listening-port=${TURN_PORT}
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${TURN_PASS}
realm=${DOMAIN}
user=${TURN_USER}:${TURN_PASS}
cert=${CERT_PATH}
pkey=${KEY_PATH}
no-stdout-log
log-file=/var/log/turnserver.log
EOF

sudo chown root:root /etc/turnserver.conf
sudo chmod 600 /etc/turnserver.conf

echo "Restarting coturn service..."
sudo systemctl daemon-reload
sudo systemctl enable --now coturn
sudo systemctl restart coturn

echo ""
echo "TURN credentials ready. Set these env vars before building the frontend:"
echo "VITE_ICE_TURN_URL=turn:${DOMAIN}:${TURN_PORT}?transport=udp"
echo "VITE_ICE_TURN_USERNAME=${TURN_USER}"
echo "VITE_ICE_TURN_CREDENTIAL=${TURN_PASS}"

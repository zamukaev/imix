#!/usr/bin/env bash
#
# First certificate, and the switch to HTTPS. Run once, on the VPS, after DNS
# for all three names points at this host:
#
#   cd /opt/imix && sudo bash scripts/init-letsencrypt.sh
#
# Why a script and not just a config: nginx will not start when
# `ssl_certificate` names a file that does not exist, and certbot cannot create
# that file until nginx is already serving /.well-known over HTTP. So the stack
# comes up on deploy/nginx/bootstrap (plain HTTP, ACME included), gets a
# certificate, and only then moves to deploy/nginx/tls.
#
# Safe to re-run: certbot is asked not to replace a certificate that is already
# there, and the stage flip is idempotent.

set -euo pipefail

COMPOSE_DIR=${COMPOSE_DIR:-/opt/imix}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}

cd "$COMPOSE_DIR"

set -a
# shellcheck disable=SC1091
source ./.env
set +a

: "${DOMAIN:?DOMAIN is not set in .env}"
: "${API_DOMAIN:?API_DOMAIN is not set in .env}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is not set in .env}"

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# --- 1. check DNS before asking Let's Encrypt anything ----------------------
#
# Five failed validations against the same name in an hour and that name is rate
# limited. Checking here costs a second and turns "locked out until the top of
# the hour" into "fix your DNS".
public_ip=$(curl -fsS https://api.ipify.org || true)
echo "This host appears to be ${public_ip:-<unknown>}"

for name in "$DOMAIN" "www.$DOMAIN" "$API_DOMAIN"; do
  resolved=$(getent ahostsv4 "$name" | awk 'NR==1{print $1}' || true)
  if [[ -z $resolved ]]; then
    echo "✗ $name does not resolve. Create the A record and wait for TTL." >&2
    exit 1
  fi
  if [[ -n $public_ip && $resolved != "$public_ip" ]]; then
    echo "✗ $name resolves to $resolved, not $public_ip." >&2
    echo "  Fix the A record before continuing — a mismatch fails validation." >&2
    exit 1
  fi
  echo "✓ $name → $resolved"
done

# --- 2. serve the challenge -------------------------------------------------
echo
echo "Bringing nginx up on plain HTTP…"
sed -i 's/^NGINX_STAGE=.*/NGINX_STAGE=bootstrap/' .env
compose up -d nginx
sleep 3

# Proves the path certbot is about to use actually works, from outside.
probe="/var/www/certbot/.well-known/acme-challenge/imix-preflight"
compose run --rm --entrypoint /bin/sh certbot -c "mkdir -p $(dirname "$probe") && echo ok > $probe"
if ! curl -fsS "http://$DOMAIN/.well-known/acme-challenge/imix-preflight" | grep -q ok; then
  echo "✗ The ACME path is not reachable from the internet." >&2
  echo "  Check that port 80 is open and nothing else is bound to it." >&2
  exit 1
fi
compose run --rm --entrypoint /bin/sh certbot -c "rm -f $probe"
echo "✓ ACME challenge path is reachable"

# --- 3. issue ---------------------------------------------------------------
#
# One certificate for all three names. Three separate ones would mean three
# renewals to watch and three ways for one of them to quietly expire.
echo
echo "Requesting a certificate for $DOMAIN, www.$DOMAIN, $API_DOMAIN…"
compose run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" -d "$API_DOMAIN" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --no-eff-email \
  --keep-until-expiring \
  --non-interactive

# --- 4. switch to HTTPS -----------------------------------------------------
echo
echo "Switching nginx to the TLS config…"
sed -i 's/^NGINX_STAGE=.*/NGINX_STAGE=tls/' .env
compose up -d --force-recreate nginx
sleep 3

echo
echo "Verifying…"
curl -fsS -o /dev/null -w '  https://%{host} → %{http_code}\n' "https://$DOMAIN/" || true
curl -fsS -o /dev/null -w '  https://%{host} → %{http_code}\n' "https://$API_DOMAIN/health" || true
curl -fsS -o /dev/null -w '  http://%{host} → %{http_code} (expect 301)\n' "http://$DOMAIN/" || true

echo
echo "Done. Renewal runs twice a day in the certbot container; confirm it with:"
echo "  docker compose -f $COMPOSE_FILE run --rm --entrypoint certbot certbot renew --dry-run"

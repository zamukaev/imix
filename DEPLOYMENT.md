# DEPLOYMENT — iMIX on a single VPS

Production runs as four containers behind nginx on one host, deployed from
GitHub Actions through GHCR. This document is the operational one: what the
stack is, how to stand it up the first time, and what to do on an ordinary
Tuesday.

`README.md` also describes a Vercel + Railway layout, and `apps/web/vercel.json`
and `railway.toml` are still checked in. That topology is not wrong — it is what
staging can use, and it is the fallback if this host is ever retired. **The VPS
is production.**

> **Open, and not closed by this document.** The host is AlphaVPS, which is
> Bulgarian. 152-ФЗ requires personal data of Russian citizens to be stored in
> Russia, and this shop stores accounts and orders. Everything here — the
> compose file, the images, the workflow — moves to a Russian provider
> unchanged; only `VPS_HOST` and the DNS records differ. It is a host decision
> that is still owed, not an architectural one.

---

## 1. Architecture

```
                       Internet
                          │
                    :80 / :443            ← the only published ports
                          │
                 ┌────────▼────────┐
                 │  nginx          │
                 │  + certbot      │      network: imix-edge
                 └───┬────────┬────┘
   DOMAIN.ru         │        │        api.DOMAIN.ru
   /uploads/* ───────┤        │
   (from the volume) │        │
              ┌──────▼──┐  ┌──▼────────┐
              │frontend │  │  backend  │
              │  :3000  │─▶│   :4000   │
              └─────────┘  └─────┬─────┘
                                 │            network: imix-internal
                            ┌────▼────┐       (internal: true)
                            │   db    │  :5432
                            └─────────┘
```

Two networks, on purpose. `imix-edge` carries anything nginx has to reach.
`imix-internal` is declared `internal: true`, which removes its gateway: the
database has no route to the internet and the internet has no route to it. That
is the second lock. The first is that **Postgres publishes no port at all** —
which matters more than a firewall rule, because `docker-proxy` installs its own
forwarding ahead of UFW's chain, so a published port is reachable from outside
even when `ufw status` claims otherwise.

Three things are worth knowing before changing anything:

- **The browser makes exactly one cross-origin call.** Almost everything goes
  through the storefront's own route handlers under `app/api/`, which proxy
  server-side. The exception is `POST /payments/intent` from the checkout page.
  That is why `api.DOMAIN.ru` exists and why `WEB_ORIGIN` has to be right.
- **Server-side rendering does not go through nginx.** The storefront container
  reads `API_INTERNAL_URL=http://backend:4000` and talks to the API over the
  bridge. The public URL is only for the browser.
- **`NEXT_PUBLIC_*` is not configuration.** Next substitutes those values into
  the JavaScript bundle when the image is built, so `imix-web` is bound to the
  domain it was built for. Changing a domain is a rebuild, not a restart.

### What lives where

| In the repository | |
|---|---|
| `docker-compose.production.yml` | the whole stack |
| `.env.production.example` | template for the server's `.env` |
| `deploy/nginx/bootstrap/` | plain-HTTP config, used before a certificate exists |
| `deploy/nginx/tls/` | the HTTPS config |
| `deploy/nginx/snippets/proxy.conf` | proxy headers, shared by both |
| `scripts/init-letsencrypt.sh` | first certificate, then the switch to HTTPS |
| `scripts/backup-db.sh` | nightly `pg_dump` |
| `scripts/setup-swap.sh` | 2 GB swap file |
| `.github/workflows/deploy.yml` | validate → build → push → deploy |

| On the VPS, under `/opt/imix` | |
|---|---|
| `docker-compose.production.yml`, `deploy/`, `scripts/` | copied from the repository |
| `.env` | **the only place production secrets exist** |
| `backups/` | dumps, on the host disk rather than in a volume |

| Images (GHCR) | |
|---|---|
| `imix-web` | the storefront, Next standalone |
| `imix-api` | the API |
| `imix-api-tools` | the API's *build* stage — kept because it still has `ts-node`, which `prisma db seed` needs and the production install strips out |

---

## 2. First-time server setup

Nothing below destroys anything. Run it as the deploy user; `sudo` where shown.

### 2.1 Look before touching

```bash
lsb_release -a
docker --version && docker compose version
free -h && df -h
sudo ufw status verbose
sudo ss -tlnp
docker ps -a && docker volume ls
```

**Stop and think if:** something already listens on 80 or 443, or `docker volume
ls` shows volumes you do not recognise. Do not deploy over another service.

### 2.2 Docker

If `docker compose version` fails, install Docker Engine from Docker's own
repository (not Ubuntu's `docker.io`, which ships an old Compose):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # log out and back in
```

### 2.3 Swap

2 GB of RAM has to hold Postgres, two Node servers and nginx. It fits, but with
no swap there is no margin: the first time memory runs short the OOM killer
takes a process down instead of the machine getting slower.

```bash
sudo bash /opt/imix/scripts/setup-swap.sh
```

The script does nothing if swap is already active, and refuses if `/swapfile`
exists but is unused — inspect that yourself rather than letting a script
overwrite a file it did not create.

### 2.4 Firewall

```bash
sudo ufw allow 22/tcp     # or your SSH port — do not change it here
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw default deny incoming
sudo ufw enable
```

3000, 4000 and 5432 are not in this list and must not be. They are not published
by the compose file either, which is the guarantee that actually holds.

### 2.5 The directory

```bash
sudo mkdir -p /opt/imix/backups
sudo chown -R "$USER":"$USER" /opt/imix
```

Copy `docker-compose.production.yml`, `deploy/` and `scripts/` from the
repository into `/opt/imix`.

### 2.6 The environment file

```bash
cp .env.production.example /opt/imix/.env
chmod 600 /opt/imix/.env
```

Fill it in. Generate secrets on the server, not in a password manager you will
later paste from into a terminal history:

```bash
openssl rand -base64 32   # JWT_SECRET
openssl rand -base64 32   # JWT_REFRESH_SECRET   (a different one)
openssl rand -hex 24      # POSTGRES_PASSWORD
```

`POSTGRES_PASSWORD` is hex on purpose: `@`, `:` and `/` are structural in a
connection URL, and a password containing one truncates `DATABASE_URL` silently
rather than failing. Whatever you generate has to be written into
`DATABASE_URL` as well.

### 2.7 A deploy key for GitHub

On your own machine:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/imix-deploy -C "github-actions@imix"
ssh-copy-id -i ~/.ssh/imix-deploy.pub USER@VPS_IP
```

The **private** key goes into the GitHub secret `VPS_SSH_PRIVATE_KEY`. It never
goes into the repository.

---

## 3. DNS

Create these at your registrar. Nothing here is done for you.

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<VPS_IP>` | 300 |
| A | `www` | `<VPS_IP>` | 300 |
| A | `api` | `<VPS_IP>` | 300 |

**Why A rather than CNAME for `www`.** A CNAME is the right answer when the
target is a hostname you do not control and whose address can change — a managed
platform. Here all three names point at one static IP you own, so an A record is
one fewer lookup and one fewer thing to keep in sync. At the apex there is no
choice at all: RFC 1034 forbids a CNAME alongside the SOA and NS records that
have to exist at `@`.

Verify before asking Let's Encrypt for anything — five failed validations for a
name in an hour and that name is rate-limited:

```bash
dig +short DOMAIN.ru www.DOMAIN.ru api.DOMAIN.ru
```

All three must return the VPS address.

---

## 4. First deploy, by hand

Do this once, manually, before wiring up CI. If it does not work by hand it will
not work from a workflow, and it is much harder to read the failure.

```bash
cd /opt/imix

# 1. Pull. Needs a personal access token with read:packages.
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
docker compose -f docker-compose.production.yml pull

# 2. Database first.
docker compose -f docker-compose.production.yml up -d db
docker compose -f docker-compose.production.yml ps      # wait for (healthy)

# 3. Schema.
docker compose -f docker-compose.production.yml --profile tasks run --rm migrate

# 4. The catalogue and the first ADMIN. ONCE — see the warning below.
docker compose -f docker-compose.production.yml --profile tasks run --rm seed

# 5. Everything else.
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
```

> **The seed writes data.** It is idempotent — every record is upserted on its
> natural key and nothing is ever deleted — but re-running it resets the ADMIN
> account's password to whatever `ADMIN_PASSWORD` currently says, and restores
> any seeded product an admin has since edited. Run it on an empty database and
> then leave it alone. API registration only ever creates a plain `USER`, so
> this is the only way an ADMIN comes into existence.

Check it before going further:

```bash
curl -I  http://DOMAIN.ru/
curl -s  http://api.DOMAIN.ru/health     # expect "database":"up"
```

---

## 5. HTTPS

```bash
cd /opt/imix
sudo bash scripts/init-letsencrypt.sh
```

The script checks DNS, proves the ACME path is reachable from outside, requests
**one certificate covering all three names**, then flips `NGINX_STAGE` from
`bootstrap` to `tls` in `.env` and recreates nginx.

One certificate rather than three: one renewal to watch, one way for it to fail
loudly rather than three ways for one of them to expire unnoticed.

Renewal runs inside the `certbot` container twice a day. Confirm it:

```bash
docker compose -f docker-compose.production.yml run --rm \
  --entrypoint certbot certbot renew --dry-run
```

Afterwards:

```bash
curl -I https://DOMAIN.ru/            # 200
curl -I http://DOMAIN.ru/             # 301 to https
curl -s https://api.DOMAIN.ru/health  # {"status":"ok",…,"database":"up"}
```

---

## 6. CI/CD

`.github/workflows/deploy.yml` runs on every push to `main`:

1. **validate** — Node 22, pnpm 11.20.0, `pnpm typecheck`, `pnpm lint`,
   `pnpm test` against a real Postgres service container. (`pnpm format:check`
   is deliberately not a gate: it has never passed on this repository.)
2. **build** — three images to GHCR, tagged `sha-<commit>` **and** `latest`.
3. **deploy** — SSH to the VPS, rewrite `IMAGE_TAG`, pull, migrate, `up -d`,
   then wait for all three containers to report healthy. If they do not, the job
   fails and prints the rollback command.

Images are built in CI and never on the VPS: a `next build` on a 2-core, 2 GB
host would compete with the shop it is meant to replace.

### Secrets and variables

Repository **secrets** (Settings → Secrets and variables → Actions → Secrets):

| Name | What |
|---|---|
| `VPS_HOST` | IP or hostname |
| `VPS_USER` | the deploy user |
| `VPS_SSH_PRIVATE_KEY` | the private half of the deploy key from §2.7 |
| `VPS_SSH_PORT` | only if SSH is not on 22 |
| `GHCR_PULL_TOKEN` | classic PAT with `read:packages`, for `docker login` on the VPS |

Repository **variables** (same page → Variables). These are not secrets — every
one of them is published to anyone who loads the site, and they are variables so
that they are visible rather than hidden:

| Name | Example |
|---|---|
| `DOMAIN` | `imix.ru` |
| `API_DOMAIN` | `api.imix.ru` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…`, or leave unset |

Pushing images uses the workflow's built-in `GITHUB_TOKEN`; no secret is needed
for that half.

---

## 7. Day to day

### Deploy

```bash
git push origin main
```

That is the whole thing. Watch it in the Actions tab.

### Roll back

Images are immutable and tagged with the commit that produced them.

```bash
cd /opt/imix
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=sha-<previous-commit-sha>|' .env
docker compose -f docker-compose.production.yml up -d
```

Available tags: `docker image ls | grep imix`, or the Packages tab on GitHub.

**This rolls back code, not the schema.** Prisma has no down migrations. A
migration therefore has to be readable by the version still running — add a
column, do not rename one — and anything genuinely destructive is run by hand,
deliberately, with a backup taken first.

### Migrations

Applied automatically by the deploy job. By hand:

```bash
cd /opt/imix
docker compose -f docker-compose.production.yml --profile tasks run --rm migrate
```

### Logs

```bash
cd /opt/imix
docker compose -f docker-compose.production.yml logs -f            # everything
docker compose -f docker-compose.production.yml logs -f frontend
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f db
docker compose -f docker-compose.production.yml logs -f nginx
```

Rotation is set per service in the compose file (10 MB × 3), so logs cannot fill
the disk. It is set there rather than in `/etc/docker/daemon.json` so that
adopting it never requires restarting the daemon under a running shop.

### Restart

```bash
docker compose -f docker-compose.production.yml restart backend
docker compose -f docker-compose.production.yml up -d --force-recreate nginx
```

### Backups

```bash
crontab -e
# 20 3 * * * /opt/imix/scripts/backup-db.sh >> /opt/imix/backups/backup.log 2>&1
```

`pg_dump --format=custom`, gzipped, seven kept. They are written to
`/opt/imix/backups` on the host disk — **outside** the `imix-db-data` volume,
because a backup that only exists inside the thing it backs up is not a backup.

Off-site copies are the obvious next step and are deliberately not configured
here; it needs a destination and a credential that are yours to choose.

Restoring is destructive and has no script:

```bash
gunzip -c backups/imix-YYYYmmdd-HHMMSS.dump.gz > /tmp/restore.dump
docker compose -f docker-compose.production.yml exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < /tmp/restore.dump
```

`--clean` drops every object it is about to recreate. Take a fresh dump first.

### Uploads

`POST /admin/upload` writes to the `imix-uploads` volume, mounted at `/uploads`
in the API. nginx serves it read-only at `/uploads/` on the apex domain, so the
relative paths stored in the database resolve without Next being involved.

Moving to Cloudinary later is one variable — set `CLOUDINARY_URL` in `.env` and
restart the backend. **Do not delete the volume afterwards:** paths already in
the database still point at it.

---

## 8. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `backend` restarts, log says `JWT_SECRET is required in production` | It is missing from `/opt/imix/.env`. Deliberate — the API refuses to boot rather than sign tokens with a development fallback. |
| `/health` says `"database":"down"` | Postgres is not healthy. `docker compose … logs db`. Check `DATABASE_URL` names the host `db`, not `localhost`. |
| nginx will not start after `init-letsencrypt.sh` | `NGINX_STAGE=tls` but no certificate. `docker compose … logs nginx`; set it back to `bootstrap`, recreate, and re-run the script. |
| Certificate renewal fails | The ACME location must come *before* the HTTPS redirect. `docker compose … run --rm --entrypoint certbot certbot renew --dry-run` shows the real error. |
| Checkout fails with a CORS error in the browser console | `WEB_ORIGIN` does not list the origin the browser actually sent. It is a comma-separated list and needs both the apex and `www`. |
| Admin image upload fails, or images 404 | The volume must be writable by the container's `node` user; the image creates `/uploads` owned by `node` so that an empty volume inherits it. If the volume predates that, recreate it. |
| The site still shows the old domain after a domain change | `NEXT_PUBLIC_*` is baked into the bundle. Change the repository variables and rebuild — restarting does nothing. |
| `pull` fails with `denied` | The PAT in `GHCR_PULL_TOKEN` needs `read:packages`, and the package must be visible to that account. |
| Deploy job hangs on the health gate | `docker compose … logs --tail=100 backend frontend` on the host. The job prints the rollback command when it gives up. |
| Out of memory during a deploy | Confirm swap is on (`free -h`). Images are built in CI; nothing should be compiling here. |

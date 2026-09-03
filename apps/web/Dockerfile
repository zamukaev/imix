# syntax=docker/dockerfile:1

# Build context is the repository root, not apps/web:
#
#   docker build -f apps/web/Dockerfile -t imix-web .
#
# The storefront imports @imix/types and @imix/config through the pnpm
# workspace, and a context rooted at apps/web cannot see either.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Debian rather than Alpine: sharp — which next/image needs to optimise a
# photograph — ships prebuilt binaries against glibc and compiles from source on
# musl, which on a 2 vCPU builder is the difference between seconds and minutes.
RUN corepack enable
# Drop root before anything is written, rather than chowning the tree at the
# end: a `chown -R` over node_modules rewrites every file into a fresh layer.
RUN mkdir -p /pnpm /repo && chown -R node:node /pnpm /repo
USER node
WORKDIR /repo

# --- install ---------------------------------------------------------------
# Manifests before sources, so the install layer survives every commit that does
# not touch a package.json or the lockfile. "web..." is web plus the workspace
# packages it depends on — the API and its dependency tree never enter this
# image.
FROM base AS deps
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node packages/config/package.json packages/config/
COPY --chown=node:node packages/types/package.json packages/types/
COPY --chown=node:node apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "web..."

# --- build -----------------------------------------------------------------
FROM deps AS build

# NEXT_PUBLIC_* is not configuration, it is source: Next substitutes each one
# into the JavaScript it sends to the browser, so their values are fixed here
# and an image is bound to the domain it was built for. Changing a domain means
# rebuilding, not restarting — which is why CI passes these in and the runtime
# .env does not carry them.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --chown=node:node packages packages
COPY --chown=node:node apps/web apps/web
# @imix/types is consumed as compiled dist/, so next build has nothing to
# resolve until tsc has run over it.
RUN pnpm --filter @imix/types build && pnpm --filter web build

# --- runtime ---------------------------------------------------------------
# No second install here, unlike the API image: `output: 'standalone'` has
# already worked out which modules the app actually reaches and copied them into
# .next/standalone, so reinstalling would only add back what the trace left out
# on purpose.
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Every interface, not just loopback — nginx proxies to this container by name.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The traced server, then the two things the trace cannot see: the client bundle
# and the static files, both served from disk at request time.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

EXPOSE 3000

# Uploaded images are *not* served from here — the API writes them to a volume
# nginx reads directly (see deploy/nginx). This container never sees them.
CMD ["node", "apps/web/server.js"]

# syntax=docker/dockerfile:1

# Build context is the repository root, not apps/api:
#
#   docker build -f apps/api/Dockerfile -t imix-api .
#
# The API imports @imix/types through the pnpm workspace, and a context rooted at
# apps/api cannot see it. On Railway this means the service's root directory
# stays "/" with the Dockerfile path set to apps/api/Dockerfile.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Debian rather than Alpine: argon2 and Prisma's engines both ship prebuilt
# binaries against glibc, and on musl they get compiled from source instead.
# OpenSSL is what Prisma's query engine links against and slim does not carry it.
RUN apt-get update \
  && apt-get install --no-install-recommends -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
# Drop root before anything is written, rather than chowning the tree at the
# end: a `chown -R` over node_modules rewrites every file into a fresh layer and
# roughly doubles the image.
RUN mkdir -p /pnpm /repo && chown -R node:node /pnpm /repo
# The mount point for the uploads volume, created here so that it exists in the
# image owned by `node`. Docker initialises an empty named volume from whatever
# is at the mount path, ownership included — without this the volume arrives
# root-owned, the server runs as `node`, and every admin image upload fails with
# EACCES at the moment somebody tries to add a product.
RUN mkdir -p /uploads && chown node:node /uploads
USER node
WORKDIR /repo

# api's postinstall is `prisma generate`, and prisma.config.ts resolves
# DATABASE_URL eagerly — locally that comes from apps/api/.env, which is
# deliberately not in this image. Generating a client needs the schema and
# nothing else, so a placeholder satisfies the config. It is set per RUN rather
# than as an ENV on purpose: baked in, it would become a silent default that
# points a misconfigured deployment at a database that isn't there, instead of
# letting it fail on the spot.
ARG PRISMA_GENERATE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

# --- install ---------------------------------------------------------------
# Manifests before sources, so the install layer survives every commit that does
# not touch a package.json or the lockfile. "api..." is api plus the workspace
# packages it depends on — the web app and its dependency tree never enter this
# image.
FROM base AS deps
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node packages/config/package.json packages/config/
COPY --chown=node:node packages/types/package.json packages/types/
COPY --chown=node:node apps/api/package.json apps/api/
COPY --chown=node:node apps/api/prisma apps/api/prisma
COPY --chown=node:node apps/api/prisma.config.ts apps/api/
RUN DATABASE_URL=$PRISMA_GENERATE_URL pnpm install --frozen-lockfile --filter "api..."

# --- build -----------------------------------------------------------------
FROM deps AS build
COPY --chown=node:node packages packages
COPY --chown=node:node apps/api apps/api
# @imix/types is consumed as compiled dist/, so nest build has nothing to
# resolve until tsc has run over it.
RUN pnpm --filter @imix/types build && pnpm --filter api build

# --- runtime ---------------------------------------------------------------
# A second, production-only install rather than a copy of the build stage's
# node_modules: that tree carries the Nest CLI, Jest and TypeScript, none of
# which a running server has any use for.
FROM base AS runtime
ENV NODE_ENV=production

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node packages/config/package.json packages/config/
COPY --chown=node:node packages/types/package.json packages/types/
COPY --chown=node:node apps/api/package.json apps/api/
# The schema has to be in place before the install: api's postinstall runs
# `prisma generate` against it, and the migrations travel with the image so the
# release step can apply them.
COPY --chown=node:node apps/api/prisma apps/api/prisma
COPY --chown=node:node apps/api/prisma.config.ts apps/api/
# The store is deleted in the same layer as the install that fills it —
# a `rm -rf` in a later RUN would only mask it behind an existing layer, not
# shrink the image. It holds a second copy of every package that is already
# unpacked into node_modules, and nothing after this point installs anything.
#
# ~/.cache/pnpm and not ~/.cache wholesale — the neighbours matter. ~/.cache/node
# is where corepack keeps the pnpm binary, and ~/.cache/prisma holds the schema
# engine `migrate deploy` runs. This container sits on a network with no route
# out, so anything deleted here cannot be fetched again.
RUN DATABASE_URL=$PRISMA_GENERATE_URL pnpm install --frozen-lockfile --prod --filter "api..." \
  && rm -rf /pnpm/store ~/.cache/pnpm

COPY --from=build --chown=node:node /repo/packages/types/dist packages/types/dist
COPY --from=build --chown=node:node /repo/apps/api/dist apps/api/dist

WORKDIR /repo/apps/api

# Informational only — the platform decides the real port and main.ts reads it
# from PORT.
EXPOSE 4000

# Migrations are deliberately not run here. Container start happens once per
# replica and per restart; `prisma migrate deploy` should happen once per
# release, which is what a platform's release/pre-deploy command is for:
#
#   pnpm --filter api db:deploy
CMD ["node", "dist/main"]

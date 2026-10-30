FROM node:current-alpine AS base

FROM base AS build-env

WORKDIR /usr/src/app

RUN apk add --no-cache libtool autoconf automake python3 make g++ pnpm

FROM build-env AS build

WORKDIR /usr/src/app

RUN --mount=target=/usr/src/app/package.json,source=package.json \
    --mount=target=/usr/src/app/pnpm-lock.yaml,source=pnpm-lock.yaml \
    --mount=target=/usr/src/app/pnpm-workspace.yaml,source=pnpm-workspace.yaml \
    pnpm ci

COPY --link . .

RUN pnpm run build

FROM build-env AS composit

WORKDIR /usr/src/app

RUN --mount=target=/usr/src/app/package.json,source=package.json \
    --mount=target=/usr/src/app/pnpm-lock.yaml,source=pnpm-lock.yaml \
    --mount=target=/usr/src/app/pnpm-workspace.yaml,source=pnpm-workspace.yaml \
    pnpm ci --prod && \
    mkdir stats

COPY --link --exclude=node_modules/ --from=build /usr/src/app/distribution /usr/src/app/distribution

FROM base AS deploy

HEALTHCHECK --interval=5m --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthcheck || exit 1

WORKDIR /usr/src/app

RUN apk add --no-cache ffmpeg

COPY --chown=node:node --from=composit /usr/src/app /usr/src/app

USER node

CMD [ "node", "distribution/src/index.js"]

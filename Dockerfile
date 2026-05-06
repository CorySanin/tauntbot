FROM node:lts-alpine AS base

FROM base AS build-env

WORKDIR /usr/src/app

RUN apk add --no-cache libtool autoconf automake python3 make g++ pnpm

FROM build-env AS build

WORKDIR /usr/src/app

RUN --mount=target=/usr/src/app/package.json,source=package.json \
    --mount=target=/usr/src/app/pnpm-lock.yaml,source=pnpm-lock.yaml \
    pnpm install

COPY --link . .

RUN pnpm run build

FROM build-env AS composit

WORKDIR /usr/src/app

RUN --mount=target=/usr/src/app/package.json,source=package.json \
    --mount=target=/usr/src/app/pnpm-lock.yaml,source=pnpm-lock.yaml \
    pnpm install --prod && \
    mkdir stats

COPY --link --from=build /usr/src/app/distribution /usr/src/app/distribution

FROM base AS deploy

HEALTHCHECK --timeout=3s \
  CMD curl --fail http://localhost:8080/healthcheck || exit 1

WORKDIR /usr/src/app

RUN apk add --no-cache ffmpeg curl

COPY --chown=node:node --from=composit /usr/src/app /usr/src/app

USER node

CMD [ "node", "distribution/src/index.js"]

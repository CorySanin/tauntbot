FROM node:lts-alpine AS base

FROM base AS build-env

WORKDIR /usr/src/app

RUN apk add --no-cache libtool autoconf automake python3 make g++

COPY package*.json ./

FROM build-env AS build

WORKDIR /usr/src/app

RUN npm ci

COPY . .

RUN npm run build

FROM build-env AS composit

WORKDIR /usr/src/app

RUN npm ci --only=production

COPY --from=build /usr/src/app/distribution /usr/src/app/distribution

FROM base AS deploy

WORKDIR /usr/src/app

COPY --from=composit /usr/src/app /usr/src/app

RUN apk add --no-cache ffmpeg curl && chown node . && mkdir stats

USER node

CMD [ "node", "distribution/src/index.js"]

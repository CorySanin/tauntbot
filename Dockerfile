FROM node:12-alpine as npm-install

WORKDIR /usr/src/app

RUN apk update; apk upgrade; apk add ca-certificates libtool autoconf automake git python make gcc g++

COPY package*.json ./

RUN npm ci --only=production

FROM node:12-alpine

RUN apk update; apk upgrade; apk add ca-certificates ffmpeg

COPY --from=npm-install /usr/src/app /usr/src/app

WORKDIR /usr/src/app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown appuser .

USER appuser

COPY . .

RUN mkdir stats

CMD [ "node", "index.js"]

FROM node:alpine as npm-install

WORKDIR /usr/src/app

RUN apk add --no-cache libtool autoconf automake python3 make g++

COPY package*.json ./

RUN npm ci --only=production

FROM node:alpine

WORKDIR /usr/src/app

COPY --from=npm-install /usr/src/app /usr/src/app

COPY . .

RUN apk add --no-cache ffmpeg && addgroup -S appgroup && adduser -S appuser -G appgroup && chown appuser . && mkdir stats

USER appuser

CMD [ "node", "index.js"]

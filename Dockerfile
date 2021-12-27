FROM node:17-alpine as build
WORKDIR /usr/src/bot/

COPY package.json yarn.lock tsconfig.json /usr/src/bot/


RUN apk add --no-cache python3 libpng libpng-dev jpeg-dev pango-dev cairo-dev giflib-dev \
    && apk add --no-cache --virtual .build-deps git build-base g++ make gcc
RUN yarn install --immutable --immutable-cache --check-cache
COPY . .
RUN yarn build-prod
RUN apk del .build-deps

CMD ["node", "bin/index.js"]
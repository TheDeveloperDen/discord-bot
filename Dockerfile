FROM node:17-alpine as build
WORKDIR /usr/src/bot/

COPY package.json yarn.lock tsconfig.json /usr/src/bot/


RUN apk add  --no-cache python3 make g++ gcc libpng libpng-dev jpeg-dev pango-dev cairo-dev giflib-dev
RUN yarn install --immutable --immutable-cache --check-cache
COPY . .
RUN yarn build-prod
RUN npm prune --production

FROM node:17-alpine as production
WORKDIR /usr/src/bot/
COPY --from=build /usr/src/bot/bin ./bin
COPY --from=build /usr/src/bot/node_modules ./node_modules

CMD ["node", "bin/index.js"]
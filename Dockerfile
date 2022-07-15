FROM node:17-alpine as build
WORKDIR /usr/src/bot/

COPY package.json yarn.lock ./
RUN apk add --no-cache python3 libpng libpng-dev jpeg-dev pango-dev cairo-dev giflib-dev git build-base g++ make gcc
RUN yarn install

COPY tsconfig.json tsconfig.production.json ./
COPY src/ ./src/
RUN yarn build-prod

FROM node:17-alpine
WORKDIR /usr/src/bot/
COPY src/ ./
COPY CascadiaCode.ttf ./
COPY hotTakeData.json ./
COPY --from=build /usr/src/bot/node_modules ./node_modules/
COPY --from=build /usr/src/bot/bin ./bin/
COPY --from=build /usr/src/bot/package.json ./package.json
RUN apk add --no-cache cairo-dev pango-dev jpeg-dev giflib-dev # these are needed by canvas at runtime
ENV NODE_ENV production
CMD ["yarn", "start-built"]

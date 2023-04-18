FROM node:17-alpine as build
WORKDIR /usr/src/bot/

COPY package.json yarn.lock ./
RUN apk add bash python3 libpng libpng-dev jpeg-dev pango-dev cairo-dev giflib-dev git build-base g++ make gcc
RUN yarn global add typescript
RUN yarn install

COPY tsconfig.json tsconfig.production.json ./
COPY src/ ./src/
RUN /bin/bash -c 'cd node_modules/djs-slash-helper; tsc'
RUN yarn build-prod

FROM node:17-alpine
WORKDIR /usr/src/bot/
COPY src/ ./
COPY CascadiaCode.ttf ./
COPY hotTakeData.json ./
COPY --from=build /usr/src/bot/node_modules ./node_modules/
COPY --from=build /usr/src/bot/bin ./bin/
COPY --from=build /usr/src/bot/package.json ./package.json
RUN apk add cairo-dev pango-dev jpeg-dev giflib-dev # these are needed by canvas at runtime
ENV NODE_ENV production
EXPOSE 3300 9229
CMD ["yarn", "start-built"]

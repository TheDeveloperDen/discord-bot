FROM node:17 as base
WORKDIR /usr/src/bot/

COPY package.json /usr/src/bot/
COPY yarn.lock /usr/src/bot/
COPY tsconfig.json /usr/src/bot/

RUN apt update && apt install -y python3
RUN yarn install --immutable --immutable-cache --check-cache

COPY . .

FROM base as production
RUN yarn build

CMD ["node", "bin/index.js"]
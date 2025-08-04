# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:latest AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
# add node-gyp dependencies
RUN apt-get update && apt-get install -y \
    python3 make build-essential pkg-config libpixman-1-dev libcairo2-dev \
    libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libstdc++6

RUN cd /temp/dev && bun install --frozen-lockfile --verbose

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production
RUN bun run lint
RUN bun run build-prod

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/bin ./bin
COPY --from=prerelease /usr/src/app/instrument.js .
COPY --from=prerelease /usr/src/app/hotTakeData.json .
COPY --from=prerelease /usr/src/app/CascadiaCode.ttf .
COPY --from=prerelease /usr/src/app/package.json .

RUN apt-get update && apt install -y libcairo2-dev libpango1.0-dev libgif7 librsvg2-2

# run the app
RUN chown -R bun:bun /usr/src/app
USER bun
ENTRYPOINT [ "bun", "run", "start-built" ]
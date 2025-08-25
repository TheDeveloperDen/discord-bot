# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:canary AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
# add node-gyp dependencies
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
    python3 make build-essential pkg-config libpixman-1-dev libcairo2-dev \
    libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /temp/dev
RUN bun install --frozen-lockfile --verbose \
    && mkdir -p /temp/prod

# install with --production (exclude devDependencies)
COPY package.json bun.lock /temp/prod/
ENV HUSKY=0
WORKDIR /temp/prod
RUN bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# [optional] tests & build
ENV NODE_ENV=production
RUN bun run lint && bun run build-prod

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/bin ./bin
COPY --from=prerelease /usr/src/app/instrument.js .
COPY --from=prerelease /usr/src/app/hotTakeData.json .
COPY --from=prerelease /usr/src/app/CascadiaCode.ttf .
COPY --from=prerelease /usr/src/app/package.json .

# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       libcairo2-dev libpango1.0-dev libgif7 librsvg2-2 curl \
    && rm -rf /var/lib/apt/lists/* \
    && chown -R bun:bun /usr/src/app

# run the app
USER bun
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s \
    CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT [ "bun", "run", "start-built" ]
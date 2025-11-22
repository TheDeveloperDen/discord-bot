# base image with system dependencies
FROM oven/bun:canary AS base
WORKDIR /usr/src/app
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       python3 make build-essential pkg-config libpixman-1-dev libcairo2-dev \
       libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libstdc++6 \
       libgif7 librsvg2-2 curl fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Install node modules.
FROM base AS deps
COPY package.json bun.lock ./
ENV HUSKY=0
RUN bun install --frozen-lockfile --production

# create final release image
FROM base AS release
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Set permissions for non-root user
RUN chown -R bun:bun /usr/src/app
USER bun

# Expose port and set entrypoint
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s \
    CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT [ "bun", "run", "start:prod" ]
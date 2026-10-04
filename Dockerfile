# base image with system dependencies
FROM oven/bun:1.4.2 AS base
WORKDIR /usr/src/app
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       python3 make build-essential pkg-config libpixman-1-dev libcairo2-dev \
       libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libstdc++6 \
       libgif7 librsvg2-2 curl fonts-noto-color-emoji ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install node modules.
FROM base AS deps
COPY package.json bun.lock ./
ENV HUSKY=0
RUN bun install --frozen-lockfile --production

# create final release image
FROM base AS release
COPY --from=deps --chown=1000:1000 /usr/src/app/node_modules ./node_modules
COPY --chown=1000:1000 . .
RUN mkdir -p /usr/src/app/logs && chown 1000:1000 /usr/src/app /usr/src/app/logs

# Git commit SHA, used as the Sentry release
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
USER 1000:1000

# Expose port and set entrypoint
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s \
    CMD ["curl", "-fsS", "http://localhost:3000/health"]
ENTRYPOINT [ "bun", "run", "start:prod" ]

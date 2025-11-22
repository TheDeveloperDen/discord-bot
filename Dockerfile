FROM oven/bun:canary AS base
WORKDIR /usr/src/app

# Install system dependencies needed for runtime
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       python3 make build-essential pkg-config libpixman-1-dev libcairo2-dev \
       libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libstdc++6 \
       libgif7 librsvg2-2 curl fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Copy over project files
COPY package.json bun.lock tsconfig.json tsconfig.production.json ./
COPY instrument.js CascadiaCode.ttf ./
COPY src ./src

# Install production dependencies
ENV HUSKY=0
RUN bun install --frozen-lockfile --production

# Set permissions for non-root user
RUN chown -R bun:bun /usr/src/app
USER bun

# Expose port and set entrypoint
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s \
    CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT [ "bun", "run", "start:prod" ]

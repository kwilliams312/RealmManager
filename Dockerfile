# Stage 1: Build the Next.js application
FROM node:22-slim AS builder

WORKDIR /app

# Install bun
RUN npm install -g bun@latest --quiet

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Copy source and build
COPY . .
RUN mkdir -p public && bun run build

# Stage 2: Production image
FROM node:22-slim

# Install Docker CLI for realm container management
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg git && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin docker-compose-plugin && \
    apt-get purge -y gnupg && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user with access to Docker socket
ARG DOCKER_GID=988
RUN groupadd -g $DOCKER_GID dockerhost && \
    useradd -r -m -s /bin/false -G dockerhost appuser

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public dir may be empty; copy if exists
RUN mkdir -p ./public
COPY --from=builder /app/public ./public/

# Copy seed data for first-boot source seeding
COPY --from=builder /app/src/data/seed ./data/seed

# Create data directories and set ownership
RUN mkdir -p /data/realms /data/etc && \
    chown -R appuser:appuser /app /data

USER appuser

EXPOSE 5555

ENV NODE_ENV=production
ENV PORT=5555
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

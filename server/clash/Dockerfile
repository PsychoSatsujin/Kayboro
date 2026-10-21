# Fandom Clash API in a container (an alternative to the Linode's systemd service; same server.mjs).
# Build from the repo root (the server shares tools/clash/matchmaking.js with the app):
#   docker build -f server/clash/Dockerfile -t kayboro-clash .
#   docker run -d --name clash -p 8787:8787 -v clash-data:/data kayboro-clash
# Snapshots go in the volume as files: /data/kv/snapshot%3Acurrent holds the id, /data/kv/snapshot%3A<id> the
# JSON (the id URL-encoded, as deploy.sh writes them). Put a proxy (Caddy) in front for HTTPS; with one, set
# TRUST_PROXY=1 so the per-IP rate limits see the client address from X-Real-IP.
FROM node:22-bookworm-slim

WORKDIR /app
COPY server/clash/schema.sql server/clash/schema.sql
COPY server/clash/src server/clash/src
COPY server/clash/node/server.mjs server/clash/node/shim.mjs server/clash/node/
COPY tools/clash/matchmaking.js tools/clash/matchmaking.js
COPY src/main/clash-matchmaking.js src/main/clash-matchmaking.js

RUN mkdir -p /data/kv && chown -R node:node /data
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0 DATA_DIR=/data TRUST_PROXY=0
VOLUME /data
USER node
EXPOSE 8787
# SIGTERM (docker stop) drains in-flight requests and closes SQLite; give it the 10 s it may take.
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "--experimental-sqlite", "--no-warnings", "server/clash/node/server.mjs"]

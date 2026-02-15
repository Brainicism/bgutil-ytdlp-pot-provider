FROM node:25-bookworm-slim AS install
USER node
WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci --omit=dev --no-audit --no-fund && \
    npm audit && npm audit signatures

FROM install AS build_node

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci --no-audit --no-fund && \
    npm audit && npm audit signatures

COPY types/ types/
COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

FROM install AS server_node

COPY --from=build_node /app/build /app/build

EXPOSE 4416
ENTRYPOINT ["/usr/local/bin/node", "build/main.js"]

FROM denoland/deno:debian-2.6.9 AS server_deno
USER deno
WORKDIR /app
ENV DENO_DIR=/app/.cache/deno
ENV DENO_NO_PROMPT=1 DENO_NO_UPDATE_CHECK=1

COPY types/ types/
COPY tsconfig.json package.json deno.lock ./
COPY --from=install --chown=deno:deno /app/node_modules node_modules/
COPY src/ src/

RUN deno cache --frozen src/main.ts

EXPOSE 4416
ENTRYPOINT [ \
    "/usr/bin/deno", "run", "--allow-env", "--allow-net", \
    "--allow-ffi=/app/node_modules", "--allow-read=/app/node_modules", \
    "/app/src/main.ts"]

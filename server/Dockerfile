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

COPY tsconfig.json ./
COPY src/ src/
COPY types/ types/
RUN npx tsc

FROM install AS server_node

COPY --from=build_node /app/build /app/build

EXPOSE 4416
ENTRYPOINT ["/usr/local/bin/node", "build/main.js"]

FROM denoland/deno:alpine-2.6.8 AS build_deno
USER deno
WORKDIR /app
ENV DENO_DIR=/home/deno/.cache/deno

COPY types/ types/
COPY tsconfig.json package.json deno.lock ./
COPY src/ src/
COPY --from=install /app/node_modules node_modules/

run --mount=type=cache,target=/home/deno/.cache/deno,uid=1000,gid=1000 \
    deno compile --output server --allow-env --allow-net --frozen --no-check \
    --allow-ffi=/tmp/deno-compile-server/node_modules \
    --allow-read=/tmp/deno-compile-server/node_modules \
    src/main.ts

FROM gcr.io/distroless/cc-debian12 AS server_deno
USER nonroot
WORKDIR /app

COPY --from=build_deno --chown=nonroot:nonroot /app/server ./

EXPOSE 4416
ENTRYPOINT ["/app/server"]

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
COPY tsconfig.json package.json package-lock.json ./
COPY --from=install --chown=deno:deno /app/node_modules node_modules/
COPY scripts/ scripts/
COPY src/ src/

# Generate a v4 deno.lock file
RUN deno upgrade --output 'deno.v4' \
    --checksum '70bad6284689e7d20e9dc8fa4feab92b895396ba2bb3faf848e9078b2d75db14' \
    'v2.2.15' && \
    ./deno.v4 install --node-modules-dir=manual --entrypoint src/main.ts && \
    deno run -A scripts/check.ts ; \
    rm -f deno.v4

RUN deno cache --frozen src/main.ts ; \
    du -had 5 "${DENO_DIR}" | sort -h

EXPOSE 4416
ENTRYPOINT [ \
    "/usr/bin/deno", "run", "--allow-env", "--allow-net", \
    "--allow-ffi=/app/node_modules", "--allow-read=/app/node_modules", \
    "/app/src/main.ts"]

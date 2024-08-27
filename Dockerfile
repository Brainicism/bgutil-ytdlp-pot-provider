FROM node:20-slim AS build
WORKDIR /app
COPY yarn.lock package.json ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

ENTRYPOINT ["node", "build/main.js"]

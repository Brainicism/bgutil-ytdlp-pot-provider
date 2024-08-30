FROM node:20-slim AS build
WORKDIR /app

COPY yarn.lock package.json ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

FROM node:20-slim
WORKDIR /app

COPY --from=build /app/build /app/build
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/yarn.lock /app/yarn.lock
RUN yarn install --production

ENTRYPOINT ["node", "build/main.js"]

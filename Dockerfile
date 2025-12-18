FROM node:22-slim as builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN node ace build --ignore-ts-errors

FROM node:22-slim as production

WORKDIR /app

COPY --from=builder /app/build .

COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=3333

EXPOSE 3333

CMD ["node", "bin/server.js"]

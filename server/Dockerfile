FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci

COPY server ./server
COPY package.json package-lock.json ./
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build:server

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/index.js"]
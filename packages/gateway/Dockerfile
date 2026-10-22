FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/gateway/package.json ./packages/gateway/
RUN npm install
COPY packages/shared ./packages/shared
COPY packages/gateway ./packages/gateway
RUN npm run build -w packages/shared
RUN npm run build -w packages/gateway

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/gateway/dist ./packages/gateway/dist
COPY packages/gateway/package.json ./packages/gateway/
ENV NODE_ENV=production
CMD ["node", "packages/gateway/dist/server.js"]

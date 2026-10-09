# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++ vips-dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
RUN apk add --no-cache python3 make g++ vips-dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runner
RUN apk add --no-cache vips
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY deploy/run-migrations.mjs ./deploy/run-migrations.mjs
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/main"]

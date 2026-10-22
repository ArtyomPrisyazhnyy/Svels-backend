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
ARG GIT_SHA=unknown
ENV NODE_ENV=production
ENV SENTRY_RELEASE=${GIT_SHA}
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY deploy/run-migrations.mjs ./deploy/run-migrations.mjs
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]

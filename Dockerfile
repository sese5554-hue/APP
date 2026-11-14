FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PROVIDER_MODE=unconfigured HOST=0.0.0.0 PORT=3001 UPLOAD_DIR=/app/.runtime/uploads
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir -p .runtime/uploads && chown -R node:node .runtime
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/database ./database
COPY --from=build --chown=node:node /app/scripts/process.mjs /app/scripts/serve.mjs ./scripts/
USER node
EXPOSE 3001
CMD ["node", "dist/api/apps/api/src/server.js"]

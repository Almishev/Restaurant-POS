# --- Stage 1: build React client ---
FROM node:20-alpine AS client-build
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
ENV CI=false
RUN npm run build

# --- Stage 2: production API + static UI ---
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8081
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev

COPY config ./config
COPY controllers ./controllers
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY utils ./utils
COPY cron ./cron
COPY server.js seeder.js ./

COPY --from=client-build /app/client/build ./client/build

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8081)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

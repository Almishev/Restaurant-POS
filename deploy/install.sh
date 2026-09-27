#!/usr/bin/env bash
# Installs Restaurant POS via Docker Hub image (Linux / macOS).
#
# Usage:
#   chmod +x install.sh
#   ./install.sh
#   JWT_SECRET="my-secret" APP_PORT=8081 ./install.sh /opt/restaurant-pos

set -euo pipefail

INSTALL_DIR="${1:-$(pwd)/restaurant-pos}"
APP_PORT="${APP_PORT:-8081}"
DOCKER_IMAGE="${DOCKER_IMAGE:-antonalmishev/restaurant-pos:latest}"
JWT_SECRET="${JWT_SECRET:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не е намерен. Инсталирай Docker и опитай отново." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose не е наличен." >&2
  exit 1
fi

if [[ -z "$JWT_SECRET" ]]; then
  if command -v openssl >/dev/null 2>&1; then
    JWT_SECRET="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-32)"
  else
    JWT_SECRET="change-me-$(date +%s)"
  fi
  echo "Генериран JWT_SECRET (запазен в .env)."
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
echo "Инсталационна папка: $INSTALL_DIR"

cat > docker-compose.yml <<'YAML'
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db

  app:
    image: ${DOCKER_IMAGE:-antonalmishev/restaurant-pos:latest}
    restart: unless-stopped
    ports:
      - "${APP_PORT:-8081}:8081"
    environment:
      PORT: "8081"
      HOST: "0.0.0.0"
      MONGO_URI: mongodb://mongo:27017/restaurant-pos
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
    depends_on:
      - mongo

volumes:
  mongo_data:
YAML

cat > .env <<EOF
APP_PORT=${APP_PORT}
JWT_SECRET=${JWT_SECRET}
DOCKER_IMAGE=${DOCKER_IMAGE}
EOF

echo "Pull image..."
docker compose pull

echo "Start containers..."
docker compose up -d

echo "Seed database (first install)..."
docker compose run --rm app node seeder.js

echo ""
echo "Готово!"
echo "Отвори: http://localhost:${APP_PORT}"
echo "От таблет: http://<IP-НА-ТОЗИ-PC>:${APP_PORT}"
echo "Вход: admin / 0000  |  bar / 0000  |  kitchen / 0000"
echo "Папка: ${INSTALL_DIR}"

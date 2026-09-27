# Deploy Restaurant POS with Docker Hub image

1. Copy `docker-compose.yml` and `.env.example` to the restaurant machine.
2. Rename `.env.example` → `.env` and set a strong `JWT_SECRET`.
3. Image default: `antonalmishev/restaurant-pos:latest` (change `DOCKER_IMAGE` only if needed).
4. Run:

```bash
docker compose pull
docker compose up -d
docker compose run --rm app node seeder.js
```

5. Open `http://SERVER-IP:8081` on the PC and waiter tablets (same Wi‑Fi/LAN).

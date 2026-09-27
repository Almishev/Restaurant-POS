# Инсталационен скрипт за Restaurant POS (Docker)

Този документ описва как да създадеш (или използваш готовия) скрипт, който на ресторантски компютър автоматично:

1. Създава папка `restaurant-pos`
2. Записва `docker-compose.yml`
3. Записва `.env` с:
   - `APP_PORT=8081`
   - `JWT_SECRET=...`
   - `DOCKER_IMAGE=antonalmishev/restaurant-pos:latest`
4. Изпълнява:
   ```bash
   docker compose pull
   docker compose up -d
   docker compose run --rm app node seeder.js
   ```

Готови скриптове в тази папка:

| Файл | ОС |
|------|-----|
| `install.ps1` | Windows (PowerShell) |
| `install.sh` | Linux / macOS |

---

## Предварителни изисквания

На целевия компютър трябва да има:

- [Docker Desktop](https://docs.docker.com/desktop/) (Windows/macOS) **или** Docker Engine + Compose plugin (Linux)
- Достъп до интернет (за `docker pull` от Docker Hub)

Проверка:

```bash
docker --version
docker compose version
```

---

## Вариант A — използвай готовия скрипт

### Windows (PowerShell)

1. Копирай на компютъра файловете:
   - `install.ps1`
   - (по желание) `docker-compose.yml` — скриптът го създава сам, ако липсва
2. Отвори PowerShell **в папката със скрипта** и изпълни:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

С персонализирана тайна:

```powershell
.\install.ps1 -JwtSecret "moqta-mnogo-silna-taina"
```

### Linux / macOS

```bash
chmod +x install.sh
./install.sh
```

С персонализирана тайна:

```bash
JWT_SECRET="moqta-mnogo-silna-taina" ./install.sh
```

След успех отвори в браузър:

`http://localhost:8081`  
или от таблет в същата мрежа: `http://IP-НА-СЪРВЪРА:8081`

---

## Вариант B — създай скрипта сам

### 1) Какво трябва да направи скриптът

Псевдокод:

```text
ако няма Docker → спри с грешка
mkdir restaurant-pos (ако няма) и влез в папката
запиши docker-compose.yml (съдържанието от deploy/docker-compose.yml)
запиши .env с APP_PORT, JWT_SECRET, DOCKER_IMAGE
docker compose pull
docker compose up -d
docker compose run --rm app node seeder.js
изпиши URL и default потребители
```

### 2) Съдържание на `.env`

```env
APP_PORT=8081
JWT_SECRET=сложна-тайна
DOCKER_IMAGE=antonalmishev/restaurant-pos:latest
```

> Смени `JWT_SECRET` с дълъг случаен низ на всеки ресторант.

### 3) Съдържание на `docker-compose.yml`

Използвай файла `docker-compose.yml` от тази папка (`deploy/docker-compose.yml` в репото).  
Скриптовете `install.ps1` / `install.sh` могат да го **вградят** (write на диска), за да не се налага ръчно копиране.

### 4) Минимален PowerShell пример

```powershell
$Dir = Join-Path $PWD "restaurant-pos"
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
Set-Location $Dir

@"
APP_PORT=8081
JWT_SECRET=change-me-to-a-long-random-string
DOCKER_IMAGE=antonalmishev/restaurant-pos:latest
"@ | Set-Content -Encoding utf8 .env

# Тук запиши и docker-compose.yml (виж install.ps1)

docker compose pull
docker compose up -d
docker compose run --rm app node seeder.js
```

### 5) Минимален Bash пример

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p restaurant-pos && cd restaurant-pos

cat > .env <<'EOF'
APP_PORT=8081
JWT_SECRET=change-me-to-a-long-random-string
DOCKER_IMAGE=antonalmishev/restaurant-pos:latest
EOF

# Тук запиши и docker-compose.yml (виж install.sh)

docker compose pull
docker compose up -d
docker compose run --rm app node seeder.js
```

Пълните версии са в `install.ps1` и `install.sh`.

---

## След инсталация

### Default вход (след seeder)

| Потребител | Парола | Роля |
|------------|--------|------|
| `admin` | `0000` | администратор |
| `bar` | `0000` | само `/bar` |
| `kitchen` | `0000` | само `/kitchen` |

### Обновяване към нова версия (след GitHub Actions push)

В папката `restaurant-pos`:

```bash
docker compose pull
docker compose up -d
```

**Не** пускай отново `seeder.js` при update — ще презапише артикулите (ако не ползваш `--users-only`).

Само потребители (без да пипа менюто):

```bash
docker compose run --rm app node seeder.js --users-only
```

### Спиране

```bash
docker compose down
```

### Пълно изтриване (вкл. базата)

```bash
docker compose down -v
```

---

## Често срещани проблеми

| Проблем | Решение |
|---------|---------|
| `docker: command not found` | Инсталирай Docker Desktop / Docker Engine |
| Порт 8081 зает | Смени `APP_PORT` в `.env` (напр. `8082`) |
| Таблетите не отварят страницата | Използвай LAN IP на сървъра, не `localhost`; провери firewall |
| Стар image | `docker compose pull` после `up -d` |

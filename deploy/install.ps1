#Requires -Version 5.1
<#
.SYNOPSIS
  Installs Restaurant POS via Docker Hub image (Windows).

.EXAMPLE
  .\install.ps1
  .\install.ps1 -JwtSecret "my-strong-secret" -InstallDir "C:\restaurant-pos"
#>
param(
  [string]$InstallDir = (Join-Path (Get-Location) "restaurant-pos"),
  [string]$JwtSecret = "",
  [string]$AppPort = "8081",
  [string]$DockerImage = "antonalmishev/restaurant-pos:latest"
)

$ErrorActionPreference = "Stop"

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker не е намерен. Инсталирай Docker Desktop и опитай отново."
  }
  docker compose version | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose не е наличен. Обнови Docker Desktop."
  }
}

function New-RandomSecret {
  $bytes = New-Object byte[] 24
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes) -replace "[+/=]", "x")
}

Assert-Docker

if ([string]::IsNullOrWhiteSpace($JwtSecret)) {
  $JwtSecret = New-RandomSecret
  Write-Host "Генериран JWT_SECRET (запазен в .env)." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Set-Location $InstallDir
Write-Host "Инсталационна папка: $InstallDir" -ForegroundColor Cyan

$compose = @"
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db

  app:
    image: `${DOCKER_IMAGE:-antonalmishev/restaurant-pos:latest}
    restart: unless-stopped
    ports:
      - "`${APP_PORT:-8081}:8081"
    environment:
      PORT: "8081"
      HOST: "0.0.0.0"
      MONGO_URI: mongodb://mongo:27017/restaurant-pos
      JWT_SECRET: `${JWT_SECRET:-change-me-in-production}
    depends_on:
      - mongo

volumes:
  mongo_data:
"@

$envFile = @"
APP_PORT=$AppPort
JWT_SECRET=$JwtSecret
DOCKER_IMAGE=$DockerImage
"@

Set-Content -Path "docker-compose.yml" -Value $compose -Encoding UTF8
Set-Content -Path ".env" -Value $envFile -Encoding UTF8

Write-Host "Pull image..." -ForegroundColor Cyan
docker compose pull
if ($LASTEXITCODE -ne 0) { throw "docker compose pull failed" }

Write-Host "Start containers..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

Write-Host "Seed database (first install)..." -ForegroundColor Cyan
docker compose run --rm app node seeder.js
if ($LASTEXITCODE -ne 0) { throw "seeder failed" }

Write-Host ""
Write-Host "Готово!" -ForegroundColor Green
Write-Host "Отвори: http://localhost:$AppPort"
Write-Host "От таблет: http://<IP-НА-ТОЗИ-PC>:$AppPort"
Write-Host "Вход: admin / 0000  |  bar / 0000  |  kitchen / 0000"
Write-Host "Папка: $InstallDir"

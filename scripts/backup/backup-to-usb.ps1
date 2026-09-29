#Requires -Version 5.1
<#
.SYNOPSIS
  Dump restaurant-pos MongoDB to USB flash drive (POS-BACKUP.id).

.EXAMPLE
  .\backup-to-usb.ps1
  .\backup-to-usb.ps1 -UsbPath "E:\" -KeepDays 14
#>
param(
  [string]$UsbPath = $env:POS_BACKUP_USB,
  [string]$DbName = "restaurant-pos",
  [string]$MongoUri = "mongodb://127.0.0.1:27017",
  [int]$KeepDays = 14,
  [string]$ComposeDir = ""
)

$ErrorActionPreference = "Stop"
$MarkerName = "POS-BACKUP.id"
$Stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$LogPrefix = "[POS-BACKUP $Stamp]"

function Write-Log([string]$msg, [string]$color = "White") {
  Write-Host "$LogPrefix $msg" -ForegroundColor $color
}

function Find-UsbRoot {
  if ($UsbPath -and (Test-Path -LiteralPath $UsbPath)) {
    return (Resolve-Path -LiteralPath $UsbPath).Path
  }
  if ($env:POS_BACKUP_USB -and (Test-Path -LiteralPath $env:POS_BACKUP_USB)) {
    return (Resolve-Path -LiteralPath $env:POS_BACKUP_USB).Path
  }

  foreach ($drive in (Get-PSDrive -PSProvider FileSystem)) {
    if ($drive.Name -notmatch '^[A-Z]$') { continue }
    if ($drive.Name -eq 'C') { continue }
    $root = "$($drive.Name):\"
    $marker = Join-Path $root $MarkerName
    if (Test-Path -LiteralPath $marker) { return $root }
  }

  try {
    $labeled = Get-Volume | Where-Object {
      $_.FileSystemLabel -eq "POS-BACKUP" -and $_.DriveLetter
    } | Select-Object -First 1
    if ($labeled) {
      return "$($labeled.DriveLetter):\"
    }
  } catch {}

  if (Test-Path -LiteralPath "E:\") { return "E:\" }

  return $null
}

function Find-Mongodump {
  if ($env:MONGODUMP_PATH -and (Test-Path -LiteralPath $env:MONGODUMP_PATH)) {
    return $env:MONGODUMP_PATH
  }
  $cmd = Get-Command mongodump -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "C:\Users\Admin\Desktop\mongodb-database-tools-windows-x86_64-100.10.0\bin\mongodump.exe",
    "$env:USERPROFILE\Desktop\mongodb-database-tools-windows-x86_64-100.10.0\bin\mongodump.exe",
    "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe",
    "C:\Program Files\MongoDB\Tools\bin\mongodump.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  return $null
}

function Find-MongoContainer {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $null }
  try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { return $null }
  } catch { return $null }

  $id = docker ps --filter "ancestor=mongo:7" --format "{{.ID}}" 2>$null | Select-Object -First 1
  if ($id) { return $id }
  $id = docker ps --format "{{.ID}} {{.Names}} {{.Image}}" 2>$null |
    Where-Object { $_ -match '\bmongo\b' } |
    ForEach-Object { ($_ -split '\s+')[0] } |
    Select-Object -First 1
  return $id
}

function Invoke-DockerDump([string]$containerId, [string]$outDir) {
  Write-Log "Dump via Docker container $containerId ..." "Cyan"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  # Dump inside container then docker cp (portable; avoids Windows path bind quirks)
  $remote = "/tmp/pos-backup-$Stamp"
  docker exec $containerId mongodump --db=$DbName --out=$remote
  if ($LASTEXITCODE -ne 0) { throw "docker exec mongodump failed" }
  docker cp "${containerId}:${remote}/$DbName" $outDir
  if ($LASTEXITCODE -ne 0) { throw "docker cp failed" }
  docker exec $containerId rm -rf $remote | Out-Null
}

function Invoke-LocalDump([string]$outDir) {
  $mongodump = Find-Mongodump
  if (-not $mongodump) {
    throw "mongodump not found. Install MongoDB Database Tools or set MONGODUMP_PATH."
  }
  Write-Log "Dump via local mongodump: $mongodump" "Cyan"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  & $mongodump --uri="$MongoUri" --db=$DbName --out=$outDir
  if ($LASTEXITCODE -ne 0) { throw "mongodump failed (is Mongo running on $MongoUri?)" }
}

function Remove-OldBackups([string]$backupRoot, [int]$days) {
  if ($days -le 0) { return }
  $cutoff = (Get-Date).AddDays(-$days)
  Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.CreationTime -lt $cutoff) {
      Write-Log "Prune old backup: $($_.Name)" "DarkYellow"
      Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
  }
}

# --- main ---
$usbRoot = Find-UsbRoot
if (-not $usbRoot) {
  throw "USB backup target not found. Run init-usb.ps1 or set POS_BACKUP_USB / plug in the stick."
}

$marker = Join-Path $usbRoot $MarkerName
if (-not (Test-Path -LiteralPath $marker)) {
  Write-Log "Warning: $MarkerName missing on $usbRoot - continuing anyway." "Yellow"
}

$backupRoot = Join-Path $usbRoot "pos-backups"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$dest = Join-Path $backupRoot $Stamp
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Log "USB: $usbRoot" "Green"
Write-Log "Destination: $dest" "Green"

$container = Find-MongoContainer
try {
  if ($container) {
    Invoke-DockerDump -containerId $container -outDir $dest
  } else {
    Invoke-LocalDump -outDir $dest
  }
} catch {
  Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue
  throw
}

$meta = @{
  timestamp   = (Get-Date).ToString("o")
  hostname    = $env:COMPUTERNAME
  os          = "windows"
  db          = $DbName
  method      = $(if ($container) { "docker:$container" } else { "local:$MongoUri" })
  destination = $dest
} | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $dest "backup-meta.json") -Value $meta -Encoding UTF8

Remove-OldBackups -backupRoot $backupRoot -days $KeepDays

$sizeMB = [math]::Round(((Get-ChildItem -LiteralPath $dest -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 2)
Write-Log "OK - backup complete ($sizeMB MB)" "Green"

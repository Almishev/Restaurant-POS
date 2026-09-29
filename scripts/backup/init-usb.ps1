#Requires -Version 5.1
<#
.SYNOPSIS
  Initialize USB stick as POS backup target (writes POS-BACKUP.id).

.EXAMPLE
  .\init-usb.ps1 -DriveLetter E
  .\init-usb.ps1 -Path "E:\"
#>
param(
  [ValidatePattern('^[A-Za-z]$')]
  [string]$DriveLetter = "E",
  [string]$Path = "",
  [string]$VolumeLabel = "POS-BACKUP"
)

$ErrorActionPreference = "Stop"

if (-not $Path) {
  $Path = "${DriveLetter}:\"
}

if (-not (Test-Path -LiteralPath $Path)) {
  throw "USB path not found: $Path - plug in the flash drive first."
}

$marker = Join-Path $Path "POS-BACKUP.id"
$content = @"
Restaurant-POS backup target
created=$(Get-Date -Format "o")
hostname=$env:COMPUTERNAME
os=windows
"@
Set-Content -LiteralPath $marker -Value $content -Encoding UTF8

$backupRoot = Join-Path $Path "pos-backups"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

try {
  $vol = Get-Volume -DriveLetter $DriveLetter -ErrorAction Stop
  if ($vol.FileSystemLabel -ne $VolumeLabel) {
    Set-Volume -DriveLetter $DriveLetter -NewFileSystemLabel $VolumeLabel -ErrorAction Stop
    Write-Host "Volume label set to $VolumeLabel" -ForegroundColor Green
  }
} catch {
  Write-Host "Could not set volume label (need Admin?). Marker file is enough." -ForegroundColor Yellow
}

Write-Host "USB ready: $marker" -ForegroundColor Green
Write-Host "Backups will go to: $backupRoot" -ForegroundColor Cyan

#Requires -Version 5.1
<#
.SYNOPSIS
  Register daily Windows Scheduled Task for POS USB backup (23:00).

.EXAMPLE
  .\install-windows-task.ps1
  .\install-windows-task.ps1 -Time "22:00" -TaskName "RestaurantPOS-Backup"
#>
param(
  [string]$TaskName = "RestaurantPOS-USB-Backup",
  [string]$Time = "23:00"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupScript = Join-Path $scriptDir "backup-to-usb.ps1"

if (-not (Test-Path -LiteralPath $backupScript)) {
  throw "Missing $backupScript"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument `
  "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""

$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

try {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null
} catch {
  # Fallback without elevation / CIM issues
  $tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
  schtasks /Create /TN $TaskName /TR $tr /SC DAILY /ST $Time /F | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to register scheduled task. Run PowerShell as Administrator." }
}

Write-Host "Scheduled task '$TaskName' registered daily at $Time." -ForegroundColor Green
Write-Host "Script: $backupScript" -ForegroundColor Cyan
Write-Host "Test now: schtasks /Run /TN `"$TaskName`"" -ForegroundColor Yellow

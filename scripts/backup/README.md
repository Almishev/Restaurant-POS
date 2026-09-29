# POS automatic backup → USB flash drive

Backs up MongoDB (`restaurant-pos`) to a USB stick that works on **Windows and Linux**.

## One-time: prepare the USB

1. Plug in the flash drive.
2. Run the init script (creates marker file `POS-BACKUP.id`):

**Windows (PowerShell as Admin recommended for volume label):**
```powershell
cd C:\Users\Admin\Desktop\POS-restaurant\Restaurant-POS\scripts\backup
.\init-usb.ps1 -DriveLetter E
```

**Linux:**
```bash
cd /path/to/Restaurant-POS/scripts/backup
chmod +x *.sh
sudo ./init-usb.sh /media/$USER/YOUR_USB_MOUNT
# or after auto-mount:
./init-usb.sh
```

Optional: set volume label to `POS-BACKUP` (helps discovery).

## Run backup now

**Windows:**
```powershell
.\backup-to-usb.ps1
```

**Linux:**
```bash
./backup-to-usb.sh
```

Output folder on USB:
```
<USB>/pos-backups/2026-09-28_221500/
  restaurant-pos/     # mongodump files
  backup-meta.json
```

Old backups are pruned (default keep **14** days).

## Schedule (automatic)

**Windows Task Scheduler (daily 23:00):**
```powershell
.\install-windows-task.ps1
```

**Linux cron (daily 23:00):**
```bash
./install-linux-cron.sh
```

## How the USB is found

1. Env override: `POS_BACKUP_USB` / `-UsbPath`
2. Drive/mount that contains `POS-BACKUP.id`
3. Volume labeled `POS-BACKUP`
4. Windows fallback: drive `E:` if present

## Mongo source (auto)

1. Running Docker container matching `mongo` → `docker exec … mongodump`
2. Else local `mongodump` against `mongodb://127.0.0.1:27017`

If Database Tools are not in PATH (Windows), set:
```powershell
$env:MONGODUMP_PATH = "C:\Users\Admin\Desktop\mongodb-database-tools-windows-x86_64-100.10.0\bin\mongodump.exe"
```

Or add that `bin` folder to PATH.

## Move stick Windows → Linux

1. Safely eject on Windows.
2. Plug into Linux PC → mount (usually under `/media/...` or `/run/media/...`).
3. Run `./backup-to-usb.sh` (or rely on cron). Same `POS-BACKUP.id` is detected.

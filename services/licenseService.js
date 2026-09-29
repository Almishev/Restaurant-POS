/**
 * Subscription / license check via Google Apps Script + Sheet.
 * Env:
 *   LICENSE_ENABLED=true|false   (default true if URL+shop+key set)
 *   LICENSE_CHECK_URL=https://script.google.com/macros/s/.../exec
 *   LICENSE_SHOP_ID=SHOP-...
 *   LICENSE_KEY=XXXX-XXXX-...
 *   LICENSE_TIMEOUT_MS=10000
 *   LICENSE_OFFLINE_GRACE_DAYS=7  (allow login if last ok check within N days)
 */
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'license-cache.json');

class LicenseService {
  get enabled() {
    const flag = process.env.LICENSE_ENABLED;
    if (flag === 'false') return false;
    if (flag === 'true') return true;
    // Auto-enable only when all required config is present
    return Boolean(this.checkUrl && this.shopId && this.licenseKey);
  }

  get checkUrl() {
    return (process.env.LICENSE_CHECK_URL || '').trim().replace(/\/$/, '');
  }

  get shopId() {
    return (process.env.LICENSE_SHOP_ID || '').trim();
  }

  get licenseKey() {
    return (process.env.LICENSE_KEY || '').trim();
  }

  get timeoutMs() {
    return Number(process.env.LICENSE_TIMEOUT_MS || 10000);
  }

  get offlineGraceDays() {
    return Number(process.env.LICENSE_OFFLINE_GRACE_DAYS || 7);
  }

  readCache() {
    try {
      if (!fs.existsSync(CACHE_FILE)) return null;
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      return null;
    }
  }

  writeCache(payload) {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        CACHE_FILE,
        JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }, null, 2),
        'utf8'
      );
    } catch (err) {
      console.log('[LICENSE] cache write failed:', err.message);
    }
  }

  cacheStillValid() {
    const cache = this.readCache();
    if (!cache || !cache.active || !cache.cachedAt) return null;
    const ageMs = Date.now() - new Date(cache.cachedAt).getTime();
    const maxMs = this.offlineGraceDays * 24 * 60 * 60 * 1000;
    if (ageMs > maxMs) return null;
    return cache;
  }

  reasonMessage(reason, data = {}) {
    const map = {
      missing_params: 'Липсват настройки за лиценз (shop_id / license_key).',
      not_found: 'Лицензът не е намерен. Провери shop_id и ключа.',
      sheet_not_found: 'Грешка в лицензния сървър (липсва таблица).',
      disabled_or_expired_status: 'Абонаментът е деактивиран.',
      past_valid_until: `Абонаментът е изтекъл${
        data.valid_until ? ` на ${data.valid_until}` : ''
      }.`,
      inactive: 'Абонаментът не е активен.',
      network: 'Няма връзка към лицензния сървър.',
      error: data.message || 'Грешка при проверка на абонамента.',
      not_configured:
        'Лицензът не е конфигуриран. Задай LICENSE_SHOP_ID и LICENSE_KEY в .env',
    };
    return map[reason] || data.message || 'Абонаментът не е валиден.';
  }

  async fetchRemote() {
    const url = new URL(this.checkUrl);
    url.searchParams.set('shop_id', this.shopId);
    url.searchParams.set('license_key', this.licenseKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        redirect: 'follow',
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Невалиден отговор от лицензния сървър');
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * @returns {{ ok: boolean, active: boolean, message?: string, shop_name?: string, valid_until?: string, offline?: boolean }}
   */
  async verify() {
    if (!this.enabled) {
      return {
        ok: true,
        active: true,
        skipped: true,
        message: 'License check disabled',
      };
    }

    if (!this.checkUrl || !this.shopId || !this.licenseKey) {
      return {
        ok: false,
        active: false,
        reason: 'not_configured',
        message: this.reasonMessage('not_configured'),
      };
    }

    try {
      const data = await this.fetchRemote();

      if (!data || data.ok === false) {
        const reason = data?.reason || 'not_found';
        return {
          ok: false,
          active: false,
          reason,
          message: this.reasonMessage(reason, data),
          raw: data,
        };
      }

      if (!data.active) {
        const reason = data.reason || 'inactive';
        this.writeCache({ active: false, ...data });
        return {
          ok: true,
          active: false,
          reason,
          message: this.reasonMessage(reason, data),
          shop_name: data.shop_name,
          valid_until: data.valid_until,
          raw: data,
        };
      }

      this.writeCache({
        active: true,
        shop_id: data.shop_id,
        shop_name: data.shop_name,
        valid_until: data.valid_until,
        status: data.status,
      });

      return {
        ok: true,
        active: true,
        reason: 'ok',
        shop_name: data.shop_name,
        valid_until: data.valid_until,
        raw: data,
      };
    } catch (err) {
      console.log('[LICENSE] remote check failed:', err.message);
      const grace = this.cacheStillValid();
      if (grace) {
        return {
          ok: true,
          active: true,
          offline: true,
          shop_name: grace.shop_name,
          valid_until: grace.valid_until,
          message: `Офлайн режим: ползва се последна валидна проверка (до ${this.offlineGraceDays} дни).`,
        };
      }
      return {
        ok: false,
        active: false,
        reason: 'network',
        message:
          this.reasonMessage('network') +
          ' Няма скорошна валидна проверка за офлайн достъп.',
      };
    }
  }
}

module.exports = new LicenseService();

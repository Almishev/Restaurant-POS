const mongoose = require('mongoose');

/**
 * ErpNet.FP integration (http://localhost:8001 by default).
 * A sale is stored only after the fiscal device prints the receipt.
 */
class FiscalService {
  get baseUrl() {
    return (process.env.FISCAL_FP_BASE_URL || 'http://localhost:8001').replace(
      /\/$/,
      ''
    );
  }

  get printerId() {
    return process.env.FISCAL_PRINTER_ID || '';
  }

  get operator() {
    return process.env.FISCAL_OPERATOR || '1';
  }

  get operatorPassword() {
    return process.env.FISCAL_OPERATOR_PASSWORD || '1';
  }

  get taxGroup() {
    return Number(process.env.FISCAL_TAX_GROUP || 2);
  }

  get timeoutMs() {
    return Number(process.env.FISCAL_TIMEOUT_MS || 30000);
  }

  mapPaymentType(paymentMode) {
    const p = String(paymentMode || '').toLowerCase();
    if (p === 'room' || p.includes('стая') || p === 'credit') return 'credit';
    if (p === 'card' || p === 'карта' || p.includes('card')) return 'card';
    return 'cash';
  }

  deviceCode(serial) {
    const cleaned = String(serial || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!cleaned) {
      throw new Error('Фискалното устройство не върна сериен номер');
    }
    if (cleaned.length >= 8) return cleaned.slice(-8);
    return cleaned.padStart(8, '0');
  }

  mapStornoReasonToFiscalCode(reason) {
    const reasonMap = {
      operatorError: 'operator-error',
      returnedItems: 'refund',
      defectiveGoods: 'refund',
      other: 'operator-error',
    };
    return reasonMap[reason] || 'operator-error';
  }

  truncateText(text, maxLen = 32) {
    const s = String(text || '').trim();
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen);
  }

  buildSaleItems(cartItems) {
    return (cartItems || [])
      .map((item) => {
        const line = {
          type: 'sale',
          text: this.truncateText(item.name || item.text || 'Артикул'),
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.price) || 0,
          taxGroup: Number(item.taxGroup) || this.taxGroup,
        };
        if (item.note) {
          return [
            line,
            { type: 'comment', text: this.truncateText(item.note, 40) },
          ];
        }
        return [line];
      })
      .flat();
  }

  async nextUnpDocNumber(deviceCode) {
    const Counter =
      mongoose.models.FiscalCounter ||
      mongoose.model(
        'FiscalCounter',
        new mongoose.Schema({
          _id: { type: String },
          seq: { type: Number, default: 0 },
        })
      );
    const doc = await Counter.findByIdAndUpdate(
      `unp:${deviceCode}`,
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return String(doc.seq).padStart(7, '0').slice(-7);
  }

  buildUniqueSaleNumber(deviceCode, operatorCode, docNumber) {
    const op = String(operatorCode || this.operator).replace(/\D/g, '').padStart(4, '0').slice(-4);
    const seq = String(docNumber).padStart(7, '0').slice(-7);
    return `${deviceCode}-${op}-${seq}`;
  }

  async httpJson(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        const msg =
          (Array.isArray(data.messages) && data.messages[0]?.text) ||
          data.error ||
          `HTTP ${res.status} ${path}`;
        throw new Error(msg);
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`ErpNet.FP timeout (${this.timeoutMs}ms): ${path}`);
      }
      if (err.cause?.code === 'ECONNREFUSED' || /fetch failed/i.test(err.message)) {
        throw new Error(
          `ErpNet.FP недостъпен на ${this.baseUrl}. Провери дали сървърът работи.`
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  isOk(result) {
    if (!result) return false;
    const ok = result.ok;
    return ok === true || ok === 'true';
  }

  assertOk(result, action) {
    if (this.isOk(result)) return;
    const errMsg =
      (Array.isArray(result?.messages) &&
        result.messages.find((m) => m.type === 'error')?.text) ||
      `${action} failed`;
    throw new Error(errMsg);
  }

  async listPrinters() {
    return this.httpJson('GET', '/printers');
  }

  async resolvePrinterId() {
    if (this.printerId) return this.printerId;
    const printers = await this.listPrinters();
    const ids = Object.keys(printers || {});
    if (!ids.length) {
      throw new Error('Няма конфигуриран принтер в ErpNet.FP');
    }
    return ids[0];
  }

  async getPrinterInfo(printerId) {
    const id = printerId || (await this.resolvePrinterId());
    return this.httpJson('GET', `/printers/${encodeURIComponent(id)}`);
  }

  async requireSerial(printerId) {
    const info = await this.getPrinterInfo(printerId);
    const serial = info?.serialNumber;
    if (!serial) {
      throw new Error('Фискалното устройство не върна сериен номер');
    }
    return serial;
  }

  async getStatus() {
    try {
      const printers = await this.listPrinters();
      const ids = Object.keys(printers || {});
      if (!ids.length) {
        return {
          ok: false,
          baseUrl: this.baseUrl,
          error: 'Няма конфигуриран принтер в ErpNet.FP',
        };
      }
      const id = this.printerId || ids[0];
      const status = await this.httpJson(
        'GET',
        `/printers/${encodeURIComponent(id)}/status`
      );
      return {
        ok: true,
        baseUrl: this.baseUrl,
        printerCount: ids.length,
        printers,
        status,
      };
    } catch (error) {
      return {
        ok: false,
        baseUrl: this.baseUrl,
        error: error.message,
      };
    }
  }

  /**
   * Print fiscal receipt for a closed bill.
   */
  async printReceipt(bill, operator = {}) {
    const cartItems = bill.cartItems || [];
    const totalAmount = Number(bill.totalAmount) || 0;
    const paymentType = this.mapPaymentType(bill.paymentMode);
    const items = this.buildSaleItems(cartItems);
    const operatorCode = String(operator.code || this.operator).replace(/\D/g, '').padStart(4, '0').slice(-4);
    const operatorPassword = String(operator.password || this.operatorPassword);

    const printerId = await this.resolvePrinterId();
    const deviceSerial = await this.requireSerial(printerId);
    const code = this.deviceCode(deviceSerial);
    const docNumber = await this.nextUnpDocNumber(code);
    const uniqueSaleNumber = this.buildUniqueSaleNumber(code, operatorCode, docNumber);
    let paymentAmount = totalAmount;
    if (paymentType === 'cash' && bill.cashReceived != null && bill.cashReceived !== '') {
      const received = Math.round(Number(bill.cashReceived) * 100) / 100;
      if (!Number.isFinite(received) || received + 0.001 < totalAmount) {
        throw new Error('Получените пари са по-малко от сметката');
      }
      paymentAmount = received;
    }
    const payload = {
      uniqueSaleNumber,
      operator: operatorCode,
      operatorPassword,
      items,
      payments: [{ amount: paymentAmount, paymentType }],
    };

    const result = await this.httpJson(
      'POST',
      `/printers/${encodeURIComponent(printerId)}/receipt`,
      payload
    );
    this.assertOk(result, 'Print receipt');
    if (!result.receiptNumber) {
      throw new Error('Фискалното устройство не върна номер на бона');
    }

    return {
      success: true,
      fiscalReceiptId: result.receiptNumber,
      uniqueSaleNumber,
      receiptDateTime: result.receiptDateTime,
      fiscalMemorySerialNumber: result.fiscalMemorySerialNumber,
      receiptAmount: result.receiptAmount,
      fiscalDeviceSerialNumber: deviceSerial,
      timestamp: result.receiptDateTime
        ? new Date(result.receiptDateTime)
        : new Date(),
      message: 'Фискален бон отпечатан',
      raw: result,
    };
  }

  async printStornoBon(originalBill, stornoId, reason, cartItems, operator = {}) {
    try {
      if (
        !originalBill.fiscalReceiptId ||
        !originalBill.fiscalReceiptDateTime ||
        !originalBill.fiscalMemorySerialNumber
      ) {
        throw new Error(
          'Оригиналният бон няма фискални данни (receiptNumber / dateTime / FM). Не може да се сторнира на касата.'
        );
      }
      const items = this.buildSaleItems(cartItems);
      const totalAmount = items
        .filter((i) => i.type === 'sale')
        .reduce(
          (s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 1),
          0
        );
      const paymentType = this.mapPaymentType(originalBill.paymentMode);
      const fiscalReason = this.mapStornoReasonToFiscalCode(reason);
      const operatorCode = String(operator.code || this.operator).replace(/\D/g, '').padStart(4, '0').slice(-4);
      const operatorPassword = String(operator.password || this.operatorPassword);
      const printerId = await this.resolvePrinterId();
      const deviceSerial = await this.requireSerial(printerId);
      const code = this.deviceCode(deviceSerial);
      const uniqueSaleNumber = this.buildUniqueSaleNumber(
        code,
        operatorCode,
        await this.nextUnpDocNumber(code)
      );

      const payload = {
        uniqueSaleNumber,
        operator: operatorCode,
        operatorPassword,
        receiptNumber: originalBill.fiscalReceiptId,
        receiptDateTime: originalBill.fiscalReceiptDateTime,
        fiscalMemorySerialNumber: originalBill.fiscalMemorySerialNumber,
        reason: fiscalReason,
        items,
        payments: [{ amount: totalAmount, paymentType }],
      };

      const result = await this.httpJson(
        'POST',
        `/printers/${encodeURIComponent(printerId)}/reversalreceipt`,
        payload
      );
      this.assertOk(result, 'Print reversal');
      if (!result.receiptNumber) {
        throw new Error('Фискалното устройство не върна номер на сторно бона');
      }

      return {
        success: true,
        fiscalReceiptId: result.receiptNumber,
        uniqueSaleNumber,
        fiscalMemorySerialNumber: result.fiscalMemorySerialNumber,
        fiscalDeviceSerialNumber: code,
        timestamp: result.receiptDateTime
          ? new Date(result.receiptDateTime)
          : new Date(),
        message: 'Сторно бон отпечатан',
        raw: result,
      };
    } catch (error) {
      console.error('[FISCAL] Error printing storno receipt:', error);
      throw error;
    }
  }

  async printXReport() {
    const printerId = await this.resolvePrinterId();
    const result = await this.httpJson(
      'POST',
      `/printers/${encodeURIComponent(printerId)}/xreport`,
      {}
    );
    this.assertOk(result, 'X report');
    return result;
  }

  async printZReport() {
    const printerId = await this.resolvePrinterId();
    const result = await this.httpJson(
      'POST',
      `/printers/${encodeURIComponent(printerId)}/zreport`,
      {}
    );
    this.assertOk(result, 'Z report');
    return result;
  }

  async checkForNewZReport() {
    return null;
  }
}

module.exports = new FiscalService();

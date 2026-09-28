const mongoose = require('mongoose');
const Report = require('../models/reportModel');

/**
 * ErpNet.FP integration (http://localhost:8001 by default).
 * FISCAL_TEST_MODE=true → mock responses (no device needed).
 * FISCAL_TEST_MODE=false → real HTTP calls to ErpNet.FP.
 */
class FiscalService {
  get isTestMode() {
    if (this._forceTestMode !== undefined) return this._forceTestMode;
    return process.env.FISCAL_TEST_MODE !== 'false';
  }

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

  get testDeviceSerial() {
    return process.env.FISCAL_TEST_DEVICE_SERIAL || 'TEST0001';
  }

  get timeoutMs() {
    return Number(process.env.FISCAL_TIMEOUT_MS || 30000);
  }

  setTestMode(enabled) {
    this._forceTestMode = Boolean(enabled);
  }

  mapPaymentType(paymentMode) {
    const p = String(paymentMode || '').toLowerCase();
    if (p === 'card' || p === 'карта' || p.includes('card')) return 'card';
    return 'cash';
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

  async nextUnpDocNumber() {
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
      'unp',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return String(doc.seq).padStart(7, '0');
  }

  buildUniqueSaleNumber(deviceSerial, docNumber) {
    const serial = String(deviceSerial || this.testDeviceSerial).toUpperCase();
    const op = String(this.operator).padStart(4, '0').slice(-4);
    return `${serial}-${op}-${docNumber}`;
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
    if (this.isTestMode) {
      return {
        [this.testDeviceSerial.toLowerCase()]: {
          serialNumber: this.testDeviceSerial,
          manufacturer: 'Mock',
          model: 'TEST',
          fiscalMemorySerialNumber: 'FM-TEST-001',
          itemTextMaxLength: 32,
        },
      };
    }
    return this.httpJson('GET', '/printers');
  }

  async resolvePrinterId() {
    if (this.printerId) return this.printerId;
    const printers = await this.listPrinters();
    const ids = Object.keys(printers || {});
    if (!ids.length) {
      throw new Error(
        'Няма конфигуриран принтер в ErpNet.FP (Available 0). Добави устройство или остави FISCAL_TEST_MODE=true.'
      );
    }
    return ids[0];
  }

  async getPrinterInfo(printerId) {
    if (this.isTestMode) {
      return {
        serialNumber: this.testDeviceSerial,
        fiscalMemorySerialNumber: 'FM-TEST-001',
        itemTextMaxLength: 32,
      };
    }
    const id = printerId || (await this.resolvePrinterId());
    return this.httpJson('GET', `/printers/${encodeURIComponent(id)}`);
  }

  async getStatus() {
    if (this.isTestMode) {
      return {
        ok: true,
        testMode: true,
        baseUrl: this.baseUrl,
        message: 'Тестов режим — няма реална връзка към каса',
      };
    }
    try {
      const printers = await this.listPrinters();
      const ids = Object.keys(printers || {});
      let status = null;
      if (ids.length) {
        const id = this.printerId || ids[0];
        status = await this.httpJson(
          'GET',
          `/printers/${encodeURIComponent(id)}/status`
        );
      }
      return {
        ok: true,
        testMode: false,
        baseUrl: this.baseUrl,
        printerCount: ids.length,
        printers,
        status,
      };
    } catch (error) {
      return {
        ok: false,
        testMode: false,
        baseUrl: this.baseUrl,
        error: error.message,
      };
    }
  }

  mockReceiptResult(amount, prefix = 'TEST') {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const receiptDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return {
      ok: 'true',
      receiptNumber: `${prefix}-${String(Date.now()).slice(-7)}`,
      receiptDateTime,
      receiptAmount: amount,
      fiscalMemorySerialNumber: 'FM-TEST-001',
      messages: [{ type: 'info', text: 'Mock fiscal receipt (test mode)' }],
    };
  }

  /**
   * Print fiscal receipt for a closed bill.
   */
  async printReceipt(bill) {
    const cartItems = bill.cartItems || [];
    const totalAmount = Number(bill.totalAmount) || 0;
    const paymentType = this.mapPaymentType(bill.paymentMode);
    const items = this.buildSaleItems(cartItems);

    const docNumber = await this.nextUnpDocNumber();
    let deviceSerial = this.testDeviceSerial;
    let printerId = this.printerId;

    if (!this.isTestMode) {
      printerId = await this.resolvePrinterId();
      const info = await this.getPrinterInfo(printerId);
      deviceSerial = info.serialNumber || deviceSerial;
    }

    const uniqueSaleNumber = this.buildUniqueSaleNumber(deviceSerial, docNumber);
    const payload = {
      uniqueSaleNumber,
      operator: String(this.operator),
      operatorPassword: String(this.operatorPassword),
      items,
      payments: [{ amount: totalAmount, paymentType }],
    };

    let result;
    if (this.isTestMode) {
      console.log('[FISCAL] TEST printReceipt', {
        uniqueSaleNumber,
        items: items.length,
        totalAmount,
        paymentType,
      });
      await new Promise((r) => setTimeout(r, 200));
      result = this.mockReceiptResult(totalAmount);
    } else {
      result = await this.httpJson(
        'POST',
        `/printers/${encodeURIComponent(printerId)}/receipt`,
        payload
      );
      this.assertOk(result, 'Print receipt');
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
      message: this.isTestMode
        ? 'Фискален бон (тестов режим)'
        : 'Фискален бон отпечатан',
      raw: result,
    };
  }

  async printStornoBon(originalBill, stornoId, reason, cartItems) {
    try {
      const items = this.buildSaleItems(cartItems);
      const totalAmount = items
        .filter((i) => i.type === 'sale')
        .reduce(
          (s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 1),
          0
        );
      const paymentType = this.mapPaymentType(originalBill.paymentMode);
      const fiscalReason = this.mapStornoReasonToFiscalCode(reason);

      if (this.isTestMode) {
        console.log('[FISCAL] TEST printStornoBon', {
          billId: originalBill._id,
          stornoId,
          reason: fiscalReason,
        });
        await new Promise((r) => setTimeout(r, 300));
        const result = this.mockReceiptResult(totalAmount, 'STORNO-TEST');
        return {
          success: true,
          fiscalReceiptId: result.receiptNumber,
          timestamp: new Date(),
          message: 'Сторно бон (тестов режим)',
          raw: result,
        };
      }

      const printerId = await this.resolvePrinterId();
      const uniqueSaleNumber =
        originalBill.uniqueSaleNumber ||
        this.buildUniqueSaleNumber(
          originalBill.fiscalDeviceSerialNumber || this.testDeviceSerial,
          await this.nextUnpDocNumber()
        );

      if (
        !originalBill.fiscalReceiptId ||
        !originalBill.fiscalReceiptDateTime ||
        !originalBill.fiscalMemorySerialNumber
      ) {
        throw new Error(
          'Оригиналният бон няма фискални данни (receiptNumber / dateTime / FM). Не може да се сторнира на касата.'
        );
      }

      const payload = {
        uniqueSaleNumber,
        operator: String(this.operator),
        operatorPassword: String(this.operatorPassword),
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

      return {
        success: true,
        fiscalReceiptId: result.receiptNumber,
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
    if (this.isTestMode) {
      return { ok: true, testMode: true, message: 'X report (test mode)' };
    }
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
    if (this.isTestMode) {
      return {
        ok: true,
        testMode: true,
        fiscalReportId: `TEST-Z-${Date.now()}`,
        message: 'Z report (test mode)',
      };
    }
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
    try {
      if (this.isTestMode) {
        const now = new Date();
        const startOfDay = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const existingReport = await Report.findOne({
          type: 'Z',
          from: startOfDay,
          to: { $gte: startOfDay, $lte: now },
          isTestMode: true,
        });
        if (!existingReport) {
          const newReport = new Report({
            type: 'Z',
            from: startOfDay,
            to: now,
            totalAmount: 0,
            totalBills: 0,
            byPayment: {},
            items: {},
            bills: [],
            isSynchronized: true,
            synchronizedAt: new Date(),
            isTestMode: true,
            fiscalReportId: `TEST-${Date.now()}`,
          });
          await newReport.save();
          console.log('Създаден тестов Z отчет:', newReport._id);
          return newReport;
        }
      }
      return null;
    } catch (error) {
      console.error('Грешка при проверка за нов Z отчет:', error);
      throw error;
    }
  }

  async synchronizeZReport(reportId) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Отчетът не е намерен');
      }
      if (this.isTestMode) {
        report.isSynchronized = true;
        report.synchronizedAt = new Date();
        report.isTestMode = true;
        await report.save();
        return report;
      }

      const deviceResult = await this.printZReport();
      report.isSynchronized = true;
      report.synchronizedAt = new Date();
      report.isTestMode = false;
      report.fiscalReportId =
        deviceResult.fiscalReportId ||
        deviceResult.receiptNumber ||
        `FP-Z-${Date.now()}`;
      await report.save();
      return report;
    } catch (error) {
      console.error('Грешка при синхронизация на Z отчет:', error);
      throw error;
    }
  }
}

module.exports = new FiscalService();

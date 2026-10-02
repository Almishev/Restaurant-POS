const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["X", "Z", "shift"], required: true },
    reportNumber: { type: Number },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    userId: { type: String }, // кой е направил отчета (ако е по оператор)
    totalAmount: { type: Number, required: true },
    totalBills: { type: Number, required: true },
    stornoAmount: { type: Number, default: 0 },
    netAmount: { type: Number },
    byPayment: { type: Object }, // { cash: 100, card: 200 }
    items: { type: Object },     // { "Капрезе": { quantity: 2, total: 18 }, ... }
    bills: { type: Array },      // по желание: всички сметки, включени в отчета
    stornos: { type: Array },
    roomAmount: { type: Number, default: 0 },
    roomBillCount: { type: Number, default: 0 },
    // Ново: полета за фискална интеграция
    fiscalReportId: { type: String },
    isSynchronized: { type: Boolean, default: false },
    synchronizedAt: { type: Date },
    syncError: { type: String },
    // Тестов режим
    isTestMode: { type: Boolean, default: false }
  },
  { timestamps: true }
);

reportSchema.index(
  { type: 1, reportNumber: 1 },
  { unique: true, partialFilterExpression: { reportNumber: { $exists: true } } }
);

const Report = mongoose.model("Report", reportSchema);
module.exports = Report; 
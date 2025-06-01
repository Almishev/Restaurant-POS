const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["X", "Z"], required: true }, // X или Z отчет
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    userId: { type: String }, // кой е направил отчета (ако е по оператор)
    totalAmount: { type: Number, required: true },
    totalBills: { type: Number, required: true },
    byPayment: { type: Object }, // { cash: 100, card: 200 }
    items: { type: Object },     // { "Капрезе": { quantity: 2, total: 18 }, ... }
    bills: { type: Array },      // по желание: всички сметки, включени в отчета
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

const Report = mongoose.model("Report", reportSchema);
module.exports = Report; 
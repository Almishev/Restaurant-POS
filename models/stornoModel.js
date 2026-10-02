const mongoose = require("mongoose");

const stornoSchema = mongoose.Schema(
  {
    /** bill = след генерирана сметка; pre_bill = отмяна на изпратен артикул преди сметка */
    type: {
      type: String,
      enum: ["bill", "pre_bill"],
      default: "bill",
    },
    originalBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "bills",
      required: false,
    },
    tableId: {
      type: String,
      default: "",
    },
    tableName: {
      type: String,
      default: "",
    },
    customerName: {
      type: String,
      default: "",
    },
    userId: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    cartItems: {
      type: Array,
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      required: false,
      default: "",
    },
    reason: {
      type: String,
      required: true,
      enum: ["operatorError", "returnedItems", "defectiveGoods", "other"],
    },
    reasonText: {
      type: String,
    },
    fiscalReceiptId: {
      type: String,
    },
    fiscalReceiptTimestamp: {
      type: Date,
    },
    fiscalStatus: {
      type: String,
      default: "pending",
      enum: ["pending", "completed", "error", "n/a"],
    },
    fiscalErrorMessage: {
      type: String,
    },
    originalBillFiscalId: {
      type: String,
    },
    includedInShiftReport: {
      type: Boolean,
      default: false,
    },
    shiftReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
      required: false,
    },
  },
  { timestamps: true }
);

const Storno = mongoose.model("storno", stornoSchema);

module.exports = Storno;

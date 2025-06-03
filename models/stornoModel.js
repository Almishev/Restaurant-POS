const mongoose = require("mongoose");

const stornoSchema = mongoose.Schema(
  {
    originalBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "bills",
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    customerName: {
      type: String,
    },
    customerPhone: {
      type: String,
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
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: ["operatorError", "returnedItems", "defectiveGoods", "other"]
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
      enum: ["pending", "completed", "error"]
    },
    fiscalErrorMessage: {
      type: String,
    },
    originalBillFiscalId: {
      type: String,
    }
  },
  { timestamps: true }
);

const Storno = mongoose.model("storno", stornoSchema);

module.exports = Storno;

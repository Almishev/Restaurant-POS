const mongoose = require("mongoose");

const billSchema = mongoose.Schema(
  {
    customerName: {
      type: String,
      required: false,
    },
    tableId: {
      type: String,
      required: false,
    },
    tableName: {
      type: String,
      required: false,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    subTotal: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      required: true,
    },
    hotelBookingId: {
      type: String,
      required: false,
    },
    hotelRoomNumber: {
      type: String,
      required: false,
    },
    hotelGuestName: {
      type: String,
      required: false,
    },
    cartItems: {
      type: Array,
      required: true,
    },
    /** Per-line remaining qty after partial stornos: { [itemKey]: remainingQty } */
    stornoedQuantities: {
      type: Map,
      of: Number,
      default: {},
    },
    date: {
      type: Date,
      default: Date.now,
    },
    userId: {
      type: String,
      required: true,
    },
    isStornoed: {
      type: Boolean,
      default: false,
    },
    includedInZReport: {
      type: Boolean,
      default: false,
    },
    zReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "reports",
      required: false,
    },
    /** ErpNet.FP / fiscal device fields */
    fiscalReceiptId: { type: String },
    fiscalReceiptDateTime: { type: String },
    fiscalMemorySerialNumber: { type: String },
    fiscalDeviceSerialNumber: { type: String },
    uniqueSaleNumber: { type: String },
    fiscalStatus: {
      type: String,
      enum: ["pending", "completed", "error", "n/a"],
      default: "pending",
    },
    fiscalErrorMessage: { type: String },
  },
  { timestamps: true }
);

const Bills = mongoose.model("bills", billSchema);

module.exports = Bills;

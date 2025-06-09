const mongoose = require("mongoose");

const tableSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: String,
      required: false,
    },    cartItems: [
      {
        itemId: String,
        name: String,
        price: Number,
        quantity: Number,
        status: { type: String, default: "Изпратено" },
        note: { type: String, default: "" }
      }
    ],
    pendingItems: [
      {
        itemId: String,
        name: String,
        price: Number,
        quantity: Number,
        note: { type: String, default: "" }
      }
    ],
    totalAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: "open",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const Table = mongoose.model("Table", tableSchema);

module.exports = Table; 
const mongoose = require("mongoose");

const tableSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    cartItems: [
      {
        itemId: String,
        name: String,
        price: Number,
        quantity: Number,
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
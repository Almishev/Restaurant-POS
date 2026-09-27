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
    cartItems: {
      type: Array,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now, // Функция, а не резултат от функцията
    },
    userId: {
      type: String,
      required: true,
    },
    isStornoed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Bills = mongoose.model("bills", billSchema);

module.exports = Bills;

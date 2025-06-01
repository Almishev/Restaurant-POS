const mongoose = require("mongoose");


const itemSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      enum: ["kitchen", "bar"],
      required: true,
    },
  },
  { timestamp: true }
);


const Item = mongoose.model("Item", itemSchema);
const Items = mongoose.model("Items", itemSchema);

module.exports = Item;

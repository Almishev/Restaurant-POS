const mongoose = require("mongoose");

const kitchenOrderSchema = mongoose.Schema({
  tableName: String,
  waiterName: String,
  items: [
    {
      name: String,
      quantity: Number,
      done: { type: Boolean, default: false },
    }
  ],
  status: { type: String, default: "ново" },
  createdAt: { type: Date, default: Date.now }
});

const KitchenOrder = mongoose.model("KitchenOrder", kitchenOrderSchema);
module.exports = KitchenOrder; 
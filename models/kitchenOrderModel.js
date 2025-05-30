const mongoose = require("mongoose");

const kitchenOrderSchema = mongoose.Schema({
  tableName: String,
  items: [
    {
      name: String,
      quantity: Number,
    }
  ],
  status: { type: String, default: "ново" },
  createdAt: { type: Date, default: Date.now }
});

const KitchenOrder = mongoose.model("KitchenOrder", kitchenOrderSchema);
module.exports = KitchenOrder; 
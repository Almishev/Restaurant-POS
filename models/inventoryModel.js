const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  unit: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  history: [
    {
      type: { type: String, enum: ['in', 'out'], required: true },
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      user: { type: String },
      note: { type: String }
    }
  ]
});

module.exports = mongoose.model('Inventory', inventorySchema); 
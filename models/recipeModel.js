const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true }, // Ястието
  ingredients: [
    {
      inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true }, // Суровина
      quantity: { type: Number, required: true }, // Количество (например 200)
      unit: { type: String, default: 'g' } // Единица (г, мл, бр.)
    }
  ]
});

module.exports = mongoose.model('Recipe', recipeSchema); 
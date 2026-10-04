const mongoose = require("mongoose");

const kioskCounterSchema = mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("KioskCounter", kioskCounterSchema);

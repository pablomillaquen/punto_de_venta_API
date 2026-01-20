const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  branch: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 5
  },
  batches: [{
    lot: { type: String },
    expiry: { type: Date },
    quantity: { type: Number, required: true },
    receivedAt: { type: Date, default: Date.now }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Composite index to ensure unique product per branch
InventorySchema.index({ product: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', InventorySchema);

const mongoose = require('mongoose');

const StockMovementSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  branch: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['IN', 'OUT', 'TRANSFER', 'ADJUST', 'SALE'],
    required: true
  },
  reason: {
    type: String // e.g., "Initial Stock", "Sale #123", "Expired", "Transfer to Branch B"
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  batch: {
    lot: String,
    expiry: Date
  },
  documentId: {
    type: String // Reference to a Transfer Document or Import Batch ID
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('StockMovement', StockMovementSchema);

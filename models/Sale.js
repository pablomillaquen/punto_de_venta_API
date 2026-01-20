const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.ObjectId,
    ref: 'Product',
    required: true
  },
  name: { type: String, required: true },
  price: { type: Number, required: true }, // Snapshotted price at time of sale
  quantity: { type: Number, required: true, min: 0.01 },
  total: { type: Number, required: true }
});

const SaleSchema = new mongoose.Schema({
  branch: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.ObjectId, // Cashier
    ref: 'User',
    required: true
  },
  items: [SaleItemSchema],
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'transbank'],
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'void'],
    default: 'completed'
  },
  transbankData: {
    buyOrder: String,
    sessionId: String,
    authorizationCode: String,
    amount: Number,
    responseCode: Number,
    transactionDate: Date,
    cardNumber: String // Masked usually
  },
  createdAt: {
    type: Date,
    default: Date.now, 
    index: true 
  }
});

module.exports = mongoose.model('Sale', SaleSchema);

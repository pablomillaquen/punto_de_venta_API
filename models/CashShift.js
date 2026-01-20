const mongoose = require('mongoose');

const CashShiftSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  branch: {
    type: mongoose.Schema.ObjectId,
    ref: 'Branch',
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  endTime: {
    type: Date
  },
  startAmount: {
    type: Number,
    required: true,
    min: 0
  },
  salesTotal: { // Total sales during this shift (system calculated)
    type: Number,
    default: 0
  },
  cashSalesTotal: { // Cash sales only
    type: Number,
    default: 0
  },
  cardSalesTotal: { // Card sales only
    type: Number,
    default: 0
  },
  expectedCash: { // startAmount + cashSalesTotal
    type: Number,
    default: 0
  },
  actualCash: { // Entered by cashier at close
    type: Number
  },
  difference: { // actualCash - expectedCash
    type: Number
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  observations: {
    type: String
  }
}, {
    timestamps: true
});

module.exports = mongoose.model('CashShift', CashShiftSchema);

const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor ingrese nombre del producto'],
    trim: true,
    maxlength: [100, 'Nombre no puede exceder 100 caracteres']
  },
  barcode: {
    type: String,
    required: [true, 'Por favor ingrese código de barras'],
    unique: true,
    index: true,
    trim: true
  },
  sku: {
    type: String,
    trim: true
  },
  category: {
    type: mongoose.Schema.ObjectId,
    ref: 'Category',
    required: false
  },
  price: {
    type: Number,
    required: [true, 'Por favor ingrese precio de venta'],
    min: 0
  },
  cost: {
    type: Number,
    required: [true, 'Por favor ingrese costo'],
    min: 0
  },
  taxRate: {
    type: Number,
    default: 19 // Standard Chilean IVA
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    default: 'no-photo.jpg'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', ProductSchema);

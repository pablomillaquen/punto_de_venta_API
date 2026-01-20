const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor ingrese nombre de categoría'],
    trim: true,
    unique: true,
    maxlength: [50, 'Nombre no puede exceder 50 caracteres']
  },
  description: {
    type: String,
    maxlength: [500, 'Descripción no puede exceder 500 caracteres']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Category', CategorySchema);

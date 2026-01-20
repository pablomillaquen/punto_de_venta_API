const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Por favor ingrese nombre de sucursal'],
    trim: true,
    unique: true,
    maxlength: [50, 'Nombre no puede exceder 50 caracteres']
  },
  address: {
    type: String,
    required: [true, 'Por favor ingrese dirección'],
    maxlength: [100, 'Dirección no puede exceder 100 caracteres']
  },
  phone: {
    type: String,
    maxlength: [20, 'Teléfono no puede exceder 20 caracteres']
  },
  manager: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Branch', BranchSchema);

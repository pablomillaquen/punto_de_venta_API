const express = require('express');
const {
  getProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/products');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(getProducts)
  .post(protect, authorize('admin', 'supervisor'), createProduct);

router
    .route('/barcode/:barcode')
    .get(getProductByBarcode);

router
  .route('/:id')
  .get(getProduct)
  .put(protect, authorize('admin', 'supervisor'), updateProduct)
  .delete(protect, authorize('admin', 'supervisor'), deleteProduct);

module.exports = router;

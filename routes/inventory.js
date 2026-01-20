const express = require('express');
const {
  getInventory,
  addStock,
  transferStock,
  transferStockBulk,
  getHistory,
  importExcelPreview,
  confirmImport
} = require('../controllers/inventory');


const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(getInventory);

router
  .route('/history')
  .get(authorize('admin', 'supervisor', 'bodega'), getHistory);

router
    .route('/add')
    .post(authorize('admin', 'supervisor', 'bodega'), addStock);

router
    .route('/transfer')
    .post(authorize('admin', 'supervisor'), transferStock);

router
    .route('/transfer-bulk')
    .post(authorize('admin', 'supervisor'), transferStockBulk);

router
    .route('/import-preview')
    .post(authorize('admin', 'supervisor', 'bodega'), importExcelPreview);

router
    .route('/import-confirm')
    .post(authorize('admin', 'supervisor', 'bodega'), confirmImport);

module.exports = router;

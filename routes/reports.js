const express = require('express');
const {
  getImportReceipt,
  getStockChecklist,
  getTransferDocument,
  getSalesReport,
  getCashShiftReport,
  getDailyCashReport
} = require('../controllers/reports');


const router = express.Router();

const { protect } = require('../middleware/auth');

router.use(protect);

router
  .route('/import-receipt/:batchId')
  .get(getImportReceipt);

router
  .route('/checklist')
  .post(getStockChecklist);

router
  .route('/transfer-document/:transferId')
  .get(getTransferDocument);

router
  .route('/sales')
  .get(getSalesReport);

router
    .route('/cash-shift/:shiftId')
    .get(getCashShiftReport);

router
    .route('/daily-cash')
    .get(getDailyCashReport);

module.exports = router;

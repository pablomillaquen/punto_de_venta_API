const express = require('express');
const {
  startShift,
  closeShift,
  getCurrentShift,
  getShifts
} = require('../controllers/cashShifts');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(authorize('admin', 'supervisor'), getShifts);

router
  .route('/start')
  .post(startShift);

router
  .route('/close')
  .post(closeShift);

router
  .route('/current')
  .get(getCurrentShift);

module.exports = router;

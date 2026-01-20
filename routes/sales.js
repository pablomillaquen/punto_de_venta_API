const express = require('express');
const {
  createSale,
  getSales
} = require('../controllers/sales');

const router = express.Router();

const { protect } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(getSales)
  .post(createSale);

module.exports = router;

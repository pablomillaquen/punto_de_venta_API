const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categories');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router
  .route('/')
  .get(getCategories)
  .post(protect, authorize('admin', 'supervisor'), createCategory);

router
  .route('/:id')
  .get(getCategory)
  .put(protect, authorize('admin', 'supervisor'), updateCategory)
  .delete(protect, authorize('admin', 'supervisor'), deleteCategory);

module.exports = router;

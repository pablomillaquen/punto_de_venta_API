const express = require('express');
const {
  getBranches,
  getBranch,
  createBranch,
  updateBranch,
  deleteBranch
} = require('../controllers/branches');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect); // Protect all routes

router
  .route('/')
  .get(getBranches)
  .post(authorize('admin'), createBranch);

router
  .route('/:id')
  .get(getBranch)
  .put(authorize('admin'), updateBranch)
  .delete(authorize('admin'), deleteBranch);

module.exports = router;

const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Branch = require('../models/Branch');

// @desc      Get all branches
// @route     GET /api/v1/branches
// @access    Private
exports.getBranches = asyncHandler(async (req, res, next) => {
  const branches = await Branch.find();

  res.status(200).json({
    success: true,
    count: branches.length,
    data: branches
  });
});

// @desc      Get single branch
// @route     GET /api/v1/branches/:id
// @access    Private
exports.getBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.findById(req.params.id);

  if (!branch) {
    return next(
      new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: branch
  });
});

// @desc      Create new branch
// @route     POST /api/v1/branches
// @access    Private (Admin)
exports.createBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.create(req.body);

  res.status(201).json({
    success: true,
    data: branch
  });
});

// @desc      Update branch
// @route     PUT /api/v1/branches/:id
// @access    Private (Admin)
exports.updateBranch = asyncHandler(async (req, res, next) => {
  let branch = await Branch.findById(req.params.id);

  if (!branch) {
    return next(
      new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404)
    );
  }

  branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: branch
  });
});

// @desc      Delete branch
// @route     DELETE /api/v1/branches/:id
// @access    Private (Admin)
exports.deleteBranch = asyncHandler(async (req, res, next) => {
  const branch = await Branch.findById(req.params.id);

  if (!branch) {
    return next(
      new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404)
    );
  }

  await branch.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

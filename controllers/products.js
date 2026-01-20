const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Product = require('../models/Product');

// @desc      Get all products
// @route     GET /api/v1/products
// @access    Public / Private (Filtered by Branch)
exports.getProducts = asyncHandler(async (req, res, next) => {
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit', 'branchId']; // branchId is special

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Base query for products
  let mongoQuery = Product.find(JSON.parse(queryStr));

  // FILTER BY BRANCH STOCK LOGIC
  // If branchId is provided, we only want products that have stock in that branch
  // ERROR: This is complex because Stock is in Inventory model, not Product.
  // STRATEGY: 
  // 1. If branchId provided, find all Inventory items for that branch with quantity > 0
  // 2. Get list of product Ids
  // 3. Filter Product.find with those Ids
  
  if (req.query.branchId) {
      const Inventory = require('../models/Inventory');
      const branchInventory = await Inventory.find({ 
          branch: req.query.branchId,
          quantity: { $gt: 0 }
      }).select('product');
      
      const productIds = branchInventory.map(inv => inv.product);
      // Add _id IN logic to the query
      mongoQuery = mongoQuery.where('_id').in(productIds);
  }

  // Populate category after potential branch filtering
  query = mongoQuery.populate('category', 'name');

  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Product.countDocuments();

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const products = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: products.length,
    pagination,
    data: products
  });
});

// @desc      Get single product
// @route     GET /api/v1/products/:id
// @access    Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id).populate('category', 'name');

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc      Get product by barcode
// @route     GET /api/v1/products/barcode/:barcode
// @access    Public
exports.getProductByBarcode = asyncHandler(async (req, res, next) => {
    const product = await Product.findOne({ barcode: req.params.barcode }).populate('category', 'name');
  
    if (!product) {
      return next(
        new ErrorResponse(`Product not found with barcode of ${req.params.barcode}`, 404)
      );
    }
  
    res.status(200).json({
      success: true,
      data: product
    });
  });

// @desc      Create new product
// @route     POST /api/v1/products
// @access    Private
exports.createProduct = asyncHandler(async (req, res, next) => {
  // Add user to req.body if needed, but simple CRUD for now
  
  constproduct = await Product.create(req.body);

  res.status(201).json({
    success: true,
    data: constproduct
  });
});

// @desc      Update product
// @route     PUT /api/v1/products/:id
// @access    Private
exports.updateProduct = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: product
  });
});

// @desc      Delete product
// @route     DELETE /api/v1/products/:id
// @access    Private
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(
      new ErrorResponse(`Product not found with id of ${req.params.id}`, 404)
    );
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

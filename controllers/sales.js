const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const TransbankService = require('../services/transbank');

// @desc      Create a new sale
// @route     POST /api/v1/sales
// @access    Private (Cashier, Admin, Supervisor)
exports.createSale = asyncHandler(async (req, res, next) => {
  const { items, branchId, paymentMethod } = req.body;
  const userId = req.user.id; // User from token

  if (!items || items.length === 0) {
    return next(new ErrorResponse('No items in sale', 400));
  }

  // Calculate Total & Validate Stock
  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const inventory = await Inventory.findOne({ 
        product: item.product, 
        branch: branchId 
    }).populate('product');

    if (!inventory) {
      return next(new ErrorResponse(`Product ${item.product} not found in this branch`, 404));
    }

    if (inventory.quantity < item.quantity) {
      return next(new ErrorResponse(`Insufficient stock for product: ${inventory.product.name}. Available: ${inventory.quantity}`, 400));
    }

    const lineTotal = Math.round(item.price * item.quantity); 
    
    totalAmount += lineTotal;
    
    processedItems.push({
      product: item.product,
      name: inventory.product.name, // Ensure name comes from DB
      price: item.price,
      quantity: item.quantity,
      total: lineTotal
    });
  }

  // Handle Payment
  let transbankData = null;
  if (paymentMethod === 'transbank') {
    try {
      // Init transaction on Physical POS
      const buyOrder = `INV-${Date.now()}`; // Generate unique order ID
      const tbResponse = await TransbankService.sale(totalAmount, buyOrder);
      
      if (!tbResponse.success) {
         return next(new ErrorResponse('Transbank payment failed', 400));
      }
      
      transbankData = {
          buyOrder: buyOrder,
          authorizationCode: tbResponse.authorizationCode,
          amount: tbResponse.amount,
          transactionDate: tbResponse.transactionDate,
          responseCode: tbResponse.responseCode
      };

    } catch (err) {
      return next(new ErrorResponse('Error connecting to Transbank POS', 500));
    }
  }

  // Deduct Stock
  // This should be a transaction in MongoDB but sticking to simple updates for MVP
  for (const item of items) {
      const inventory = await Inventory.findOne({ product: item.product, branch: branchId });
      inventory.quantity -= item.quantity;
      await inventory.save();
  }

  // Create Sale Record
  const sale = await Sale.create({
    branch: branchId,
    user: userId,
    items: processedItems,
    totalAmount,
    paymentMethod,
    status: 'completed',
    transbankData
  });

  // Emit Socket Event
  if (req.app.get('io')) {
      req.app.get('io').emit('sale-created', sale);
  }

  res.status(201).json({
    success: true,
    data: sale
  });
});

// @desc      Get all sales
// @route     GET /api/v1/sales
// @access    Private
exports.getSales = asyncHandler(async (req, res, next) => {
    let query;
    const reqQuery = { ...req.query };
    
    // Role-based constraints
    if (req.user.role === 'cajero') {
        reqQuery.user = req.user.id;
        reqQuery.branch = req.user.branch;
    } else if (req.user.role === 'supervisor') {
        reqQuery.branch = req.user.branch;
    }
    // Admin can query any branch/user passed in req.query, or sees all by default.

    // Build Mongoose Query
    const queryObj = {};

    if (reqQuery.branch) queryObj.branch = reqQuery.branch;
    if (reqQuery.user) queryObj.user = reqQuery.user;
    
    // Date Filtering
    if (reqQuery.date) {
        // Construct start and end dates using Local Time string literals
        // This assumes the server is running in the same timezone as the user (Local)
        const start = new Date(`${reqQuery.date}T00:00:00`);
        const end = new Date(`${reqQuery.date}T23:59:59.999`);
        
        queryObj.createdAt = {
            $gte: start,
            $lte: end
        };
        console.log('Sales Query Date Range (Local):', start, end);
    }
    
    console.log('Final Sales Query:', queryObj);

    query = Sale.find(queryObj)
        .populate('user', 'name')
        .populate('branch', 'name')
        .sort('-createdAt');

    const sales = await query;
  
    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales
    });
});

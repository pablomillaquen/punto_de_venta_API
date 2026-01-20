const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');

// @desc      Get inventory for a branch (or all if admin)
// @route     GET /api/v1/inventory
// @access    Private
exports.getInventory = asyncHandler(async (req, res, next) => {
    let query;
    const reqQuery = { ...req.query };
    
    // Fields to exclude from direct match
    const removeFields = ['select', 'sort', 'page', 'limit', 'search', 'status'];
    removeFields.forEach(param => delete reqQuery[param]);
    
    let queryObj = { ...reqQuery }; // Start with basic filters (like branch)

    // 1. Text Search (Name or Barcode via Product)
    if (req.query.search) {
        const products = await Product.find({
            $or: [
                { name: { $regex: req.query.search, $options: 'i' } },
                { barcode: { $regex: req.query.search, $options: 'i' } }
            ]
        }).select('_id');
        
        const productIds = products.map(p => p._id);
        queryObj.product = { $in: productIds };
    }

    // 2. Status Filter
    if (req.query.status) {
        if (req.query.status === 'out') {
            queryObj.quantity = 0;
        } else if (req.query.status === 'low') {
            // quantity <= lowStockThreshold
            queryObj.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };
        } else if (req.query.status === 'ok') {
            queryObj.quantity = { $gt: 0 };
        }
    }

    // Base specific logic for Role?
    // User role logic should be handled by Frontend passing correct 'branch' param,
    // (Supervisor forces own branch, Admin selects).
    // The previous implementation relied on req.query directly. 
    // We assume queryObj has 'branch' if it was in req.query.

    query = Inventory.find(queryObj)
        .populate('product', 'name barcode price category')
        .populate('branch', 'name');

    // Sort
    if (req.query.sort) {
        const sortBy = req.query.sort.split(',').join(' ');
        query = query.sort(sortBy);
    } else {
        query = query.sort('-lastUpdated');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Inventory.countDocuments(queryObj);

    query = query.skip(startIndex).limit(limit);

    const inventory = await query;
    
    // Pagination result
    const pagination = {};
    if (endIndex < total) {
        pagination.next = { page: page + 1, limit };
    }
    if (startIndex > 0) {
        pagination.prev = { page: page - 1, limit };
    }
  
    res.status(200).json({
      success: true,
      count: inventory.length,
      total,
      pagination,
      data: inventory
    });
});

const StockMovement = require('../models/StockMovement');

// @desc      Get inventory history (Stock Movements)
// @route     GET /api/v1/inventory/history
// @access    Private (Admin, Supervisor, Bodega)
exports.getHistory = asyncHandler(async (req, res, next) => {
    let query;
    const reqQuery = { ...req.query };
    
    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];
    removeFields.forEach(param => delete reqQuery[param]);
    
    // Filter by date range if provided
    if (req.query.startDate && req.query.endDate) {
        reqQuery.createdAt = {
            $gte: new Date(req.query.startDate),
            $lte: new Date(req.query.endDate)
        };
        delete reqQuery.startDate;
        delete reqQuery.endDate;
    }

    query = StockMovement.find(reqQuery)
        .populate('product', 'name barcode')
        .populate('branch', 'name')
        .populate('user', 'name')
        .sort('-createdAt');

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;
    const total = await StockMovement.countDocuments(reqQuery);

    query = query.skip(startIndex).limit(limit);

    const history = await query;

    res.status(200).json({
        success: true,
        count: history.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: history
    });
});

// @desc      Add stock (receive inventory)
// @route     POST /api/v1/inventory/add
// @access    Private (Admin, Supervisor, Bodega)
exports.addStock = asyncHandler(async (req, res, next) => {
    const { productId, branchId, quantity, lot, expiry, reason } = req.body;

    let inventory = await Inventory.findOne({ product: productId, branch: branchId });

    if (!inventory) {
        // Create new inventory record if not exists for this product-branch combo
        inventory = await Inventory.create({
            product: productId,
            branch: branchId,
            quantity: 0,
            batches: []
        });
    }

    // Add to batches
    inventory.batches.push({
        lot,
        expiry,
        quantity,
        receivedAt: Date.now()
    });

    // Update total quantity
    inventory.quantity += parseInt(quantity);
    inventory.lastUpdated = Date.now();

    await inventory.save();

    // Create Stock Movement log
    await StockMovement.create({
        product: productId,
        branch: branchId,
        quantity: quantity,
        type: 'IN',
        reason: reason || 'Manual Entry',
        user: req.user.id,
        batch: { lot, expiry }
    });

    // Emit Socket Event
    if (req.app.get('io')) {
        req.app.get('io').emit('stock-updated', { productId, branchId, quantity: inventory.quantity });
    }

    res.status(200).json({
        success: true,
        data: inventory
    });
});

// @desc      Transfer stock between branches
// @route     POST /api/v1/inventory/transfer
// @access    Private (Admin, Supervisor)
exports.transferStock = asyncHandler(async (req, res, next) => {
    const { productId, fromBranchId, toBranchId, quantity, reason } = req.body;

    const sourceInv = await Inventory.findOne({ product: productId, branch: fromBranchId });

    if (!sourceInv || sourceInv.quantity < quantity) {
        return next(new ErrorResponse(`Insufficient stock in source branch`, 400));
    }

    // Deduct from source
    let remainingToDeduct = parseInt(quantity);
    sourceInv.quantity -= remainingToDeduct;
    await sourceInv.save();
    
    // Log OUT movement
    await StockMovement.create({
        product: productId,
        branch: fromBranchId,
        quantity: -remainingToDeduct,
        type: 'TRANSFER',
        reason: reason || `Transfer to ${toBranchId}`,
        user: req.user.id
    });

    // Add to destination
    let destInv = await Inventory.findOne({ product: productId, branch: toBranchId });
    if (!destInv) {
        destInv = await Inventory.create({
            product: productId,
            branch: toBranchId,
            quantity: 0,
            batches: []
        });
    }

    destInv.quantity += parseInt(quantity);
    destInv.batches.push({
        lot: "TRANSFER",
        quantity: parseInt(quantity),
        receivedAt: Date.now()
    });
    
    await destInv.save();

    // Log IN movement
    await StockMovement.create({
        product: productId,
        branch: toBranchId,
        quantity: parseInt(quantity),
        type: 'TRANSFER',
        reason: reason || `Transfer from ${fromBranchId}`,
        user: req.user.id
    });

    // Emit Socket Event
    if (req.app.get('io')) {
        req.app.get('io').emit('stock-updated', { 
            productId, 
            branches: [
                { id: fromBranchId, quantity: sourceInv.quantity },
                { id: toBranchId, quantity: destInv.quantity }
            ] 
        });
    }

    res.status(200).json({
        success: true,
        message: 'Transfer successful'
    });
});

const XlsxPopulate = require('xlsx-populate');
const fs = require('fs');
const path = require('path');

// @desc      Preview Excel Import
// @route     POST /api/v1/inventory/import-preview
// @access    Private (Admin, Supervisor, Bodega)
exports.importExcelPreview = asyncHandler(async (req, res, next) => {
    if (!req.files || !req.files.file) {
        return next(new ErrorResponse('Please upload a file', 400));
    }

    const file = req.files.file;

    // Check file type
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
        return next(new ErrorResponse('Please upload a valid Excel file', 400));
    }

    const workbook = await XlsxPopulate.fromDataAsync(file.data);
    const sheet = workbook.sheet(0);
    const usedRange = sheet.usedRange();
    
    if (!usedRange) {
         return next(new ErrorResponse('Excel file is empty', 400));
    }

    const value = usedRange.value();
    const headers = value[0];
    const rows = value.slice(1);

    const previewData = [];
    const errors = [];

    // Expected Headers: Barcode, BranchCode, Quantity, Lot, Expiry(YYYY-MM-DD)
    // Map headers to indices? Assumed fixed format for MVP or check headers.
    // Let's assume fixed: 0: Barcode, 1: BranchCode, 2: Quantity, 3: Lot, 4: Expiry

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const barcode = row[0];
        const branchCode = row[1]; // Branch Name or specific code? Let's use Branch Name for user friendliness
        const quantity = row[2];
        const lot = row[3];
        const expiry = row[4];

        if (!barcode || !branchCode || !quantity) continue;

        const product = await Product.findOne({ barcode });
        const branch = await mongoose.model('Branch').findOne({ name: branchCode });

        let rowError = null;
        if (!product) rowError = `Product not found: ${barcode}`;
        if (!branch) rowError = `Branch not found: ${branchCode}`;
        
        previewData.push({
            row: i + 2,
            barcode,
            productName: product ? product.name : 'Unknown',
            productId: product ? product._id : null,
            branchName: branchCode,
            branchId: branch ? branch._id : null,
            quantity,
            lot,
            expiry,
            status: rowError ? 'Error' : 'Valid',
            error: rowError
        });
        
        if (rowError) errors.push(rowError);
    }

    res.status(200).json({
        success: true,
        data: previewData,
        hasErrors: errors.length > 0
    });
});

// @desc      Confirm Excel Import
// @route     POST /api/v1/inventory/import-confirm
// @access    Private
exports.confirmImport = asyncHandler(async (req, res, next) => {
    const { items } = req.body; // Array of validated items
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return next(new ErrorResponse('No items to import', 400));
    }

    const results = [];
    const batchId = `IMPORT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    for (const item of items) {
        if (!item.productId || !item.branchId) continue;

        let inventory = await Inventory.findOne({ product: item.productId, branch: item.branchId });

        if (!inventory) {
            inventory = await Inventory.create({
                product: item.productId,
                branch: item.branchId,
                quantity: 0,
                batches: []
            });
        }

        inventory.batches.push({
            lot: item.lot || 'IMPORT',
            expiry: item.expiry ? new Date(item.expiry) : null,
            quantity: item.quantity,
            receivedAt: Date.now()
        });

        inventory.quantity += parseInt(item.quantity);
        inventory.lastUpdated = Date.now();
        await inventory.save();

        // Log Movement
        await StockMovement.create({
            product: item.productId,
            branch: item.branchId,
            quantity: item.quantity,
            type: 'IN',
            reason: `Excel Import ${batchId}`,
            user: req.user.id,
            batch: { lot: item.lot, expiry: item.expiry },
            documentId: batchId
        });
        
        results.push(inventory);
    }

    // Generate PDF Receipt? (Handled by Frontend requesting a report or returning ID?)
    // User requirement: "Se descarga inmediatamente... un reporte".
    // We can return the batchId, and frontend calls /api/v1/reports/import-receipt/:batchId

    res.status(200).json({
        success: true,
        count: results.length,
        batchId
    });
});

// @desc      Bulk Transfer
// @route     POST /api/v1/inventory/transfer-bulk
// @access    Private
exports.transferStockBulk = asyncHandler(async (req, res, next) => {
    const { items, toBranchId } = req.body; // items: [{ productId, fromBranchId, quantity }]
    
    if (!items || items.length === 0 || !toBranchId) {
        return next(new ErrorResponse('Invalid transfer data', 400));
    }

    const transferId = `TRANS-${Date.now()}`;
    const results = [];

    for (const item of items) {
        const sourceInv = await Inventory.findOne({ product: item.productId, branch: item.fromBranchId });

        // Skip if invalid or insufficient (or handle partial?)
        // Let's strict fail or skip? Skip is safer for bulk.
        if (!sourceInv || sourceInv.quantity < item.quantity) {
             continue; 
             // Or throw?
        }

        let qty = parseInt(item.quantity);
        sourceInv.quantity -= qty;
        await sourceInv.save();

        // Log OUT
        await StockMovement.create({
            product: item.productId,
            branch: item.fromBranchId,
            quantity: -qty,
            type: 'TRANSFER',
            reason: `Bulk Transfer to ${toBranchId}`,
            user: req.user.id,
            documentId: transferId
        });

        // Add Dest
        let destInv = await Inventory.findOne({ product: item.productId, branch: toBranchId });
        if (!destInv) {
            destInv = await Inventory.create({
                product: item.productId,
                branch: toBranchId,
                quantity: 0,
                batches: []
            });
        }
        destInv.quantity += qty;
        destInv.batches.push({ lot: 'TRANSFER', quantity: qty, receivedAt: Date.now() });
        await destInv.save();

        // Log IN
         await StockMovement.create({
            product: item.productId,
            branch: toBranchId,
            quantity: qty,
            type: 'TRANSFER',
            reason: `Bulk Transfer from ${item.fromBranchId}`,
            user: req.user.id,
            documentId: transferId
        });
        
        results.push(item);
    }
    
    // Emit updates (Optimization: emit once or loop)
    if (req.app.get('io') && results.length > 0) {
        // Simple emit global update for now to trigger refresh
         req.app.get('io').emit('stock-updated', { type: 'bulk' });
    }

    res.status(200).json({
        success: true,
        count: results.length,
        transferId
    });
});

const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const CashShift = require('../models/CashShift');
const Sale = require('../models/Sale');

// @desc    Start a new cash shift
// @route   POST /api/v1/cash-shifts/start
// @access  Private (Cashier, Supervisor)
exports.startShift = asyncHandler(async (req, res, next) => {
    const { startAmount } = req.body;

    // Check if user already has an open shift
    const existingShift = await CashShift.findOne({
        user: req.user.id,
        branch: req.user.branch,
        status: 'open'
    });

    if (existingShift) {
        return next(new ErrorResponse('Ya tienes un turno de caja abierto.', 400));
    }

    const shift = await CashShift.create({
        user: req.user.id,
        branch: req.user.branch,
        startAmount,
        startTime: Date.now(),
        status: 'open'
    });

    res.status(201).json({
        success: true,
        data: shift
    });
});

// @desc    Close current cash shift (Corte de Caja)
// @route   POST /api/v1/cash-shifts/close
// @access  Private (Cashier, Supervisor)
exports.closeShift = asyncHandler(async (req, res, next) => {
    const { actualCash, observations } = req.body;

    const shift = await CashShift.findOne({
        user: req.user.id,
        branch: req.user.branch,
        status: 'open'
    });

    if (!shift) {
        return next(new ErrorResponse('No tienes un turno de caja abierto.', 404));
    }

    // Calculate sales totals during this shift
    const sales = await Sale.find({
        user: req.user.id,
        branch: req.user.branch,
        createdAt: { $gte: shift.startTime } // Sales since start
    });

    let salesTotal = 0;
    let cashSalesTotal = 0;
    let cardSalesTotal = 0;

    sales.forEach(sale => {
        salesTotal += sale.totalAmount;
        if (sale.paymentMethod === 'transbank') {
             cardSalesTotal += sale.totalAmount;
        } else {
             cashSalesTotal += sale.totalAmount;
        }
    });

    // Update shift
    shift.endTime = Date.now();
    shift.status = 'closed';
    shift.salesTotal = salesTotal;
    shift.cashSalesTotal = cashSalesTotal;
    shift.cardSalesTotal = cardSalesTotal;
    shift.expectedCash = shift.startAmount + cashSalesTotal;
    shift.actualCash = actualCash;
    shift.difference = actualCash - (shift.startAmount + cashSalesTotal);
    shift.observations = observations;

    await shift.save();

    res.status(200).json({
        success: true,
        data: shift
    });
});

// @desc    Get current open shift
// @route   GET /api/v1/cash-shifts/current
// @access  Private
exports.getCurrentShift = asyncHandler(async (req, res, next) => {
    const shift = await CashShift.findOne({
        user: req.user.id,
        branch: req.user.branch,
        status: 'open'
    });

    if (!shift) {
        return res.status(200).json({ success: true, data: null });
    }

    res.status(200).json({
        success: true,
        data: shift
    });
});

// @desc    Get all shifts (Report)
// @route   GET /api/v1/cash-shifts
// @access  Private (Admin, Supervisor)
exports.getShifts = asyncHandler(async (req, res, next) => {
    let queryObj = {};

    // Filter by date
    if (req.query.date) {
        const start = new Date(`${req.query.date}T00:00:00`);
        const end = new Date(`${req.query.date}T23:59:59.999`);
        queryObj.startTime = { $gte: start, $lte: end };
    }
    
    // Filter by branch
    if (req.query.branch) {
        queryObj.branch = req.query.branch;
    } else if (req.user.role === 'supervisor') {
        // Enforce supervisor branch
        queryObj.branch = req.user.branch;
    }

    const shifts = await CashShift.find(queryObj)
        .populate('user', 'name')
        .populate('branch', 'name')
        .sort('-startTime');

    res.status(200).json({
        success: true,
        count: shifts.length,
        data: shifts
    });
});

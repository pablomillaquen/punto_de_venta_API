const PDFDocument = require('pdfkit');
const asyncHandler = require('../middleware/async');
const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const CashShift = require('../models/CashShift');

// Helper to create PDF Header
const createParams = (doc, title, docNumber) => {
    doc.fontSize(20).text('SISTEMA POS - MULTISUCURSAL', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(title, { align: 'center' });
    doc.fontSize(12).text(`N° Documento: ${docNumber || 'PENDIENTE'}`, { align: 'right' });
    doc.text(`Fecha: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown();
    doc.hrule = () => doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.hrule();
    doc.moveDown();
};

// Helper for Signature Footer
const createFooter = (doc) => {
    doc.moveDown(4);
    const startY = doc.y;
    const margin = 50;
    const pageWidth = doc.page.width;
    
    doc.moveTo(margin, startY).lineTo(margin + 150, startY).stroke();
    doc.text('Entregado por', margin, startY + 5);
    
    doc.moveTo(pageWidth - margin - 150, startY).lineTo(pageWidth - margin, startY).stroke();
    doc.text('Recibido/Revisado por', pageWidth - margin - 150, startY + 5);
};

// @desc    Generate Import Receipt PDF
// @route   GET /api/v1/reports/import-receipt/:batchId
// @desc    Generate Import Receipt PDF
// @route   GET /api/v1/reports/import-receipt/:batchId
exports.getImportReceipt = asyncHandler(async (req, res, next) => {
    const { batchId } = req.params;
    
    const movements = await StockMovement.find({ documentId: batchId })
        .populate('product', 'name barcode')
        .populate('branch', 'name')
        .populate('user', 'name');

    if (!movements || movements.length === 0) {
        return res.status(404).send('No records found for this Import Batch');
    }

    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Import_${batchId}.pdf`);

    doc.pipe(res);
    
    createParams(doc, 'COMPROBANTE DE INGRESO MASIVO', batchId);

    doc.text(`Usuario Responsable: ${movements[0].user ? movements[0].user.name : 'Unknown'}`);
    doc.moveDown();

    // Table Header
    doc.font('Helvetica-Bold');
    let headerY = doc.y;
    doc.text('Producto / Código', 50, headerY, { width: 200 });
    doc.text('Sucursal', 250, headerY, { width: 100 });
    doc.text('Cantidad', 350, headerY, { width: 50 });
    doc.text('Lote/Venc.', 420, headerY, { width: 100 });
    doc.moveDown();
    doc.font('Helvetica');
    doc.hrule();
    doc.moveDown(0.5);

    // Rows
    movements.forEach(m => {
        let y = doc.y;
        doc.text(`${m.product.name}\n${m.product.barcode}`, 50, y, { width: 200 });
        doc.text(m.branch.name, 250, y, { width: 100 });
        doc.text(m.quantity.toString(), 350, y, { width: 50 });
        doc.text(`${m.batch?.lot || '-'}\n${m.batch?.expiry ? new Date(m.batch.expiry).toLocaleDateString() : '-'}`, 420, y, { width: 100 });
        doc.moveDown();
        doc.moveDown(0.5);
    });

    createFooter(doc);

    doc.end();
});

// @desc    Generate Checklist PDF
exports.getStockChecklist = asyncHandler(async (req, res, next) => {
    const { items } = req.body;
    
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Checklist_${Date.now()}.pdf`);
    doc.pipe(res);

    createParams(doc, 'LISTADO DE CONTROL DE STOCK', `CHK-${Date.now()}`);

    doc.font('Helvetica-Bold');
    let headerY = doc.y;
    doc.text('Producto', 50, headerY, { width: 250 });
    doc.text('Sucursal', 300, headerY, { width: 100 });
    doc.text('Stock Sistema', 400, headerY, { width: 80 });
    doc.text('Físico', 480, headerY, { width: 80 });
    doc.moveDown();
    doc.font('Helvetica');
    doc.hrule();
    doc.moveDown();

    // Rows
    items.forEach(item => {
         let y = doc.y;
         doc.text(item.productName || item.product?.name, 50, y, { width: 250 });
         doc.text(item.branchName || item.branch?.name, 300, y, { width: 100 });
         doc.text((item.quantity || 0).toString(), 400, y, { width: 80 });
         doc.text("_______", 480, y, { width: 80 });
         doc.moveDown();
    });

    createFooter(doc);
    doc.end();
});

// @desc    Generate Transfer Document PDF
// @route   GET /api/v1/reports/transfer-document/:transferId
exports.getTransferDocument = asyncHandler(async (req, res, next) => {
    const { transferId } = req.params;
    
    const movements = await StockMovement.find({ documentId: transferId, type: 'TRANSFER', quantity: { $lt: 0 } })
        .populate('product', 'name barcode')
        .populate('branch', 'name')
        .populate('user', 'name');

    if (!movements || movements.length === 0) {
        return res.status(404).send('No records found for this Transfer ID');
    }
    
    const inMovement = await StockMovement.findOne({ documentId: transferId, type: 'TRANSFER', quantity: { $gt: 0 } }).populate('branch', 'name');
    const toBranchName = inMovement ? inMovement.branch.name : 'Unknown';
    const fromBranchName = movements[0].branch.name;

    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Traslado_${transferId}.pdf`);

    doc.pipe(res);
    
    createParams(doc, 'GUÍA DE TRASLADO ENTRE SUCURSALES', transferId);
    
    doc.text(`Origen: ${fromBranchName}`);
    doc.text(`Destino: ${toBranchName}`);
    doc.text(`Usuario Responsable: ${movements[0].user.name}`);
    doc.moveDown();

    // Table Header
    doc.font('Helvetica-Bold');
    let headerY = doc.y;
    doc.text('Producto / Código', 50, headerY, { width: 300 });
    doc.text('Cantidad', 350, headerY, { width: 100 });
    doc.text('Recepción', 450, headerY, { width: 100 });
    doc.moveDown();
    doc.font('Helvetica');
    doc.hrule();
    doc.moveDown(0.5);

    // Rows
    movements.forEach(m => {
        let y = doc.y;
        doc.text(`${m.product.name}\n${m.product.barcode}`, 50, y, { width: 300 });
        doc.text(Math.abs(m.quantity).toString(), 350, y, { width: 100 }); 
        doc.text('_______', 450, y, { width: 100 });
        doc.moveDown();
        doc.moveDown(0.5);
    });

    createFooter(doc);

    doc.end();
});
// @desc    Generate Sales Report PDF
// @route   GET /api/v1/reports/sales
exports.getSalesReport = asyncHandler(async (req, res, next) => {
    const reqQuery = { ...req.query };
    const queryObj = {};

    // Role Logic: handled by query params if passed from frontend service which handles context
    // Ideally we should enforce strict role checks here too like in sales.js, 
    // but for the report endpoint we can rely on the passed filters if trusted or re-implement.
    // For consistency, let's trust the query builder logic from frontend for now, or minimal checks.
    
    if (req.user.role === 'cajero') {
        queryObj.user = req.user.id;
        queryObj.branch = req.user.branch;
    } else if (req.user.role === 'supervisor') {
         queryObj.branch = req.user.branch;
    }
    // Admin override if params exist
    if (reqQuery.branch && req.user.role === 'admin') queryObj.branch = reqQuery.branch;
    
    // Date Filtering
    if (reqQuery.date) {
        const start = new Date(`${reqQuery.date}T00:00:00`);
        const end = new Date(`${reqQuery.date}T23:59:59.999`);
        queryObj.createdAt = { $gte: start, $lte: end };
    }

    const sales = await Sale.find(queryObj)
        .populate('user', 'name')
        .populate('branch', 'name')
        .sort('-createdAt');

    const doc = new PDFDocument({ layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Ventas_${Date.now()}.pdf`);
    doc.pipe(res);

    createParams(doc, 'REPORTE DE VENTAS', `RPT-${Date.now()}`);

    // Filter Info
    doc.text(`Fecha: ${reqQuery.date || 'Todas'}`);
    
    let branchName = 'Todas las sucursales';
    if (queryObj.branch) {
         if (sales.length > 0 && sales[0].branch) branchName = sales[0].branch.name;
    } else if (reqQuery.branch) {
         branchName = 'Sucursal Seleccionada'; 
    }
    doc.text(`Sucursal: ${branchName}`);
    doc.moveDown();

    // Table Header
    doc.font('Helvetica-Bold');
    let headerY = doc.y;
    
    // Total width for landscape (792) minus margins (50x2) = 692
    const colWidths = {
        id: 110,
        hora: 80,
        sucursal: 140,
        cajero: 140,
        metodo: 110,
        total: 112
    };
    
    let currentX = 50;
    doc.text('ID Transacción', currentX, headerY, { width: colWidths.id }); currentX += colWidths.id;
    doc.text('Hora', currentX, headerY, { width: colWidths.hora }); currentX += colWidths.hora;
    doc.text('Sucursal', currentX, headerY, { width: colWidths.sucursal }); currentX += colWidths.sucursal;
    doc.text('Cajero', currentX, headerY, { width: colWidths.cajero }); currentX += colWidths.cajero;
    doc.text('Método Pago', currentX, headerY, { width: colWidths.metodo }); currentX += colWidths.metodo;
    doc.text('Total', currentX, headerY, { width: colWidths.total, align: 'right' });
    
    doc.moveDown();
    doc.font('Helvetica');
    doc.hrule();
    doc.moveDown(0.5);

    // Rows
    let totalCash = 0;
    let totalTransbank = 0;
    
    sales.forEach(s => {
        let y = doc.y;
        
        // Pagination Check for Landscape (height is ~612)
        if (y > 500) {
            doc.addPage();
            y = 50;
        }

        let rowX = 50;
        doc.text(s._id.toString().toUpperCase(), rowX, y, { width: colWidths.id }); rowX += colWidths.id;
        doc.text(new Date(s.createdAt).toLocaleTimeString(), rowX, y, { width: colWidths.hora }); rowX += colWidths.hora;
        doc.text(s.branch?.name || '-', rowX, y, { width: colWidths.sucursal }); rowX += colWidths.sucursal;
        doc.text(s.user?.name || '-', rowX, y, { width: colWidths.cajero }); rowX += colWidths.cajero;
        doc.text((s.paymentMethod || '').toUpperCase(), rowX, y, { width: colWidths.metodo }); rowX += colWidths.metodo;
        doc.text(`$${s.totalAmount.toLocaleString('es-CL')}`, rowX, y, { width: colWidths.total, align: 'right' });
        
        doc.moveDown();
        
        if (s.paymentMethod === 'cash') totalCash += s.totalAmount;
        if (s.paymentMethod === 'transbank') totalTransbank += s.totalAmount;
    });
    
    doc.hrule();
    doc.moveDown();
    
    // Summary - Adjusted for better width
    const summaryWidth = 300;
    const summaryX = doc.page.width - summaryWidth - 50;
    
    doc.font('Helvetica-Bold');
    doc.text('RESUMEN Y TOTALES', summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.moveDown(0.5);
    
    doc.font('Helvetica');
    doc.text(`Total Efectivo: $${totalCash.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.text(`Total Transbank: $${totalTransbank.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold');
    doc.fontSize(14).text(`TOTAL GENERAL: $${(totalCash + totalTransbank).toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });

    createFooter(doc);
    doc.end();
});

// @desc    Generate Cash Shift Report PDF
// @route   GET /api/v1/reports/cash-shift/:shiftId
exports.getCashShiftReport = asyncHandler(async (req, res, next) => {
    const { shiftId } = req.params;

    const shift = await CashShift.findById(shiftId)
        .populate('user', 'name')
        .populate('branch', 'name');

    if (!shift) {
        return res.status(404).send('Cash shift not found');
    }

    // Fetch sales for this shift
    const sales = await Sale.find({
        branch: shift.branch._id,
        user: shift.user._id,
        createdAt: { $gte: shift.startTime, $lte: shift.endTime || new Date() }
    }).sort('createdAt');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Cierre_Caja_${shiftId}.pdf`);
    doc.pipe(res);

    createParams(doc, 'COMPROBANTE DE CIERRE DE CAJA', shiftId);

    // Shift Info
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('INFORMACIÓN DEL TURNO');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Cajero: ${shift.user.name}`);
    doc.text(`Sucursal: ${shift.branch.name}`);
    doc.text(`Inicio: ${new Date(shift.startTime).toLocaleString()}`);
    doc.text(`Cierre: ${shift.endTime ? new Date(shift.endTime).toLocaleString() : 'En curso'}`);
    doc.moveDown();

    // Sales Table
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('DETALLE DE VENTAS');
    doc.moveDown(0.5);
    
    doc.fontSize(10);
    let headerY = doc.y;
    doc.text('ID Venta', 50, headerY, { width: 150 });
    doc.text('Hora', 200, headerY, { width: 80 });
    doc.text('Método', 280, headerY, { width: 100 });
    doc.text('Transbank N°', 380, headerY, { width: 100 });
    doc.text('Total', 480, headerY, { width: 70, align: 'right' });
    
    doc.moveDown(0.5);
    doc.hrule();
    doc.moveDown(0.5);

    sales.forEach(s => {
        let y = doc.y;
        if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
        }
        
        doc.font('Helvetica').fontSize(9);
        doc.text(s._id.toString().substring(s._id.toString().length - 8).toUpperCase(), 50, y, { width: 150 });
        doc.text(new Date(s.createdAt).toLocaleTimeString(), 200, y, { width: 80 });
        doc.text(s.paymentMethod.toUpperCase(), 280, y, { width: 100 });
        doc.text(s.transbankData?.voucherNumber || '-', 380, y, { width: 100 });
        doc.text(`$${s.totalAmount.toLocaleString('es-CL')}`, 480, y, { width: 70, align: 'right' });
        doc.moveDown();
    });

    doc.moveDown();
    doc.hrule();
    doc.moveDown();

    // Totals Summary
    const summaryX = 350;
    const summaryWidth = 200;
    
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('RESUMEN DE CAJA', summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    doc.text(`Apertura (Efectivo): $${shift.startAmount.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.text(`Ventas Efectivo: $${shift.cashSalesTotal.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.text(`Ventas Tarjeta: $${shift.cardSalesTotal.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.moveDown(0.5);
    
    doc.font('Helvetica-Bold');
    doc.text(`Total Ventas: $${shift.salesTotal.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.text(`Esperado en Efectivo: $${shift.expectedCash.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    
    if (shift.status === 'closed') {
        doc.text(`Efectivo Real: $${shift.actualCash.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
        const diffColor = shift.difference < 0 ? 'red' : 'black';
        doc.fillColor(diffColor).text(`Diferencia: $${shift.difference.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
        doc.fillColor('black');
    }
    
    doc.moveDown();
    if (shift.observations) {
        doc.fontSize(10).font('Helvetica-Oblique');
        doc.text(`Observaciones: ${shift.observations}`, 50, doc.y, { width: 500 });
    }

    createFooter(doc);
    doc.end();
});

// @desc    Generate Daily Cash Report PDF
// @route   GET /api/v1/reports/daily-cash
exports.getDailyCashReport = asyncHandler(async (req, res, next) => {
    const { date, branch } = req.query;
    
    const queryObj = {};
    if (branch) queryObj.branch = branch;
    
    if (date) {
        const start = new Date(`${date}T00:00:00`);
        const end = new Date(`${date}T23:59:59.999`);
        queryObj.startTime = { $gte: start, $lte: end };
    }

    const shifts = await CashShift.find(queryObj)
        .populate('user', 'name')
        .populate('branch', 'name')
        .sort('branch startTime');

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Cierres_${date}.pdf`);
    doc.pipe(res);

    createParams(doc, 'REPORTE DIARIO DE CIERRES DE CAJA', `DIA-${date}`);

    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Fecha: ${date}`);
    doc.text(`Sucursal: ${branch ? (shifts.length > 0 ? shifts[0].branch.name : branch) : 'Todas'}`);
    doc.moveDown();

    // Table Header
    doc.fontSize(10).font('Helvetica-Bold');
    let headerY = doc.y;
    doc.text('Sucursal', 50, headerY, { width: 100 });
    doc.text('Cajero', 150, headerY, { width: 100 });
    doc.text('Horario', 250, headerY, { width: 100 });
    doc.text('V. Efectivo', 350, headerY, { width: 70, align: 'right' });
    doc.text('V. Tarjeta', 420, headerY, { width: 70, align: 'right' });
    doc.text('Dif.', 490, headerY, { width: 60, align: 'right' });
    
    doc.moveDown(0.5);
    doc.hrule();
    doc.moveDown(0.5);

    let totalCashSales = 0;
    let totalCardSales = 0;
    let totalDifference = 0;

    shifts.forEach(s => {
        let y = doc.y;
        if (y > doc.page.height - 100) {
            doc.addPage();
            y = 50;
        }

        doc.font('Helvetica').fontSize(9);
        doc.text(s.branch.name, 50, y, { width: 100 });
        doc.text(s.user.name, 150, y, { width: 100 });
        doc.text(`${new Date(s.startTime).toLocaleTimeString().substring(0, 5)} - ${s.endTime ? new Date(s.endTime).toLocaleTimeString().substring(0, 5) : '...' }`, 250, y, { width: 100 });
        doc.text(`$${s.cashSalesTotal.toLocaleString('es-CL')}`, 350, y, { width: 70, align: 'right' });
        doc.text(`$${s.cardSalesTotal.toLocaleString('es-CL')}`, 420, y, { width: 70, align: 'right' });
        
        const diff = s.difference || 0;
        const diffColor = diff < 0 ? 'red' : 'black';
        doc.fillColor(diffColor).text(`$${diff.toLocaleString('es-CL')}`, 490, y, { width: 60, align: 'right' });
        doc.fillColor('black');
        
        doc.moveDown();
        
        totalCashSales += s.cashSalesTotal;
        totalCardSales += s.cardSalesTotal;
        totalDifference += diff;
    });

    doc.moveDown();
    doc.hrule();
    doc.moveDown();

    // Totals
    const summaryX = 350;
    const summaryWidth = 200;
    
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('TOTALES DEL DÍA', summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    doc.text(`Total Ventas Efectivo: $${totalCashSales.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.text(`Total Ventas Tarjeta: $${totalCardSales.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.moveDown(0.5);
    
    doc.font('Helvetica-Bold');
    doc.text(`TOTAL GENERAL: $${(totalCashSales + totalCardSales).toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    
    const totalDiffColor = totalDifference < 0 ? 'red' : 'black';
    doc.fillColor(totalDiffColor).text(`DIFERENCIA TOTAL: $${totalDifference.toLocaleString('es-CL')}`, summaryX, doc.y, { width: summaryWidth, align: 'right' });
    doc.fillColor('black');

    createFooter(doc);
    doc.end();
});

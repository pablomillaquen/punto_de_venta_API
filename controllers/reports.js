const PDFDocument = require('pdfkit');
const asyncHandler = require('../middleware/async');
const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');
const CashShift = require('../models/CashShift');

// ========================
// HELPER FUNCTIONS
// ========================

/**
 * Creates a professional header with branding
 * @param {Object} doc - PDFKit document
 * @param {String} title - Report title
 * @param {String} docNumber - Document number/ID
 */
const createHeader = (doc, title, docNumber) => {
    const pageWidth = doc.page.width;
    const margin = 50;
    
    // Logo/Branding section
    doc.fontSize(22)
       .font('Helvetica-Bold')
       .fillColor('#333333')
       .text('SISTEMA POS', margin, 40, { align: 'left' });
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#666666')
       .text('Gestión Multisucursal', margin, 62);
    
    // Document info (right side)
    doc.fontSize(9)
       .fillColor('#666666')
       .text(`DOC N°: ${docNumber || 'PENDIENTE'}`, pageWidth - 200, 40, { align: 'right', width: 150 });
    
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CL')}`, pageWidth - 200, 52, { align: 'right', width: 150 });
    
    doc.text(`Hora: ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 200, 64, { align: 'right', width: 150 });
    
    // Main title
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text(title, margin, 90, { align: 'center', width: pageWidth - (margin * 2) });
    
    // Separator line
    doc.moveTo(margin, 115)
       .lineTo(pageWidth - margin, 115)
       .lineWidth(2)
       .strokeColor('#F88813')
       .stroke();
    
    doc.moveDown();
    doc.y = 130; // Reset Y position after header
};

/**
 * Creates footer with signatures and page numbers
 * @param {Object} doc - PDFKit document
 * @param {Number} currentPage - Current page number
 * @param {Boolean} includeSignatures - Whether to include signature lines
 */
const createFooter = (doc, currentPage = 1, includeSignatures = true) => {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    const margin = 50;
    
    // We place the footer at a safe distance from bottom. 
    // Since we reduced margins to 30/50, we use a fixed Y.
    const footerY = pageHeight - 60;
    
    // Page Number
    doc.fontSize(8)
       .fillColor('#999999')
       .text(`Página ${currentPage}`, margin, footerY, { align: 'center', width: pageWidth - (margin * 2) });
    
    doc.fontSize(7)
       .text(`Generado por Sistema POS - ${new Date().toLocaleString('es-CL')}`, 
              margin, footerY + 10, { align: 'center', width: pageWidth - (margin * 2) });
    
    if (includeSignatures) {
        // Signatures are placed relative to footerY
        const signatureY = footerY - 50;
        
        doc.lineWidth(0.5)
           .strokeColor('#333333');

        // Left signature
        doc.moveTo(margin + 50, signatureY)
           .lineTo(margin + 200, signatureY)
           .stroke();
        
        doc.fontSize(8)
           .fillColor('#333333')
           .font('Helvetica')
           .text('Firma Responsable', margin + 50, signatureY + 5, { width: 150, align: 'center' });
        
        // Right signature
        doc.moveTo(pageWidth - margin - 200, signatureY)
           .lineTo(pageWidth - margin - 50, signatureY)
           .stroke();
        
        doc.text('Firma Recepción', pageWidth - margin - 200, signatureY + 5, { width: 150, align: 'center' });
    }
};

/**
 * Draws a horizontal line
 */
const drawLine = (doc, color = '#CCCCCC', lineWidth = 0.5) => {
    const margin = 50;
    doc.moveTo(margin, doc.y)
       .lineTo(doc.page.width - margin, doc.y)
       .strokeColor(color)
       .lineWidth(lineWidth)
       .stroke();
};

// ========================
// REPORT ENDPOINTS
// ========================

/**
 * @desc    Generate Import Receipt PDF
 * @route   GET /api/v1/reports/import-receipt/:batchId
 * @access  Private
 */
exports.getImportReceipt = asyncHandler(async (req, res, next) => {
    const { batchId } = req.params;
    
    const movements = await StockMovement.find({ documentId: batchId })
        .populate('product', 'name barcode')
        .populate('branch', 'name')
        .populate('user', 'name');

    if (!movements || movements.length === 0) {
        return res.status(404).send('No se encontraron registros para este lote de ingreso');
    }

    const doc = new PDFDocument({ 
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 40, left: 50, right: 50 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Ingreso_${batchId}.pdf`);
    doc.pipe(res);
    
    createHeader(doc, 'COMPROBANTE DE INGRESO MASIVO', batchId);

    // Info section
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Usuario Responsable: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(movements[0].user ? movements[0].user.name : 'Desconocido');
    
    doc.moveDown(1.5);

    // Table Header
    const tableTop = doc.y;
    const colWidths = { producto: 220, codigo: 120, sucursal: 140, cantidad: 80, lote: 100, vencimiento: 100 };
    let xPos = 50;
    
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor('#FFFFFF');
    
    // Header background
    doc.rect(50, tableTop, doc.page.width - 100, 20)
       .fillAndStroke('#F88813', '#F88813');
    
    doc.text('Producto', xPos + 5, tableTop + 6, { width: colWidths.producto });
    xPos += colWidths.producto;
    doc.text('Código de Barras', xPos, tableTop + 6, { width: colWidths.codigo });
    xPos += colWidths.codigo;
    doc.text('Sucursal', xPos, tableTop + 6, { width: colWidths.sucursal });
    xPos += colWidths.sucursal;
    doc.text('Cant.', xPos, tableTop + 6, { width: colWidths.cantidad, align: 'center' });
    xPos += colWidths.cantidad;
    doc.text('Lote', xPos, tableTop + 6, { width: colWidths.lote });
    xPos += colWidths.lote;
    doc.text('Vencimiento', xPos, tableTop + 6, { width: colWidths.vencimiento });
    
    doc.y = tableTop + 25;
    doc.fillColor('#000000');

    // Rows
    let rowCount = 0;
    let pageNum = 1;
    movements.forEach((m, index) => {
        if (doc.y > doc.page.height - 130) {
            createFooter(doc, pageNum, false);
            doc.addPage();
            pageNum++;
            createHeader(doc, 'COMPROBANTE DE INGRESO MASIVO (Continuación)', batchId);
            doc.y += 10;
        }
        
        const rowY = doc.y;
        const rowHeight = 30;
        
        // Zebra striping
        if (index % 2 === 0) {
            doc.rect(50, rowY, doc.page.width - 100, rowHeight)
               .fillAndStroke('#F5F5F5', '#F5F5F5');
        }
        
        xPos = 50;
        doc.font('Helvetica').fontSize(8).fillColor('#000000');
        
        doc.text(m.product.name, xPos + 5, rowY + 8, { width: colWidths.producto - 10 });
        xPos += colWidths.producto;
        doc.text(m.product.barcode || '-', xPos, rowY + 8, { width: colWidths.codigo });
        xPos += colWidths.codigo;
        doc.text(m.branch.name, xPos, rowY + 8, { width: colWidths.sucursal });
        xPos += colWidths.sucursal;
        doc.text(m.quantity.toString(), xPos, rowY + 8, { width: colWidths.cantidad, align: 'center' });
        xPos += colWidths.cantidad;
        doc.text(m.batch?.lot || '-', xPos, rowY + 8, { width: colWidths.lote });
        xPos += colWidths.lote;
        doc.text(m.batch?.expiry ? new Date(m.batch.expiry).toLocaleDateString('es-CL') : '-', xPos, rowY + 8, { width: colWidths.vencimiento });
        
        doc.y = rowY + rowHeight;
        rowCount++;
    });

    doc.moveDown(2);
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(`Total de productos ingresados: ${rowCount}`, 50, doc.y);

    createFooter(doc, pageNum, true);
    doc.end();
});

/**
 * @desc    Generate Stock Checklist PDF
 * @route   POST /api/v1/reports/stock-checklist
 * @access  Private
 */
exports.getStockChecklist = asyncHandler(async (req, res, next) => {
    const { items } = req.body;
    
    const doc = new PDFDocument({ 
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 40, left: 50, right: 50 }
    });
    
    const docNumber = `CHK-${Date.now()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Checklist_${docNumber}.pdf`);
    doc.pipe(res);

    createHeader(doc, 'LISTADO DE CONTROL DE INVENTARIO', docNumber);

    // Table Header
    const tableTop = doc.y + 10;
    const colWidths = { producto: 280, sucursal: 160, stockSistema: 100, stockFisico: 120 };
    let xPos = 50;
    
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    
    doc.rect(50, tableTop, doc.page.width - 100, 20)
       .fillAndStroke('#F88813', '#F88813');
    
    doc.text('Producto', xPos + 5, tableTop + 6, { width: colWidths.producto });
    xPos += colWidths.producto;
    doc.text('Sucursal', xPos, tableTop + 6, { width: colWidths.sucursal });
    xPos += colWidths.sucursal;
    doc.text('Stock Sistema', xPos, tableTop + 6, { width: colWidths.stockSistema, align: 'center' });
    xPos += colWidths.stockSistema;
    doc.text('Stock Físico', xPos, tableTop + 6, { width: colWidths.stockFisico, align: 'center' });
    
    doc.y = tableTop + 25;
    doc.fillColor('#000000');

    // Rows
    let pageNum = 1;
    items.forEach((item, index) => {
        if (doc.y > doc.page.height - 130) {
            createFooter(doc, pageNum, false);
            doc.addPage();
            pageNum++;
            createHeader(doc, 'LISTADO DE CONTROL DE INVENTARIO (Continuación)', docNumber);
            doc.y += 10;
        }
        
        const rowY = doc.y;
        const rowHeight = 25;
        
        if (index % 2 === 0) {
            doc.rect(50, rowY, doc.page.width - 100, rowHeight)
               .fillAndStroke('#F5F5F5', '#F5F5F5');
        }
        
        xPos = 50;
        doc.font('Helvetica').fontSize(8).fillColor('#000000');
        
        doc.text(item.productName || item.product?.name, xPos + 5, rowY + 8, { width: colWidths.producto - 10 });
        xPos += colWidths.producto;
        doc.text(item.branchName || item.branch?.name, xPos, rowY + 8, { width: colWidths.sucursal });
        xPos += colWidths.sucursal;
        doc.text((item.quantity || 0).toString(), xPos, rowY + 8, { width: colWidths.stockSistema, align: 'center' });
        xPos += colWidths.stockSistema;
        doc.text('__________', xPos, rowY + 8, { width: colWidths.stockFisico, align: 'center' });
        
        doc.y = rowY + rowHeight;
    });

    createFooter(doc, pageNum, true);
    doc.end();
});

/**
 * @desc    Generate Transfer Document PDF
 * @route   GET /api/v1/reports/transfer-document/:transferId
 * @access  Private
 */
exports.getTransferDocument = asyncHandler(async (req, res, next) => {
    const { transferId } = req.params;
    
    const movements = await StockMovement.find({ documentId: transferId, type: 'TRANSFER', quantity: { $lt: 0 } })
        .populate('product', 'name barcode')
        .populate('branch', 'name')
        .populate('user', 'name');

    if (!movements || movements.length === 0) {
        return res.status(404).send('No se encontraron registros para este traspaso');
    }
    
    const inMovement = await StockMovement.findOne({ documentId: transferId, type: 'TRANSFER', quantity: { $gt: 0 } })
        .populate('branch', 'name');
    
    const toBranchName = inMovement ? inMovement.branch.name : 'Desconocido';
    const fromBranchName = movements[0].branch.name;

    const doc = new PDFDocument({ 
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 40, left: 50, right: 50 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Traslado_${transferId}.pdf`);
    doc.pipe(res);
    
    createHeader(doc, 'GUÍA DE TRASLADO ENTRE SUCURSALES', transferId);
    
    // Transfer info
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Origen: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(fromBranchName);
    
    doc.font('Helvetica-Bold')
       .text('Destino: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(toBranchName);
    
    doc.font('Helvetica-Bold')
       .text('Usuario Responsable: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(movements[0].user.name);
    
    doc.moveDown(1.5);

    // Table Header
    const tableTop = doc.y;
    const colWidths = { producto: 300, codigo: 150, cantidad: 100, recepcion: 150 };
    let xPos = 50;
    
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    
    doc.rect(50, tableTop, doc.page.width - 100, 20)
       .fillAndStroke('#F88813', '#F88813');
    
    doc.text('Producto', xPos + 5, tableTop + 6, { width: colWidths.producto });
    xPos += colWidths.producto;
    doc.text('Código de Barras', xPos, tableTop + 6, { width: colWidths.codigo });
    xPos += colWidths.codigo;
    doc.text('Cantidad', xPos, tableTop + 6, { width: colWidths.cantidad, align: 'center' });
    xPos += colWidths.cantidad;
    doc.text('Recepción ✓', xPos, tableTop + 6, { width: colWidths.recepcion, align: 'center' });
    
    doc.y = tableTop + 25;
    doc.fillColor('#000000');

    // Rows
    let pageNum = 1;
    movements.forEach((m, index) => {
        if (doc.y > doc.page.height - 130) {
            createFooter(doc, pageNum, false);
            doc.addPage();
            pageNum++;
            createHeader(doc, 'GUÍA DE TRASLADO (Continuación)', transferId);
            doc.y += 10;
        }
        
        const rowY = doc.y;
        const rowHeight = 30;
        
        if (index % 2 === 0) {
            doc.rect(50, rowY, doc.page.width - 100, rowHeight)
               .fillAndStroke('#F5F5F5', '#F5F5F5');
        }
        
        xPos = 50;
        doc.font('Helvetica').fontSize(8).fillColor('#000000');
        
        doc.text(m.product.name, xPos + 5, rowY + 10, { width: colWidths.producto - 10 });
        xPos += colWidths.producto;
        doc.text(m.product.barcode || '-', xPos, rowY + 10, { width: colWidths.codigo });
        xPos += colWidths.codigo;
        doc.text(Math.abs(m.quantity).toString(), xPos, rowY + 10, { width: colWidths.cantidad, align: 'center' });
        xPos += colWidths.cantidad;
        doc.text('__________', xPos, rowY + 10, { width: colWidths.recepcion, align: 'center' });
        
        doc.y = rowY + rowHeight;
    });

    createFooter(doc, pageNum, true);
    doc.end();
});

/**
 * @desc    Generate Sales Report PDF
 * @route   GET /api/v1/reports/sales
 * @access  Private
 */
exports.getSalesReport = asyncHandler(async (req, res, next) => {
    const reqQuery = { ...req.query };
    const queryObj = {};

    // Role-based filtering
    if (req.user.role === 'cajero') {
        queryObj.user = req.user.id;
        queryObj.branch = req.user.branch;
    } else if (req.user.role === 'supervisor') {
        queryObj.branch = req.user.branch;
    }
    
    if (reqQuery.branch && req.user.role === 'admin') {
        queryObj.branch = reqQuery.branch;
    }
    
    // Date filtering
    if (reqQuery.date) {
        const start = new Date(`${reqQuery.date}T00:00:00`);
        const end = new Date(`${reqQuery.date}T23:59:59.999`);
        queryObj.createdAt = { $gte: start, $lte: end };
    }

    const sales = await Sale.find(queryObj)
        .populate('user', 'name')
        .populate('branch', 'name')
        .sort('-createdAt');

    const doc = new PDFDocument({ 
        size: 'A4', 
        layout: 'landscape',
        margins: { top: 50, bottom: 40, left: 50, right: 50 }
    });
    
    const docNumber = `VTA-${Date.now()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Ventas_${docNumber}.pdf`);
    doc.pipe(res);

    createHeader(doc, 'REPORTE DE VENTAS', docNumber);

    // Filter info
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Fecha: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(reqQuery.date || 'Todas las fechas');
    
    let branchName = 'Todas las sucursales';
    if (queryObj.branch && sales.length > 0 && sales[0].branch) {
        branchName = sales[0].branch.name;
    }
    
    doc.font('Helvetica-Bold')
       .text('Sucursal: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(branchName);
    
    doc.moveDown(1.5);

    // Table Header
    const tableTop = doc.y;
    const colWidths = { 
        id: 140, 
        fecha: 80, 
        hora: 60, 
        sucursal: 120, 
        cajero: 120, 
        metodo: 90, 
        total: 100 
    };
    
    let xPos = 50;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    
    doc.rect(50, tableTop, doc.page.width - 100, 20)
       .fillAndStroke('#F88813', '#F88813');
    
    doc.text('ID Transacción', xPos + 2, tableTop + 6, { width: colWidths.id });
    xPos += colWidths.id;
    doc.text('Fecha', xPos, tableTop + 6, { width: colWidths.fecha, align: 'center' });
    xPos += colWidths.fecha;
    doc.text('Hora', xPos, tableTop + 6, { width: colWidths.hora, align: 'center' });
    xPos += colWidths.hora;
    doc.text('Sucursal', xPos, tableTop + 6, { width: colWidths.sucursal });
    xPos += colWidths.sucursal;
    doc.text('Cajero', xPos, tableTop + 6, { width: colWidths.cajero });
    xPos += colWidths.cajero;
    doc.text('Método', xPos, tableTop + 6, { width: colWidths.metodo, align: 'center' });
    xPos += colWidths.metodo;
    doc.text('Total', xPos, tableTop + 6, { width: colWidths.total, align: 'right' });
    
    doc.y = tableTop + 25;
    doc.fillColor('#000000');

    // Rows
    let totalCash = 0;
    let totalTransbank = 0;
    let pageNum = 1;
    
    sales.forEach((s, index) => {
        if (doc.y > doc.page.height - 130) {
            createFooter(doc, pageNum, false);
            doc.addPage();
            pageNum++;
            createHeader(doc, 'REPORTE DE VENTAS (Continuación)', docNumber);
            doc.y += 10;
        }
        
        const rowY = doc.y;
        const rowHeight = 22;
        
        if (index % 2 === 0) {
            doc.rect(50, rowY, doc.page.width - 100, rowHeight)
               .fillAndStroke('#F5F5F5', '#F5F5F5');
        }
        
        xPos = 50;
        doc.font('Helvetica').fontSize(7).fillColor('#000000');
        
        doc.text(s._id.toString().substring(s._id.toString().length - 12).toUpperCase(), xPos + 2, rowY + 7, { width: colWidths.id - 4 });
        xPos += colWidths.id;
        doc.text(new Date(s.createdAt).toLocaleDateString('es-CL'), xPos, rowY + 7, { width: colWidths.fecha, align: 'center' });
        xPos += colWidths.fecha;
        doc.text(new Date(s.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), xPos, rowY + 7, { width: colWidths.hora, align: 'center' });
        xPos += colWidths.hora;
        doc.text(s.branch?.name || '-', xPos, rowY + 7, { width: colWidths.sucursal });
        xPos += colWidths.sucursal;
        doc.text(s.user?.name || '-', xPos, rowY + 7, { width: colWidths.cajero });
        xPos += colWidths.cajero;
        doc.text((s.paymentMethod || '').toUpperCase(), xPos, rowY + 7, { width: colWidths.metodo, align: 'center' });
        xPos += colWidths.metodo;
        doc.text(`$${s.totalAmount.toLocaleString('es-CL')}`, xPos, rowY + 7, { width: colWidths.total - 5, align: 'right' });
        
        doc.y = rowY + rowHeight;
        
        if (s.paymentMethod === 'cash') totalCash += s.totalAmount;
        if (s.paymentMethod === 'transbank') totalTransbank += s.totalAmount;
    });
    
    doc.moveDown(1);
    drawLine(doc, '#000000', 1);
    doc.moveDown(0.5);
    
    // Summary section
    const summaryX = doc.page.width - 250;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333');
    doc.text('RESUMEN DE TOTALES', summaryX, doc.y, { width: 220, align: 'right' });
    doc.moveDown(0.5);
    
    // Improved summary layout to avoid overlapping
    const drawSummaryLine = (label, value, color = '#333333', size = 9, isBold = false) => {
        const y = doc.y;
        doc.fontSize(size).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
        doc.text(label, summaryX, y, { width: 140, align: 'right' });
        doc.text(value, summaryX + 145, y, { width: 75, align: 'right' });
        doc.y = y + size + 5;
    };

    drawSummaryLine('Total Efectivo:', `$${totalCash.toLocaleString('es-CL')}`);
    drawSummaryLine('Total Transbank:', `$${totalTransbank.toLocaleString('es-CL')}`);
    
    doc.moveDown(0.2);
    doc.save();
    doc.moveTo(summaryX + 100, doc.y).lineTo(summaryX + 220, doc.y).lineWidth(0.5).stroke('#CCCCCC');
    doc.restore();
    doc.moveDown(0.5);
    
    drawSummaryLine('TOTAL GENERAL:', `$${(totalCash + totalTransbank).toLocaleString('es-CL')}`, '#F88813', 11, true);
    
    createFooter(doc, pageNum, true);
    doc.end();
});

/**
 * @desc    Generate Cash Shift Report PDF
 * @route   GET /api/v1/reports/cash-shift/:shiftId
 * @access  Private
 */
exports.getCashShiftReport = asyncHandler(async (req, res, next) => {
    const { shiftId } = req.params;

    const shift = await CashShift.findById(shiftId)
        .populate('user', 'name')
        .populate('branch', 'name');

    if (!shift) {
        return res.status(404).send('Turno de caja no encontrado');
    }

    const sales = await Sale.find({
        branch: shift.branch._id,
        user: shift.user._id,
        createdAt: { $gte: shift.startTime, $lte: shift.endTime || new Date() }
    }).sort('createdAt');

    const doc = new PDFDocument({ 
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 40, left: 50, right: 50 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Cierre_Caja_${shiftId}.pdf`);
    doc.pipe(res);

    createHeader(doc, 'COMPROBANTE DE CIERRE DE CAJA', shiftId);

    // Shift information box
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333');
    doc.text('INFORMACIÓN DEL TURNO', 50, doc.y);
    doc.moveDown(0.5);
    
    const infoBoxY = doc.y;
    doc.roundedRect(50, infoBoxY, 350, 80, 5)
       .lineWidth(1)
       .strokeColor('#CCCCCC')
       .stroke();
    
    doc.fontSize(9).font('Helvetica');
    doc.text(`Cajero: ${shift.user.name}`, 60, infoBoxY + 10);
    doc.text(`Sucursal: ${shift.branch.name}`, 60, infoBoxY + 25);
    doc.text(`Inicio: ${new Date(shift.startTime).toLocaleString('es-CL')}`, 60, infoBoxY + 40);
    doc.text(`Cierre: ${shift.endTime ? new Date(shift.endTime).toLocaleString('es-CL') : 'En curso'}`, 60, infoBoxY + 55);
    
    doc.y = infoBoxY + 90;
    doc.moveDown();

    // Sales table
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('DETALLE DE VENTAS', 50, doc.y);
    doc.moveDown(0.5);
    
    const tableTop = doc.y;
    const colWidths = { id: 150, hora: 100, metodo: 110, voucher: 140, total: 100 };
    let xPos = 50;
    
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    
    doc.rect(50, tableTop, doc.page.width - 100, 20)
       .fillAndStroke('#F88813', '#F88813');
    
    doc.text('ID Venta', xPos + 5, tableTop + 6, { width: colWidths.id });
    xPos += colWidths.id;
    doc.text('Hora', xPos, tableTop + 6, { width: colWidths.hora, align: 'center' });
    xPos += colWidths.hora;
    doc.text('Método', xPos, tableTop + 6, { width: colWidths.metodo, align: 'center' });
    xPos += colWidths.metodo;
    doc.text('N° Voucher', xPos, tableTop + 6, { width: colWidths.voucher, align: 'center' });
    xPos += colWidths.voucher;
    doc.text('Total', xPos, tableTop + 6, { width: colWidths.total, align: 'right' });
    
    doc.y = tableTop + 25;
    doc.fillColor('#000000');

    let pageNum = 1;
    sales.forEach((s, index) => {
        if (doc.y > doc.page.height - 130) {
            createFooter(doc, pageNum, false);
            doc.addPage();
            pageNum++;
            createHeader(doc, 'CIERRE DE CAJA (Continuación)', shiftId);
            doc.y += 10;
        }
        
        const rowY = doc.y;
        const rowHeight = 22;
        
        if (index % 2 === 0) {
            doc.rect(50, rowY, doc.page.width - 100, rowHeight)
               .fillAndStroke('#F5F5F5', '#F5F5F5');
        }
        
        xPos = 50;
        doc.font('Helvetica').fontSize(7).fillColor('#000000');
        
        doc.text(s._id.toString().substring(s._id.toString().length - 12).toUpperCase(), xPos + 5, rowY + 7, { width: colWidths.id - 10 });
        xPos += colWidths.id;
        doc.text(new Date(s.createdAt).toLocaleTimeString('es-CL'), xPos, rowY + 7, { width: colWidths.hora, align: 'center' });
        xPos += colWidths.hora;
        doc.text(s.paymentMethod.toUpperCase(), xPos, rowY + 7, { width: colWidths.metodo, align: 'center' });
        xPos += colWidths.metodo;
        doc.text(s.transbankData?.voucherNumber || '-', xPos, rowY + 7, { width: colWidths.voucher, align: 'center' });
        xPos += colWidths.voucher;
        doc.text(`$${s.totalAmount.toLocaleString('es-CL')}`, xPos, rowY + 7, { width: colWidths.total - 5, align: 'right' });
        
        doc.y = rowY + rowHeight;
    });

    doc.moveDown(1);
    drawLine(doc, '#000000', 1);
    doc.moveDown(1);

    // Summary box
    const summaryBoxY = doc.y;
    const summaryBoxX = doc.page.width - 320;
    
    doc.roundedRect(summaryBoxX, summaryBoxY, 270, shift.status === 'closed' ? 140 : 110, 5)
       .lineWidth(1)
       .fillAndStroke('#FFF8F0', '#F88813');
    
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333');
    doc.text('RESUMEN DE CAJA', summaryBoxX + 10, summaryBoxY + 10, { width: 250 });
    
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    
    const detailX = summaryBoxX + 10;
    // Detail drawing helper for summary
    const drawSummaryRow = (label, value, isBold = false, color = '#333333') => {
        const y = doc.y;
        doc.fontSize(9).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
        doc.text(label, detailX, y, { width: 150 });
        doc.text(value, detailX + 155, y, { width: 95, align: 'right' });
        doc.y = y + 14;
    };

    drawSummaryRow('Apertura (Efectivo):', `$${shift.startAmount.toLocaleString('es-CL')}`);
    drawSummaryRow('Ventas Efectivo:', `$${shift.cashSalesTotal.toLocaleString('es-CL')}`);
    drawSummaryRow('Ventas Tarjeta:', `$${shift.cardSalesTotal.toLocaleString('es-CL')}`);
    
    doc.moveDown(0.2);
    drawLine(doc, '#CCCCCC', 0.5);
    doc.moveDown(0.4);
    
    drawSummaryRow('Total Ventas:', `$${shift.salesTotal.toLocaleString('es-CL')}`, true, '#F88813');
    drawSummaryRow('Esperado en Efectivo:', `$${shift.expectedCash.toLocaleString('es-CL')}`, true);
    
    if (shift.status === 'closed') {
        drawSummaryRow('Efectivo Real:', `$${shift.actualCash.toLocaleString('es-CL')}`);
        const diffColor = shift.difference < 0 ? '#D32F2F' : '#388E3C';
        drawSummaryRow('Diferencia:', `$${shift.difference.toLocaleString('es-CL')}`, true, diffColor);
    }
    
    if (shift.observations) {
        doc.y = summaryBoxY + (shift.status === 'closed' ? 150 : 120);
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666');
        doc.text(`Observaciones: ${shift.observations}`, 50, doc.y, { width: 500 });
    }

    createFooter(doc, pageNum, true);
    doc.end();
});

/**
 * @desc    Generate Daily Cash Report PDF
 * @route   GET /api/v1/reports/daily-cash
 * @access  Private
 */
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

    const doc = new PDFDocument({ 
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 40, left: 50, right: 50 }
    });
    
    const docNumber = `DIA-${date || Date.now()}`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Cierres_${date}.pdf`);
    doc.pipe(res);

    createHeader(doc, 'REPORTE DIARIO DE CIERRES DE CAJA', docNumber);

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Fecha: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(date || 'Todas');
    
    doc.font('Helvetica-Bold')
       .text('Sucursal: ', 50, doc.y, { continued: true })
       .font('Helvetica')
       .text(branch ? (shifts.length > 0 ? shifts[0].branch.name : branch) : 'Todas');
    
    doc.moveDown(1.5);

    // Table header
    const tableTop = doc.y;
    const colWidths = { sucursal: 120, cajero: 130, horario: 120, efectivo: 90, tarjeta: 90, total: 90, diferencia: 80 };
    let xPos = 50;
    
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
    
    doc.rect(50, tableTop, doc.page.width - 100, 20)
       .fillAndStroke('#F88813', '#F88813');
    
    doc.text('Sucursal', xPos + 5, tableTop + 6, { width: colWidths.sucursal });
    xPos += colWidths.sucursal;
    doc.text('Cajero', xPos, tableTop + 6, { width: colWidths.cajero });
    xPos += colWidths.cajero;
    doc.text('Horario', xPos, tableTop + 6, { width: colWidths.horario, align: 'center' });
    xPos += colWidths.horario;
    doc.text('Efectivo', xPos, tableTop + 6, { width: colWidths.efectivo, align: 'right' });
    xPos += colWidths.efectivo;
    doc.text('Tarjeta', xPos, tableTop + 6, { width: colWidths.tarjeta, align: 'right' });
    xPos += colWidths.tarjeta;
    doc.text('Total', xPos, tableTop + 6, { width: colWidths.total, align: 'right' });
    xPos += colWidths.total;
    doc.text('Dif.', xPos, tableTop + 6, { width: colWidths.diferencia, align: 'right' });
    
    doc.y = tableTop + 25;
    doc.fillColor('#000000');

    let totalCashSales = 0;
    let totalCardSales = 0;
    let totalDifference = 0;
    let pageNum = 1;

    shifts.forEach((s, index) => {
        if (doc.y > doc.page.height - 120) {
            createFooter(doc, pageNum, false);
            doc.addPage();
            pageNum++;
            createHeader(doc, 'REPORTE DIARIO DE CIERRES (Continuación)', docNumber);
            doc.y += 10;
        }
        
        const rowY = doc.y;
        const rowHeight = 22;
        
        if (index % 2 === 0) {
            doc.rect(50, rowY, doc.page.width - 100, rowHeight)
               .fillAndStroke('#F5F5F5', '#F5F5F5');
        }
        
        xPos = 50;
        doc.font('Helvetica').fontSize(7).fillColor('#000000');
        
        doc.text(s.branch.name, xPos + 5, rowY + 7, { width: colWidths.sucursal - 10 });
        xPos += colWidths.sucursal;
        doc.text(s.user.name, xPos, rowY + 7, { width: colWidths.cajero });
        xPos += colWidths.cajero;
        
        const startTime = new Date(s.startTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        const endTime = s.endTime ? new Date(s.endTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '...';
        doc.text(`${startTime} - ${endTime}`, xPos, rowY + 7, { width: colWidths.horario, align: 'center' });
        xPos += colWidths.horario;
        
        doc.text(`$${s.cashSalesTotal.toLocaleString('es-CL')}`, xPos, rowY + 7, { width: colWidths.efectivo - 5, align: 'right' });
        xPos += colWidths.efectivo;
        doc.text(`$${s.cardSalesTotal.toLocaleString('es-CL')}`, xPos, rowY + 7, { width: colWidths.tarjeta - 5, align: 'right' });
        xPos += colWidths.tarjeta;
        doc.text(`$${s.salesTotal.toLocaleString('es-CL')}`, xPos, rowY + 7, { width: colWidths.total - 5, align: 'right' });
        xPos += colWidths.total;
        
        const diff = s.difference || 0;
        const diffColor = diff < 0 ? '#D32F2F' : '#000000';
        doc.fillColor(diffColor).text(`$${diff.toLocaleString('es-CL')}`, xPos, rowY + 7, { width: colWidths.diferencia - 5, align: 'right' });
        doc.fillColor('#000000');
        
        doc.y = rowY + rowHeight;
        
        totalCashSales += s.cashSalesTotal;
        totalCardSales += s.cardSalesTotal;
        totalDifference += diff;
    });

    doc.moveDown(1);
    drawLine(doc, '#000000', 1);
    doc.moveDown(1);

    // Totals summary
    const summaryX = doc.page.width - 320;
    
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333333');
    doc.text('TOTALES DEL DÍA', summaryX, doc.y, { width: 270, align: 'right' });
    doc.moveDown(0.5);
    
    const drawDailySummaryLine = (label, value, color = '#333333', size = 9, isBold = false) => {
        const y = doc.y;
        doc.fontSize(size).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
        doc.text(label, summaryX, y, { width: 180, align: 'right' });
        doc.text(value, summaryX + 185, y, { width: 85, align: 'right' });
        doc.y = y + size + 5;
    };

    drawDailySummaryLine('Total Efectivo:', `$${totalCashSales.toLocaleString('es-CL')}`);
    drawDailySummaryLine('Total Tarjeta:', `$${totalCardSales.toLocaleString('es-CL')}`);
    
    doc.moveDown(0.5);
    drawDailySummaryLine('TOTAL GENERAL:', `$${(totalCashSales + totalCardSales).toLocaleString('es-CL')}`, '#F88813', 11, true);
    
    const finalDiffColor = totalDifference < 0 ? '#D32F2F' : '#388E3C';
    drawDailySummaryLine('DIFERENCIA TOTAL:', `$${totalDifference.toLocaleString('es-CL')}`, finalDiffColor, 11, true);
    
    createFooter(doc, pageNum, true);
    doc.end();
});

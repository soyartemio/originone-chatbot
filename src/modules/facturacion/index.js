const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../../data/invoices.json');

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
}

function getInvoices() {
  ensureDbExists();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveInvoices(invoices) {
  ensureDbExists();
  fs.writeFileSync(DB_PATH, JSON.stringify(invoices, null, 2));
}

/**
 * GET /api/facturacion/invoices
 */
router.get('/api/facturacion/invoices', (req, res) => {
  const invoices = getInvoices();
  res.json({ success: true, total: invoices.length, invoices });
});

/**
 * POST /api/facturacion/invoices
 */
router.post('/api/facturacion/invoices', (req, res) => {
  try {
    const invoices = getInvoices();
    const newInvoice = {
      id: 'FAC-' + Date.now().toString(36).toUpperCase(),
      folio: req.body.folio || `F-10${invoices.length + 1}`,
      cliente: req.body.cliente || 'Cliente sin nombre',
      empresa: req.body.empresa || 'Empresa Prospecto',
      concepto: req.body.concepto || 'Desarrollo de Solución de IA & Automatización',
      subtotal: parseFloat(req.body.subtotal || 0),
      iva: parseFloat(req.body.subtotal || 0) * 0.16,
      total: parseFloat(req.body.subtotal || 0) * 1.16,
      estado: req.body.estado || 'Emitida',
      fecha_emision: new Date().toISOString().split('T')[0],
      fecha_vencimiento: req.body.fecha_vencimiento || '2026-08-15',
      creado_por: req.body.creado_por || 'Socio Ejecutivo'
    };

    invoices.unshift(newInvoice);
    saveInvoices(invoices);
    res.json({ success: true, invoice: newInvoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/facturacion/invoices/:id
 */
router.patch('/api/facturacion/invoices/:id', (req, res) => {
  const invoices = getInvoices();
  const idx = invoices.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Factura no encontrada' });

  invoices[idx] = { ...invoices[idx], ...req.body, actualizado_el: new Date().toISOString() };
  saveInvoices(invoices);
  res.json({ success: true, invoice: invoices[idx] });
});

module.exports = router;

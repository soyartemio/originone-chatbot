const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../../data/transactions.json');

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
  }
}


function getTransactions() {
  ensureDbExists();
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) { return []; }
}

function saveTransactions(transactions) {
  ensureDbExists();
  fs.writeFileSync(DB_PATH, JSON.stringify(transactions, null, 2));
}

/**
 * GET /api/contabilidad/pnl
 * Estado de Resultados en tiempo real
 */
router.get('/api/contabilidad/pnl', (req, res) => {
  const transactions = getTransactions();
  let totalIngresos = 0;
  let totalEgresos = 0;

  const egresosPorCategoria = {};

  transactions.forEach(t => {
    const monto = parseFloat(t.monto || 0);
    if (t.tipo === 'ingreso') {
      totalIngresos += monto;
    } else {
      totalEgresos += monto;
      egresosPorCategoria[t.categoria] = (egresosPorCategoria[t.categoria] || 0) + monto;
    }
  });

  const utilidadNeta = totalIngresos - totalEgresos;
  const margenUtilidad = totalIngresos > 0 ? ((utilidadNeta / totalIngresos) * 100).toFixed(1) : '0.0';

  res.json({
    success: true,
    pnl: {
      totalIngresos,
      totalEgresos,
      utilidadNeta,
      margenUtilidad: `${margenUtilidad}%`,
      egresosPorCategoria,
      transaccionesCount: transactions.length
    },
    transacciones: transactions
  });
});

/**
 * POST /api/contabilidad/transaccion
 */
router.post('/api/contabilidad/transaccion', (req, res) => {
  try {
    const transactions = getTransactions();
    const newTrx = {
      id: 'TRX-' + Date.now().toString(36).toUpperCase(),
      tipo: req.body.tipo || 'egreso', // ingreso | egreso
      categoria: req.body.categoria || 'Gasto General',
      monto: parseFloat(req.body.monto || 0),
      concepto: req.body.concepto || 'Sin concepto',
      fecha: req.body.fecha || new Date().toISOString().split('T')[0],
      socio: req.body.socio || 'Artemio Gonzalez'
    };

    transactions.unshift(newTrx);
    saveTransactions(transactions);
    res.json({ success: true, transaccion: newTrx });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

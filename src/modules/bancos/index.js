const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../../data/bank_accounts.json');

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
  }
}


function getAccounts() {
  ensureDbExists();
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) { return []; }
}

/**
 * GET /api/bancos/cuentas
 */
router.get('/api/bancos/cuentas', (req, res) => {
  const cuentas = getAccounts();
  const saldoTotalMxn = cuentas.reduce((acc, c) => acc + (c.moneda === 'USD' ? c.saldo * 20 : c.saldo), 0);

  res.json({
    success: true,
    saldoTotalEstimadoMxn: saldoTotalMxn,
    cuentas: cuentas
  });
});

module.exports = router;

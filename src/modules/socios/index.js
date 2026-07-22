const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../../data/partners.json');

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const initialPartners = [
      { id: 'SOC-01', nombre: 'Artemio Gonzalez', rol: 'Socio Fundador & CEO / Tech Lead', porcentaje: 50.0, estado: 'Activo', utilidades_retiradas: 0 },
      { id: 'SOC-02', nombre: 'Socio Operativo', rol: 'Socio Cofundador & COO', porcentaje: 50.0, estado: 'Activo', utilidades_retiradas: 0 }
    ];
    fs.writeFileSync(DB_PATH, JSON.stringify(initialPartners, null, 2));
  }
}

function getPartners() {
  ensureDbExists();
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) { return []; }
}

/**
 * GET /api/socios/dashboard
 */
router.get('/api/socios/dashboard', (req, res) => {
  const partners = getPartners();
  
  // Calcular distribución de utilidades basada en la contabilidad actual
  const trxDbPath = path.join(__dirname, '../../../data/transactions.json');
  let utilidadNeta = 0;

  if (fs.existsSync(trxDbPath)) {
    try {
      const trxs = JSON.parse(fs.readFileSync(trxDbPath, 'utf8'));
      const ingresos = trxs.filter(t => t.tipo === 'ingreso').reduce((a, b) => a + parseFloat(b.monto || 0), 0);
      const egresos = trxs.filter(t => t.tipo === 'egreso').reduce((a, b) => a + parseFloat(b.monto || 0), 0);
      utilidadNeta = ingresos - egresos;
    } catch (e) {}
  }


  const partnersCalculated = partners.map(p => {
    const utilidadCorrespondiente = (utilidadNeta * (p.porcentaje / 100)).toFixed(2);
    return {
      ...p,
      utilidadCorrespondiente: parseFloat(utilidadCorrespondiente)
    };
  });

  res.json({
    success: true,
    transparencia: {
      utilidadAcumuladaEmpresa: utilidadNeta,
      politicaReparto: '50% Reinversión en IA / 50% Distribución Directa a Socios',
      socios: partnersCalculated
    }
  });
});

module.exports = router;

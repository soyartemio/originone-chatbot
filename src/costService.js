const crypto = require('crypto');
const { isRetryable, readCostsSnapshot, writeCostsSnapshot } = require('./costStorage');

const DEFAULT_COSTS = Object.freeze([
  {
    id: 'COST-RENDER-CRM', servicio: 'Render', proveedor: 'Render', proyectos: ['CRM Origin One'],
    categoria: 'Hosting', plan: 'Free', monto: 0, moneda: 'USD', periodicidad: 'mensual', estado: 'gratuito',
    proxima_renovacion: null, notas: 'Servicio web del CRM.'
  },
  {
    id: 'COST-CLOUDFLARE', servicio: 'Cloudflare', proveedor: 'Cloudflare',
    proyectos: ['CRM Origin One', 'Origin One Web', 'Infraestructura compartida'], categoria: 'Cloud', plan: 'Free',
    monto: 0, moneda: 'USD', periodicidad: 'mensual', estado: 'gratuito', proxima_renovacion: null,
    notas: 'DNS, Worker privado y almacenamiento R2.'
  },
  {
    id: 'COST-DOMAIN', servicio: 'Dominio originone.com.mx', proveedor: 'Cloudflare', proyectos: ['Corporativo Origin One'],
    categoria: 'Dominio', plan: 'Costo pendiente', monto: 0, moneda: 'MXN', periodicidad: 'anual', estado: 'por_capturar',
    proxima_renovacion: null, notas: 'Capturar costo y fecha real de renovación.'
  },
  {
    id: 'COST-PHONE', servicio: 'Línea telefónica', proveedor: 'Por capturar', proyectos: ['Ventas y atención'],
    categoria: 'Telefonía', plan: 'Dato pendiente', monto: 0, moneda: 'MXN', periodicidad: 'mensual', estado: 'por_capturar',
    proxima_renovacion: null, notas: 'Capturar proveedor, plan y cargo mensual.'
  }
]);

const VALID_CURRENCIES = new Set(['MXN', 'USD']);
const VALID_PERIODS = new Set(['mensual', 'anual', 'unico']);
const VALID_STATES = new Set(['gratuito', 'activo', 'por_capturar', 'pausado', 'archivado']);
let mutationQueue = Promise.resolve();

function initialCosts() {
  return structuredClone(DEFAULT_COSTS);
}

function normalizeCost(input, existing = {}) {
  const servicio = String(input.servicio ?? existing.servicio ?? '').trim();
  if (!servicio) throw new Error('El nombre del servicio es requerido');
  const proveedor = String(input.proveedor ?? existing.proveedor ?? 'Por registrar').trim() || 'Por registrar';
  const projectsInput = input.proyectos ?? existing.proyectos ?? [];
  const proyectos = [...new Set((Array.isArray(projectsInput) ? projectsInput : String(projectsInput).split(','))
    .map(value => String(value).trim()).filter(Boolean))].slice(0, 20);
  if (!proyectos.length) throw new Error('Asigna al menos un proyecto');

  const estado = String(input.estado ?? existing.estado ?? 'por_capturar');
  if (!VALID_STATES.has(estado)) throw new Error('El estado del costo no es válido');
  const moneda = String(input.moneda ?? existing.moneda ?? 'MXN').toUpperCase();
  if (!VALID_CURRENCIES.has(moneda)) throw new Error('La moneda debe ser MXN o USD');
  const periodicidad = String(input.periodicidad ?? existing.periodicidad ?? 'mensual');
  if (!VALID_PERIODS.has(periodicidad)) throw new Error('La periodicidad no es válida');
  const monto = estado === 'gratuito' ? 0 : Number(input.monto ?? existing.monto ?? 0);
  if (!Number.isFinite(monto) || monto < 0) throw new Error('El monto debe ser un número igual o mayor a cero');
  if (estado === 'activo' && monto <= 0) throw new Error('Un costo activo debe tener un monto mayor a cero');

  const renewal = input.proxima_renovacion ?? existing.proxima_renovacion ?? null;
  const proxima_renovacion = renewal ? String(renewal).slice(0, 10) : null;
  if (proxima_renovacion && Number.isNaN(new Date(`${proxima_renovacion}T12:00:00Z`).getTime())) {
    throw new Error('La fecha de renovación no es válida');
  }

  return {
    ...existing,
    servicio,
    proveedor,
    proyectos,
    categoria: String(input.categoria ?? existing.categoria ?? 'Otro').trim() || 'Otro',
    plan: String(input.plan ?? existing.plan ?? 'Sin especificar').trim() || 'Sin especificar',
    monto,
    moneda,
    periodicidad,
    estado,
    proxima_renovacion,
    notas: String(input.notas ?? existing.notas ?? '').trim().slice(0, 1000),
    actualizado_el: new Date().toISOString()
  };
}

async function getCosts() {
  await mutationQueue;
  const snapshot = await readCostsSnapshot();
  return snapshot.exists ? snapshot.costs : initialCosts();
}

async function mutateCosts(mutator) {
  const execute = async () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const snapshot = await readCostsSnapshot();
        const costs = snapshot.exists ? structuredClone(snapshot.costs) : initialCosts();
        const result = mutator(costs);
        await writeCostsSnapshot(costs, snapshot.etag, snapshot.backend);
        return result;
      } catch (error) {
        if (!isRetryable(error) || attempt === 4) throw error;
        await new Promise(resolve => setTimeout(resolve, attempt * 250));
      }
    }
  };
  const operation = mutationQueue.then(execute, execute);
  mutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function createCost(input) {
  return mutateCosts(costs => {
    const now = new Date().toISOString();
    const cost = normalizeCost(input, {
      id: `COST-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      creado_el: now
    });
    costs.unshift(cost);
    return cost;
  });
}

function updateCost(id, input) {
  return mutateCosts(costs => {
    const index = costs.findIndex(cost => cost.id === id);
    if (index === -1) return null;
    costs[index] = normalizeCost(input, costs[index]);
    return costs[index];
  });
}

function summarizeCosts(costs) {
  const visible = costs.filter(cost => cost.estado !== 'archivado');
  const monthlyEquivalent = cost => cost.periodicidad === 'anual' ? Number(cost.monto || 0) / 12 : cost.periodicidad === 'mensual' ? Number(cost.monto || 0) : 0;
  const today = new Date();
  const inThirtyDays = new Date(today);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  return {
    mensualMxn: visible.filter(cost => cost.estado === 'activo' && cost.moneda === 'MXN').reduce((sum, cost) => sum + monthlyEquivalent(cost), 0),
    mensualUsd: visible.filter(cost => cost.estado === 'activo' && cost.moneda === 'USD').reduce((sum, cost) => sum + monthlyEquivalent(cost), 0),
    gratuitos: visible.filter(cost => cost.estado === 'gratuito').length,
    porCapturar: visible.filter(cost => cost.estado === 'por_capturar').length,
    renovaciones30: visible.filter(cost => {
      if (!cost.proxima_renovacion) return false;
      const renewal = new Date(`${cost.proxima_renovacion}T23:59:59`);
      return renewal >= today && renewal <= inThirtyDays;
    }).length,
    totalServicios: visible.length
  };
}

module.exports = { DEFAULT_COSTS, createCost, getCosts, summarizeCosts, updateCost };

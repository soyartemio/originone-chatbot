const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originone-costs-'));
process.env.COSTS_DB_PATH = path.join(testDir, 'costs.json');
process.env.NODE_ENV = 'test';
delete process.env.CRM_GATEWAY_URL;
for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) delete process.env[key];

const { createCost, getCosts, summarizeCosts, updateCost } = require('../src/costService');

test.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

test('inicia con servicios gratuitos y pendientes sin inventar costos', async () => {
  const costs = await getCosts();
  const summary = summarizeCosts(costs);
  assert.ok(costs.some(cost => cost.servicio === 'Render' && cost.estado === 'gratuito'));
  assert.ok(costs.some(cost => cost.servicio === 'Dominio originone.com.mx' && cost.estado === 'por_capturar'));
  assert.equal(summary.mensualMxn, 0);
  assert.equal(summary.mensualUsd, 0);
  assert.equal(summary.gratuitos, 2);
  assert.equal(summary.porCapturar, 2);
});

test('guarda un costo multiproyecto y calcula su equivalente mensual', async () => {
  const created = await createCost({
    servicio: 'Software anual',
    proveedor: 'Proveedor Demo',
    proyectos: ['CRM Origin One', 'Sitio web'],
    categoria: 'Software',
    plan: 'Pro',
    monto: 1200,
    moneda: 'USD',
    periodicidad: 'anual',
    estado: 'activo',
    proxima_renovacion: '2027-07-22'
  });
  assert.deepEqual(created.proyectos, ['CRM Origin One', 'Sitio web']);
  const costs = await getCosts();
  assert.equal(costs.length, 5);
  assert.equal(summarizeCosts(costs).mensualUsd, 100);

  const archived = await updateCost(created.id, { estado: 'archivado' });
  assert.equal(archived.estado, 'archivado');
  assert.equal(summarizeCosts(await getCosts()).mensualUsd, 0);
});

test('rechaza costos sin proyecto o con moneda inválida', async () => {
  await assert.rejects(() => createCost({ servicio: 'Sin proyecto', proyectos: [] }), /al menos un proyecto/);
  await assert.rejects(() => createCost({ servicio: 'Moneda', proyectos: ['CRM'], moneda: 'EUR' }), /MXN o USD/);
  await assert.rejects(
    () => createCost({ servicio: 'Activo sin monto', proyectos: ['CRM'], estado: 'activo', monto: 0 }),
    /monto mayor a cero/
  );
});

test('el Worker privado reserva un objeto R2 separado para costos', () => {
  const workerSource = fs.readFileSync(path.join(__dirname, '../cloudflare/crm-storage-worker/src/index.mjs'), 'utf8');
  assert.match(workerSource, /'\/v1\/costs': \{ key: 'crm\/costs\.json', shape: 'costs' \}/);
  assert.match(workerSource, /shape === 'costs'/);
});

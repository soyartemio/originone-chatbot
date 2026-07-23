const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const crmHtml = fs.readFileSync(path.join(__dirname, '../public/crm/index.html'), 'utf8');
const crmApp = fs.readFileSync(path.join(__dirname, '../public/crm/app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/crm/manifest.webmanifest'), 'utf8'));

test('el CRM usa rutas absolutas para cargar estilos y programa desde el subdominio', () => {
  assert.match(crmHtml, /href="\/crm\/styles\.css"/);
  assert.match(crmHtml, /src="\/crm\/app\.js"/);
});

test('el rediseño incluye resumen operativo y navegación funcional', () => {
  assert.match(crmHtml, /id="moduleDashboardSection"/);
  assert.match(crmHtml, /id="dashRecentContacts"/);
  assert.match(crmHtml, /data-module="dashboard"/);
  assert.match(crmApp, /async function loadDashboardModule/);
  assert.match(crmApp, /function renderDashboardPipeline/);
  assert.match(crmHtml, /id="backToDashboardButton"/);
  assert.match(crmHtml, /id="activeCrmFilter"/);
  assert.match(crmApp, /window\.addEventListener\('popstate', restoreNavigationFromUrl\)/);
  assert.match(crmApp, /window\.history\[replace \? 'replaceState' : 'pushState'\]/);
  assert.doesNotMatch(crmHtml, /data-module="facturacion"/);
});

test('los flujos principales exponen fuente, responsable, próximo paso y notas', () => {
  assert.match(crmHtml, /Fuente: Prospectos/);
  assert.match(crmHtml, /id="leadOwnerSelect"/);
  assert.match(crmHtml, /id="nextActionInput"/);
  assert.match(crmHtml, /id="saveNoteButton"/);
  assert.match(crmHtml, /onclick="archiveCurrentLead\(\)"/);
  assert.match(crmApp, /async function syncInstagramInBackground/);
  assert.match(crmApp, /async function saveNextAction/);
});

test('costos multiproyecto tiene fuente, filtros y formulario operativo', () => {
  assert.match(crmHtml, /id="moduleCostsSection"/);
  assert.match(crmHtml, /data-module="costos"/);
  assert.match(crmHtml, /Fuente: R2 privado \/ Costos/);
  assert.match(crmHtml, /id="costProjectsInput"/);
  assert.match(crmApp, /async function loadCostsModule/);
  assert.match(crmApp, /async function submitCostForm/);
});

test('Origin One OS cumple la configuración base para guardarse como app', () => {
  assert.match(crmHtml, /rel="manifest" href="\/crm\/manifest\.webmanifest" crossorigin="use-credentials"/);
  assert.match(crmHtml, /id="installAppButton"/);
  assert.equal(manifest.id, '/crm/');
  assert.equal(manifest.start_url, '/crm/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.ok(fs.existsSync(path.join(__dirname, '../public/crm/icon-192.png')));
  assert.ok(fs.existsSync(path.join(__dirname, '../public/crm/icon-512.png')));
  assert.ok(fs.existsSync(path.join(__dirname, '../public/crm/sw.js')));
  assert.match(crmApp, /serviceWorker\.register\('\/crm\/sw\.js', \{ scope: '\/' \}\)/);
  assert.match(serverSource, /Service-Worker-Allowed', '\/'/);
});

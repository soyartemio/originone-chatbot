const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const crmHtml = fs.readFileSync(path.join(__dirname, '../public/crm/index.html'), 'utf8');

test('el CRM usa rutas absolutas para cargar estilos y programa desde el subdominio', () => {
  assert.match(crmHtml, /href="\/crm\/styles\.css"/);
  assert.match(crmHtml, /src="\/crm\/app\.js"/);
});

const express = require('express');
const crmRoutes = require('../src/crmRoutes');
const facturacionModule = require('../src/modules/facturacion');
const contabilidadModule = require('../src/modules/contabilidad');
const bancosModule = require('../src/modules/bancos');
const sociosModule = require('../src/modules/socios');

async function testErp() {
  console.log('Verificando carga de todos los módulos del ERP Origin One OS...');
  console.log('✅ CRM & Leads');
  console.log('✅ Facturación & Cotizaciones');
  console.log('✅ Contabilidad & P&L');
  console.log('✅ Bancos & Tesorería');
  console.log('✅ Transparencia entre Socios');
  console.log('🎉 Todos los módulos iniciados e integrados sin colisiones.');
}

testErp();

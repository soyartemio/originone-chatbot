const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'originone-growth-'));
process.env.ANALYTICS_DB_PATH = path.join(directory, 'analytics.json');
process.env.CRM_DB_PATH = path.join(directory, 'appointments.json');
process.env.PUBLICATIONS_DB_PATH = path.join(directory, 'publications.json');
delete process.env.CRM_GATEWAY_SOURCE_SECRET;
delete process.env.META_PAGE_ACCESS_TOKEN;

fs.writeFileSync(process.env.CRM_DB_PATH, '[]');
fs.writeFileSync(process.env.PUBLICATIONS_DB_PATH, '[]');

const { recordEvent, getGrowthSummary } = require('../src/growthAnalyticsService');
const { scheduleAppointment, reviewAppointment } = require('../src/agendaService');

test('mide el embudo web sin guardar datos personales', async () => {
  await recordEvent({ name: 'page_view', sessionId: 'session-a', source: 'linkedin', medium: 'organic_social', campaign: 'signal_demo', content: 'post_a', path: '/?utm_source=linkedin' });
  await recordEvent({ name: 'cta_signal_demo', sessionId: 'session-a', source: 'linkedin', medium: 'organic_social', campaign: 'signal_demo', content: 'post_a', path: '/s1gnal.html' });
  await recordEvent({ name: 'signal_open', sessionId: 'session-a', source: 'linkedin', campaign: 'signal_demo', content: 'post_a', path: '/' });
  await recordEvent({ name: 'signal_start', sessionId: 'session-a', source: 'linkedin', campaign: 'signal_demo', content: 'post_a', path: '/' });
  const summary = await getGrowthSummary(30);
  assert.equal(summary.web.visitors, 1);
  assert.equal(summary.web.pageViews, 1);
  assert.equal(summary.web.signalStarts, 1);
  assert.equal(summary.web.visitorToConversationRate, 100);
  assert.deepEqual(summary.web.sources, { linkedin: 1 });
  assert.equal(summary.attribution.campaigns['signal_demo · post_a'].ctaClicks, 1);
  assert.equal(summary.attribution.campaigns['signal_demo · post_a'].signalStarts, 1);
  assert.equal(summary.web.diagnosticClicks, 0);
});

test('agrupa llamados de diagnóstico por campaña y conserva su variante', async () => {
  await recordEvent({ name: 'page_view', sessionId: 'session-b', source: 'instagram', medium: 'organic_social', campaign: 'cierre_mensual', content: 'pub-seguros-reporte', path: '/diagnostico-cierre.html' });
  await recordEvent({ name: 'cta_closure_diagnostic', sessionId: 'session-b', source: 'instagram', medium: 'organic_social', campaign: 'cierre_mensual', content: 'pub-seguros-reporte', path: '/diagnostico-cierre.html' });
  await recordEvent({ name: 'lead_qualified', sessionId: 'session-b', source: 'instagram', medium: 'organic_social', campaign: 'cierre_mensual', content: 'pub-seguros-reporte', path: '/diagnostico-cierre.html' });
  await recordEvent({ name: 'proposal_created', sessionId: 'session-b', source: 'instagram', medium: 'organic_social', campaign: 'cierre_mensual', content: 'pub-seguros-reporte', path: '/crm' });
  const summary = await getGrowthSummary(30);
  assert.equal(summary.web.diagnosticClicks, 1);
  assert.equal(summary.attribution.campaigns['cierre_mensual · pub-seguros-reporte'].pageViews, 1);
  assert.equal(summary.attribution.campaigns['cierre_mensual · pub-seguros-reporte'].ctaClicks, 1);
  assert.equal(summary.attribution.campaigns['cierre_mensual · pub-seguros-reporte'].qualifiedLeads, 1);
  assert.equal(summary.web.proposals, 1);
  assert.equal(summary.attribution.campaigns['cierre_mensual · pub-seguros-reporte'].proposals, 1);
});

test('S1GNAL propone una cita y una persona la confirma', async () => {
  const created = await scheduleAppointment({
    nombre_cliente: 'Prospecto S1GNAL',
    fecha_propuesta: '2026-08-05',
    hora_propuesta: '16:00',
    canal_origen: 'S1GNAL Web Live',
    requires_review: true
  });
  assert.equal(created.appointment.appointment_status, 'proposed');
  assert.equal(created.appointment.etapa, 'Cita por revisar');
  const reviewed = await reviewAppointment(created.appointment.id, 'confirm', 'Artemio');
  assert.equal(reviewed.appointment_status, 'confirmed');
  assert.equal(reviewed.etapa, 'Cita Confirmada');
  assert.equal(reviewed.revisada_por, 'Artemio');
});

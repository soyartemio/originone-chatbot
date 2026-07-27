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
  await recordEvent({ name: 'page_view', sessionId: 'session-a', source: 'linkedin', path: '/?utm_source=linkedin' });
  await recordEvent({ name: 'signal_open', sessionId: 'session-a', source: 'linkedin', path: '/' });
  await recordEvent({ name: 'signal_start', sessionId: 'session-a', source: 'linkedin', path: '/' });
  const summary = await getGrowthSummary(30);
  assert.equal(summary.web.visitors, 1);
  assert.equal(summary.web.pageViews, 1);
  assert.equal(summary.web.signalStarts, 1);
  assert.equal(summary.web.visitorToConversationRate, 100);
  assert.deepEqual(summary.web.sources, { linkedin: 1 });
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

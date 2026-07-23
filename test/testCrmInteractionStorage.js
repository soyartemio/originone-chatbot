const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originone-crm-'));
process.env.CRM_DB_PATH = path.join(testDir, 'appointments.json');

const {
  appendChatMessage,
  getAppointments,
  importChatMessages,
  saveAppointments
} = require('../src/agendaService');

test.beforeEach(() => saveAppointments([]));
test.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

test('guarda una interacción de Instagram sin convertir su ID en teléfono', async () => {
  await appendChatMessage('ig-user-123456789', 'user', 'Necesito información', 'Instagram Direct', 'cliente_demo', 'mid-1');

  const [lead] = await getAppointments();
  assert.equal(lead.external_id, 'ig-user-123456789');
  assert.equal(lead.canal_origen, 'Instagram Direct');
  assert.equal(lead.telefono_whatsapp, 'Por consultar');
  assert.equal(lead.historial_mensajes.length, 1);
  assert.equal(lead.historial_mensajes[0].evento_id, 'mid-1');
});

test('no duplica un evento cuando Meta reintenta el mismo webhook', async () => {
  await appendChatMessage('ig-user-1', 'user', 'Hola', 'Instagram Direct', null, 'mid-retry');
  await appendChatMessage('ig-user-1', 'user', 'Hola', 'Instagram Direct', null, 'mid-retry');

  const [lead] = await getAppointments();
  assert.equal(lead.historial_mensajes.length, 1);
});

test('conserva el número cuando la interacción sí viene de WhatsApp', async () => {
  await appendChatMessage('528100000000', 'user', 'Hola', 'WhatsApp Direct', 'Cliente WhatsApp', 'wamid-1');

  const [lead] = await getAppointments();
  assert.equal(lead.telefono_whatsapp, '528100000000');
});

test('importa un historial de Instagram en una sola operación, conserva fechas y evita duplicados', async () => {
  const messages = [
    {
      userId: 'ig-customer-9',
      role: 'user',
      messageText: 'Hola',
      channelName: 'Instagram Direct',
      userName: 'cliente_nueve',
      eventId: 'instagram:msg-1',
      createdAt: '2026-07-22T18:00:00.000Z'
    },
    {
      userId: 'ig-customer-9',
      role: 'assistant',
      messageText: '¡Hola! ¿En qué te ayudo?',
      channelName: 'Instagram Direct',
      userName: 'cliente_nueve',
      eventId: 'instagram:msg-2',
      createdAt: '2026-07-22T18:00:02.000Z'
    }
  ];

  const firstImport = await importChatMessages(messages);
  const secondImport = await importChatMessages(messages);
  const [lead] = await getAppointments();

  assert.deepEqual(firstImport, { importedMessages: 2, skippedMessages: 0, affectedLeads: 1 });
  assert.deepEqual(secondImport, { importedMessages: 0, skippedMessages: 2, affectedLeads: 1 });
  assert.equal(lead.nombre_cliente, 'cliente_nueve');
  assert.equal(lead.historial_mensajes.length, 2);
  assert.equal(lead.historial_mensajes[0].fecha, '2026-07-22T18:00:00.000Z');
});

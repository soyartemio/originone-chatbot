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
  saveAppointments,
  scheduleAppointment,
  updateLead
} = require('../src/agendaService');

test.beforeEach(() => saveAppointments([]));
test.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

test('guarda una interacción de Instagram sin convertir su ID en teléfono', async () => {
  await appendChatMessage('ig-user-123456789', 'user', 'Necesito información', 'Instagram Direct', 'cliente_demo', 'mid-1');

  const [lead] = await getAppointments();
  assert.equal(lead.external_id, 'ig-user-123456789');
  assert.equal(lead.canal_origen, 'Instagram Direct');
  assert.equal(lead.telefono_whatsapp, 'Por consultar');
  assert.equal(lead.etapa, 'Nuevo contacto');
  assert.equal(lead.fecha_propuesta, 'Por confirmar');
  assert.ok(lead.fecha_primer_contacto);
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

test('corrige contactos heredados que se etiquetaron erróneamente como cita', async () => {
  await saveAppointments([{
    id: 'LEAD-ig-legacy-1',
    external_id: 'ig-legacy-1',
    nombre_cliente: 'Contacto anterior',
    fecha_propuesta: '2026-07-22',
    hora_propuesta: '05:30 p.m.',
    etapa: 'Cita Agendada',
    estatus: 'En Conversación con IA',
    historial_mensajes: [{ rol: 'user', texto: 'Hola', evento_id: 'legacy-mid-1', fecha: '2026-07-22T17:30:00.000Z' }]
  }]);

  await importChatMessages([{
    userId: 'ig-legacy-1',
    role: 'user',
    messageText: 'Hola',
    channelName: 'Instagram Direct',
    eventId: 'legacy-mid-1',
    createdAt: '2026-07-22T17:30:00.000Z'
  }]);

  const [lead] = await getAppointments();
  assert.equal(lead.etapa, 'Nuevo contacto');
  assert.equal(lead.fecha_primer_contacto, '2026-07-22');
  assert.equal(lead.fecha_propuesta, 'Por confirmar');
  assert.equal(lead.historial_mensajes.length, 1);
});

test('una sincronización no revierte una etapa elegida manualmente', async () => {
  await appendChatMessage('ig-manual-1', 'user', 'Hola', 'Instagram Direct', 'Contacto manual', 'manual-mid-1');
  await updateLead('LEAD-ig-manual-1', {
    etapa: 'Cita Confirmada',
    fecha_propuesta: '2026-07-30',
    hora_propuesta: '10:00 AM'
  });
  await appendChatMessage('ig-manual-1', 'user', 'Seguimos en contacto', 'Instagram Direct', 'Contacto manual', 'manual-mid-2');

  const [lead] = await getAppointments();
  assert.equal(lead.etapa, 'Cita Confirmada');
  assert.equal(lead.etapa_fuente, 'manual');
});

test('impide confirmar manualmente una cita sin fecha ni hora', async () => {
  await appendChatMessage('ig-no-slot', 'user', 'Hola', 'Instagram Direct', 'Sin horario', 'no-slot-mid-1');

  await assert.rejects(
    () => updateLead('LEAD-ig-no-slot', { etapa: 'Cita Confirmada' }),
    /Captura la fecha y la hora acordadas/
  );
});

test('guarda responsable y próximo paso estructurado del prospecto', async () => {
  await appendChatMessage('ig-follow-up', 'user', 'Quiero una propuesta', 'Instagram Direct', 'Seguimiento', 'follow-up-mid-1');
  const updated = await updateLead('LEAD-ig-follow-up', {
    responsable: 'Edgar',
    siguiente_accion: 'Enviar propuesta',
    siguiente_accion_fecha: '2026-07-23T16:00:00.000Z',
    siguiente_accion_estado: 'pendiente'
  });

  assert.equal(updated.responsable, 'Edgar');
  assert.equal(updated.siguiente_accion, 'Enviar propuesta');
  assert.equal(updated.siguiente_accion_estado, 'pendiente');
  await assert.rejects(
    () => updateLead('LEAD-ig-follow-up', { responsable: 'Otra persona' }),
    /Artemio o Edgar/
  );
});

test('sólo crea una cita confirmada cuando hay fecha y hora acordadas', async () => {
  const result = await scheduleAppointment({
    nombre_cliente: 'Cita real',
    email: 'cliente@example.com',
    telefono_whatsapp: '528100000000',
    fecha_propuesta: '2026-07-30',
    hora_propuesta: '10:00 AM'
  });

  assert.equal(result.appointment.etapa, 'Cita Confirmada');
  assert.equal(result.appointment.etapa_fuente, 'agenda_confirmada');
  await assert.rejects(
    () => scheduleAppointment({ nombre_cliente: 'Sin horario' }),
    /fecha y una hora acordadas/
  );
});

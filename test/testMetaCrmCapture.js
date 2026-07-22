const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originone-meta-crm-'));
process.env.CRM_DB_PATH = path.join(testDir, 'appointments.json');

const metaWebhook = require('../src/metaWebhook');
const { getAppointments, saveAppointments } = require('../src/agendaService');

test.beforeEach(() => saveAppointments([]));
test.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

test('registra comentarios de Instagram como interacciones del CRM', async () => {
  await metaWebhook.registerCommentInteraction({
    id: 'comment-123',
    text: '¿Me pueden compartir información?',
    from: { id: 'ig-user-77', username: 'cliente_demo' }
  }, 'Instagram Comentarios');

  const [lead] = await getAppointments();
  assert.equal(lead.canal_origen, 'Instagram Comentarios');
  assert.equal(lead.nombre_cliente, 'cliente_demo');
  assert.equal(lead.historial_mensajes[0].texto, '¿Me pueden compartir información?');
});

test('registra contenido multimedia antes de cualquier procesamiento externo', async () => {
  await metaWebhook.processDirectMessage({
    senderId: 'ig-user-media',
    message: { mid: 'mid-media', attachments: [{ type: 'image' }] },
    channelName: 'Instagram Direct',
    eventId: 'mid-media'
  });

  const [lead] = await getAppointments();
  assert.equal(lead.historial_mensajes[0].texto, '[Contenido recibido: image]');
});

test('acepta el formato real del webhook de Instagram y confirma después de guardar', async () => {
  const postLayer = metaWebhook.stack.find(layer => layer.route?.path === '/webhook' && layer.route.methods.post);
  const handler = postLayer.route.stack[0].handle;
  const response = {
    headersSent: false,
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      this.headersSent = true;
      return this;
    }
  };

  await handler({
    body: {
      object: 'instagram',
      entry: [{
        id: 'ig-business-account',
        messaging: [{
          sender: { id: 'ig-user-webhook' },
          message: { mid: 'mid-webhook', attachments: [{ type: 'image' }] }
        }]
      }]
    }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, 'EVENT_RECEIVED');
  assert.equal((await getAppointments())[0].canal_origen, 'Instagram Direct');
});

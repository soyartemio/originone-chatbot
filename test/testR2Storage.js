const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'originone-r2-'));
process.env.CRM_DB_PATH = path.join(testDir, 'appointments.json');
process.env.R2_ACCOUNT_ID = 'account-test';
process.env.R2_ACCESS_KEY_ID = 'access-test';
process.env.R2_SECRET_ACCESS_KEY = 'secret-test';
process.env.R2_BUCKET_NAME = 'crm-test';
process.env.R2_CRM_OBJECT_KEY = 'crm/appointments.json';
process.env.R2_WRITE_INTERVAL_MS = '0';

let remoteBody = null;
let remoteEtag = null;
const putRequests = [];

S3Client.prototype.send = async command => {
  if (command instanceof GetObjectCommand) {
    if (remoteBody === null) {
      const error = new Error('missing');
      error.name = 'NoSuchKey';
      error.$metadata = { httpStatusCode: 404 };
      throw error;
    }
    return {
      ETag: remoteEtag,
      Body: { transformToString: async () => remoteBody }
    };
  }

  if (command instanceof PutObjectCommand) {
    putRequests.push(command.input);
    if (command.input.IfNoneMatch === '*' && remoteBody !== null) {
      const error = new Error('precondition');
      error.name = 'PreconditionFailed';
      error.$metadata = { httpStatusCode: 412 };
      throw error;
    }
    if (command.input.IfMatch && command.input.IfMatch !== remoteEtag) {
      const error = new Error('precondition');
      error.name = 'PreconditionFailed';
      error.$metadata = { httpStatusCode: 412 };
      throw error;
    }
    remoteBody = command.input.Body;
    remoteEtag = `"etag-${putRequests.length}"`;
    return { ETag: remoteEtag };
  }

  throw new Error('Comando inesperado');
};

const { appendChatMessage, getAppointments, saveAppointments } = require('../src/agendaService');
const { isR2Configured } = require('../src/crmStorage');

test.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

test('usa el bucket privado R2 como fuente de verdad y protege versiones', async () => {
  assert.equal(isR2Configured(), true);

  await saveAppointments([]);
  assert.equal(putRequests[0].Bucket, 'crm-test');
  assert.equal(putRequests[0].Key, 'crm/appointments.json');
  assert.equal(putRequests[0].IfNoneMatch, '*');

  await appendChatMessage('ig-r2-user', 'user', 'Hola desde Instagram', 'Instagram Direct', null, 'mid-r2');
  assert.equal(putRequests[1].IfMatch, '"etag-1"');

  const [lead] = await getAppointments();
  assert.equal(lead.external_id, 'ig-r2-user');
  assert.equal(lead.historial_mensajes[0].evento_id, 'mid-r2');
});

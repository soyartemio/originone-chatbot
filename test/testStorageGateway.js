const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.CRM_GATEWAY_SOURCE_SECRET = 'existing-private-server-secret-for-tests';
process.env.CRM_GATEWAY_URL = 'https://storage.example.test';

const {
  deriveApplicationSecret,
  deriveGatewaySecret,
  readGatewayObject,
  writeGatewayObject
} = require('../src/storageGateway');

test('deriva claves separadas para gateway, sesiones y activación', () => {
  const gateway = deriveGatewaySecret();
  const session = deriveApplicationSecret('session');
  const setup = deriveApplicationSecret('setup');
  assert.match(gateway, /^[a-f0-9]{64}$/);
  assert.notEqual(gateway, session);
  assert.notEqual(session, setup);
});

test('firma lecturas y escrituras sin enviar la clave fuente', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    const responseBody = options.method === 'GET' ? '[]' : '{"success":true}';
    return new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ETag: '"etag-test"' }
    });
  };

  try {
    const read = await readGatewayObject('appointments');
    assert.deepEqual(read.data, []);
    await writeGatewayObject('appointments', [{ id: 'lead-1' }], '"etag-test"');

    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, 'https://storage.example.test/v1/appointments');
    assert.equal(requests[1].options.headers['If-Match'], '"etag-test"');
    assert.equal(requests[1].options.headers['Content-Length'], Buffer.byteLength(requests[1].options.body).toString());
    assert.equal(JSON.stringify(requests).includes(process.env.CRM_GATEWAY_SOURCE_SECRET), false);

    for (const request of requests) {
      const headers = request.options.headers;
      const body = request.options.body || '';
      const contentHash = crypto.createHash('sha256').update(body).digest('hex');
      const canonical = `${request.options.method}\n/v1/appointments\n${headers['X-O1-Timestamp']}\n${contentHash}`;
      const expected = crypto.createHmac('sha256', Buffer.from(deriveGatewaySecret(), 'hex')).update(canonical).digest('hex');
      assert.equal(headers['X-O1-Signature'], expected);
    }
  } finally {
    global.fetch = originalFetch;
  }
});

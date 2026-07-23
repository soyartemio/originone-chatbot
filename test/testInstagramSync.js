const test = require('node:test');
const assert = require('node:assert/strict');

const { getAttachmentText, mapWithConcurrency } = require('../src/instagramSyncService');

test('describe contenido multimedia de Instagram cuando no hay texto', () => {
  assert.equal(getAttachmentText({
    attachments: { data: [{ mime_type: 'image/jpeg' }] }
  }), '[Contenido recibido: image/jpeg]');
  assert.equal(getAttachmentText({ attachments: { data: [{}] } }), '[Contenido multimedia recibido]');
  assert.equal(getAttachmentText({}), null);
});

test('limita la concurrencia al consultar conversaciones de Instagram', async () => {
  let active = 0;
  let maximum = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async value => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });

  assert.deepEqual(results, [2, 4, 6, 8, 10, 12]);
  assert.equal(maximum, 2);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { getAttachmentText } = require('../src/instagramSyncService');

test('describe contenido multimedia de Instagram cuando no hay texto', () => {
  assert.equal(getAttachmentText({
    attachments: { data: [{ mime_type: 'image/jpeg' }] }
  }), '[Contenido recibido: image/jpeg]');
  assert.equal(getAttachmentText({ attachments: { data: [{}] } }), '[Contenido multimedia recibido]');
  assert.equal(getAttachmentText({}), null);
});

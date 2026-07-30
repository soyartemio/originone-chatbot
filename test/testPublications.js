const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'originone-publications-'));
process.env.PUBLICATIONS_DB_PATH = path.join(temporaryDirectory, 'publications.json');
delete process.env.CRM_GATEWAY_URL;
delete process.env.CRM_GATEWAY_SOURCE_SECRET;
delete process.env.META_PAGE_ACCESS_TOKEN;
delete process.env.R2_ACCOUNT_ID;
delete process.env.R2_ACCESS_KEY_ID;
delete process.env.R2_SECRET_ACCESS_KEY;
delete process.env.R2_BUCKET_NAME;

const {
  addPublicationNote,
  createPublication,
  getPublications,
  setPublicationApproval
} = require('../src/publicationService');

test('inicia con propuestas reales y copy multicanal', async () => {
  const publications = await getPublications();
  assert.ok(publications.length >= 3);
  assert.ok(publications.some(item => item.title.includes('chatbot')));
  assert.ok(publications.every(item => item.copies.instagram && item.copies.facebook && item.copies.linkedin));
  assert.ok(publications.every(item => item.narrative?.fictional));
  assert.ok(publications.every(item => item.copies.instagram.includes('Caso ficticio basado en una situación común.')));
  assert.ok(publications.every(item => item.visualHeadline && item.visualCaption));
  assert.deepEqual(publications.slice(0, 3).map(item => item.campaignOrder), [0, 1, 2]);
});

test('requiere doble aprobación y conserva notas del equipo', async () => {
  const publication = await createPublication({
    title: 'Prueba editorial',
    industry: 'Manufactura',
    situation: 'Una escena reconocible',
    platforms: ['instagram', 'facebook', 'linkedin'],
    creativeUrl: 'https://example.com/generated-test.png',
    copies: { instagram: 'IG', facebook: 'FB', linkedin: 'LI' },
    status: 'revision'
  }, 'origin-one-marketing');

  await addPublicationNote(publication.id, 'Cambiar el gancho.', 'edgar', 'Edgar');
  const firstApproval = await setPublicationApproval(publication.id, 'approved', 'artemio', 'Artemio');
  assert.equal(firstApproval.status, 'revision');
  const secondApproval = await setPublicationApproval(publication.id, 'approved', 'edgar', 'Edgar');
  assert.equal(secondApproval.status, 'aprobada');
  assert.equal(secondApproval.notes[0].author, 'Edgar');
});

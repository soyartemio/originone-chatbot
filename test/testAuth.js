const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'originone-auth-'));
process.env.AUTH_DB_PATH = path.join(testDirectory, 'auth.json');
process.env.AUTH_SESSION_SECRET = 'session-secret-for-tests-0123456789-abcdefghijklmnopqrstuvwxyz';
process.env.AUTH_SETUP_SECRET = 'setup-secret-for-tests-0123456789-abcdefghijklmnopqrstuvwxyz';
process.env.NODE_ENV = 'test';
for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']) delete process.env[key];

const {
  createAuthRouter,
  createSetupToken,
  getPasskeyRpID,
  getWebAuthnConfig,
  hashPassword,
  verifyPassword,
  requireApiAuth
} = require('../src/authService');
const { readAuthSnapshot } = require('../src/authStorage');

test.after(() => fs.rmSync(testDirectory, { recursive: true, force: true }));

test('hash de contraseña no conserva el texto y detecta credenciales incorrectas', async () => {
  const stored = await hashPassword('Clave-Segura-2026!');
  assert.equal(stored.algorithm, 'scrypt');
  assert.equal(JSON.stringify(stored).includes('Clave-Segura-2026!'), false);
  assert.equal(await verifyPassword('Clave-Segura-2026!', stored), true);
  assert.equal(await verifyPassword('Clave-Incorrecta-2026!', stored), false);
});

test('solo el enlace privado puede iniciar el alta y después exige passkey', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter());
  app.get('/private', requireApiAuth, (req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  process.env.AUTH_ORIGIN = origin;
  process.env.AUTH_RP_ID = '127.0.0.1';

  try {
    const denied = await fetch(`${origin}/api/auth/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ username: 'artemio', password: 'Clave-Segura-2026!', setupToken: 'incorrecto' })
    });
    assert.equal(denied.status, 403);

    const setup = await fetch(`${origin}/api/auth/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        username: 'artemio',
        password: 'Clave-Segura-2026!',
        setupToken: createSetupToken('artemio')
      })
    });
    const body = await setup.json();
    assert.equal(setup.status, 200);
    assert.equal(body.next, 'register_passkey');
    assert.ok(body.options.challenge);
    assert.match(setup.headers.get('set-cookie'), /o1_challenge=/);

    const stored = (await readAuthSnapshot()).data.users.artemio;
    assert.ok(stored.password.hash);
    assert.equal(stored.passkeys.length, 0);

    const privateResponse = await fetch(`${origin}/private`);
    assert.equal(privateResponse.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('los enlaces de activación son distintos por usuario', () => {
  assert.notEqual(createSetupToken('artemio'), createSetupToken('edgar'));
});

test('elige un RP ID por dominio y conserva las passkeys heredadas de Render', () => {
  process.env.NODE_ENV = 'production';
  process.env.AUTH_ORIGIN = 'https://crm.originone.com.mx,https://originone-chatbot.onrender.com';
  process.env.AUTH_RP_ID = 'crm.originone.com.mx';
  process.env.AUTH_LEGACY_RP_ID = 'originone-chatbot.onrender.com';

  const customConfig = getWebAuthnConfig({ get: name => name === 'origin' ? 'https://crm.originone.com.mx' : null });
  const renderConfig = getWebAuthnConfig({ get: name => name === 'origin' ? 'https://originone-chatbot.onrender.com' : null });

  assert.equal(customConfig.rpID, 'crm.originone.com.mx');
  assert.equal(renderConfig.rpID, 'originone-chatbot.onrender.com');
  assert.equal(getPasskeyRpID({}, customConfig), 'originone-chatbot.onrender.com');

  process.env.NODE_ENV = 'test';
});

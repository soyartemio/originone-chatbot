const crypto = require('crypto');
const { mutateAuthData } = require('../src/authStorage');
const { hashActivationToken } = require('../src/authService');

const username = String(process.argv[2] || '').trim().toLowerCase();
if (!['artemio', 'edgar'].includes(username)) {
  throw new Error('Uso: node scripts/reset-user-access.js <artemio|edgar>');
}

const activationToken = crypto.randomBytes(32).toString('base64url');
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

(async () => {
  await mutateAuthData(authData => {
    const user = authData.users[username];
    user.password = null;
    user.passkeys = [];
    user.passwordFallbackEnabled = true;
    user.createdAt = null;
    user.setupCompletedAt = null;
    user.activation = { hash: hashActivationToken(activationToken), expiresAt, createdAt: new Date().toISOString() };
    user.accessResetAt = new Date().toISOString();
  });
  const url = `https://crm.originone.com.mx/auth?user=${encodeURIComponent(username)}&setup=${encodeURIComponent(activationToken)}`;
  console.log(JSON.stringify({ username, expiresAt, url }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });

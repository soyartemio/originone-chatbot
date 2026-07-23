const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const { readAuthSnapshot, mutateAuthData } = require('./authStorage');
const { deriveApplicationSecret } = require('./storageGateway');

const scrypt = promisify(crypto.scrypt);
const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL_SECONDS || 8 * 60 * 60);
const CHALLENGE_TTL_SECONDS = 5 * 60;
const attempts = new Map();
let webAuthnModule = null;

function getSecrets() {
  const sessionSecret = process.env.AUTH_SESSION_SECRET || deriveApplicationSecret('session');
  const setupSecret = process.env.AUTH_SETUP_SECRET || deriveApplicationSecret('setup');
  if (!sessionSecret || sessionSecret.length < 32 || !setupSecret || setupSecret.length < 32) {
    throw new Error('AUTH_SESSION_SECRET y AUTH_SETUP_SECRET deben tener al menos 32 caracteres');
  }
  return { sessionSecret, setupSecret };
}

function getWebAuthnConfig(req = null) {
  const defaultOrigins = process.env.NODE_ENV === 'production'
    ? ['https://crm.originone.com.mx', 'https://originone-chatbot.onrender.com']
    : ['http://localhost:3000'];
  const configuredOrigins = (process.env.AUTH_ORIGIN || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const origins = [...new Set([...configuredOrigins, ...defaultOrigins])];
  const primary = new URL(origins[0]);
  const suppliedOrigin = String(req?.get?.('origin') || '').replace(/\/$/, '');
  const requestOrigin = origins.includes(suppliedOrigin) ? suppliedOrigin : origins[0];
  const requestHostname = new URL(requestOrigin).hostname;
  const configuredRpIDs = String(process.env.AUTH_RP_ID || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return {
    rpName: process.env.AUTH_RP_NAME || 'Origin One CRM',
    rpID: origins.some(origin => new URL(origin).hostname === requestHostname)
      ? requestHostname
      : (configuredRpIDs[0] || primary.hostname),
    origin: requestOrigin,
    origins,
    legacyRPID: process.env.AUTH_LEGACY_RP_ID || 'originone-chatbot.onrender.com'
  };
}

function getPasskeyRpID(passkey, config = getWebAuthnConfig()) {
  return passkey?.rpID || config.legacyRPID;
}

async function getWebAuthn() {
  if (!webAuthnModule) webAuthnModule = await import('@simplewebauthn/server');
  return webAuthnModule;
}

function normalizeUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  return ['artemio', 'edgar'].includes(username) ? username : null;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signPayload(payload, secret) {
  const encoded = encode(payload);
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifySignedPayload(token, secret, purpose) {
  if (!token || !token.includes('.')) return null;
  const [encoded, supplied] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const suppliedBuffer = Buffer.from(supplied || '');
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.purpose !== purpose || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator === -1) return cookies;
    cookies[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim());
    return cookies;
  }, {});
}

function cookieNames() {
  const secure = process.env.NODE_ENV === 'production';
  return {
    secure,
    session: secure ? '__Host-o1_session' : 'o1_session',
    challenge: secure ? '__Host-o1_challenge' : 'o1_challenge'
  };
}

function setCookie(res, name, value, maxAge) {
  const { secure } = cookieNames();
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, maxAge)}`
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearCookie(res, name) {
  setCookie(res, name, '', 0);
}

function sessionForRequest(req) {
  try {
    const { sessionSecret } = getSecrets();
    const token = parseCookies(req)[cookieNames().session];
    return verifySignedPayload(token, sessionSecret, 'session');
  } catch {
    return null;
  }
}

function issueSession(res, user) {
  const { sessionSecret } = getSecrets();
  const now = Math.floor(Date.now() / 1000);
  const token = signPayload({
    purpose: 'session',
    username: user.username,
    displayName: user.displayName,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  }, sessionSecret);
  setCookie(res, cookieNames().session, token, SESSION_TTL_SECONDS);
  clearCookie(res, cookieNames().challenge);
}

function issueChallenge(res, payload) {
  const { sessionSecret } = getSecrets();
  const now = Math.floor(Date.now() / 1000);
  const token = signPayload({
    ...payload,
    purpose: 'challenge',
    iat: now,
    exp: now + CHALLENGE_TTL_SECONDS
  }, sessionSecret);
  setCookie(res, cookieNames().challenge, token, CHALLENGE_TTL_SECONDS);
}

function challengeForRequest(req, ceremony) {
  const { sessionSecret } = getSecrets();
  const token = parseCookies(req)[cookieNames().challenge];
  const payload = verifySignedPayload(token, sessionSecret, 'challenge');
  return payload?.ceremony === ceremony ? payload : null;
}

function createSetupToken(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) throw new Error('Usuario desconocido');
  const { setupSecret } = getSecrets();
  return crypto.createHmac('sha256', setupSecret).update(`originone-setup:${normalized}`).digest('base64url');
}

function verifySetupToken(username, suppliedToken) {
  if (!suppliedToken) return false;
  const expected = Buffer.from(createSetupToken(username));
  const supplied = Buffer.from(String(suppliedToken));
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 12 || value.length > 128) return 'La contraseña debe tener entre 12 y 128 caracteres';
  const normalized = value.toLowerCase().replace(/\s/g, '');
  const blocked = ['password1234', 'contraseña123', 'originone2026', 'artemio12345', 'edgar123456'];
  if (blocked.includes(normalized) || new Set(value).size < 5) return 'Elige una contraseña menos predecible';
  return null;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const cost = 131072;
  const blockSize = 8;
  const parallelization = 1;
  const derived = await scrypt(password, salt, 64, { N: cost, r: blockSize, p: parallelization, maxmem: 192 * 1024 * 1024 });
  return {
    algorithm: 'scrypt',
    salt: salt.toString('base64url'),
    hash: Buffer.from(derived).toString('base64url'),
    cost,
    blockSize,
    parallelization
  };
}

async function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const derived = await scrypt(password, Buffer.from(stored.salt, 'base64url'), 64, {
    N: stored.cost || 131072,
    r: stored.blockSize || 8,
    p: stored.parallelization || 1,
    maxmem: 192 * 1024 * 1024
  });
  const expected = Buffer.from(stored.hash, 'base64url');
  const actual = Buffer.from(derived);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function attemptKey(req, username) {
  return `${req.ip || req.socket?.remoteAddress || 'unknown'}:${username || 'unknown'}`;
}

function enforceRateLimit(req, username) {
  const key = attemptKey(req, username);
  const state = attempts.get(key);
  if (!state) return;
  if (state.resetAt <= Date.now()) {
    attempts.delete(key);
    return;
  }
  if (state.count >= 5) {
    const error = new Error('Demasiados intentos. Espera 15 minutos.');
    error.status = 429;
    throw error;
  }
}

function recordFailure(req, username) {
  const key = attemptKey(req, username);
  const existing = attempts.get(key);
  if (!existing || existing.resetAt <= Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
  } else {
    existing.count += 1;
  }
}

function clearFailures(req, username) {
  attempts.delete(attemptKey(req, username));
}

function safeUser(user) {
  return {
    username: user.username,
    displayName: user.displayName,
    configured: Boolean(user.password && user.passkeys?.length),
    passkeyCount: user.passkeys?.length || 0
  };
}

function requireApiAuth(req, res, next) {
  const session = sessionForRequest(req);
  if (!session) return res.status(401).json({ success: false, error: 'Autenticación requerida' });
  req.auth = { username: session.username, displayName: session.displayName };
  next();
}

function requirePageAuth(req, res, next) {
  const session = sessionForRequest(req);
  if (!session) {
    const target = encodeURIComponent(req.originalUrl || '/admin/');
    return res.redirect(302, `/auth?next=${target}`);
  }
  req.auth = { username: session.username, displayName: session.displayName };
  next();
}

function requireTrustedOrigin(req, res, next) {
  const { origins } = getWebAuthnConfig();
  const origin = req.get('origin');
  if (!origin || !origins.includes(origin.replace(/\/$/, ''))) {
    return res.status(403).json({ success: false, error: 'Origen no permitido' });
  }
  next();
}

function createAuthRouter() {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    next();
  });

  router.get('/session', async (req, res) => {
    const session = sessionForRequest(req);
    if (!session) return res.json({ authenticated: false });
    res.json({ authenticated: true, user: { username: session.username, displayName: session.displayName } });
  });

  router.get('/users', async (req, res, next) => {
    try {
      getSecrets();
      const { data } = await readAuthSnapshot();
      res.json({ users: Object.values(data.users).map(safeUser) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/password', requireTrustedOrigin, async (req, res, next) => {
    const username = normalizeUsername(req.body.username);
    try {
      if (!username) return res.status(400).json({ success: false, error: 'Selecciona un usuario válido' });
      enforceRateLimit(req, username);
      const { data } = await readAuthSnapshot();
      const user = data.users[username];

      if (!user.password) {
        if (!verifySetupToken(username, req.body.setupToken)) {
          recordFailure(req, username);
          return res.status(403).json({ success: false, error: 'Este usuario requiere su enlace privado de activación' });
        }
        const passwordError = validatePassword(req.body.password);
        if (passwordError) return res.status(400).json({ success: false, error: passwordError });
        const password = await hashPassword(String(req.body.password));
        await mutateAuthData(authData => {
          const current = authData.users[username];
          if (current.password) throw Object.assign(new Error('La cuenta ya fue activada'), { status: 409 });
          current.password = password;
          current.createdAt = new Date().toISOString();
        });
      } else if (!await verifyPassword(String(req.body.password || ''), user.password)) {
        recordFailure(req, username);
        return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
      }

      clearFailures(req, username);
      const latest = (await readAuthSnapshot()).data.users[username];
      const webAuthn = await getWebAuthn();
      const config = getWebAuthnConfig(req);
      const rpPasskeys = latest.passkeys.filter(passkey => getPasskeyRpID(passkey, config) === config.rpID);

      if (!rpPasskeys.length) {
        if (!latest.passkeys.length && !verifySetupToken(username, req.body.setupToken)) {
          return res.status(403).json({ success: false, error: 'Abre el enlace privado para terminar la activación' });
        }
        const options = await webAuthn.generateRegistrationOptions({
          rpName: config.rpName,
          rpID: config.rpID,
          userID: Buffer.from(latest.id, 'utf8'),
          userName: latest.username,
          userDisplayName: latest.displayName,
          attestationType: 'none',
          excludeCredentials: [],
          authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'required'
          },
          supportedAlgorithmIDs: [-7, -257]
        });
        issueChallenge(res, {
          ceremony: 'registration',
          username,
          challenge: options.challenge,
          rpID: config.rpID,
          origin: config.origin
        });
        return res.json({ success: true, next: 'register_passkey', options });
      }

      const options = await webAuthn.generateAuthenticationOptions({
        rpID: config.rpID,
        allowCredentials: rpPasskeys.map(passkey => ({ id: passkey.id, transports: passkey.transports })),
        userVerification: 'required'
      });
      issueChallenge(res, {
        ceremony: 'authentication',
        username,
        challenge: options.challenge,
        rpID: config.rpID,
        origin: config.origin
      });
      res.json({ success: true, next: 'authenticate_passkey', options });
    } catch (error) {
      next(error);
    }
  });

  router.post('/passkey/register/verify', requireTrustedOrigin, async (req, res, next) => {
    try {
      const challenge = challengeForRequest(req, 'registration');
      if (!challenge) return res.status(400).json({ success: false, error: 'La activación expiró. Inténtalo de nuevo.' });
      const { data } = await readAuthSnapshot();
      const user = data.users[challenge.username];
      if (!user?.password) return res.status(409).json({ success: false, error: 'La cuenta aún no tiene contraseña' });

      const webAuthn = await getWebAuthn();
      const config = getWebAuthnConfig(req);
      const expectedRPID = challenge.rpID || config.rpID;
      const expectedOrigin = challenge.origin || config.origin;
      if (expectedRPID !== config.rpID || expectedOrigin !== config.origin) {
        return res.status(400).json({ success: false, error: 'El dominio de activación no coincide' });
      }
      const verification = await webAuthn.verifyRegistrationResponse({
        response: req.body.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin,
        expectedRPID,
        requireUserVerification: true
      });
      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ success: false, error: 'No fue posible verificar la passkey' });
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      await mutateAuthData(authData => {
        const current = authData.users[challenge.username];
        if (current.passkeys.some(passkey => passkey.id === credential.id)) return;
        current.passkeys.push({
          id: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: credential.transports || req.body.response?.response?.transports || [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          rpID: expectedRPID,
          createdAt: new Date().toISOString()
        });
        current.setupCompletedAt = new Date().toISOString();
      });

      issueSession(res, user);
      res.json({ success: true, user: safeUser(user), redirect: '/admin/' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/passkey/authenticate/verify', requireTrustedOrigin, async (req, res, next) => {
    try {
      const challenge = challengeForRequest(req, 'authentication');
      if (!challenge) return res.status(400).json({ success: false, error: 'El acceso expiró. Inténtalo de nuevo.' });
      const { data } = await readAuthSnapshot();
      const user = data.users[challenge.username];
      const config = getWebAuthnConfig(req);
      const expectedRPID = challenge.rpID || config.rpID;
      const expectedOrigin = challenge.origin || config.origin;
      if (expectedRPID !== config.rpID || expectedOrigin !== config.origin) {
        return res.status(400).json({ success: false, error: 'El dominio de acceso no coincide' });
      }
      const passkey = user?.passkeys.find(item =>
        item.id === req.body.response?.id && getPasskeyRpID(item, config) === expectedRPID
      );
      if (!passkey) return res.status(400).json({ success: false, error: 'Passkey no reconocida' });

      const webAuthn = await getWebAuthn();
      const verification = await webAuthn.verifyAuthenticationResponse({
        response: req.body.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin,
        expectedRPID,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
          counter: passkey.counter,
          transports: passkey.transports
        },
        requireUserVerification: true
      });
      if (!verification.verified) return res.status(401).json({ success: false, error: 'Passkey no verificada' });

      await mutateAuthData(authData => {
        const stored = authData.users[challenge.username].passkeys.find(item => item.id === passkey.id);
        stored.counter = verification.authenticationInfo.newCounter;
        stored.lastUsedAt = new Date().toISOString();
      });

      issueSession(res, user);
      res.json({ success: true, user: safeUser(user), redirect: '/admin/' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', requireTrustedOrigin, (req, res) => {
    clearCookie(res, cookieNames().session);
    clearCookie(res, cookieNames().challenge);
    res.json({ success: true });
  });

  router.use((error, req, res, next) => {
    console.error('[Auth]', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.status ? error.message : 'No fue posible completar la autenticación'
    });
  });

  return router;
}

module.exports = {
  createAuthRouter,
  createSetupToken,
  getWebAuthnConfig,
  getPasskeyRpID,
  hashPassword,
  verifyPassword,
  requireApiAuth,
  requirePageAuth,
  sessionForRequest
};

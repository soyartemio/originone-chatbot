const crypto = require('crypto');

const DEFAULT_GATEWAY_URL = 'https://originone-crm-storage.4nwq6cqmyj.workers.dev';
const ROUTES = {
  appointments: '/v1/appointments',
  auth: '/v1/auth',
  costs: '/v1/costs'
};

function getSourceSecret() {
  return process.env.CRM_GATEWAY_SOURCE_SECRET || process.env.META_PAGE_ACCESS_TOKEN || '';
}

function deriveGatewaySecret(sourceSecret = getSourceSecret()) {
  if (!sourceSecret) return null;
  return crypto.createHash('sha256').update(`originone-crm-gateway-v1\0${sourceSecret}`).digest('hex');
}

function deriveApplicationSecret(label, sourceSecret = getSourceSecret()) {
  if (!sourceSecret) return null;
  return crypto.createHmac('sha256', sourceSecret).update(`originone-auth-v1:${label}`).digest('hex');
}

function getGatewayConfiguration() {
  const secret = deriveGatewaySecret();
  if (!secret) return null;
  return {
    baseUrl: String(process.env.CRM_GATEWAY_URL || DEFAULT_GATEWAY_URL).replace(/\/$/, ''),
    secret
  };
}

function isStorageGatewayConfigured() {
  return Boolean(getGatewayConfiguration());
}

async function signedHeaders(method, pathname, body, configuration) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const contentHash = crypto.createHash('sha256').update(body).digest('hex');
  const canonical = `${method}\n${pathname}\n${timestamp}\n${contentHash}`;
  const signature = crypto.createHmac('sha256', Buffer.from(configuration.secret, 'hex')).update(canonical).digest('hex');
  return {
    'X-O1-Timestamp': timestamp,
    'X-O1-Content-SHA256': contentHash,
    'X-O1-Signature': signature
  };
}

async function requestGateway(objectName, method, options = {}) {
  const configuration = getGatewayConfiguration();
  if (!configuration) throw new Error('El gateway privado de R2 no está configurado');
  const pathname = ROUTES[objectName];
  if (!pathname) throw new Error('Objeto de almacenamiento desconocido');
  const body = options.body || '';
  const headers = {
    ...(await signedHeaders(method, pathname, body, configuration)),
    ...(options.etag ? { 'If-Match': options.etag } : {}),
    ...(options.createOnly ? { 'If-None-Match': '*' } : {})
  };
  if (method === 'PUT') {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(body).toString();
  }

  const response = await fetch(`${configuration.baseUrl}${pathname}`, {
    method,
    headers,
    ...(method === 'PUT' ? { body } : {}),
    signal: AbortSignal.timeout(15000)
  });
  if (method === 'GET' && response.status === 404) return { missing: true, etag: null, data: null };
  if (response.status === 412) {
    const error = new Error('Precondition failed');
    error.name = 'PreconditionFailed';
    error.statusCode = 412;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`Gateway R2 respondió ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return {
    missing: false,
    etag: response.headers.get('etag'),
    data: method === 'GET' ? await response.json() : null
  };
}

function readGatewayObject(objectName) {
  return requestGateway(objectName, 'GET');
}

function writeGatewayObject(objectName, data, previousEtag) {
  return requestGateway(objectName, 'PUT', {
    body: JSON.stringify(data, null, 2),
    etag: previousEtag,
    createOnly: !previousEtag
  });
}

module.exports = {
  deriveApplicationSecret,
  deriveGatewaySecret,
  getGatewayConfiguration,
  isStorageGatewayConfigured,
  readGatewayObject,
  writeGatewayObject
};

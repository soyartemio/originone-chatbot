const fs = require('fs');
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { isStorageGatewayConfigured, readGatewayObject, writeGatewayObject } = require('./storageGateway');

const LOCAL_PATH = process.env.ANALYTICS_DB_PATH
  ? path.resolve(process.env.ANALYTICS_DB_PATH)
  : path.join(__dirname, '../data/analytics.json');
const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
let client;

function configuration() {
  if (!REQUIRED.some(key => process.env[key])) return null;
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Configuración R2 incompleta. Faltan: ${missing.join(', ')}`);
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    key: process.env.R2_ANALYTICS_OBJECT_KEY || 'crm/analytics.json'
  };
}

function r2(config) {
  if (!client) client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
  return client;
}

function readLocal() {
  if (!fs.existsSync(LOCAL_PATH)) return [];
  const value = JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8'));
  return Array.isArray(value) ? value : [];
}

function writeLocal(events) {
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  const temporary = `${LOCAL_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(events, null, 2));
  fs.renameSync(temporary, LOCAL_PATH);
}

function isMissing(error) {
  return error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
}

async function readAnalyticsSnapshot() {
  const config = configuration();
  if (config) {
    try {
      const response = await r2(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: config.key }));
      return { events: JSON.parse(await response.Body.transformToString()), etag: response.ETag || null, backend: 'r2' };
    } catch (error) {
      if (isMissing(error)) return { events: [], etag: null, backend: 'r2' };
      throw error;
    }
  }
  if (isStorageGatewayConfigured() && (process.env.NODE_ENV === 'production' || process.env.CRM_GATEWAY_URL)) {
    const response = await readGatewayObject('analytics');
    return response.missing
      ? { events: [], etag: null, backend: 'gateway' }
      : { events: response.data, etag: response.etag, backend: 'gateway' };
  }
  return { events: readLocal(), etag: null, backend: 'local' };
}

async function writeAnalyticsSnapshot(events, etag, backend) {
  const config = configuration();
  if (config) {
    const response = await r2(config).send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: config.key,
      Body: JSON.stringify(events),
      ContentType: 'application/json',
      ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' })
    }));
    return { etag: response.ETag || null };
  }
  if (backend === 'gateway') return writeGatewayObject('analytics', events, etag);
  writeLocal(events);
  return {};
}

module.exports = { readAnalyticsSnapshot, writeAnalyticsSnapshot };

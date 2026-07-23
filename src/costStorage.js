const fs = require('fs');
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { isStorageGatewayConfigured, readGatewayObject, writeGatewayObject } = require('./storageGateway');

const LOCAL_DB_PATH = process.env.COSTS_DB_PATH
  ? path.resolve(process.env.COSTS_DB_PATH)
  : path.join(__dirname, '../data/costs.json');

const R2_REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
let r2Client = null;
let lastR2WriteAt = 0;

function getR2Configuration() {
  const configuredKeys = R2_REQUIRED_ENV.filter(key => Boolean(process.env[key]));
  if (configuredKeys.length === 0) return null;
  const missingKeys = R2_REQUIRED_ENV.filter(key => !process.env[key]);
  if (missingKeys.length) throw new Error(`Configuración R2 incompleta. Faltan: ${missingKeys.join(', ')}`);
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    objectKey: process.env.R2_COSTS_OBJECT_KEY || 'crm/costs.json'
  };
}

function shouldUseGateway() {
  return isStorageGatewayConfigured() && (process.env.NODE_ENV === 'production' || Boolean(process.env.CRM_GATEWAY_URL));
}

function ensureLocalFile() {
  const directory = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(LOCAL_DB_PATH)) fs.writeFileSync(LOCAL_DB_PATH, '[]');
}

function readLocalCosts() {
  ensureLocalFile();
  const costs = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
  if (!Array.isArray(costs)) throw new Error('El archivo local de costos no contiene una lista válida');
  return costs;
}

function writeLocalCosts(costs) {
  ensureLocalFile();
  const temporaryPath = `${LOCAL_DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(costs, null, 2));
  fs.renameSync(temporaryPath, LOCAL_DB_PATH);
}

function getR2Client(configuration) {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey
      }
    });
  }
  return r2Client;
}

function isMissing(error) {
  return error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
}

function isRetryable(error) {
  const status = error?.statusCode || error?.$metadata?.httpStatusCode;
  return error?.name === 'PreconditionFailed' || status === 412 || status === 429 || status >= 500;
}

async function readCostsSnapshot() {
  const configuration = getR2Configuration();
  if (!configuration) {
    if (shouldUseGateway()) {
      const response = await readGatewayObject('costs');
      if (response.missing) return { costs: [], etag: null, backend: 'gateway', exists: false };
      if (!Array.isArray(response.data)) throw new Error('El gateway R2 no contiene una lista de costos válida');
      return { costs: response.data, etag: response.etag, backend: 'gateway', exists: true };
    }
    const exists = fs.existsSync(LOCAL_DB_PATH);
    return { costs: exists ? readLocalCosts() : [], etag: null, backend: 'local', exists };
  }

  try {
    const response = await getR2Client(configuration).send(new GetObjectCommand({
      Bucket: configuration.bucket,
      Key: configuration.objectKey
    }));
    const costs = JSON.parse(await response.Body.transformToString());
    if (!Array.isArray(costs)) throw new Error('El objeto de R2 no contiene una lista de costos válida');
    return { costs, etag: response.ETag || null, backend: 'r2', exists: true };
  } catch (error) {
    if (isMissing(error)) return { costs: [], etag: null, backend: 'r2', exists: false };
    throw new Error(`No fue posible leer los costos desde R2: ${error.message}`, { cause: error });
  }
}

async function writeCostsSnapshot(costs, previousEtag = null, backend = null) {
  if (!Array.isArray(costs)) throw new Error('costs debe ser una lista');
  const configuration = getR2Configuration();

  if (!configuration) {
    if (backend === 'gateway' || shouldUseGateway()) {
      await writeGatewayObject('costs', costs, previousEtag);
      try { writeLocalCosts(costs); } catch (error) { console.warn(`[CostStorage] Copia local pendiente: ${error.message}`); }
      return { backend: 'gateway', etag: null };
    }
    writeLocalCosts(costs);
    return { backend: 'local', etag: null };
  }

  const minimumInterval = Number(process.env.R2_WRITE_INTERVAL_MS ?? 1100);
  const remainingWait = Math.max(0, minimumInterval - (Date.now() - lastR2WriteAt));
  if (remainingWait) await new Promise(resolve => setTimeout(resolve, remainingWait));
  lastR2WriteAt = Date.now();

  const response = await getR2Client(configuration).send(new PutObjectCommand({
    Bucket: configuration.bucket,
    Key: configuration.objectKey,
    Body: JSON.stringify(costs, null, 2),
    ContentType: 'application/json',
    ...(previousEtag ? { IfMatch: previousEtag } : { IfNoneMatch: '*' })
  }));
  try { writeLocalCosts(costs); } catch (error) { console.warn(`[CostStorage] Copia local pendiente: ${error.message}`); }
  return { backend: 'r2', etag: response.ETag || null };
}

module.exports = { isRetryable, readCostsSnapshot, writeCostsSnapshot };

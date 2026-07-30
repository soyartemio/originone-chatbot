const fs = require('fs');
const path = require('path');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { isStorageGatewayConfigured, readGatewayObject, writeGatewayObject } = require('./storageGateway');

const LOCAL_DB_PATH = process.env.PUBLICATIONS_DB_PATH
  ? path.resolve(process.env.PUBLICATIONS_DB_PATH)
  : path.join(__dirname, '../data/publications.json');
const R2_REQUIRED_ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
let r2Client = null;

function getR2Configuration() {
  const configuredKeys = R2_REQUIRED_ENV.filter(key => Boolean(process.env[key]));
  if (!configuredKeys.length) return null;
  const missingKeys = R2_REQUIRED_ENV.filter(key => !process.env[key]);
  if (missingKeys.length) throw new Error(`Configuración R2 incompleta. Faltan: ${missingKeys.join(', ')}`);
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    objectKey: process.env.R2_PUBLICATIONS_OBJECT_KEY || 'crm/publications.json'
  };
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

function shouldUseGateway() {
  return isStorageGatewayConfigured() && (process.env.NODE_ENV === 'production' || Boolean(process.env.CRM_GATEWAY_URL));
}

function ensureLocalFile() {
  const directory = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(LOCAL_DB_PATH)) fs.writeFileSync(LOCAL_DB_PATH, '[]');
}

function readLocal() {
  ensureLocalFile();
  const data = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
  if (!Array.isArray(data)) throw new Error('El archivo local de publicaciones no contiene una lista válida');
  return data;
}

function writeLocal(data) {
  ensureLocalFile();
  const temporaryPath = `${LOCAL_DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
  fs.renameSync(temporaryPath, LOCAL_DB_PATH);
}

async function readPublicationsSnapshot() {
  // Production uses the signed gateway as the source of truth. Direct R2
  // credentials may also be present for legacy storage, but must not shadow
  // the gateway (a missing object there is a normal first-run state).
  if (shouldUseGateway()) {
    const response = await readGatewayObject('publications');
    if (response.missing) return { publications: [], etag: null, backend: 'gateway', exists: false };
    if (!Array.isArray(response.data)) throw new Error('El gateway no contiene una lista de publicaciones válida');
    return { publications: response.data, etag: response.etag, backend: 'gateway', exists: true };
  }
  const configuration = getR2Configuration();
  if (configuration) {
    try {
      const response = await getR2Client(configuration).send(new GetObjectCommand({
        Bucket: configuration.bucket,
        Key: configuration.objectKey
      }));
      const publications = JSON.parse(await response.Body.transformToString());
      if (!Array.isArray(publications)) throw new Error('El objeto de R2 no contiene una lista válida');
      return { publications, etag: response.ETag || null, backend: 'r2', exists: true };
    } catch (error) {
      if (isMissing(error)) return { publications: [], etag: null, backend: 'r2', exists: false };
      throw new Error(`No fue posible leer las publicaciones desde R2: ${error.message}`, { cause: error });
    }
  }
  const exists = fs.existsSync(LOCAL_DB_PATH);
  return { publications: exists ? readLocal() : [], etag: null, backend: 'local', exists };
}

async function writePublicationsSnapshot(publications, previousEtag = null, backend = null) {
  if (!Array.isArray(publications)) throw new Error('publications debe ser una lista');
  if (backend === 'gateway' || shouldUseGateway()) {
    await writeGatewayObject('publications', publications, previousEtag);
    try { writeLocal(publications); } catch (error) { console.warn(`[PublicationStorage] Copia local pendiente: ${error.message}`); }
    return { backend: 'gateway' };
  }
  const configuration = getR2Configuration();
  if (configuration) {
    const response = await getR2Client(configuration).send(new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: configuration.objectKey,
      Body: JSON.stringify(publications, null, 2),
      ContentType: 'application/json',
      ...(previousEtag ? { IfMatch: previousEtag } : { IfNoneMatch: '*' })
    }));
    try { writeLocal(publications); } catch (error) { console.warn(`[PublicationStorage] Copia local pendiente: ${error.message}`); }
    return { backend: 'r2', etag: response.ETag || null };
  }
  writeLocal(publications);
  return { backend: 'local' };
}

module.exports = { readPublicationsSnapshot, writePublicationsSnapshot };

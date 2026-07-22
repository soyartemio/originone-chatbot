const fs = require('fs');
const path = require('path');
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3');
const {
  isStorageGatewayConfigured,
  readGatewayObject,
  writeGatewayObject
} = require('./storageGateway');

const LOCAL_DB_PATH = process.env.CRM_DB_PATH
  ? path.resolve(process.env.CRM_DB_PATH)
  : path.join(__dirname, '../data/appointments.json');

const R2_REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME'
];

let r2Client = null;
let lastR2WriteAt = 0;

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getR2Configuration() {
  const configuredKeys = R2_REQUIRED_ENV.filter(key => Boolean(process.env[key]));
  if (configuredKeys.length === 0) return null;

  const missingKeys = R2_REQUIRED_ENV.filter(key => !process.env[key]);
  if (missingKeys.length > 0) {
    throw new Error(`Configuración R2 incompleta. Faltan: ${missingKeys.join(', ')}`);
  }

  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    objectKey: process.env.R2_CRM_OBJECT_KEY || 'crm/appointments.json'
  };
}

function isR2Configured() {
  return Boolean(getR2Configuration()) || shouldUseStorageGateway();
}

function shouldUseStorageGateway() {
  return isStorageGatewayConfigured() && (process.env.NODE_ENV === 'production' || Boolean(process.env.CRM_GATEWAY_URL));
}

function ensureLocalDbExists() {
  const directory = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(LOCAL_DB_PATH)) fs.writeFileSync(LOCAL_DB_PATH, '[]');
}

function readLocalAppointments() {
  ensureLocalDbExists();
  const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('El archivo local del CRM no contiene una lista válida');
  return parsed;
}

function writeLocalAppointments(appointments) {
  ensureLocalDbExists();
  const temporaryPath = `${LOCAL_DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(appointments, null, 2));
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

function isObjectMissing(error) {
  return error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
}

function isPreconditionFailure(error) {
  return error?.name === 'PreconditionFailed' || error?.$metadata?.httpStatusCode === 412;
}

function isTransientStorageError(error) {
  const statusCode = error?.$metadata?.httpStatusCode;
  return statusCode === 429 || statusCode >= 500 || ['SlowDown', 'ServiceUnavailable', 'InternalError'].includes(error?.name);
}

async function readAppointmentsSnapshot() {
  const configuration = getR2Configuration();
  if (!configuration) {
    if (shouldUseStorageGateway()) {
      const response = await readGatewayObject('appointments');
      if (response.missing) return { appointments: [], etag: null, backend: 'gateway' };
      if (!Array.isArray(response.data)) throw new Error('El gateway R2 no contiene una lista válida');
      return { appointments: response.data, etag: response.etag, backend: 'gateway' };
    }
    return { appointments: readLocalAppointments(), etag: null, backend: 'local' };
  }

  try {
    const response = await getR2Client(configuration).send(new GetObjectCommand({
      Bucket: configuration.bucket,
      Key: configuration.objectKey
    }));
    const contents = await response.Body.transformToString();
    const appointments = JSON.parse(contents);
    if (!Array.isArray(appointments)) throw new Error('El objeto de R2 no contiene una lista válida');
    return { appointments, etag: response.ETag || null, backend: 'r2' };
  } catch (error) {
    if (isObjectMissing(error)) {
      return { appointments: readLocalAppointments(), etag: null, backend: 'r2' };
    }
    throw new Error(`No fue posible leer el CRM desde R2: ${error.message}`, { cause: error });
  }
}

async function writeAppointmentsSnapshot(appointments, previousEtag = null) {
  if (!Array.isArray(appointments)) throw new Error('appointments debe ser una lista');

  const configuration = getR2Configuration();
  if (!configuration) {
    if (shouldUseStorageGateway()) {
      await writeGatewayObject('appointments', appointments, previousEtag);
      try {
        writeLocalAppointments(appointments);
      } catch (localError) {
        console.warn(`[CRMStorage] No se pudo actualizar la copia local: ${localError.message}`);
      }
      return { backend: 'gateway', etag: null };
    }
    writeLocalAppointments(appointments);
    return { backend: 'local', etag: null };
  }

  try {
    // R2 admite como máximo una escritura por segundo sobre la misma clave.
    const minimumInterval = Number(process.env.R2_WRITE_INTERVAL_MS ?? 1100);
    const remainingWait = Math.max(0, minimumInterval - (Date.now() - lastR2WriteAt));
    if (remainingWait > 0) await wait(remainingWait);
    lastR2WriteAt = Date.now();

    const response = await getR2Client(configuration).send(new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: configuration.objectKey,
      Body: JSON.stringify(appointments, null, 2),
      ContentType: 'application/json',
      ...(previousEtag ? { IfMatch: previousEtag } : { IfNoneMatch: '*' })
    }));

    // Copia operativa local de mejor esfuerzo; R2 sigue siendo la fuente de verdad.
    try {
      writeLocalAppointments(appointments);
    } catch (localError) {
      console.warn(`[CRMStorage] No se pudo actualizar la copia local: ${localError.message}`);
    }
    return { backend: 'r2', etag: response.ETag || null };
  } catch (error) {
    if (isPreconditionFailure(error) || isTransientStorageError(error)) throw error;
    throw new Error(`No fue posible guardar el CRM en R2: ${error.message}`, { cause: error });
  }
}

module.exports = {
  isR2Configured,
  isPreconditionFailure,
  isTransientStorageError,
  readAppointmentsSnapshot,
  writeAppointmentsSnapshot
};

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

const LOCAL_AUTH_PATH = process.env.AUTH_DB_PATH
  ? path.resolve(process.env.AUTH_DB_PATH)
  : path.join(__dirname, '../data/auth.json');

let client = null;
let mutationQueue = Promise.resolve();
let lastWriteAt = 0;

function emptyAuthData() {
  return {
    version: 1,
    users: {
      artemio: {
        id: 'originone-artemio',
        username: 'artemio',
        displayName: 'Artemio',
        password: null,
        passkeys: [],
        createdAt: null,
        setupCompletedAt: null
      },
      edgar: {
        id: 'originone-edgar',
        username: 'edgar',
        displayName: 'Edgar',
        password: null,
        passkeys: [],
        createdAt: null,
        setupCompletedAt: null
      }
    }
  };
}

function getConfiguration() {
  const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const configured = keys.filter(key => Boolean(process.env[key]));
  if (configured.length === 0) return null;
  const missing = keys.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Configuración R2 incompleta. Faltan: ${missing.join(', ')}`);
  return {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    objectKey: process.env.R2_AUTH_OBJECT_KEY || 'crm/auth.json'
  };
}

function shouldUseStorageGateway() {
  return isStorageGatewayConfigured() && (process.env.NODE_ENV === 'production' || Boolean(process.env.CRM_GATEWAY_URL));
}

function getClient(configuration) {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey
      }
    });
  }
  return client;
}

function normalizeAuthData(data) {
  const defaults = emptyAuthData();
  const source = data && typeof data === 'object' ? data : {};
  for (const username of Object.keys(defaults.users)) {
    defaults.users[username] = {
      ...defaults.users[username],
      ...(source.users?.[username] || {}),
      username,
      passkeys: Array.isArray(source.users?.[username]?.passkeys)
        ? source.users[username].passkeys
        : []
    };
  }
  return { ...defaults, ...source, users: defaults.users };
}

function ensureLocalFile() {
  const directory = path.dirname(LOCAL_AUTH_PATH);
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(LOCAL_AUTH_PATH)) {
    fs.writeFileSync(LOCAL_AUTH_PATH, JSON.stringify(emptyAuthData(), null, 2), { mode: 0o600 });
  }
}

function readLocal() {
  ensureLocalFile();
  return normalizeAuthData(JSON.parse(fs.readFileSync(LOCAL_AUTH_PATH, 'utf8')));
}

function writeLocal(data) {
  ensureLocalFile();
  const temporary = `${LOCAL_AUTH_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, LOCAL_AUTH_PATH);
}

function isMissing(error) {
  return error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;
}

function isConflict(error) {
  return error?.name === 'PreconditionFailed' || error?.$metadata?.httpStatusCode === 412;
}

async function readAuthSnapshot() {
  const configuration = getConfiguration();
  if (!configuration) {
    if (shouldUseStorageGateway()) {
      const response = await readGatewayObject('auth');
      return {
        data: response.missing ? emptyAuthData() : normalizeAuthData(response.data),
        etag: response.etag,
        backend: 'gateway'
      };
    }
    return { data: readLocal(), etag: null, backend: 'local' };
  }

  try {
    const response = await getClient(configuration).send(new GetObjectCommand({
      Bucket: configuration.bucket,
      Key: configuration.objectKey
    }));
    const contents = await response.Body.transformToString();
    return {
      data: normalizeAuthData(JSON.parse(contents)),
      etag: response.ETag || null,
      backend: 'r2'
    };
  } catch (error) {
    if (isMissing(error)) return { data: emptyAuthData(), etag: null, backend: 'r2' };
    throw new Error(`No fue posible leer la autenticación desde R2: ${error.message}`, { cause: error });
  }
}

async function writeAuthSnapshot(data, previousEtag, backend) {
  if (backend === 'local') {
    writeLocal(data);
    return;
  }

  if (backend === 'gateway') {
    await writeGatewayObject('auth', data, previousEtag);
    return;
  }

  const configuration = getConfiguration();
  const waitMs = Math.max(0, Number(process.env.R2_WRITE_INTERVAL_MS ?? 1100) - (Date.now() - lastWriteAt));
  if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
  lastWriteAt = Date.now();
  await getClient(configuration).send(new PutObjectCommand({
    Bucket: configuration.bucket,
    Key: configuration.objectKey,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    CacheControl: 'no-store',
    ...(previousEtag ? { IfMatch: previousEtag } : { IfNoneMatch: '*' })
  }));
}

async function mutateAuthData(mutator) {
  const operation = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await readAuthSnapshot();
      const result = await mutator(snapshot.data);
      try {
        await writeAuthSnapshot(snapshot.data, snapshot.etag, snapshot.backend);
        return result;
      } catch (error) {
        if (!isConflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error('No fue posible guardar la autenticación por una actualización simultánea');
  };

  const queued = mutationQueue.then(operation, operation);
  mutationQueue = queued.catch(() => {});
  return queued;
}

module.exports = {
  emptyAuthData,
  readAuthSnapshot,
  mutateAuthData
};

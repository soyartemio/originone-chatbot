const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const encoder = new TextEncoder();

const OBJECTS = Object.freeze({
  '/v1/appointments': { key: 'crm/appointments.json', shape: 'appointments' },
  '/v1/auth': { key: 'crm/auth.json', shape: 'auth' }
});

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Invalid secret format');
  return new Uint8Array(value.match(/.{2}/g).map(byte => Number.parseInt(byte, 16)));
}

async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value));
}

async function hmacHex(secretHex, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(secretHex),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function timingSafeStringEqual(first, second) {
  const [firstHash, secondHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(first)),
    crypto.subtle.digest('SHA-256', encoder.encode(second))
  ]);
  return crypto.subtle.timingSafeEqual(firstHash, secondHash);
}

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}

async function verifyRequest(request, env, pathname) {
  const timestamp = request.headers.get('x-o1-timestamp') || '';
  const contentHash = request.headers.get('x-o1-content-sha256') || '';
  const signature = request.headers.get('x-o1-signature') || '';
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(contentHash) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) return false;
  const canonical = `${request.method}\n${pathname}\n${timestamp}\n${contentHash.toLowerCase()}`;
  const expected = await hmacHex(env.GATEWAY_SECRET, canonical);
  return timingSafeStringEqual(signature.toLowerCase(), expected);
}

function validatePayload(payload, shape) {
  if (shape === 'appointments') return Array.isArray(payload);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const usernames = Object.keys(payload.users || {}).sort();
  return payload.version === 1 && usernames.join(',') === 'artemio,edgar';
}

async function handleGet(env, definition) {
  const object = await env.CRM_BUCKET.get(definition.key);
  if (!object || !('body' in object)) return json({ error: 'Not found' }, 404);
  const headers = new Headers({
    'Content-Type': object.httpMetadata?.contentType || 'application/json',
    'Cache-Control': 'no-store',
    ETag: object.httpEtag,
    'X-Content-Type-Options': 'nosniff'
  });
  return new Response(object.body, { status: 200, headers });
}

async function handlePut(request, env, definition) {
  const contentLength = Number(request.headers.get('content-length'));
  if (!Number.isInteger(contentLength) || contentLength < 0 || contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Invalid content length' }, 413);
  }
  const body = await request.arrayBuffer();
  const contentHash = await sha256Hex(body);
  if (!await timingSafeStringEqual(contentHash, request.headers.get('x-o1-content-sha256') || '')) {
    return json({ error: 'Content hash mismatch' }, 400);
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!validatePayload(payload, definition.shape)) return json({ error: 'Invalid payload shape' }, 400);

  const ifMatch = request.headers.get('if-match');
  const ifNoneMatch = request.headers.get('if-none-match');
  let onlyIf;
  if (ifMatch) {
    // R2Conditional expects the raw ETag, while the HTTP header includes quotes.
    onlyIf = { etagMatches: ifMatch.replace(/^W\//, '').replace(/^"|"$/g, '') };
  } else if (ifNoneMatch) {
    const conditionalHeaders = new Headers();
    conditionalHeaders.set('If-None-Match', ifNoneMatch);
    onlyIf = conditionalHeaders;
  }

  const stored = await env.CRM_BUCKET.put(definition.key, body, {
    ...(onlyIf ? { onlyIf } : {}),
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
    sha256: contentHash
  });
  if (!stored) return json({ error: 'Precondition failed' }, 412);
  return json({ success: true }, 200, { ETag: stored.httpEtag });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') return json({ status: 'ok' });
    const definition = OBJECTS[url.pathname];
    if (!definition) return json({ error: 'Not found' }, 404);
    if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, PUT' });

    try {
      if (!await verifyRequest(request, env, url.pathname)) return json({ error: 'Unauthorized' }, 401);
      if (request.method === 'GET') return await handleGet(env, definition);
      return await handlePut(request, env, definition);
    } catch (error) {
      console.error(JSON.stringify({ message: 'CRM storage request failed', path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
      return json({ error: 'Internal error' }, 500);
    }
  }
};

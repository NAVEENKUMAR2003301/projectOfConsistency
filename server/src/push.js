// Web Push (RFC 8291 / RFC 8188) on Web Crypto only — no Node APIs, so it runs
// on Workers. Two pieces: a signed VAPID header proving who is sending, and an
// aes128gcm-encrypted payload that only the subscriber's browser can read.
//
// This is written out rather than pulled from a library because the Node
// `web-push` package depends on Node crypto and does not run here.

const enc = new TextEncoder()

export const b64urlToBytes = (value) => {
  const pad = value.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export const bytesToB64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const concat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

/** Imports a raw P-256 public key (65 bytes, uncompressed). */
const importPublic = (raw) =>
  crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, [])

/**
 * The VAPID `Authorization` header: an ES256 JWT proving the sender owns the
 * public key the subscriber was given.
 */
async function vapidHeader(endpoint, publicKey, privateKey, subject) {
  const { origin } = new URL(endpoint)
  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud: origin,
    // 12 hours; push services reject anything beyond 24.
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  }

  const signingInput = `${bytesToB64url(enc.encode(JSON.stringify(header)))}.${bytesToB64url(
    enc.encode(JSON.stringify(claims)),
  )}`

  // The private key is the raw 32-byte scalar; JWK is the portable way in.
  const pub = b64urlToBytes(publicKey)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: privateKey,
    ext: true,
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput),
  )

  return {
    Authorization: `vapid t=${signingInput}.${bytesToB64url(signature)}, k=${publicKey}`,
  }
}

/**
 * Encrypts `payload` for one subscription using aes128gcm.
 * Returns the body bytes to POST to the endpoint.
 */
async function encrypt(payload, p256dh, auth) {
  const clientPublic = b64urlToBytes(p256dh)
  const authSecret = b64urlToBytes(auth)

  // An ephemeral key pair per message — required by the spec.
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const ephemeralPublic = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey),
  )

  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: await importPublic(clientPublic) },
      ephemeral.privateKey,
      256,
    ),
  )

  // Pseudo-random key, then the content encryption key and nonce.
  const prkInfo = concat(
    enc.encode('WebPush: info\0'),
    clientPublic,
    ephemeralPublic,
  )
  const ikm = await hkdf(authSecret, shared, prkInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // A single record, so the padding delimiter is 0x02.
  const plaintext = concat(enc.encode(payload), new Uint8Array([2]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext),
  )

  // Header: salt | record size (4096) | key id length | key id
  const recordSize = new Uint8Array([0, 0, 16, 0])
  const header = concat(
    salt,
    recordSize,
    new Uint8Array([ephemeralPublic.length]),
    ephemeralPublic,
  )
  return concat(header, ciphertext)
}

/**
 * Sends one push. Returns { ok, status } — a 404 or 410 means the subscription
 * is dead and the caller should delete it.
 */
export async function sendPush(subscription, payload, vapid) {
  const body = await encrypt(payload, subscription.p256dh, subscription.auth)
  const headers = await vapidHeader(
    subscription.endpoint,
    vapid.publicKey,
    vapid.privateKey,
    vapid.subject,
  )

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
    },
    body,
  })

  return {
    ok: response.ok,
    status: response.status,
    // These two mean the browser threw the subscription away.
    gone: response.status === 404 || response.status === 410,
  }
}

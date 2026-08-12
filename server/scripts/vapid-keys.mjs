// Generates a VAPID key pair using only Node's built-in Web Crypto, so there
// is no dependency to install and nothing that could exfiltrate the key.
//
//   node scripts/vapid-keys.mjs
//
// The public key also goes into the browser; the private key is a secret and
// must only ever live in `wrangler secret put`.

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const pair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)

// The public key travels as the raw uncompressed point (65 bytes).
const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey))
// The private key is the `d` scalar from the JWK, already base64url.
const { d: privateKey } = await crypto.subtle.exportKey('jwk', pair.privateKey)

console.log(`
VAPID key pair
──────────────────────────────────────────────────────────────
PUBLIC  (safe to ship to the browser)
${publicKey}

PRIVATE (secret — never commit, never send to the client)
${privateKey}

Next:
  wrangler secret put VAPID_PUBLIC_KEY     # paste the public key
  wrangler secret put VAPID_PRIVATE_KEY    # paste the private key

Then set VITE_API_URL in the web app to your worker's URL.
──────────────────────────────────────────────────────────────
`)

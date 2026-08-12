import { sendPush } from './push.js'

// Consistency cloud reminders.
//
// Scope on purpose: this server knows habit NAMES and TIMES, nothing else. No
// check-in history, no notes, no expenses — those stay on the device, so the
// app's privacy claim survives someone opting in to reminders.

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } })

const oops = (message, status = 400) => json({ error: message }, status)

const nowIso = () => new Date().toISOString()

const sha256 = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 128 bits of entropy, in a shape a person can copy without ambiguity. */
function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ' // no 0/O/1/I/L/U
  let out = ''
  for (const byte of bytes) out += alphabet[byte % alphabet.length]
  return out.match(/.{1,5}/g).join('-')
}

const newId = () => crypto.randomUUID()

// --- CORS -------------------------------------------------------------------
// Only the deployed app may call this. ALLOWED_ORIGIN is set in wrangler.toml.
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = (env.ALLOWED_ORIGIN ?? '').split(',').map((s) => s.trim())
  const ok = allowed.includes(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// --- auth -------------------------------------------------------------------

const SESSION_DAYS = 90

async function authenticate(request, env) {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const row = await env.DB.prepare(
    'SELECT account_id, expires_at FROM sessions WHERE token_hash = ?',
  )
    .bind(await sha256(token))
    .first()

  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) return null
  return row.account_id
}

// --- routes -----------------------------------------------------------------

/** Creates an account and returns the key ONCE. It is never recoverable. */
async function createAccount(env) {
  const key = newKey()
  const id = newId()
  await env.DB.prepare(
    'INSERT INTO accounts (id, key_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
  )
    .bind(id, await sha256(key), nowIso(), nowIso())
    .run()

  return json({ accountId: id, accountKey: key }, 201)
}

/** Exchanges an account key for a session token. */
async function createSession(request, env) {
  const { accountKey } = await request.json().catch(() => ({}))
  if (typeof accountKey !== 'string' || accountKey.length < 8) {
    return oops('That account key does not look right.', 400)
  }

  const account = await env.DB.prepare('SELECT id FROM accounts WHERE key_hash = ?')
    .bind(await sha256(accountKey.trim().toUpperCase()))
    .first()

  // Same message either way: never reveal whether a key exists.
  if (!account) return oops('That account key was not recognised.', 401)

  const token = bytesToToken(crypto.getRandomValues(new Uint8Array(32)))
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString()

  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).bind(await sha256(token), account.id, nowIso(), expires),
    env.DB.prepare('UPDATE accounts SET last_seen_at = ? WHERE id = ?').bind(
      nowIso(),
      account.id,
    ),
  ])

  return json({ token, expiresAt: expires, accountId: account.id })
}

const bytesToToken = (bytes) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Everything the account page shows. */
async function accountDetails(accountId, env) {
  const [account, devices, reminders, sent] = await Promise.all([
    env.DB.prepare('SELECT id, created_at, last_seen_at FROM accounts WHERE id = ?')
      .bind(accountId)
      .first(),
    env.DB.prepare(
      'SELECT id, label, created_at, failures FROM devices WHERE account_id = ? ORDER BY created_at',
    )
      .bind(accountId)
      .all(),
    env.DB.prepare('SELECT id, name, slots, target FROM reminders WHERE account_id = ?')
      .bind(accountId)
      .all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM sends WHERE account_id = ?')
      .bind(accountId)
      .first(),
  ])

  if (!account) return oops('No such account.', 404)

  return json({
    accountId: account.id,
    createdAt: account.created_at,
    lastSeenAt: account.last_seen_at,
    devices: (devices.results ?? []).map((d) => ({
      id: d.id,
      label: d.label,
      createdAt: d.created_at,
      failing: d.failures > 0,
    })),
    reminders: (reminders.results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      times: JSON.parse(r.slots),
      target: r.target,
    })),
    remindersSent: sent?.n ?? 0,
  })
}

/** Stores or refreshes this browser's push subscription. */
async function subscribe(request, accountId, env) {
  const body = await request.json().catch(() => ({}))
  const { endpoint, keys, label } = body ?? {}
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return oops('That push subscription is incomplete.', 400)
  }

  await env.DB.prepare(
    `INSERT INTO devices (id, account_id, label, endpoint, p256dh, auth, created_at, failures)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(endpoint) DO UPDATE SET
       account_id = excluded.account_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       label = excluded.label,
       failures = 0`,
  )
    .bind(
      newId(),
      accountId,
      String(label ?? '').slice(0, 80),
      endpoint,
      keys.p256dh,
      keys.auth,
      nowIso(),
    )
    .run()

  return json({ ok: true })
}

async function unsubscribe(request, accountId, env) {
  const { endpoint } = await request.json().catch(() => ({}))
  if (!endpoint) return oops('No endpoint given.', 400)
  await env.DB.prepare('DELETE FROM devices WHERE account_id = ? AND endpoint = ?')
    .bind(accountId, endpoint)
    .run()
  return json({ ok: true })
}

/**
 * Replaces the whole reminder schedule for this account. The device is the
 * source of truth; the server only mirrors what it is told.
 */
async function putReminders(request, accountId, env) {
  const body = await request.json().catch(() => ({}))
  const { reminders, tzOffset } = body ?? {}
  if (!Array.isArray(reminders)) return oops('Expected a list of reminders.', 400)
  if (reminders.length > 100) return oops('Too many reminders.', 400)

  const offset = Number.isFinite(tzOffset) ? Math.trunc(tzOffset) : 0
  const statements = [
    env.DB.prepare('DELETE FROM reminders WHERE account_id = ?').bind(accountId),
  ]

  for (const r of reminders) {
    const times = Array.isArray(r?.times)
      ? r.times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)).slice(0, 24)
      : []
    if (!r?.id || !r?.name || times.length === 0) continue
    statements.push(
      env.DB.prepare(
        `INSERT INTO reminders (id, account_id, name, slots, target, tz_offset, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        String(r.id).slice(0, 64),
        accountId,
        String(r.name).slice(0, 80),
        JSON.stringify(times),
        Math.max(1, Math.min(20, Number(r.target) || 1)),
        offset,
        nowIso(),
      ),
    )
  }

  await env.DB.batch(statements)
  return json({ ok: true, stored: statements.length - 1 })
}

/** Deletes the account and everything attached to it. */
async function deleteAccount(accountId, env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sends WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM reminders WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM devices WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(accountId),
  ])
  return json({ ok: true })
}

// --- the scheduled sender ---------------------------------------------------

/** The user's local day and minute-of-day, given their UTC offset. */
function localNow(tzOffsetMinutes, at = new Date()) {
  const shifted = new Date(at.getTime() + tzOffsetMinutes * 60000)
  const pad = (n) => String(n).padStart(2, '0')
  return {
    day: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  }
}

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Runs every minute. Sends any reminder whose slot has just come round and has
 * not already been sent today.
 *
 * A slot is considered due within a small window rather than on the exact
 * minute, so a late or skipped cron run still delivers instead of silently
 * dropping the reminder.
 */
export async function runSchedule(env, at = new Date()) {
  const GRACE_MINUTES = 5
  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  }
  if (!vapid.publicKey || !vapid.privateKey) return { sent: 0, skipped: 'no VAPID keys' }

  const { results: rows = [] } = await env.DB.prepare(
    `SELECT r.id AS habit_id, r.account_id, r.name, r.slots, r.target, r.tz_offset
     FROM reminders r
     WHERE EXISTS (SELECT 1 FROM devices d WHERE d.account_id = r.account_id)`,
  ).all()

  let sent = 0
  for (const row of rows) {
    const { day, minutes } = localNow(row.tz_offset, at)
    let slots
    try {
      slots = JSON.parse(row.slots)
    } catch {
      continue
    }

    for (const [index, time] of slots.entries()) {
      const due = toMinutes(time)
      if (minutes < due || minutes > due + GRACE_MINUTES) continue

      // Claim the slot first. The primary key makes this the lock: if another
      // run already inserted it, this one does nothing and no duplicate is sent.
      const claim = await env.DB.prepare(
        'INSERT OR IGNORE INTO sends (account_id, habit_id, day, slot, sent_at) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(row.account_id, row.habit_id, day, index, nowIso())
        .run()
      if (!claim.meta?.changes) continue

      const { results: devices = [] } = await env.DB.prepare(
        'SELECT id, endpoint, p256dh, auth FROM devices WHERE account_id = ?',
      )
        .bind(row.account_id)
        .all()

      const payload = JSON.stringify({
        title: row.target > 1 ? `${row.name} — ${index + 1} of ${row.target}` : `Time for: ${row.name}`,
        body: 'Open Consistency and log it.',
        tag: `consistency-${row.habit_id}-${index}`,
        habitId: row.habit_id,
      })

      for (const device of devices) {
        try {
          const result = await sendPush(device, payload, vapid)
          if (result.gone) {
            await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(device.id).run()
          } else if (!result.ok) {
            await env.DB.prepare(
              'UPDATE devices SET failures = failures + 1 WHERE id = ?',
            )
              .bind(device.id)
              .run()
          } else {
            sent++
            if (device.failures) {
              await env.DB.prepare('UPDATE devices SET failures = 0 WHERE id = ?')
                .bind(device.id)
                .run()
            }
          }
        } catch {
          // One bad endpoint must not stop the rest of the run.
        }
      }
    }
  }

  // Housekeeping: old send records and expired sessions.
  const cutoff = new Date(at.getTime() - 7 * 864e5).toISOString().slice(0, 10)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sends WHERE day < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()),
  ])

  return { sent }
}

// --- entry point ------------------------------------------------------------

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '')

    const respond = async () => {
      // Public: the key the browser needs to subscribe.
      if (path === '/api/vapid' && request.method === 'GET') {
        return json({ publicKey: env.VAPID_PUBLIC_KEY ?? null })
      }
      if (path === '/api/account' && request.method === 'POST') return createAccount(env)
      if (path === '/api/session' && request.method === 'POST') return createSession(request, env)

      // Everything below needs a session.
      const accountId = await authenticate(request, env)
      if (!accountId) return oops('Sign in again to continue.', 401)

      if (path === '/api/account' && request.method === 'GET') {
        return accountDetails(accountId, env)
      }
      if (path === '/api/account' && request.method === 'DELETE') {
        return deleteAccount(accountId, env)
      }
      if (path === '/api/push' && request.method === 'POST') {
        return subscribe(request, accountId, env)
      }
      if (path === '/api/push' && request.method === 'DELETE') {
        return unsubscribe(request, accountId, env)
      }
      if (path === '/api/reminders' && request.method === 'PUT') {
        return putReminders(request, accountId, env)
      }
      return oops('Not found.', 404)
    }

    try {
      const response = await respond()
      for (const [k, v] of Object.entries(cors)) response.headers.set(k, v)
      return response
    } catch {
      // Never leak an internal error message to the browser.
      return json({ error: 'Something went wrong.' }, 500, cors)
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSchedule(env, new Date(event.scheduledTime)))
  },
}

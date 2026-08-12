-- Consistency: cloud reminders.
--
-- This database holds the minimum needed to send a reminder while the app is
-- closed: who to notify, when, and what the habit is called. Your check-in
-- history, notes and expenses never leave the device — there is no table here
-- for them, deliberately.

-- An account is a random key, not an email and password.
-- Rationale: hashing a low-entropy password properly (600k PBKDF2 rounds)
-- exceeds the Workers free-tier CPU budget per request. A 128-bit random key
-- needs no slow KDF — a single SHA-256 is safe, because there is nothing to
-- brute force. It also means no email provider, and no personal data stored.
CREATE TABLE IF NOT EXISTS accounts (
  id           TEXT PRIMARY KEY,
  key_hash     TEXT NOT NULL UNIQUE,      -- SHA-256 of the account key
  created_at   TEXT NOT NULL,
  last_seen_at TEXT
);

-- One row per browser that has granted notification permission.
CREATE TABLE IF NOT EXISTS devices (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label      TEXT,                        -- e.g. "Chrome on Android"
  endpoint   TEXT NOT NULL UNIQUE,        -- push service URL
  p256dh     TEXT NOT NULL,               -- client public key
  auth       TEXT NOT NULL,               -- client auth secret
  created_at TEXT NOT NULL,
  failures   INTEGER NOT NULL DEFAULT 0   -- consecutive send failures
);

CREATE INDEX IF NOT EXISTS devices_account ON devices(account_id);

-- The reminder schedule, mirrored from the device. `slots` is a JSON array of
-- 'HH:MM' local times; `tz_offset` is the device's minutes-from-UTC so the
-- worker can tell when 08:00 *for that user* actually is.
CREATE TABLE IF NOT EXISTS reminders (
  id          TEXT PRIMARY KEY,           -- habit id, unique per account
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slots       TEXT NOT NULL,
  target      INTEGER NOT NULL DEFAULT 1,
  tz_offset   INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS reminders_account ON reminders(account_id);

-- One row per reminder actually sent, so a slot fires once a day even if the
-- cron runs every minute or retries.
CREATE TABLE IF NOT EXISTS sends (
  account_id TEXT NOT NULL,
  habit_id   TEXT NOT NULL,
  day        TEXT NOT NULL,               -- the user's local YYYY-MM-DD
  slot       INTEGER NOT NULL,
  sent_at    TEXT NOT NULL,
  PRIMARY KEY (account_id, habit_id, day, slot)
);

-- Sessions are short-lived bearer tokens; the account key is never sent again
-- after the first exchange.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);

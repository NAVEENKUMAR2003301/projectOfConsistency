# Cloud reminders

A small Cloudflare Worker that sends a push notification at your reminder times
**even when Consistency is closed**. Without it the app still works completely —
reminders just only arrive while a tab is open.

Runs entirely on Cloudflare's free plan: Workers (100k requests/day), D1
(5 GB), and Cron Triggers at one-minute granularity. No card required, and
nothing sleeps.

## What it stores

Only what is needed to send a notification:

| Stored | Not stored |
|---|---|
| A random account key (hashed) | Your name, email, or any password |
| Habit **names** and reminder **times** | Check-in history, streaks |
| Push endpoints for your devices | Notes, expenses, amounts |

Your habit history, notes and spending never leave the device. The schema has
no table for them, and a test asserts it stays that way.

## Setup

You need a free Cloudflare account. From this `server/` folder:

```bash
npm install
npx wrangler login
```

**1. Create the database**

```bash
npx wrangler d1 create consistency
```

Copy the printed `database_id` into `wrangler.toml`.

**2. Create the tables**

```bash
npm run db:remote
```

**3. Generate push keys**

```bash
npm run keys
```

This prints a VAPID key pair. Store both as secrets:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

**4. Set your origins**

In `wrangler.toml`, set `ALLOWED_ORIGIN` to your deployed site (comma-separated
if you want localhost too), and `VAPID_SUBJECT` to a `mailto:` address you own —
push services use it to contact you if something misbehaves.

```toml
ALLOWED_ORIGIN = "https://your-app.vercel.app,http://localhost:5173"
VAPID_SUBJECT = "mailto:you@example.com"
```

**5. Deploy**

```bash
npm run deploy
```

**6. Point the web app at it**

In the Vercel project, add an environment variable:

```
VITE_API_URL = https://consistency-reminders.<your-subdomain>.workers.dev
```

Redeploy the site. The **Data** tab will now show *Reminders while the app is
closed*. Without this variable the panel explains it is not set up and nothing
else changes.

## How a reminder gets sent

1. You set a time on a habit, sign in, and tap **Enable on this device**.
2. The browser creates a push subscription; the worker stores its endpoint.
3. The app uploads habit names, times and your UTC offset — nothing else.
4. The cron runs every minute. For each reminder it works out the user's local
   time, and if a slot has just come round it claims that slot with an
   `INSERT OR IGNORE` and sends.

The claim is what stops duplicates: the `sends` table's primary key is
`(account_id, habit_id, day, slot)`, so a retry or an overlapping run inserts
nothing and sends nothing.

A slot is treated as due for **five minutes** after its time, so a late or
skipped cron run still delivers rather than silently dropping the reminder.

## Accounts are a key, not a password

Signing in uses a random 128-bit key like `K7M2P-QR4TX-...`, not an email and
password. Three reasons:

- Hashing a password properly needs ~600k PBKDF2 rounds, which **exceeds the
  Workers free-tier CPU budget** for a single request. A weak hash would be
  worse than no password at all.
- A random 128-bit key needs no slow hash — there is nothing to brute force, so
  a single SHA-256 is sufficient.
- No email means no email provider to pay for, and no personal data to store.

The trade-off is real and the app says so plainly: **lose the key and the
account is unrecoverable.** It is shown once on creation, with a copy button.
Your habits are unaffected either way — they live on your device.

## Cost and limits

| | Free plan |
|---|---|
| Worker requests | 100,000/day |
| Cron invocations | every minute, unlimited |
| D1 storage | 5 GB |
| D1 reads | 5 million/day |

A single user costs roughly 1,440 cron runs a day plus a handful of API calls —
comfortably inside the free tier.

## Local development

```bash
npm run db:local     # create tables in the local D1
npm run dev          # http://localhost:8787
```

Set `VITE_API_URL=http://localhost:8787` in `Consistency/.env.local`.

Cron does not fire automatically in `wrangler dev`; trigger it by hand:

```bash
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

## Deleting everything

The **Data** tab has *Delete this account and everything on the server*. It
removes the account, its devices, reminders and send history in one transaction.

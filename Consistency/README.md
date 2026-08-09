# Consistency

A habit tracker built to fight the real failure mode: not knowing what to do, but
doing it in bursts. Every check-in is gated behind a five-second puzzle, then
rewarded — so logging a day is a small moment of attention rather than a reflex tap.

Everything is stored in your browser. No account, no server, no analytics.

## Features

- **Habits** — create, edit, delete; your own names, icons and colours (nothing preset)
- **Puzzle check-in** — quick maths, sequences, unscrambles, odd-one-out, counting
- **Streaks & badges** — current/best streaks, milestones at 3 / 7 / 14 / 30 / 100 / 365 days
- **Calendar** — monthly heatmap with five intensity levels; tap a day for detail
- **Stats** — 7- and 30-day completion rates, 14-day chart, per-habit ranking
- **Notes** — write your plan, shown back as handwriting on ruled paper
- **Backups** — export/import as Excel (`.xlsx`) or JSON, with merge or replace
- **Light / dark / system** theme, and a mobile bottom nav

## Running locally

Requires **Node 20.19+**.

```bash
cd Consistency
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run lint     # eslint
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

## Deploying to Vercel

The app lives in the `Consistency/` subdirectory, and [`vercel.json`](../vercel.json)
at the **repo root** already handles that — install, build, output directory,
caching and security headers. There is nothing to configure in the dashboard.

1. Push to GitHub (this repo is already wired to `origin`):
   ```bash
   git add -A
   git commit -m "Deploy setup"
   git push
   ```
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Leave every setting at its default — `vercel.json` supplies them.
4. Click **Deploy**.

Pushes to `main` become production deploys; every other branch and PR gets its own
preview URL.

### Deploying from the CLI instead

```bash
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production deploy
```

Run it from the **repo root**, not from `Consistency/` — the config lives at the root.

### If the build fails with "no package.json found"

Vercel is looking in the wrong folder. Either keep `vercel.json` at the repo root
(the default here), or switch to the dashboard approach instead:

- Project → Settings → General → **Root Directory** → `Consistency`
- Then move `vercel.json` into `Consistency/` and delete the
  `installCommand` / `buildCommand` / `outputDirectory` keys, so Vercel's Vite
  preset takes over.

Do one or the other, not both.

## What the deploy config does

**Caching.** Hashed files under `/assets/*` are immutable and cached for a year;
`index.html`, the manifest and `theme-init.js` are revalidated on every request, so
a new deploy is picked up immediately.

**Security headers.** A strict Content-Security-Policy plus `nosniff`,
`Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, a restrictive
`Permissions-Policy` and HSTS. Two entries in the CSP are load-bearing and should
not be trimmed:

- `worker-src 'self' blob:` — the `.xlsx` reader parses in a worker created from a
  blob URL. Remove this and **Excel import silently fails**.
- `style-src 'unsafe-inline'` — React writes inline `style` attributes for progress
  bars, the confetti burst and the page gradient.

`script-src` is a strict `'self'` with no `'unsafe-inline'`. That is why the theme
bootstrap lives in [`public/theme-init.js`](public/theme-init.js) rather than an
inline `<script>` — it must run before first paint to prevent a light/dark flash,
and an external same-origin file keeps the policy strict.

**No SPA rewrite.** Navigation is state-based (tabs), not routed, so unknown paths
should genuinely 404. If you later add a router, add this to `vercel.json`:

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

## Your data

Stored in `localStorage` under `consistency.habits.v1`, `consistency.notes.v1`,
`consistency.theme.v1` and `consistency.backup-meta.v1` — on your device only.

Clearing site data wipes it, and Safari may evict it after ~7 days without a visit.
The **Data** tab exports a backup for exactly that reason, and nags after 14 days
without one. Installing to the home screen exempts the app from Safari's eviction.

Storage is capped near 5 MB per origin, which is thousands of days of habits and
notes. The Data tab shows current usage.

## Credits

Created by **Naveenkumar V**.

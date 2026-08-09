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

The app lives in the `Consistency/` subdirectory, so Vercel's **Root Directory**
must point at it. [`vercel.json`](vercel.json) sits in this folder and supplies
everything else — install, build, output directory, caching and security headers.

1. Push to GitHub (this repo is already wired to `origin`):
   ```bash
   git add -A
   git commit -m "Deploy setup"
   git push
   ```
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Set **Root Directory** to `Consistency`. Vercel usually detects this during
   import; confirm it rather than assuming.
   (Existing project: Settings → General → Root Directory.)
4. Leave everything else at its default and click **Deploy**.

Pushes to `main` become production deploys; every other branch and PR gets its own
preview URL.

### Deploying from the CLI instead

```bash
cd Consistency
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production deploy
```

Run it from `Consistency/` — the config lives here, next to `package.json`.

### Why the commands have no paths in them

Vercel runs the build with the **Root Directory as the working directory**, so the
commands are plain `npm ci` and `npm run build`, and `outputDirectory` is just
`dist`. Two path tricks that look right and both fail:

- `cd Consistency && npm ci` → `cd: Consistency: No such file or directory`, because
  the shell is already inside it.
- `npm --prefix Consistency ci` → `--prefix` changes where packages are *installed*
  while npm still reads `package.json` from the working directory, so it fails with
  `EUSAGE ... can only install with an existing package-lock.json` on the npm
  version Vercel uses.

If you ever move `vercel.json` back to the repo root, the Root Directory must be
cleared and every path in it re-prefixed with `Consistency/`. Keeping the config
beside `package.json` avoids the whole question.

### The Node version warning

The build log shows:

> Detected `"engines": { "node": ">=20.19" }` … will automatically upgrade when a
> new major Node.js version is released.

This is informational and the build proceeds. `>=20.19` is the true minimum (Vite 8
requires it). If you would rather pin the build to one major for reproducibility,
change `engines.node` in `Consistency/package.json` to e.g. `"22.x"` — but note
that a newer local Node will then print `EBADENGINE` warnings when you install.

### If the build fails with "no package.json found"

Root Directory is not set to `Consistency` — Vercel is looking at the repo root,
which has no `package.json`. Fix it in Settings → General → **Root Directory**.

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

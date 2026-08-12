import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Deploy-config guards. These check the things that only break AFTER a deploy:
// a CSP that blocks the app's own code, a wrong output directory, or an inline
// script that the policy forbids.
import { existsSync, readFileSync } from 'node:fs'

const ROOT = APP_DIR + "/../"
const APP = ROOT + 'Consistency/'

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// ---------- vercel.json ----------
// Vercel's Root Directory is set to Consistency/, so the config must live there
// and every path in it is relative to that directory — not to the repo root.
check('vercel.json lives beside the app', existsSync(APP + 'vercel.json'))
check(
  'no stale config at the repo root',
  !existsSync(ROOT + 'vercel.json'),
  'two configs would be ambiguous',
)
const vercel = JSON.parse(readFileSync(APP + 'vercel.json', 'utf8'))

// Vercel validates vercel.json against a closed schema and rejects the whole
// deploy on any unknown top-level key — including comment-style ones. `$schema`
// is the only `$`-prefixed key it accepts.
const ALLOWED_TOP_LEVEL = new Set([
  '$schema', 'buildCommand', 'cleanUrls', 'crons', 'devCommand', 'framework',
  'functions', 'git', 'headers', 'ignoreCommand', 'images', 'installCommand',
  'outputDirectory', 'public', 'redirects', 'regions', 'rewrites', 'trailingSlash',
])
for (const key of Object.keys(vercel)) {
  check(`top-level key "${key}" is valid for vercel.json`, ALLOWED_TOP_LEVEL.has(key))
}
check(
  'no comment-style keys (vercel rejects them)',
  !Object.keys(vercel).some((k) => k.startsWith('$') && k !== '$schema'),
)

// Commands run with Consistency/ as the working directory already, so any path
// juggling here is wrong: `cd Consistency` fails ("No such file or directory")
// and `npm --prefix` reads package.json from the wrong place on some npm
// versions. Plain commands are the only correct form.
for (const [name, command] of [
  ['installCommand', vercel.installCommand],
  ['buildCommand', vercel.buildCommand],
]) {
  check(`${name} does not cd (already in the app dir)`, !command.includes('cd '), command)
  check(`${name} avoids version-dependent --prefix`, !command.includes('--prefix'), command)
  check(`${name} does not reference the subdir by name`, !command.includes('Consistency'), command)
}
check('install uses ci for reproducibility', vercel.installCommand === 'npm ci')
check('build runs the build script', vercel.buildCommand === 'npm run build')
// Relative to the Root Directory, so plain "dist".
check('output dir is relative to the app', vercel.outputDirectory === 'dist')
check('framework preset matches the tooling', vercel.framework === 'vite')

// The output directory must actually exist after a build.
check('built output directory exists', existsSync(APP + 'dist/index.html'))

// ---------- headers ----------
const headerFor = (source) => vercel.headers.find((h) => h.source === source)
const valueOf = (source, key) =>
  headerFor(source)?.headers.find((h) => h.key === key)?.value ?? ''

const csp = valueOf('/(.*)', 'Content-Security-Policy')
check('CSP present', csp.length > 0)

// Load-bearing: the .xlsx reader parses inside a blob-URL worker.
check('CSP allows blob workers (xlsx import)', /worker-src[^;]*blob:/.test(csp), csp)
// React writes inline style attributes for bars, confetti and the page gradient.
check('CSP allows inline styles', /style-src[^;]*'unsafe-inline'/.test(csp))
// Scripts must stay strict — that is why theme-init is an external file.
check('CSP script-src is self', /script-src 'self'/.test(csp))
check('CSP forbids inline scripts', !/script-src[^;]*'unsafe-inline'/.test(csp))
check('CSP self-hosted fonts allowed', /font-src[^;]*'self'/.test(csp))
// Vercel's Deployment Protection bounces the manifest request through
// vercel.com/sso-api on protected preview URLs. Without this the console fills
// with manifest-src violations on every preview deploy.
check('CSP allows the Vercel SSO manifest redirect', /manifest-src[^;]*https:\/\/vercel\.com/.test(csp))
// That allowance must be scoped to manifests only — never widened to scripts.
check('vercel.com is not allowed to serve scripts', !/script-src[^;]*vercel\.com/.test(csp))
check('vercel.com is not allowed as a frame', !csp.includes('frame-src'))
check('CSP blocks framing', /frame-ancestors 'none'/.test(csp))
check('CSP blocks objects', /object-src 'none'/.test(csp))

for (const [key, expect] of [
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'no-referrer'],
  ['X-Frame-Options', 'DENY'],
]) {
  check(`${key} set`, valueOf('/(.*)', key) === expect, valueOf('/(.*)', key))
}
check('HSTS set', valueOf('/(.*)', 'Strict-Transport-Security').includes('max-age='))

// ---------- caching ----------
const assetCache = valueOf('/assets/(.*)', 'Cache-Control')
check('hashed assets cached immutably', assetCache.includes('immutable'), assetCache)
check('hashed assets cached a year', assetCache.includes('31536000'))
// cleanUrls serves the document at "/", so a rule for "/index.html" alone would
// never match the page people actually load.
for (const path of ['/', '/index.html', '/theme-init.js', '/manifest.webmanifest']) {
  const value = valueOf(path, 'Cache-Control')
  check(`${path} revalidates`, value.includes('must-revalidate'), value)
}

// ---------- the CSP must match what the built HTML actually does ----------
const builtHtml = readFileSync(APP + 'dist/index.html', 'utf8')
const inlineScripts = builtHtml.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) ?? []
check(
  'built HTML has no inline script (CSP would block it)',
  inlineScripts.length === 0,
  JSON.stringify(inlineScripts),
)
check('theme bootstrap is external', builtHtml.includes('src="/theme-init.js"'))

// theme-init.js runs before any module loads, so it cannot import the key and
// must hardcode it. That is the one unavoidable duplicate — this asserts the
// two never drift, which would leave the pre-paint script reading a key
// nothing writes and reintroduce the light/dark flash.
const themeKey = readApp('src', 'lib', 'storage.js').match(/THEME_KEY = '([^']+)'/)?.[1]
const bootstrapKey = readApp('public', 'theme-init.js').match(/getItem\('([^']+)'\)/)?.[1]
check('storage defines the theme key', Boolean(themeKey), String(themeKey))
check(
  'the pre-paint script uses the same key',
  themeKey === bootstrapKey,
  `storage:${themeKey} bootstrap:${bootstrapKey}`,
)
// And nothing else should be declaring it a third time.
const themeKeyCopies = readApp('src', 'lib', 'useTheme.js').match(/consistency\.theme/g) ?? []
check('useTheme imports rather than repeats it', themeKeyCopies.length === 0)
check('theme bootstrap is not deferred', !/theme-init\.js"\s+(defer|async)/.test(builtHtml))
check('theme bootstrap shipped to dist', existsSync(APP + 'dist/theme-init.js'))
check('favicon shipped to dist', existsSync(APP + 'dist/favicon.svg'))
check('manifest shipped to dist', existsSync(APP + 'dist/manifest.webmanifest'))

// No external origins anywhere, or `default-src 'self'` would break them.
check('no external script/style hosts in HTML', !/(src|href)="https?:\/\//.test(builtHtml))

// ---------- lockfile must be in sync or `npm ci` fails the build ----------
const pkg = JSON.parse(readFileSync(APP + 'package.json', 'utf8'))
const lock = JSON.parse(readFileSync(APP + 'package-lock.json', 'utf8'))
check('lockfile exists for npm ci', Boolean(lock.lockfileVersion))
check('lock version matches package.json', lock.version === pkg.version, `${lock.version} vs ${pkg.version}`)
check(
  'lock root entry matches package.json',
  lock.packages['']?.version === pkg.version,
  `${lock.packages['']?.version} vs ${pkg.version}`,
)
// Vercel warns on an open-ended engines range ("will automatically upgrade when
// a new major Node.js version is released"), and a pinned major makes every
// local install on a newer Node print EBADENGINE. Omitting the field is quiet in
// both places; Vercel then uses the project's configured Node version.
const engine = pkg.engines?.node
check(
  'engines.node is absent or pinned, never an open range',
  engine === undefined || !/[><]=?/.test(engine),
  JSON.stringify(pkg.engines),
)
// The requirement still has to be written down somewhere a human will read.
const readme = readFileSync(APP + 'README.md', 'utf8')
check('README states the Node requirement', /Node\s*20\.19/.test(readme))
// Every runtime dependency must be in `dependencies`, not `devDependencies`.
for (const dep of ['react', 'react-dom', 'lucide-react', 'read-excel-file', 'write-excel-file', '@fontsource/caveat']) {
  check(`${dep} is a runtime dependency`, Boolean(pkg.dependencies?.[dep]))
}

// ---------- dist must not be committed ----------
const ignore = readFileSync(APP + '.gitignore', 'utf8')
check('dist is gitignored', /^dist$/m.test(ignore))
check('node_modules is gitignored', /^node_modules$/m.test(ignore))

console.log(fails === 0 ? '\nALL DEPLOY CHECKS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Paths are derived from this file's own location so the suite runs on any
// machine and from any working directory.
export const TEST_DIR = dirname(fileURLToPath(import.meta.url))
export const APP_DIR = join(TEST_DIR, '..')

export const appPath = (...parts) => join(APP_DIR, ...parts)
export const readApp = (...parts) => readFileSync(appPath(...parts), 'utf8')

/** The pure library bundle, built by run.mjs before the suites execute. */
export const loadLibs = () =>
  import(pathToFileURL(appPath('test', '.build', 'libs.js')).href)

/**
 * The component bundle, rendered server-side. `render()` returns the markup of
 * every component against ordinary, legacy and deliberately broken data — a
 * component that throws in a browser throws here too.
 */
export const loadUI = () =>
  import(pathToFileURL(appPath('test', '.build-ui', 'ui.js')).href)

/** Markup reduced to its visible words, so assertions read like the screen. */
export const visibleText = (html) =>
  String(html)
    .split('<!-- -->')
    .join('')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

/** The production stylesheet, for checks that must see the compiled output. */
export function readBuiltCss() {
  const dir = appPath('dist', 'assets')
  const file = readdirSync(dir).find((f) => f.endsWith('.css'))
  if (!file) throw new Error('No built CSS found — run `npm run build` first.')
  return readFileSync(join(dir, file), 'utf8')
}

/** Every built JS chunk concatenated, for "did this reach the bundle" checks. */
export function readBuiltJs() {
  const dir = appPath('dist', 'assets')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n')
}

/** Minimal assertion helpers, shared so every suite reports the same way. */
export function createChecker() {
  const failures = []
  const check = (name, condition, extra = '') => {
    if (!condition) failures.push(`${name} ${extra}`.trim())
  }
  const done = (label) => {
    for (const failure of failures) console.log(`FAIL  ${failure}`)
    console.log(failures.length === 0 ? `PASS  ${label}` : `\n${failures.length} FAILURES`)
    process.exit(failures.length === 0 ? 0 : 1)
  }
  return { check, done, failures }
}

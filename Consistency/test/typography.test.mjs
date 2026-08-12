import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Typography checks. San Francisco cannot be downloaded — it is only reachable
// through platform keywords, so getting the order wrong silently falls back to
// Helvetica or Arial and the app stops looking native.
import { readFileSync, readdirSync } from 'node:fs'

const APP = APP_DIR + "/"
const cssFile = readdirSync(APP + 'dist/assets').find((f) => f.endsWith('.css'))
const css = readFileSync(APP + 'dist/assets/' + cssFile, 'utf8')
const src = readFileSync(APP + 'src/index.css', 'utf8')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const stack = css.match(/--font-sans:([^;]*)/)?.[1] ?? ''
check('font stack is defined', stack.length > 0)

// ---------- the Apple keywords, in the order that works ----------
const at = (name) => stack.indexOf(name)
check('-apple-system present', at('-apple-system') > -1, 'Safari would not reach SF')
check('BlinkMacSystemFont present', at('BlinkMacSystemFont') > -1, 'Chrome on macOS would not reach SF')
check(
  '-apple-system comes first',
  at('-apple-system') === Math.min(...['-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'Arial'].map(at).filter((i) => i > -1)),
  stack,
)
check(
  'Blink keyword precedes the generic fallbacks',
  at('BlinkMacSystemFont') < at('system-ui'),
  stack,
)
// Ordering that would defeat the point.
check('no webfont imitation ahead of SF', !/Inter|Poppins|Nunito/i.test(stack), stack)
check('Arial is the last resort, not an early pick', at('Arial') > at('system-ui'), stack)
check('ends with a generic family', /sans-serif\s*$/.test(stack.trim()), stack)

// ---------- the phantom is gone ----------
check('Inter no longer referenced', !css.includes('Inter'), 'a font that was never loaded')

// ---------- rendering hints Apple UIs rely on ----------
check('antialiasing on', css.includes('-webkit-font-smoothing:antialiased'))
check(
  'grayscale smoothing on macOS',
  /-moz-osx-font-smoothing:\s*grayscale/.test(css),
  'SF renders heavier than native without this',
)
check('optical sizing enabled', /font-optical-sizing:\s*auto/.test(css))
check('no synthesised bold or italic', /font-synthesis:\s*none/.test(css))

// ---------- the stack is actually applied ----------
check('body uses the stack', /body\{[^}]*font-family:var\(--font-sans\)/.test(css), 'declared but unused')

// ---------- handwriting is untouched ----------
check('note font still Caveat', /--font-hand:[^;]*Caveat/.test(css))
check('Caveat is still bundled', readdirSync(APP + 'dist/assets').some((f) => f.startsWith('caveat')))

// ---------- figures that update use fixed-width digits ----------
check('tabular class exists', /\.tabular\{[^}]*tabular-nums/.test(css))
const uses = readdirSync(APP + 'src/components')
  .filter((f) => f.endsWith('.jsx'))
  .filter((f) => readFileSync(APP + 'src/components/' + f, 'utf8').includes('tabular'))
check('applied across the counters', uses.length >= 4, uses.join(', '))
check('applied in App', readFileSync(APP + 'src/App.jsx', 'utf8').includes('tabular'))

// ---------- display type is tightened, body text is not ----------
check('headings tightened', /h1,\s*h2\s*\{[\s\S]{0,80}letter-spacing/.test(src), 'display type reads loose at 30px+')
check(
  'body text left at its natural spacing',
  !/^body\s*\{[^}]*letter-spacing/m.test(src),
  'tightening body text hurts readability',
)

console.log(fails === 0 ? '\nTYPOGRAPHY OK' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

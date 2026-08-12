import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Style-system checks. A missing CSS variable or an unemitted class fails
// silently — the page just renders slightly wrong, and no test would notice.
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

// ---------- shared classes must not fight Tailwind's positioning ----------
// index.css is UNLAYERED, so it outranks Tailwind's layered utilities on a
// specificity tie. A `position` in .glass silently overrode `fixed` and left
// the mobile nav scrolling with the page.
const glassRule = css.match(/\.glass\{[^}]*\}/)?.[0] ?? ''
check('.glass rule found in bundle', glassRule.length > 0)
check(
  '.glass does not set position',
  !/position\s*:/.test(glassRule),
  `would override .fixed/.sticky — ${glassRule}`,
)
check(
  '.glass has no positioned pseudo-element',
  !src.includes('.glass::before'),
  'a ::before needs a containing block, which reintroduces the conflict',
)
check('top highlight kept as an inset shadow', /inset 0 1px 0 0 var\(--glass-highlight\)/.test(src))

// Any unlayered rule that sets `position` is a latent version of this bug.
const unlayered = src.slice(src.indexOf('.glass {'))
for (const rule of unlayered.match(/\.[a-z-]+\s*\{[^}]*\}/g) ?? []) {
  const name = rule.match(/^\.[a-z-]+/)[0]
  // .ambient is meant to be fixed and is never combined with a utility.
  if (name === '.ambient') continue
  check(
    `${name} does not set position`,
    !/position\s*:/.test(rule),
    'unlayered position overrides Tailwind utilities',
  )
}

// ---------- the glass system reached the built stylesheet ----------
check('.glass emitted', css.includes('.glass'))
check('backdrop-filter present', css.includes('backdrop-filter'))
check('safari prefix present', css.includes('-webkit-backdrop-filter'), 'iOS needs the prefix')
check('glass highlight edge', css.includes('--glass-highlight'))
check('ambient layer emitted', css.includes('.ambient'))
check('hover variant emitted', css.includes('.glass-hover'))
// Without a fallback, browsers lacking backdrop-filter show unreadable panels.
// The test must cover the prefixed form too — Safari supported only
// -webkit-backdrop-filter for years, and checking the unprefixed property
// alone would wrongly send those browsers down the fallback path.
// Read the condition as text rather than pattern-matching nested parens.
const supportsLine = src.split('\n').find((l) => l.includes('@supports')) ?? ''
check('no-backdrop-filter fallback exists', supportsLine.includes('@supports'), 'none found')
check('fallback is a negative test', supportsLine.includes('not '), supportsLine.trim())
check('condition covers the plain property', /\(backdrop-filter/.test(supportsLine), supportsLine.trim())
check(
  'condition covers the -webkit- property',
  supportsLine.includes('-webkit-backdrop-filter'),
  'a prefixed-only browser (older Safari) would be misdetected',
)
const afterSupports = src.slice(src.indexOf('@supports'), src.indexOf('@supports') + 260)
check('fallback paints a solid surface', afterSupports.includes('var(--color-card)'), afterSupports)

// ---------- every glass token is defined in BOTH themes ----------
const lightBlock = src.slice(src.indexOf("[data-theme='light']"))
for (const token of [
  '--glass-bg',
  '--glass-hover',
  '--glass-border',
  '--glass-highlight',
  '--glass-shadow',
  '--orb-1',
  '--orb-2',
]) {
  check(`dark defines ${token}`, src.includes(`${token}:`))
  check(`light overrides ${token}`, lightBlock.includes(`${token}:`))
}

// ---------- animations ----------
for (const anim of ['tab-in', 'count-up', 'rise', 'pop', 'shake', 'confetti']) {
  check(`@keyframes ${anim}`, css.includes(anim), 'missing from the bundle')
}
// Motion must be switchable off for people who ask the OS for less of it.
check('reduced-motion honoured', css.includes('prefers-reduced-motion'))

// ---------- keyboard accessibility ----------
check('focus-visible ring defined', src.includes(':focus-visible'))
check('focus ring is visible, not removed', !/:focus-visible[^{]*\{[^}]*outline:\s*none/.test(src))

// ---------- no hardcoded theme colours crept back in ----------
const files = readdirSync(APP + 'src/components').filter((f) => f.endsWith('.jsx'))
for (const file of files) {
  const body = readFileSync(APP + 'src/components/' + file, 'utf8')
  for (const bad of ['bg-[#', 'text-white/', 'bg-white/[']) {
    check(`${file} has no hardcoded ${bad}`, !body.includes(bad))
  }
}

// ---------- glass is not applied to scrolling list rows ----------
// Blur composites per frame; putting it on every row of a long list is what
// makes a page stutter on a phone.
const money = readFileSync(APP + 'src/components/MoneyTab.jsx', 'utf8')
const rowLine = money.split('\n').find((l) => l.includes('flex items-center gap-3 bg-card px-4'))
check('expense rows stay flat', Boolean(rowLine) && !rowLine.includes('glass'), rowLine ?? '')

// ---------- deletes are consistently two-step and self-disarming ----------
for (const file of ['HabitCard.jsx', 'NoteCard.jsx', 'MoneyTab.jsx']) {
  const body = readFileSync(APP + 'src/components/' + file, 'utf8')
  check(`${file} confirms before deleting`, body.includes('Sure?'))
  check(`${file} disarms the confirm`, body.includes('setTimeout'), 'armed delete never expires')
}
check('category delete confirms too', money.includes('confirmCategory'))

// ---------- dead code ----------
const moneyLib = readFileSync(APP + 'src/lib/money.js', 'utf8')
check('unused dailySeries removed', !moneyLib.includes('dailySeries'))

console.log(fails === 0 ? '\nALL STYLE CHECKS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

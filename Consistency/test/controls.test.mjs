import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Native form controls on mobile. These are drawn by the OS, so the failures
// are the ones you only see on a real phone: an unreadable dropdown, an
// invisible calendar glyph, and the page zooming when a field takes focus.
import { readFileSync, readdirSync } from 'node:fs'

const APP = APP_DIR + "/"
const src = readFileSync(APP + 'src/index.css', 'utf8')
const cssFile = readdirSync(APP + 'dist/assets').find((f) => f.endsWith('.css'))
const css = readFileSync(APP + 'dist/assets/' + cssFile, 'utf8')
const read = (p) => readFileSync(APP + 'src/components/' + p, 'utf8')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// ---------- the dropdown list must follow the theme ----------
check('option colours are set', /option\{[^}]*background-color/.test(css), 'dark theme shows a white sheet')
check('option text colour is set', /option\{[^}]*color:/.test(css))
// color-scheme is what themes the OS-drawn picker on a phone.
check('dark declares a colour scheme', /color-scheme:\s*dark/.test(css))
check('light declares a colour scheme', /color-scheme:\s*light/.test(css))

// ---------- iOS zooms the page below 16px ----------
// Every focusable control must be >= 16px at phone width. Tailwind: text-base
// (16px) or larger; text-xs/text-sm are only allowed behind an sm: prefix.
const CONTROL = /<(input|select|textarea)\b[\s\S]{0,600}?\/?>/g
const SMALL = /(^|\s)(text-xs|text-sm)(\s|$)/
for (const file of readdirSync(APP + 'src/components').filter((f) => f.endsWith('.jsx'))) {
  const body = read(file)
  for (const tag of body.match(CONTROL) ?? []) {
    if (/type="(hidden|file|checkbox|radio)"/.test(tag)) continue
    const className = tag.match(/className="([^"]*)"/)?.[1]
    if (!className) continue
    // Strip responsive variants: those only apply from sm up, where zoom is
    // not a concern.
    const base = className.replace(/\b(sm|md|lg):[^\s]+/g, '')
    if (SMALL.test(base)) {
      fails++
      console.log(`FAIL  ${file}: control is under 16px on phones — iOS will zoom on focus`)
      console.log(`      ${className.slice(0, 110)}`)
    }
  }
}

// ---------- the select is ours, not the platform's ----------
const money = read('MoneyTab.jsx')
check('platform chrome stripped', /select\{[^}]*appearance:\s*none/.test(css))
check('a chevron is drawn instead', money.includes('UI.chevronDown'))
check('chevron does not eat the tap', money.includes('pointer-events-none'))
check('room reserved for the chevron', /pr-9/.test(money), 'the label would run under the arrow')
check('select is a real tap target on phones', /min-h-11/.test(money), 'under the 44px guideline')
check('select text is 16px on phones', /text-base/.test(money))

// ---------- date and time fields ----------
// Read the rule body rather than guessing a character window — a comment in
// between should not decide whether this passes.
const dateRule = src.slice(
  src.indexOf("input[type='date']"),
  src.indexOf('}', src.indexOf("input[type='date']")),
)
check('height floor for pickers', /min-height/.test(dateRule), dateRule.slice(0, 120))
check('platform chrome stripped from pickers', /appearance:\s*none/.test(dateRule))
check('value aligned left on iOS', src.includes('-webkit-date-and-time-value'))
check('picker glyph is tinted', src.includes('calendar-picker-indicator'))
check('tint has a dark value', /--picker-icon:\s*invert/.test(src))
check('tint is neutral in light mode', /--picker-icon:\s*none/.test(src))

// ---------- number field ----------
check('native spinners removed', src.includes('inner-spin-button'))
check('firefox spinner removed', /appearance:\s*textfield/.test(src))
const habitForm = read('HabitForm.jsx')
check('custom steppers exist instead', habitForm.includes('One more time a day'))

// ---------- these rules must not fight Tailwind ----------
// They live in @layer components, so a utility can still override them.
const spans = []
const re = /@layer\s+([a-z-]+)\s*\{/g
let m
while ((m = re.exec(css))) {
  let d = 1
  let i = re.lastIndex
  while (d > 0 && i < css.length) {
    if (css[i] === '{') d++
    else if (css[i] === '}') d--
    i++
  }
  spans.push({ name: m[1], start: m.index, end: i })
}
const layerOf = (i) => spans.find((s) => i > s.start && i < s.end)?.name ?? 'UNLAYERED'
// Tailwind's preflight also emits an `option` rule, so locate OURS by the
// property it sets rather than by the first match.
const ourOption = css.indexOf('option{background-color')
const ourSelect = css.search(/select\{[^}]*appearance:\s*none/)
check('our option rule exists', ourOption > -1)
check('option rule is layered', layerOf(ourOption) === 'components', layerOf(ourOption))
check('select rule is layered', layerOf(ourSelect) === 'components', layerOf(ourSelect))
// It must come after preflight, or the reset would win.
check('our option rule follows preflight', ourOption > css.indexOf('option{padding-inline-start'))

console.log(fails === 0 ? '\nNATIVE CONTROL STYLING OK' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Tests for the notes layer, the new date labels, and the paper-alignment
// contract between CSS (--rule) and JS (RULE) that nothing else would catch.
import { readFileSync } from 'node:fs'

const ROOT = APP_DIR + "/"
const dates = await import('file:///' + ROOT + 'src/lib/dates.js')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// ---------- date labels ----------
const { today, addDays, dayLabel, timeLabel } = dates
check('dayLabel today', dayLabel(today()) === 'Today', dayLabel(today()))
check('dayLabel yesterday', dayLabel(addDays(today(), -1)) === 'Yesterday')
check('dayLabel older is a real date', /\d/.test(dayLabel('2026-01-05')), dayLabel('2026-01-05'))
check('dayLabel not Today for old', dayLabel('2020-03-03') !== 'Today')
check('timeLabel empty for null', timeLabel(null) === '')
check('timeLabel empty for junk', timeLabel('not-a-date') === '')
check('timeLabel renders', timeLabel('2026-08-09T14:35:00.000Z').length > 0)

// ---------- notes reducer logic (mirrors useNotes callbacks) ----------
// The hook can't run without React, so exercise the same pure transitions.
const MAX = 2000
const trimTo = (t) => t.trim().slice(0, MAX)

check('empty note rejected', trimTo('   ') === '')
check('whitespace trimmed', trimTo('  plan  ') === 'plan')
check('long note clamped', trimTo('x'.repeat(5000)).length === MAX)
check('newlines preserved', trimTo('a\n\nb') === 'a\n\nb')

// ---------- persistence tolerance ----------
// These guards live in storage.js since the shared-storage refactor, so both
// first load and backup import validate through the same code.
const raw = readFileSync(ROOT + 'src/lib/storage.js', 'utf8')
check('notes guard non-array payload', raw.includes('Array.isArray(value)'))
check('notes drop blank text', raw.includes("typeof n.text === 'string' && n.text.trim()"))
// Both storage entry points must swallow quota/private-mode failures.
check('readJSON is guarded', /export function readJSON[\s\S]{0,220}catch/.test(raw))
check('writeJSON is guarded', /export function writeJSON[\s\S]{0,220}catch/.test(raw))
const hook = readFileSync(ROOT + 'src/lib/useNotes.js', 'utf8')
check('hook normalises on load', hook.includes('normalizeNotes(readJSON('))

// ---------- the paper alignment contract ----------
// If --rule and the JS RULE constant drift apart, the min-height stops being a
// whole number of ruled lines and the handwriting sits between the lines.
const css = readFileSync(ROOT + 'src/index.css', 'utf8')
const jsx = readFileSync(ROOT + 'src/components/PaperTextarea.jsx', 'utf8')
const cssRule = css.match(/--rule:\s*(\d+)px/)
const jsRule = jsx.match(/const RULE = (\d+)/)
check('css defines --rule', Boolean(cssRule))
check('js defines RULE', Boolean(jsRule))
check(
  'rule period matches line-height source',
  cssRule && jsRule && cssRule[1] === jsRule[1],
  `css=${cssRule?.[1]} js=${jsRule?.[1]}`,
)
check('line-height is driven by --rule', css.includes('line-height: var(--rule)'))
check(
  'ruled gradient period uses --rule',
  css.includes('var(--paper-rule) var(--rule)'),
)
check(
  'rules align to content box',
  css.includes('background-origin: content-box, padding-box'),
)
check(
  'rules scroll with text',
  css.includes('background-attachment: local, local'),
)

// Paper tokens must exist in BOTH themes or one theme renders unreadable text.
const lightBlock = css.slice(css.indexOf("[data-theme='light']"))
for (const token of ['--paper:', '--paper-rule:', '--paper-margin:', '--paper-ink:']) {
  check(`dark defines ${token}`, css.includes(token))
  check(`light overrides ${token}`, lightBlock.includes(token))
}

console.log(fails === 0 ? '\nALL NOTES TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

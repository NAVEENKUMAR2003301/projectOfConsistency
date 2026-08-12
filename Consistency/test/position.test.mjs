import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Resolves the real cascade for the mobile nav's class list, the way a browser
// would: later unlayered rules beat earlier layered ones on a specificity tie.
import { readFileSync, readdirSync } from 'node:fs'

const APP = APP_DIR + "/"
const cssFile = readdirSync(APP + 'dist/assets').find((f) => f.endsWith('.css'))
const css = readFileSync(APP + 'dist/assets/' + cssFile, 'utf8')
const nav = readFileSync(APP + 'src/components/MobileNav.jsx', 'utf8')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// The classes actually on the <nav>.
const classAttr = nav.match(/className="([^"]*fixed[^"]*)"/)?.[1] ?? ''
check('nav declares fixed', classAttr.includes('fixed'), classAttr)
check('nav declares bottom-0', classAttr.includes('bottom-0'))
check('nav declares glass', classAttr.includes('glass'))

// For every class on the nav, find the LAST rule in the bundle that sets
// `position`. Whichever appears last wins the tie — that is the applied value.
const classes = classAttr.split(/\s+/).filter(Boolean)
let winner = null
for (const cls of classes) {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\/:]/g, '\\$&')
  const pattern = new RegExp(`\\.${escaped}\\{[^}]*\\}`, 'g')
  for (const rule of css.match(pattern) ?? []) {
    const position = rule.match(/position:\s*([a-z]+)/)?.[1]
    if (!position) continue
    const at = css.lastIndexOf(rule)
    if (!winner || at > winner.at) winner = { cls, position, at }
  }
}

check('some rule sets position', winner !== null, 'nothing matched')
check(
  'the mobile nav resolves to position:fixed',
  winner?.position === 'fixed',
  `"${winner?.cls}" wins with position:${winner?.position} — the bar would scroll away`,
)
console.log(`      winning rule: .${winner?.cls} -> position:${winner?.position}`)

// The bar is only useful pinned if content clears it.
const app = readFileSync(APP + 'src/App.jsx', 'utf8')
check('content reserves space for the bar', app.includes('pb-28'))
check('desktop drops the reserve', app.includes('sm:pb-10'))
// The desktop tab strip must not leave an empty sticky gap on phones.
const stickyLine = app.split('\n').find((l) => l.includes('sticky top-0'))
check('sticky tab strip is desktop-only', stickyLine?.includes('hidden'), stickyLine ?? '')

console.log(fails === 0 ? '\nMOBILE NAV POSITION OK' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

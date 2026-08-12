import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Mobile layout audit: stacking order, overlap, padding and horizontal
// overflow — the things that make a phone view "not work".
import { readFileSync, readdirSync } from 'node:fs'

const APP = APP_DIR + "/"
const src = (p) => readFileSync(APP + p, 'utf8')
const app = src('src/App.jsx')
const cssFile = readdirSync(APP + 'dist/assets').find((f) => f.endsWith('.css'))
const css = readFileSync(APP + 'dist/assets/' + cssFile, 'utf8')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// ---------- stacking order: nothing important can be buried ----------
const z = {
  ambient: Number(css.match(/\.ambient\{[^}]*z-index:\s*(-?\d+)/)?.[1]),
  content: 10, // .relative.z-10 wrapper
  stickyTabs: 20,
  mobileNav: 30,
  modals: 40,
  toast: 50,
}
check('ambient sits at or above 0', z.ambient >= 0, `z-index:${z.ambient} paints behind ancestor backgrounds`)
check('content is above the ambient layer', z.content > z.ambient)
check('page content declares its own stacking', app.includes('relative z-10'))
// The root must not paint over the ambient layer.
const rootLine = app.split('\n').find((l) => l.includes('relative min-h-full'))
check('root has no opaque background', !/bg-(surface|card|raised)/.test(rootLine ?? ''), rootLine ?? '')
check('body paints the surface instead', /body\{[^}]*background:var\(--color-surface\)/.test(css))

// Ordering that keeps overlays usable.
check('nav above sticky tabs', z.mobileNav > z.stickyTabs)
check('modals above nav', z.modals > z.mobileNav)
check('toast above modals', z.toast > z.modals)
for (const [file, expected] of [
  ['src/components/MobileNav.jsx', 'z-30'],
  ['src/components/PuzzleModal.jsx', 'z-40'],
  ['src/components/Toast.jsx', 'z-50'],
]) {
  check(`${file} uses ${expected}`, src(file).includes(expected))
}

// ---------- no overlap with the fixed bottom bar ----------
// Bar height ≈ py-2.5 (20) + icon 19 + gap 4 + label ~12 ≈ 56px, plus the iOS
// home indicator inset. pb-28 = 112px leaves comfortable clearance.
check('content reserves space for the bar', app.includes('pb-28'))
check('desktop drops that reserve', app.includes('sm:pb-10'))
check('bar clears the home indicator', src('src/components/MobileNav.jsx').includes('safe-area-inset-bottom'))
// The toast must float above the bar, not behind it.
const toast = src('src/components/Toast.jsx')
check('toast clears the bar on phones', toast.includes('bottom-24'))
check('toast sits lower on desktop', toast.includes('sm:bottom-6'))

// ---------- the desktop-only strip must not eat mobile space ----------
const stickyLine = app.split('\n').find((l) => l.includes('sticky top-0'))
check('sticky tab strip is hidden on phones', /\bhidden\b/.test(stickyLine ?? ''), stickyLine ?? '')
check('and shown from sm up', /sm:block/.test(stickyLine ?? ''))

// ---------- horizontal overflow ----------
// Anything wider than the viewport causes the whole page to scroll sideways.
check('body breaks long words', /overflow-wrap:break-word/.test(css))
check('ambient orbs are clipped', /\.ambient\{[^}]*overflow:hidden/.test(css))
// Negative margins must always be paired with padding that cancels them.
for (const file of readdirSync(APP + 'src/components').filter((f) => f.endsWith('.jsx'))) {
  const body = src('src/components/' + file)
  for (const match of body.match(/-mx-\d+/g) ?? []) {
    const pad = match.replace('-mx-', 'px-')
    check(`${file} pairs ${match} with ${pad}`, body.includes(pad), 'unbalanced negative margin overflows')
  }
}
// Wide, fixed-size grids are the other common cause on a 320px screen.
for (const file of ['HabitForm.jsx', 'ExpenseForm.jsx']) {
  const body = src('src/components/' + file)
  if (!body.includes('grid-cols-8')) continue
  check(`${file} icon grid uses a gap that fits`, /grid-cols-8 gap-1\.5/.test(body), 'tighten the gap for 320px')
}

// ---------- responsive coverage ----------
// Every tab surface should adapt, not just shrink.
for (const file of ['MoneyTab.jsx', 'StatsDashboard.jsx', 'CalendarView.jsx', 'DataManager.jsx']) {
  check(`${file} has responsive rules`, /\bsm:/.test(src('src/components/' + file)))
}
// The habit grid drops to 7 columns on phones.
check('14-day grid halves on phones', src('src/components/HabitCard.jsx').includes('hidden sm:flex'))

// ---------- touch targets ----------
const nav = src('src/components/MobileNav.jsx')
check('nav items are full-height columns', nav.includes('flex-1') && nav.includes('py-2.5'))
check('nav gives press feedback', /active:scale/.test(nav))

// ---------- motion is still optional ----------
check('reduced motion respected', css.includes('prefers-reduced-motion'))

console.log(fails === 0 ? '\nMOBILE LAYOUT OK' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Resolves the real cascade the way a browser does — layer order first, then
// document order — for every element that mixes a custom class with Tailwind
// utilities. This is the bug class that broke the mobile nav twice.
import { readFileSync, readdirSync } from 'node:fs'

const APP = APP_DIR + "/"
const cssFile = readdirSync(APP + 'dist/assets').find((f) => f.endsWith('.css'))
const css = readFileSync(APP + 'dist/assets/' + cssFile, 'utf8')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// --- map every @layer block and its byte span -------------------------------
const spans = []
const re = /@layer\s+([a-z-]+)\s*\{/g
let m
while ((m = re.exec(css))) {
  let depth = 1
  let i = re.lastIndex
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') depth--
    i++
  }
  spans.push({ name: m[1], start: m.index, end: i })
}
// Tailwind v4 emits layer blocks rather than an `@layer a, b, c;` statement,
// so precedence follows first appearance in the file.
const layerOrder = spans.map((s) => s.name)
const layerOf = (index) => spans.find((s) => index > s.start && index < s.end)?.name ?? null

check('layers were emitted', layerOrder.length > 0, 'no @layer blocks found')
check('utilities is the last layer', layerOrder.at(-1) === 'utilities', layerOrder.join(' < '))
check(
  'components precedes utilities',
  layerOrder.indexOf('components') !== -1 &&
    layerOrder.indexOf('components') < layerOrder.indexOf('utilities'),
  layerOrder.join(' < '),
)

// --- custom classes must be layered ----------------------------------------
for (const cls of ['.glass', '.glass-hover', '.ambient', '.paper']) {
  const at = css.indexOf(cls.replace('.', '\\.') === cls ? cls + '{' : cls + '{')
  const idx = at >= 0 ? at : css.indexOf(cls)
  check(`${cls} is in a layer`, layerOf(idx) !== null, 'unlayered rules outrank every utility')
  check(`${cls} is in components`, layerOf(idx) === 'components', `found in ${layerOf(idx)}`)
}

/**
 * Resolve which rule wins for a property, given an element's class list.
 * Later layer wins outright; within the same layer, later text wins.
 */
function winner(classes, property) {
  let best = null
  for (const cls of classes) {
    const escaped = cls.replace(/[.*+?^${}()|[\]\\/:]/g, '\\$&')
    const pattern = new RegExp(`\\.${escaped}(?::[a-z-]+)?\\{[^}]*\\}`, 'g')
    for (const rule of css.match(pattern) ?? []) {
      if (!new RegExp(`(^|;|\\{)${property}\\s*:`).test(rule)) continue
      const at = css.lastIndexOf(rule)
      const rank = layerOrder.indexOf(layerOf(at) ?? 'utilities')
      if (!best || rank > best.rank || (rank === best.rank && at > best.at)) {
        best = { cls, rank, at, layer: layerOf(at) }
      }
    }
  }
  return best
}

// --- the real elements, with their real class lists -------------------------
const classesOf = (file, marker) => {
  const body = readFileSync(APP + 'src/components/' + file, 'utf8')
  const line = body.split('\n').find((l) => l.includes(marker))
  return (line?.match(/"([^"]+)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)
}

const navClasses = classesOf('MobileNav.jsx', 'fixed inset-x-0 bottom-0')
check('nav classes found', navClasses.length > 0, JSON.stringify(navClasses))

// The nav pins to the viewport…
const pos = winner(navClasses, 'position')
check('mobile nav resolves to fixed', pos?.cls === 'fixed', `.${pos?.cls} won from @layer ${pos?.layer}`)

// …and its side/bottom borders really are removed, not overridden by .glass.
for (const prop of ['border-inline-start-width', 'border-bottom-width']) {
  const w = winner(navClasses, prop)
  if (!w) continue
  check(
    `nav ${prop} comes from a utility`,
    w.cls !== 'glass',
    `.glass overrode ${prop} — the bar keeps an unwanted edge`,
  )
}

// A glass panel with no competing utility should still get its frosted fill.
const bg = winner(['glass'], 'background')
check('glass still supplies its background', bg?.cls === 'glass', JSON.stringify(bg))

console.log(fails === 0 ? '\nCSS LAYERING OK' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

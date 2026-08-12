import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Fuzz + fixture tests for the pure logic modules.
// Loaded through the bundled harness rather than by direct path, so the
// extensionless imports these modules use resolve the same way Vite resolves
// them in the app.
const { puzzles, dates, encouragement } = await loadLibs()
const { generatePuzzle } = puzzles
const { encouragementFor, ALL_DONE_MESSAGES } = encouragement

let failures = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    failures++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

// ---------- puzzles ----------
console.log('fuzzing puzzles...')
const typeCounts = {}
for (let i = 0; i < 20000; i++) {
  const p = generatePuzzle()
  typeCounts[p.type] = (typeCounts[p.type] || 0) + 1
  check('has type', typeof p.type === 'string' && p.type.length > 0)
  check('has prompt', typeof p.prompt === 'string' && p.prompt.length > 0, p.type)
  check('has hint', typeof p.hint === 'string' && p.hint.length > 0, p.type)
  check('4 options', p.options.length === 4, `${p.type} -> ${JSON.stringify(p.options)}`)
  check('unique options', new Set(p.options).size === 4, `${p.type} -> ${JSON.stringify(p.options)}`)
  check('answer in options', p.options.includes(p.answer), `${p.type} ${p.answer} ${JSON.stringify(p.options)}`)
  check('all options strings', p.options.every((o) => typeof o === 'string'), p.type)
  if (p.type === 'Quick math') {
    check('math answer non-negative', Number(p.answer) >= 0, `${p.prompt} = ${p.answer}`)
  }
}
console.log('  type distribution:', typeCounts)

// ---------- dates ----------
console.log('testing dates...')
const { dayKey, addDays, lastDays, currentStreak, bestStreak, completionRate, today, weekdayLabel } = dates

check('dayKey pads', dayKey(new Date(2026, 0, 5)) === '2026-01-05', dayKey(new Date(2026, 0, 5)))
check('addDays month rollover', addDays('2026-01-31', 1) === '2026-02-01', addDays('2026-01-31', 1))
check('addDays year rollback', addDays('2026-01-01', -1) === '2025-12-31', addDays('2026-01-01', -1))
check('addDays leap year', addDays('2028-02-28', 1) === '2028-02-29', addDays('2028-02-28', 1))
check('lastDays length', lastDays(14).length === 14)
check('lastDays ends today', lastDays(14)[13] === today())
check('lastDays sorted', lastDays(14).every((d, i, a) => i === 0 || addDays(a[i - 1], 1) === d))
check('weekdayLabel', typeof weekdayLabel(today()) === 'string' && weekdayLabel(today()).length === 1)

// DST boundaries (US spring-forward / fall-back) must not skip or repeat a day.
for (const [from, to] of [['2026-03-07', '2026-03-08'], ['2026-03-08', '2026-03-09'], ['2026-11-01', '2026-11-02']]) {
  check(`dst ${from}`, addDays(from, 1) === to, addDays(from, 1))
}

const T = today()
check('empty streak', currentStreak({}) === 0)
check('streak today only', currentStreak({ [T]: true }) === 1)
check('streak 3 ending today', currentStreak({ [T]: true, [addDays(T, -1)]: true, [addDays(T, -2)]: true }) === 3)
check('streak alive from yesterday', currentStreak({ [addDays(T, -1)]: true, [addDays(T, -2)]: true }) === 2)
check('streak dead after 2 misses', currentStreak({ [addDays(T, -2)]: true, [addDays(T, -3)]: true }) === 0)
check('streak ignores gap', currentStreak({ [T]: true, [addDays(T, -2)]: true }) === 1)

check('best empty', bestStreak({}) === 0)
check('best single', bestStreak({ [T]: true }) === 1)
check('best over gap', bestStreak({ '2026-01-01': true, '2026-01-02': true, '2026-01-03': true, '2026-01-09': true }) === 3)
check('best spans month', bestStreak({ '2026-01-30': true, '2026-01-31': true, '2026-02-01': true }) === 3)
check('best ignores false', bestStreak({ '2026-01-01': true, '2026-01-02': false, '2026-01-03': true }) === 1)

check('rate empty', completionRate({}, 30) === 0)
const full = Object.fromEntries(lastDays(30).map((d) => [d, true]))
check('rate full', completionRate(full, 30) === 100, String(completionRate(full, 30)))
const half = Object.fromEntries(lastDays(30).slice(0, 15).map((d) => [d, true]))
check('rate half', completionRate(half, 30) === 50, String(completionRate(half, 30)))
check('rate ignores old days', completionRate({ '2020-01-01': true }, 30) === 0)

// ---------- encouragement ----------
console.log('testing encouragement...')
for (let s = 0; s <= 40; s++) {
  for (const comeback of [true, false]) {
    const m = encouragementFor(s, comeback)
    check(`encouragement ${s}/${comeback}`, typeof m === 'string' && m.length > 0)
  }
}
check('all-done messages', ALL_DONE_MESSAGES.length > 0 && ALL_DONE_MESSAGES.every((m) => m.length > 0))

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)

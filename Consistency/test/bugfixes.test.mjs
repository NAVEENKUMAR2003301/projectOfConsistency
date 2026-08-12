import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Regression tests for four bugs the existing suites did not cover.
import { readFileSync } from 'node:fs'

const APP = APP_DIR + "/"
const { excel, storage, dates, targets } = await loadLibs()

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const T = dates.today()

// ---- BUG 1: `actions` is invalid on a non-persistent Notification ----------
// Chrome throws "Actions are only supported for persistent notifications", and
// the catch swallowed it — so a desktop user with no service worker got no
// notification at all instead of one without the Skip button.
const hook = readFileSync(APP + 'src/lib/useReminders.js', 'utf8')
// Search for the closing catch AFTER the fallback, not the first one in the
// file — getRegistration has its own catch further up.
const fbStart = hook.indexOf('Desktop fallback')
const fallback = hook.slice(fbStart, hook.indexOf('} catch', fbStart))
check('fallback strips actions', /const \{ actions, \.\.\.\w+ \} = options/.test(fallback), fallback)
check('fallback passes the stripped object', /new Notification\(title, (?!options)/.test(fallback), fallback)

// ---- BUG 2: no way back from a mis-tap on a repeating habit ---------------
const card = readFileSync(APP + 'src/components/HabitCard.jsx', 'utf8')
const app = readFileSync(APP + 'src/App.jsx', 'utf8')
check('card offers a single-step undo', card.includes('onUndoOne'))
check('undo appears only once something is logged', /logged > 0 &&/.test(card))
check('it is labelled for screen readers', card.includes('Undo one for'))
check('App wires it to undoOnce', app.includes('onUndoOne={(h) => undoOnce(h.id)}'))
check('undoOnce is no longer dead code', app.includes('undoOnce,'))

// ---- BUG 3: the spreadsheet dropped partial progress ----------------------
const water = {
  id: 'w',
  name: 'Drink water',
  icon: 'droplet',
  color: 'sky',
  target: 8,
  createdAt: null,
  history: { [dates.addDays(T, -1)]: { done: true, at: null } },
  progress: { [T]: 3, [dates.addDays(T, -1)]: 8 },
}
const rows = excel.checkinsToRows([water])
check('Count is a column', excel.CHECKIN_COLUMNS.includes('Count'))
check('a partial day is written out', rows.some((r) => r.Date === T), JSON.stringify(rows))
const todayRow = rows.find((r) => r.Date === T)
check('with its real count', todayRow?.Count === '3', todayRow?.Count)
const doneRow = rows.find((r) => r.Date === dates.addDays(T, -1))
check('a finished day counts as full', doneRow?.Count === '8', doneRow?.Count)

// Round trip: partial stays partial, complete stays complete.
const back = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['w', 'Drink water', 'droplet', 'sky', '8', '', '', ''],
  ]),
  checkinRows: excel.rowsToObjects([excel.CHECKIN_COLUMNS, ...rows.map((r) => CHECKIN_ORDER(r))]),
})
function CHECKIN_ORDER(r) {
  return excel.CHECKIN_COLUMNS.map((c) => r[c])
}
const restored = back.habits[0]
check('partial count survives the round trip', restored.progress[T] === 3, JSON.stringify(restored.progress))
check('partial day is NOT marked complete', !restored.history[T], JSON.stringify(restored.history))
check('the finished day is still complete', Boolean(restored.history[dates.addDays(T, -1)]))
check('so the streak is unaffected', dates.currentStreak(restored.history) >= 1)

// A backup written before repeats existed has no Count column: every row there
// meant a finished day and must still import that way.
const legacy = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['r', 'Read', 'book', 'violet', '1', '', '', ''],
  ]),
  checkinRows: excel.rowsToObjects([
    ['Habit ID', 'Habit', 'Date', 'Time', 'Logged At'],
    ['r', 'Read', T, '', ''],
  ]),
})
check('old backup still marks the day done', Boolean(legacy.habits[0].history[T]), JSON.stringify(legacy.habits[0]))

// A zero or junk count is not an entry at all.
const zero = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['w', 'Water', 'droplet', 'sky', '8', '', '', ''],
  ]),
  checkinRows: excel.rowsToObjects([excel.CHECKIN_COLUMNS, ['w', 'Water', T, '0', '', '']]),
})
check('a zero count stores nothing', !zero.habits[0].progress[T], JSON.stringify(zero.habits[0].progress))
check('and does not complete the day', !zero.habits[0].history[T])

// An over-large count cannot exceed the target.
const over = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['w', 'Water', 'droplet', 'sky', '4', '', '', ''],
  ]),
  checkinRows: excel.rowsToObjects([excel.CHECKIN_COLUMNS, ['w', 'Water', T, '99', '', '']]),
})
check('count clamps to the target', over.habits[0].progress[T] === 4, String(over.habits[0].progress[T]))

// ---- BUG 4: the target ceiling was defined twice ---------------------------
const storageSrc = readFileSync(APP + 'src/lib/storage.js', 'utf8')
const targetsSrc = readFileSync(APP + 'src/lib/targets.js', 'utf8')
const storageMax = storageSrc.match(/MAX_TARGET\s*=\s*(\d+)/)?.[1]
const targetsMax = targetsSrc.match(/MAX_TARGET\s*=\s*(\d+)/)?.[1]
check(
  'the two ceilings agree',
  storageMax === undefined || targetsMax === undefined || storageMax === targetsMax,
  `storage:${storageMax} targets:${targetsMax}`,
)
check('normalisation honours the ceiling', targets.normalizeTarget(999) === targets.MAX_TARGET)
check(
  'storage honours the same ceiling',
  storage.normalizeHabits([{ name: 'x', target: 999 }])[0].target === targets.MAX_TARGET,
  String(storage.normalizeHabits([{ name: 'x', target: 999 }])[0].target),
)

console.log(fails === 0 ? '\nALL BUGFIX TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

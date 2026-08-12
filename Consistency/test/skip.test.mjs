import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Skip semantics: every pending nudge must be shown, and skipping one must
// clear only that one — never the whole habit, never the rest of the day.
const { reminders, dates } = await loadLibs()

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const { dueSlots, unskippedSlots, dueHabits, skipKey, slotKey, wasSkippedToday } = reminders
const { today } = dates
const T = today()

const at = (h, m = 0) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

// Four nudges: 08:00, 12:00, 16:00, 20:00
const water = {
  id: 'w',
  name: 'Drink water',
  reminder: '08:00',
  reminderEnd: '20:00',
  target: 4,
  progress: {},
  history: {},
}

// ---------- every pending slot is offered, not just the newest ----------
check('one slot due at 09:00', dueSlots(water, at(9)).length === 1)
check('two due by 13:00', dueSlots(water, at(13)).length === 2)
check('all four due by 21:00', dueSlots(water, at(21)).length === 4)
// Slot indexes are distinct, so each can be tracked separately.
const indexes = dueSlots(water, at(21)).map((s) => s.index)
check('slot indexes are unique', new Set(indexes).size === indexes.length, JSON.stringify(indexes))
check('notify keys differ per slot', slotKey('w', 0) !== slotKey('w', 1))
check('skip keys differ per slot', skipKey('w', 0) !== skipKey('w', 1))
check('skip and notify keys never collide', skipKey('w', 0) !== slotKey('w', 0))

// ---------- skipping clears only the slot it was aimed at ----------
// Simulated store: three slots have passed, the first is skipped.
const state = { [skipKey('w', 0)]: T }
check('skipped slot is recognised', wasSkippedToday('w', 0, state))
check('untouched slot is not', !wasSkippedToday('w', 1, state))

const left = unskippedSlots(water, at(17), state)
check('three slots passed by 17:00', dueSlots(water, at(17)).length === 3)
check('one skipped leaves two', left.length === 2, JSON.stringify(left.map((s) => s.index)))
check('the skipped one is gone', !left.some((s) => s.index === 0))
check('the later ones remain', left.some((s) => s.index === 1) && left.some((s) => s.index === 2))

// A slot skipped earlier must not suppress one that comes round later.
const earlySkip = { [skipKey('w', 0)]: T, [skipKey('w', 1)]: T }
check(
  'a later slot still arrives after earlier skips',
  unskippedSlots(water, at(21), earlySkip).some((s) => s.index === 3),
  'skipping earlier nudges silenced the whole day',
)

// ---------- the habit only leaves the list when nothing is outstanding ----------
check('habit is listed while something is due', dueHabits([water], at(17), state).length === 1)
const allSkipped = Object.fromEntries([0, 1, 2].map((i) => [skipKey('w', i), T]))
check('skipping every current slot clears it', dueHabits([water], at(17), allSkipped).length === 0)
// ...but the next slot brings it back.
check(
  'the next slot brings it back',
  dueHabits([water], at(21), allSkipped).length === 1,
  'skipping must not mute the habit for the rest of the day',
)

// ---------- yesterday's skips must not carry over ----------
const stale = { [skipKey('w', 0)]: dates.addDays(T, -1) }
check('a skip from yesterday does not apply', unskippedSlots(water, at(9), stale).length === 1)

// ---------- completing still silences everything ----------
const done = { ...water, progress: { [T]: 4 }, history: { [T]: { done: true, at: null } } }
check('a finished habit has nothing due', dueHabits([done], at(21), {}).length === 0)

// ---------- a once-a-day habit behaves the same way ----------
const once = { id: 'r', name: 'Read', reminder: '09:00', target: 1, progress: {}, history: {} }
check('single reminder is due', dueHabits([once], at(10), {}).length === 1)
check(
  'skipping it clears it for the day',
  dueHabits([once], at(10), { [skipKey('r', 0)]: T }).length === 0,
)

console.log(fails === 0 ? '\nALL SKIP TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

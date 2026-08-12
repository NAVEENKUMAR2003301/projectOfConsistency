import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Daily-target tests. The dangerous failure is a part-finished day being read
// as complete by the streak/stat code, which all tests history[day] truthiness.
const { targets, storage, dates, reminders, progress, excel, backup } = await loadLibs()

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const { targetOf, countFor, isComplete, remainingFor, reminderSlots, normalizeTarget,
        MIN_TARGET, MAX_TARGET } = targets
const { today, addDays, currentStreak } = dates
const T = today()

// ---------- target normalisation ----------
check('default is once', targetOf({}) === 1)
check('valid target kept', targetOf({ target: 8 }) === 8)
check('zero clamps up', normalizeTarget(0) === MIN_TARGET)
check('negative clamps up', normalizeTarget(-5) === MIN_TARGET)
check('huge clamps down', normalizeTarget(999) === MAX_TARGET)
check('fractional rounds', normalizeTarget(3.6) === 4)
check('junk becomes once', normalizeTarget('abc') === MIN_TARGET)
check('undefined becomes once', normalizeTarget(undefined) === MIN_TARGET)

// ---------- counting ----------
const water = { target: 8, progress: { [T]: 3 }, history: {} }
check('counts progress', countFor(water) === 3)
check('not complete part way', isComplete(water) === false)
check('remaining is the gap', remainingFor(water) === 5)
check('count clamps to target', countFor({ target: 3, progress: { [T]: 99 }, history: {} }) === 3)
check('missing day counts zero', countFor({ target: 5, progress: {}, history: {} }) === 0)
// A finished day reads full even if the tally is absent (legacy rows).
check(
  'history implies a full count',
  countFor({ target: 8, progress: {}, history: { [T]: { done: true } } }) === 8,
)

// ---------- THE invariant: partial days must not look done ----------
const partial = storage.normalizeHabits([
  { name: 'Water', target: 8, progress: { [T]: 3 } },
])[0]
check('partial day writes no history entry', !partial.history[T], JSON.stringify(partial.history))
check('so the streak stays zero', currentStreak(partial.history) === 0)
check('and the day is not "done"', progress.dayProgress([partial], T).done === 0)

const full = storage.normalizeHabits([
  { name: 'Water', target: 8, progress: { [T]: 8 } },
])[0]
check('full tally creates the history entry', Boolean(full.history[T]))
check('so the streak counts it', currentStreak(full.history) === 1)
check('and the day reads done', progress.dayProgress([full], T).done === 1)

// Over-logging cannot exceed the target.
const over = storage.normalizeHabits([{ name: 'W', target: 3, progress: { [T]: 10 } }])[0]
check('progress clamps on load', over.progress[T] === 3, String(over.progress[T]))

// A history entry with no tally is back-filled, so the card is not blank.
const legacy = storage.normalizeHabits([
  { name: 'Old', target: 5, history: { [T]: true } },
])[0]
check('history back-fills the tally', legacy.progress[T] === 5, JSON.stringify(legacy.progress))
check('and still reads complete', isComplete(legacy))

// Habits saved before targets existed default to once a day, unchanged.
const preTargets = storage.normalizeHabits([
  { name: 'Read', history: { [addDays(T, -1)]: true, [T]: true } },
])[0]
check('legacy habit targets once', preTargets.target === 1)
check('legacy streak is intact', currentStreak(preTargets.history) === 2)

// ---------- reminder slots ----------
check('no reminder means no slots', reminderSlots({ target: 5 }).length === 0)
check('single target gives one slot', reminderSlots({ reminder: '09:00', target: 1 }).length === 1)

const slots = reminderSlots({ reminder: '08:00', reminderEnd: '20:00', target: 8 })
check('one slot per repeat', slots.length === 8, JSON.stringify(slots))
check('first slot is the start', slots[0] === '08:00', slots[0])
check('last slot is the end', slots.at(-1) === '20:00', slots.at(-1))
check('slots ascend', slots.every((s, i) => i === 0 || s > slots[i - 1]), JSON.stringify(slots))
// Evenly spread: 08:00→20:00 is 720 minutes over 7 gaps ≈ 102.9 each. Compare
// the gaps rather than hardcoding a time, so the intent is what is tested.
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const gaps = slots.slice(1).map((s, i) => mins(s) - mins(slots[i]))
check(
  'gaps between slots are equal within a minute',
  Math.max(...gaps) - Math.min(...gaps) <= 1,
  JSON.stringify(gaps),
)
check('gap matches the window divided by the repeats', Math.round(gaps[0]) === 103, String(gaps[0]))

// A window that ends before it starts is nonsense: fall back, do not invent.
check(
  'reversed window falls back to one slot',
  reminderSlots({ reminder: '20:00', reminderEnd: '08:00', target: 5 }).length === 1,
)
check(
  'missing end falls back to one slot',
  reminderSlots({ reminder: '08:00', target: 5 }).length === 1,
)
// A narrow window must not produce duplicate times that fire twice.
const narrow = reminderSlots({ reminder: '08:00', reminderEnd: '08:05', target: 20 })
check('narrow window de-duplicates', narrow.length === new Set(narrow).size, JSON.stringify(narrow))

// ---------- due detection with slots ----------
const at = (h, m) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
const habit = { id: 'h', reminder: '08:00', reminderEnd: '20:00', target: 4, progress: {}, history: {} }
check('not due before the first slot', !reminders.isDue(habit, at(7, 0)))
check('due after the first slot', reminders.isDue(habit, at(9, 0)))
check('one slot passed -> one due', reminders.dueSlots(habit, at(9, 0)).length === 1)
check('three slots passed -> three due', reminders.dueSlots(habit, at(17, 0)).length === 3)
// Logging keeps pace: two logged means the first two slots are answered.
const logged2 = { ...habit, progress: { [T]: 2 } }
check('logged repeats answer their slots', reminders.dueSlots(logged2, at(17, 0)).length === 1)
// Finishing silences the rest of the day.
const finished = { ...habit, progress: { [T]: 4 }, history: { [T]: { done: true } } }
check('completed habit has no due slots', reminders.dueSlots(finished, at(23, 0)).length === 0)
check('and is not due', !reminders.isDue(finished, at(23, 0)))

// Slot dedupe keys must be per slot, not per habit.
check('slot keys differ', reminders.slotKey('h', 0) !== reminders.slotKey('h', 1))

// ---------- backups carry the new fields ----------
const saved = [{ id: 'h1', name: 'Water', icon: 'droplet', target: 8,
  reminder: '08:00', reminderEnd: '20:00', progress: { [T]: 3 }, history: {} }]
const restored = backup.parseBackup(
  JSON.stringify(backup.buildBackup({ habits: saved, notes: [] })),
)
check('JSON keeps the target', restored.habits[0].target === 8)
check('JSON keeps the window', restored.habits[0].reminderEnd === '20:00')
check('JSON keeps the tally', restored.habits[0].progress[T] === 3)
check('JSON keeps it incomplete', !restored.habits[0].history[T])

check('Target is a sheet column', excel.HABIT_COLUMNS.includes('Target'))
check('Reminder end is a sheet column', excel.HABIT_COLUMNS.includes('Reminder end'))
const row = excel.habitsToRows(saved)[0]
check('target written to the sheet', row.Target === '8', row.Target)
check('window written to the sheet', row['Reminder end'] === '20:00')

console.log(fails === 0 ? '\nALL TARGET TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

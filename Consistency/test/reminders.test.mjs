import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Reminder scheduling tests. Timer maths fails silently — a reminder that never
// fires looks identical to one that was never due.
const { reminders, storage, excel, backup, dates } = await loadLibs()

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const {
  isValidTime, normalizeTime, formatTime, nextOccurrence, msUntil,
  isPastToday, isDue, dueHabits, hasReminder,
} = reminders
const { today, dayKey } = dates
const T = today()

// ---------- validation ----------
for (const good of ['00:00', '09:05', '19:30', '23:59']) {
  check(`"${good}" valid`, isValidTime(good))
}
for (const bad of ['24:00', '9:30', '19:60', '1930', '', null, undefined, '19:3', 'ab:cd', '-1:00']) {
  check(`${JSON.stringify(bad)} rejected`, !isValidTime(bad))
}
check('normalizeTime keeps valid', normalizeTime('07:15') === '07:15')
check('normalizeTime nulls invalid', normalizeTime('7:15') === null)
check('formatTime renders something', formatTime('19:30').length > 0, formatTime('19:30'))
check('formatTime empty for junk', formatTime('bad') === '')

// ---------- next occurrence ----------
const at = (h, m, s = 0) => new Date(2026, 7, 9, h, m, s)

const laterToday = nextOccurrence('19:30', at(9, 0))
check('later today stays today', laterToday.getDate() === 9 && laterToday.getHours() === 19)
const alreadyPast = nextOccurrence('07:00', at(9, 0))
check('past time rolls to tomorrow', alreadyPast.getDate() === 10, String(alreadyPast))
// Exactly-now must roll forward, or the timer fires with a 0ms delay in a loop.
const exactlyNow = nextOccurrence('09:00', at(9, 0, 0))
check('exactly now rolls forward', exactlyNow.getDate() === 10, String(exactlyNow))
check('one second past rolls forward', nextOccurrence('09:00', at(9, 0, 1)).getDate() === 10)
check('one second before stays today', nextOccurrence('09:00', at(8, 59, 59)).getDate() === 9)
check('invalid time has no occurrence', nextOccurrence('nope') === null)

// Month and year boundaries must not produce a date in the past.
const newYearEve = nextOccurrence('00:30', new Date(2026, 11, 31, 23, 45))
check('rolls across the year', newYearEve.getFullYear() === 2027 && newYearEve.getMonth() === 0)
const monthEnd = nextOccurrence('01:00', new Date(2026, 0, 31, 23, 0))
check('rolls across the month', monthEnd.getMonth() === 1 && monthEnd.getDate() === 1)
// Leap day
const leap = nextOccurrence('02:00', new Date(2028, 1, 28, 23, 0))
check('rolls into a leap day', leap.getDate() === 29, String(leap))

// ---------- delay is always positive and under a day ----------
const DAY_MS = 24 * 60 * 60 * 1000
for (const time of ['00:00', '06:30', '12:00', '23:59']) {
  for (const now of [at(0, 0), at(6, 30), at(12, 0), at(23, 59), at(23, 59, 59)]) {
    const ms = msUntil(time, now)
    check(`${time} from ${now.getHours()}:${now.getMinutes()} is positive`, ms > 0, String(ms))
    check(`${time} from ${now.getHours()}:${now.getMinutes()} is under 24h`, ms <= DAY_MS, String(ms))
    // setTimeout overflows past 2^31-1 ms and would fire immediately.
    check(`${time} fits in setTimeout`, ms < 2 ** 31 - 1)
  }
}

// ---------- isPastToday ----------
check('past today', isPastToday('09:00', at(10, 0)))
check('not yet today', !isPastToday('23:00', at(10, 0)))
check('exactly now counts as past', isPastToday('10:00', at(10, 0)))
check('invalid never past', !isPastToday('bad', at(10, 0)))

// ---------- due detection ----------
const habit = (over, done, reminder = '09:00') => ({
  id: 'h' + over + done,
  name: 'H',
  reminder,
  history: done ? { [T]: { done: true, at: null } } : {},
})
const now10 = new Date()
now10.setHours(10, 0, 0, 0)

check('due when overdue and not done', isDue(habit(true, false), now10))
check('not due when already done', !isDue(habit(true, true), now10))
check('not due before the time', !isDue({ ...habit(true, false), reminder: '23:30' }, now10))
check('not due without a reminder', !isDue({ id: 'x', reminder: null, history: {} }, now10))
check('hasReminder true', hasReminder({ reminder: '08:00' }))
check('hasReminder false for junk', !hasReminder({ reminder: '8:00' }))
check(
  'dueHabits filters',
  dueHabits([habit(true, false), habit(true, true)], now10).length === 1,
)
// Yesterday's completion must not satisfy today's reminder.
const yesterdayOnly = {
  id: 'y',
  reminder: '09:00',
  history: { [dates.addDays(T, -1)]: { done: true, at: null } },
}
check('yesterday does not count', isDue(yesterdayOnly, now10))

// ---------- persistence ----------
const norm = storage.normalizeHabits([
  { name: 'A', reminder: '19:30' },
  { name: 'B', reminder: '7:30' }, // not zero-padded → rejected
  { name: 'C', reminder: '25:00' },
  { name: 'D' },
  { name: 'E', reminder: 1930 },
])
check('valid reminder kept', norm[0].reminder === '19:30')
check('unpadded rejected', norm[1].reminder === null)
check('out-of-range rejected', norm[2].reminder === null)
check('missing is null', norm[3].reminder === null)
check('non-string rejected', norm[4].reminder === null)

// ---------- JSON backup round trip ----------
const withReminder = [{ id: 'h1', name: 'Read', icon: 'book', reminder: '06:45', history: {} }]
const restored = backup.parseBackup(
  JSON.stringify(backup.buildBackup({ habits: withReminder, notes: [] })),
)
check('JSON keeps reminder', restored.habits[0].reminder === '06:45')

// Merge must not clobber a reminder set on this device...
const mergedKeep = backup.mergeHabits(
  [{ id: 'a', name: 'Read', reminder: '06:00', history: {}, createdAt: null }],
  [{ id: 'b', name: 'read', reminder: '21:00', history: {}, createdAt: null }],
)
check('merge keeps local reminder', mergedKeep[0].reminder === '06:00', mergedKeep[0].reminder)
// ...but should adopt one where there is none.
const mergedAdopt = backup.mergeHabits(
  [{ id: 'a', name: 'Read', reminder: null, history: {}, createdAt: null }],
  [{ id: 'b', name: 'read', reminder: '21:00', history: {}, createdAt: null }],
)
check('merge adopts a missing reminder', mergedAdopt[0].reminder === '21:00')

// ---------- spreadsheet round trip ----------
check('Reminder is a column', excel.HABIT_COLUMNS.includes('Reminder'))
check('reminder written to the row', excel.habitsToRows(withReminder)[0].Reminder === '06:45')
const fromSheet = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['h1', 'Read', 'book', 'violet', '1', '06:45', '', ''],
  ]),
})
check('reminder read back from sheet', fromSheet.habits[0].reminder === '06:45')
// Excel may hand back a Date cell if the column gets reformatted as a time.
const fromDateCell = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['h1', 'Read', 'book', 'violet', '1', new Date(2000, 0, 1, 6, 45), '', ''],
  ]),
})
check('Date cell becomes HH:MM', fromDateCell.habits[0].reminder === '06:45', String(fromDateCell.habits[0].reminder))
// Single-digit hour from a hand-edit should be padded, not dropped.
const handEdited = excel.sheetsToData({
  habitRows: excel.rowsToObjects([excel.HABIT_COLUMNS, ['h1', 'Read', 'book', 'violet', '1', '6:45', '', '']]),
})
check('unpadded sheet time is repaired', handEdited.habits[0].reminder === '06:45')
const junkTime = excel.sheetsToData({
  habitRows: excel.rowsToObjects([excel.HABIT_COLUMNS, ['h1', 'Read', 'book', 'violet', '1', 'soon', '', '']]),
})
check('junk sheet time becomes null', junkTime.habits[0].reminder === null)

console.log(fails === 0 ? '\nALL REMINDER TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

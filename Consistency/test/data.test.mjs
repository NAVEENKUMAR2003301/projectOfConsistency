import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Tests for storage normalisation, backup export/import/merge, badges, icon
// migration and progress maths. These are the paths where a bug silently
// destroys data.
// Bundled by vite so extensionless imports resolve exactly as they do in the app.
// localStorage does not exist in node; storage.js must tolerate that.
const { storage, backup, badges, progress, dates } = await loadLibs()

// Emoji as escapes, so no editor or shell can corrupt the fixtures.
const BOOK = '\u{1F4DA}'
const FIRE = '\u{1F525}'
const MOON = '\u{1F319}'

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}
const throws = (name, fn, needle) => {
  try {
    fn()
    fails++
    console.log(`FAIL  ${name} did not throw`)
  } catch (e) {
    if (needle && !e.message.toLowerCase().includes(needle.toLowerCase())) {
      fails++
      console.log(`FAIL  ${name} wrong message: ${e.message}`)
    }
  }
}

const { today, addDays, dayKey } = dates
const T = today()

// ---------- storage safety without localStorage ----------
check('readJSON survives no localStorage', storage.readJSON('x', 'fallback') === 'fallback')
check('writeJSON returns false, no throw', storage.writeJSON('x', {}) === false)
// storageBytes/clearAll were removed as dead code; the usage meter now measures
// the in-memory data so it cannot lag a render behind.
check('dead storage helpers are gone', !('storageBytes' in storage) && !('clearAll' in storage))
check('ids are unique', new Set(Array.from({ length: 500 }, () => storage.newId('h'))).size === 500)

// ---------- history normalisation (legacy `true` -> occurrence object) ----------
const legacy = storage.normalizeHistory({ '2026-01-01': true, '2026-01-02': false })
check('legacy true becomes occurrence', legacy['2026-01-01']?.done === true)
check('legacy occurrence is truthy', Boolean(legacy['2026-01-01']))
check('false dropped', !('2026-01-02' in legacy))
check('bad day key dropped', Object.keys(storage.normalizeHistory({ nope: true })).length === 0)
check('array history rejected', Object.keys(storage.normalizeHistory([1, 2])).length === 0)
check('null history rejected', Object.keys(storage.normalizeHistory(null)).length === 0)
const withNote = storage.normalizeHistory({
  '2026-01-03': { done: true, at: '2026-01-03T10:00:00.000Z', note: '  x  '.repeat(200) },
})
check('occurrence keeps timestamp', withNote['2026-01-03'].at === '2026-01-03T10:00:00.000Z')
check('occurrence note clamped', withNote['2026-01-03'].note.length <= storage.MAX_OCCURRENCE_NOTE)
check('done:false dropped', Object.keys(storage.normalizeHistory({ '2026-01-04': { done: false } })).length === 0)

// legacy shape must still satisfy every streak reader
const legacyHabit = { history: storage.normalizeHistory({ [T]: true, [addDays(T, -1)]: true }) }
check('legacy data still streaks', dates.currentStreak(legacyHabit.history) === 2)
check('legacy data still best-streaks', dates.bestStreak(legacyHabit.history) === 2)

// ---------- habit normalisation ----------
check('non-array habits -> []', storage.normalizeHabits('nope').length === 0)
check('nameless habit dropped', storage.normalizeHabits([{ id: 'a' }]).length === 0)
check('blank name dropped', storage.normalizeHabits([{ name: '   ' }]).length === 0)
const dupes = storage.normalizeHabits([
  { id: 'same', name: 'A' },
  { id: 'same', name: 'B' },
])
check('duplicate ids are de-collided', dupes[0].id !== dupes[1].id, JSON.stringify(dupes.map((h) => h.id)))
const clamped = storage.normalizeHabits([{ name: 'x'.repeat(200) }])[0]
check('name clamped', clamped.name.length === storage.MAX_NAME_LENGTH)
check('defaults filled', clamped.icon === 'star' && typeof clamped.color === 'string')

// ---------- icon migration (emoji -> icon keys) ----------
const iconCases = storage.normalizeHabits([
  { name: 'New style', icon: 'book' },
  { name: 'Legacy', emoji: BOOK }, // pre-icon habit: keep its emoji
  { name: 'Bogus icon', icon: 'not-a-real-icon' },
  { name: 'Bogus icon with emoji', icon: 'nope', emoji: FIRE },
  { name: 'Both', icon: 'moon', emoji: MOON },
])
check('known icon kept', iconCases[0].icon === 'book' && iconCases[0].emoji === null)
check('legacy emoji preserved', iconCases[1].emoji === BOOK && iconCases[1].icon === null)
check('unknown icon falls back to default', iconCases[2].icon === 'star')
check('unknown icon keeps emoji instead', iconCases[3].icon === null && iconCases[3].emoji === FIRE)
check('icon wins when both present', iconCases[4].icon === 'moon')
// Badges must reference icon keys now, never emoji characters.
check(
  'badge icons are keys not emoji',
  badges.BADGES.every((b) => typeof b.icon === 'string' && !/\p{Extended_Pictographic}/u.test(b.icon)),
)
check('every badge key resolves', badges.BADGES.every((b) => b.icon.length > 0))

// ---------- notes normalisation ----------
check('blank note dropped', storage.normalizeNotes([{ text: '  ' }]).length === 0)
const noteDupes = storage.normalizeNotes([
  { id: 'n', text: 'a' },
  { id: 'n', text: 'b' },
])
check('duplicate note ids de-collided', noteDupes[0].id !== noteDupes[1].id)
check('bad day replaced with today', storage.normalizeNotes([{ text: 'a', day: 'junk' }])[0].day === T)

// ---------- backup round trip ----------
const habits = [
  {
    id: 'h1',
    name: 'Revise 1 chapter',
    icon: 'book',
    color: 'violet',
    createdAt: '2026-01-01T00:00:00.000Z',
    history: { [T]: { done: true, at: null }, [addDays(T, -1)]: { done: true, at: null } },
  },
]
const notes = [{ id: 'n1', text: 'plan', day: T, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: null }]

const payload = backup.buildBackup({ habits, notes })
check('backup tagged', payload.app === 'consistency' && payload.version === 1)
check('backup has exportedAt', typeof payload.exportedAt === 'string')
const roundTrip = backup.parseBackup(JSON.stringify(payload))
check('round trip keeps habits', roundTrip.habits.length === 1)
check('round trip keeps icon', roundTrip.habits[0].icon === 'book')
check('round trip keeps history', Boolean(roundTrip.habits[0].history[T]))
check('round trip keeps notes', roundTrip.notes[0].text === 'plan')
check('round trip keeps streak', dates.currentStreak(roundTrip.habits[0].history) === 2)
check('filename is dated', backup.backupFilename(new Date(2026, 7, 9)) === 'consistency-backup-2026-08-09.json')

// A JSON backup written before icons existed must still restore.
const legacyBackup = backup.parseBackup(
  JSON.stringify({ app: 'consistency', habits: [{ id: 'old', name: 'Read', emoji: BOOK }], notes: [] }),
)
check('legacy JSON backup keeps emoji', legacyBackup.habits[0].emoji === BOOK)
check('legacy JSON backup has no icon', legacyBackup.habits[0].icon === null)

// ---------- backup rejection paths ----------
throws('junk text rejected', () => backup.parseBackup('not json'), 'valid JSON')
throws('array rejected', () => backup.parseBackup('[]'), 'does not look like')
throws('null rejected', () => backup.parseBackup('null'), 'does not look like')
throws('wrong app rejected', () => backup.parseBackup('{"app":"other","habits":[]}'), 'different app')
throws('no keys rejected', () => backup.parseBackup('{"foo":1}'), 'no habits, notes or expenses')
throws('empty backup rejected', () => backup.parseBackup('{"habits":[],"notes":[]}'), 'empty')
throws(
  'future version rejected',
  () => backup.parseBackup('{"app":"consistency","version":99,"habits":[{"name":"a"}]}'),
  'newer version',
)
check('notes-only backup ok', backup.parseBackup('{"habits":[],"notes":[{"text":"hi"}]}').notes.length === 1)

// ---------- merge ----------
const current = [
  {
    id: 'local-1',
    name: 'Revise 1 chapter',
    icon: 'book',
    color: 'violet',
    createdAt: '2026-02-01T00:00:00.000Z',
    history: { [addDays(T, -1)]: { done: true, at: null } },
  },
]
const incoming = [
  {
    // Same habit from another device: different id, same name.
    id: 'remote-9',
    name: 'revise 1 chapter',
    icon: 'notebook',
    color: 'rose',
    createdAt: '2026-01-01T00:00:00.000Z',
    history: { [addDays(T, -2)]: { done: true, at: null } },
  },
  {
    id: 'remote-new',
    name: 'Drink water',
    icon: 'droplet',
    color: 'sky',
    createdAt: null,
    history: { [T]: { done: true, at: null } },
  },
]
const merged = backup.mergeHabits(current, incoming)
check('merge matches by name across devices', merged.length === 2, `got ${merged.length}`)
const revise = merged.find((h) => h.id === 'local-1')
check('merge keeps local identity', revise.icon === 'book' && revise.color === 'violet')
check('merge unions history (local day kept)', Boolean(revise.history[addDays(T, -1)]))
check('merge unions history (remote day added)', Boolean(revise.history[addDays(T, -2)]))
check('merge keeps earliest createdAt', revise.createdAt === '2026-01-01T00:00:00.000Z')
check('merge adds genuinely new habit', merged.some((h) => h.name === 'Drink water'))
check('merge does not mutate current', Object.keys(current[0].history).length === 1)
check('merge is idempotent', backup.mergeHabits(merged, incoming).length === 2)

const mergedNotes = backup.mergeNotes(notes, [
  { id: 'n1', text: 'plan', day: T, createdAt: null, updatedAt: null }, // same id
  { id: 'n2', text: 'plan', day: T, createdAt: null, updatedAt: null }, // same content
  { id: 'n3', text: 'new one', day: T, createdAt: '2026-08-02T00:00:00.000Z', updatedAt: null },
])
check('note merge dedupes by id and content', mergedNotes.length === 2, `got ${mergedNotes.length}`)
check('note merge sorts newest first', mergedNotes[0].createdAt >= (mergedNotes[1].createdAt ?? ''))

// ---------- badges ----------
check('no badges at 0', badges.earnedBadges(0).length === 0)
check('3-day badge at 3', badges.earnedBadges(3).length === 1)
check('all badges at 365', badges.earnedBadges(365).length === badges.BADGES.length)
check('next after 0 is 3', badges.nextBadge(0).days === 3)
check('next after 7 is 14', badges.nextBadge(7).days === 14)
check('no next at max', badges.nextBadge(400) === null)
check(
  'progress stays 0..100',
  [0, 1, 5, 20, 99, 400].every((n) => badges.badgeProgress(n) >= 0 && badges.badgeProgress(n) <= 100),
)
check('progress full at max', badges.badgeProgress(400) === 100)
check('progress halfway 3->7', badges.badgeProgress(5) === 50, String(badges.badgeProgress(5)))

// ---------- progress maths ----------
const newHabit = {
  id: 'x',
  name: 'New',
  createdAt: new Date().toISOString(),
  history: { [T]: { done: true, at: null } },
}
// The whole point of createdAt: a habit made today is 100%, not 3%.
check('new habit rate is 100', progress.habitRate(newHabit, 30) === 100, String(progress.habitRate(newHabit, 30)))
const oldHabit = { id: 'y', name: 'Old', createdAt: null, history: { [T]: { done: true, at: null } } }
check('legacy habit uses full window', progress.habitRate(oldHabit, 30) === 3, String(progress.habitRate(oldHabit, 30)))
check('empty habits overall 0', progress.overallRate([], 30) === 0)
check('overall respects createdAt', progress.overallRate([newHabit], 30) === 100)
const dp = progress.dayProgress([newHabit], T)
check('dayProgress counts', dp.done === 1 && dp.total === 1 && dp.pct === 100)
check('dayProgress ignores unborn habits', progress.dayProgress([newHabit], '2020-01-01').total === 0)
check('series length', progress.progressSeries([newHabit], 14).length === 14)
check('perfectDays counts today', progress.perfectDays([newHabit], 30) === 1)
check('perfectDays 0 with no habits', progress.perfectDays([], 30) === 0)
check('tone none at 0', progress.toneFor(0).label === 'Not started')
check('tone high at 80', progress.toneFor(80).label === 'Strong')
check('tone mid at 50', progress.toneFor(50).label === 'Building')
check('tone low at 10', progress.toneFor(10).label === 'Slipping')

// ---------- calendar maths ----------
const feb2028 = dates.monthMatrix(2028, 1) // leap year
check('leap Feb has 29 days', feb2028.filter(Boolean).length === 29)
check('matrix is whole weeks', feb2028.length % 7 === 0)
const jan2026 = dates.monthMatrix(2026, 0)
check('Jan 2026 has 31 days', jan2026.filter(Boolean).length === 31)
check(
  'first cell aligns to weekday',
  new Date(2026, 0, 1).getDay() === jan2026.findIndex(Boolean),
)
check(
  'shiftMonth rolls year forward',
  JSON.stringify(dates.shiftMonth({ year: 2026, month: 11 }, 1)) === '{"year":2027,"month":0}',
)
check(
  'shiftMonth rolls year back',
  JSON.stringify(dates.shiftMonth({ year: 2026, month: 0 }, -1)) === '{"year":2025,"month":11}',
)
check('isFuture tomorrow', dates.isFuture(addDays(T, 1)) === true)
check('isFuture today is false', dates.isFuture(T) === false)
check('existedOn null createdAt', dates.existedOn({ createdAt: null }, '2000-01-01') === true)
check('existedOn before creation', dates.existedOn({ createdAt: new Date().toISOString() }, '2000-01-01') === false)
check('existedOn on creation day', dates.existedOn({ createdAt: new Date().toISOString() }, T) === true)
check('existedOn bad date is permissive', dates.existedOn({ createdAt: 'junk' }, '2000-01-01') === true)
check('monthTitle renders', dates.monthTitle(2026, 0).length > 0)
check('dayKey round trip', dayKey(new Date(2026, 7, 9)) === '2026-08-09')

console.log(fails === 0 ? '\nALL DATA TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

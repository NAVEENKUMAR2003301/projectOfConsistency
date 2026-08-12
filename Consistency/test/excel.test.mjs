import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Excel backup tests. The pure mapping is tested directly, then a REAL .xlsx
// file is written to disk and read back — the only way to prove the format
// actually round-trips rather than just that the objects look right.
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT = APP_DIR + "/"
const { excel, dates } = await loadLibs()
// Windows absolute paths must be file:// URLs for the ESM loader.
const writeMod = await import('file:///' + PROJECT + 'node_modules/write-excel-file/node/index.js')
const writeXlsxFile = writeMod.default
const { getSheetData } = writeMod
const readXlsxFile = (await import('file:///' + PROJECT + 'node_modules/read-excel-file/node/index.js')).default

const TMP = process.env.TMPDIR || process.env.TEMP || '.'
const FILE = join(TMP, 'consistency-test.xlsx')

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const { today, addDays, currentStreak, bestStreak } = dates
const T = today()
const occ = (at = null) => ({ done: true, at })

const habits = [
  {
    id: 'h-1',
    name: 'Solve 5 practice problems',
    icon: 'calculator',
    color: 'emerald',
    createdAt: '2026-01-01T00:00:00.000Z',
    history: {
      [T]: occ('2026-08-09T09:14:00.000Z'),
      [addDays(T, -1)]: occ(),
      [addDays(T, -2)]: occ(),
      [addDays(T, -9)]: occ(),
    },
  },
  {
    id: 'h-2',
    name: 'Sleep before 11 PM',
    icon: 'moon',
    color: 'violet',
    createdAt: null,
    history: {},
  },
]
const notes = [
  {
    id: 'n-1',
    text: 'Finish chapter 4\nRevise formulas',
    day: T,
    createdAt: '2026-08-09T09:15:00.000Z',
    updatedAt: '2026-08-09T09:15:00.000Z',
  },
]

// ---------- pure mapping ----------
const habitRows = excel.habitsToRows(habits)
check('one row per habit', habitRows.length === 2)
check('habit row carries name', habitRows[0].Habit === 'Solve 5 practice problems')
check('null createdAt becomes empty text', habitRows[1].Created === '')

const checkinRows = excel.checkinsToRows(habits)
check('one row per occurrence', checkinRows.length === 4, `got ${checkinRows.length}`)
check('check-in rows sorted oldest first', checkinRows[0].Date < checkinRows[3].Date)
check('check-in keeps ISO for round trip', checkinRows[3]['Logged At'] === '2026-08-09T09:14:00.000Z')
check('check-in has friendly time', checkinRows[3].Time.length > 0)
check('no rows for empty history', !checkinRows.some((r) => r['Habit ID'] === 'h-2'))

check('one row per note', excel.notesToRows(notes).length === 1)
check('note newlines preserved in cell', excel.notesToRows(notes)[0].Note.includes('\n'))

// ---------- header parsing ----------
const objs = excel.rowsToObjects([
  ['ID', 'Habit', 'Icon', 'Colour', 'Created'],
  ['h-9', 'Read', '📚', 'sky', ''],
])
check('rowsToObjects lowercases headers', objs[0].habit === 'Read')
check('rowsToObjects empty for header only', excel.rowsToObjects([['ID']]).length === 0)
check('rowsToObjects empty for junk', excel.rowsToObjects(null).length === 0)
check(
  'rowsToObjects skips blank rows',
  excel.rowsToObjects([['ID', 'Habit'], ['', ''], ['h-1', 'A']]).length === 1,
)
// Reordered and extra columns must not break a hand-edited sheet.
const reordered = excel.rowsToObjects([
  ['Habit', 'Notes to self', 'ID'],
  ['Read', 'whatever', 'h-7'],
])
check('reordered columns still map', reordered[0].id === 'h-7' && reordered[0].habit === 'Read')

// ---------- sheetsToData ----------
const rebuilt = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['h-1', 'Solve 5 practice problems', '🧮', 'emerald', '1', '06:45', '', '2026-01-01T00:00:00.000Z'],
  ]),
  checkinRows: excel.rowsToObjects([
    excel.CHECKIN_COLUMNS,
    ['h-1', 'Solve 5 practice problems', T, '1', '9:14 AM', '2026-08-09T09:14:00.000Z'],
    ['h-1', 'Solve 5 practice problems', addDays(T, -1), '1', '', ''],
  ]),
  noteRows: [],
})
// Positional fixtures below must stay the same width as the header row, or a
// new column silently shifts every value and the assertions go vacuous.
check(
  'fixtures match the column count',
  excel.HABIT_COLUMNS.length === 8,
  `${excel.HABIT_COLUMNS.length} columns — update the row fixtures in this file`,
)
check(
  'check-in fixtures match the column count',
  excel.CHECKIN_COLUMNS.length === 6,
  `${excel.CHECKIN_COLUMNS.length} columns — update the check-in fixtures in this file`,
)
check('rebuild finds habit', rebuilt.habits.length === 1)
check('rebuild keeps createdAt', rebuilt.habits[0].createdAt === '2026-01-01T00:00:00.000Z')
check('rebuild keeps reminder', rebuilt.habits[0].reminder === '06:45')
check('rebuild applies check-ins', Object.keys(rebuilt.habits[0].history).length === 2)
check('rebuild keeps streak', currentStreak(rebuilt.habits[0].history) === 2)
check('rebuild keeps logged-at', rebuilt.habits[0].history[T].at === '2026-08-09T09:14:00.000Z')
check('rebuild counts nothing skipped', rebuilt.skipped === 0)

// Orphan and malformed rows are counted, never guessed at.
const orphan = excel.sheetsToData({
  habitRows: excel.rowsToObjects([excel.HABIT_COLUMNS, ['h-1', 'Read', '📚', 'sky', '1', '', '', '']]),
  checkinRows: excel.rowsToObjects([
    excel.CHECKIN_COLUMNS,
    ['h-999', 'Ghost habit', T, '1', '', ''], // no such habit
    ['h-1', 'Read', 'not-a-date', '1', '', ''], // unusable date
  ]),
  noteRows: [],
})
check('orphan check-ins skipped', orphan.skipped === 2, `got ${orphan.skipped}`)
check('orphan does not invent habits', orphan.habits.length === 1)

// A hand-edited sheet often has the name but no id — match by name.
const byName = excel.sheetsToData({
  habitRows: excel.rowsToObjects([excel.HABIT_COLUMNS, ['h-1', 'Read', '📚', 'sky', '1', '', '', '']]),
  checkinRows: excel.rowsToObjects([excel.CHECKIN_COLUMNS, ['', 'read', T, '1', '', '']]),
  noteRows: [],
})
check('check-in matched by habit name', Boolean(byName.habits[0].history[T]))
check('nameless habit rows dropped', excel.sheetsToData({
  habitRows: excel.rowsToObjects([excel.HABIT_COLUMNS, ['h-x', '', '', '', '', '', '', '']]),
}).habits.length === 0)

check('isSpreadsheet xlsx', excel.isSpreadsheet('a.xlsx') === true)
check('isSpreadsheet XLS uppercase', excel.isSpreadsheet('A.XLS') === true)
check('isSpreadsheet json is false', excel.isSpreadsheet('a.json') === false)
check('isSpreadsheet undefined safe', excel.isSpreadsheet(undefined) === false)
check('filename dated', excel.workbookFilename(new Date(2026, 7, 9)) === 'consistency-backup-2026-08-09.xlsx')

// ---------- REAL .xlsx round trip ----------
// Mirrors excelFile.toSheets(), which cannot be imported here because it pulls
// in the browser build.
const spec = excel.buildWorkbook({ habits, notes })
const sheetDescriptors = spec.map(({ sheet, rows, columns }) => ({
  sheet,
  data: getSheetData(rows, columns),
  columns: columns.map(({ width }) => ({ width })),
}))
await writeXlsxFile(sheetDescriptors).toFile(FILE)
check('file was written', readFileSync(FILE).length > 0)

// Mirrors importWorkbook(): one read, sheets picked by their `sheet` key.
const readSheets = await readXlsxFile(FILE, { getSheets: true })
const sheetMap = new Map(readSheets.map((s) => [s.sheet, s.data ?? []]))
const sheetNames = [...sheetMap.keys()]
const EXPECTED_SHEETS = ['Habits', 'Check-ins', 'Notes', 'Expenses', 'Categories']
check('every sheet present', sheetNames.length === EXPECTED_SHEETS.length, JSON.stringify(sheetNames))
check('sheets named as expected', EXPECTED_SHEETS.every((n) => sheetMap.has(n)))

const readBack = excel.sheetsToData({
  habitRows: excel.rowsToObjects(sheetMap.get('Habits') ?? []),
  checkinRows: excel.rowsToObjects(sheetMap.get('Check-ins') ?? []),
  noteRows: excel.rowsToObjects(sheetMap.get('Notes') ?? []),
})

check('round trip habit count', readBack.habits.length === 2, `got ${readBack.habits.length}`)
check('round trip nothing skipped', readBack.skipped === 0, `skipped ${readBack.skipped}`)
const rt = readBack.habits.find((h) => h.id === 'h-1')
check('round trip keeps id', Boolean(rt))
check('round trip keeps name', rt.name === 'Solve 5 practice problems')
check('round trip keeps icon key', rt.icon === 'calculator', JSON.stringify({ icon: rt.icon, emoji: rt.emoji }))
check('round trip drops emoji for icon habits', rt.emoji === null)

// A sheet written before icons existed carries an emoji in the Icon column;
// it must come back as an emoji, not be mistaken for an unknown icon key.
const legacySheet = excel.sheetsToData({
  habitRows: excel.rowsToObjects([
    excel.HABIT_COLUMNS,
    ['h-old', 'Read', '\u{1F4DA}', 'sky', '1', '', '', ''],
  ]),
})
check('legacy emoji column preserved', legacySheet.habits[0].emoji === '\u{1F4DA}')
check('legacy emoji not treated as icon', legacySheet.habits[0].icon === null)
check('round trip keeps colour', rt.color === 'emerald')
check('round trip keeps createdAt', rt.createdAt === '2026-01-01T00:00:00.000Z')
check('round trip keeps all occurrences', Object.keys(rt.history).length === 4, JSON.stringify(Object.keys(rt.history)))
// The whole point: dates must not shift by a day through Excel.
check('round trip keeps today exactly', Boolean(rt.history[T]), JSON.stringify(Object.keys(rt.history)))
check('round trip keeps day -9 exactly', Boolean(rt.history[addDays(T, -9)]))
check('round trip preserves streak', currentStreak(rt.history) === 3, String(currentStreak(rt.history)))
check('round trip preserves best streak', bestStreak(rt.history) === 3)
check('round trip preserves timestamp', rt.history[T].at === '2026-08-09T09:14:00.000Z')
check('round trip keeps habit with no history', readBack.habits.some((h) => h.id === 'h-2'))
check('round trip note text with newline', readBack.notes[0].text.includes('\n'), JSON.stringify(readBack.notes[0]?.text))
check('round trip note day', readBack.notes[0].day === T)

rmSync(FILE, { force: true })

console.log(fails === 0 ? '\nALL EXCEL TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

import { dayKey, timeLabel } from './dates'
import { isKnownIcon } from './icons'
import { newId, normalizeHabits, normalizeNotes } from './storage'

// Spreadsheet backup. The file is meant to be opened and read by a human, so
// each concern gets its own sheet and check-ins are one row per occurrence
// rather than a nested blob.
//
// All dates are written as TEXT, not Excel date cells. Excel date cells are
// serial numbers interpreted in the reader's timezone, which shifts a day
// backwards or forwards on round trip — the exact bug that would silently
// corrupt a streak.

export const SHEETS = {
  habits: 'Habits',
  checkins: 'Check-ins',
  notes: 'Notes',
}

export const HABIT_COLUMNS = ['ID', 'Habit', 'Icon', 'Colour', 'Reminder', 'Created']
export const CHECKIN_COLUMNS = ['Habit ID', 'Habit', 'Date', 'Time', 'Logged At']
export const NOTE_COLUMNS = ['ID', 'Date', 'Note', 'Created', 'Updated']

const text = (value) => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Accepts a text day, a full ISO string, or an Excel Date cell. */
function asDay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dayKey(value)
  const raw = text(value)
  if (!raw) return ''
  if (DAY_PATTERN.test(raw)) return raw
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? '' : dayKey(parsed)
}

const pad2 = (n) => String(n).padStart(2, '0')

/** Accepts 'HH:MM', 'H:MM', or a Date cell Excel produced from a time. */
function asTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`
  }
  const raw = text(value)
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const [, h, m] = match
  return Number(h) > 23 || Number(m) > 59 ? null : `${pad2(Number(h))}:${m}`
}

function asIso(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const raw = text(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

// ---------------------------------------------------------------- write side

export const habitsToRows = (habits) =>
  habits.map((h) => ({
    ID: h.id,
    Habit: h.name,
    // Icon key for current habits; legacy habits still carry their emoji here.
    Icon: h.icon ?? h.emoji ?? '',
    Colour: h.color,
    // Written as text so Excel cannot turn "19:30" into a fraction of a day.
    Reminder: h.reminder ?? '',
    Created: h.createdAt ?? '',
  }))

export const checkinsToRows = (habits) =>
  habits.flatMap((h) =>
    Object.entries(h.history)
      .filter(([, occurrence]) => occurrence)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, occurrence]) => ({
        'Habit ID': h.id,
        Habit: h.name,
        Date: day,
        // Friendly for reading; "Logged At" is what survives the round trip.
        Time: occurrence.at ? timeLabel(occurrence.at) : '',
        'Logged At': occurrence.at ?? '',
      })),
  )

export const notesToRows = (notes) =>
  notes.map((n) => ({
    ID: n.id,
    Date: n.day,
    Note: n.text,
    Created: n.createdAt ?? '',
    Updated: n.updatedAt ?? '',
  }))

/**
 * Column definitions in the shape write-excel-file v4 expects: a header cell
 * and a cell() mapper per column. Every cell is written as a String so Excel
 * cannot reinterpret a date as a timezone-shifted serial number.
 */
const columnsFor = (columns, widths) =>
  columns.map((name, i) => ({
    header: { value: name, fontWeight: 'bold' },
    cell: (row) => ({ type: String, value: text(row[name]) }),
    width: widths[i],
  }))

/**
 * A library-agnostic description of the workbook: one entry per sheet, each
 * with its rows and column definitions. excelFile.js turns this into a file,
 * which keeps this module free of any dependency and therefore testable.
 */
export function buildWorkbook({ habits, notes }) {
  return [
    {
      sheet: SHEETS.habits,
      rows: habitsToRows(habits),
      columns: columnsFor(HABIT_COLUMNS, [16, 32, 8, 12, 10, 26]),
    },
    {
      sheet: SHEETS.checkins,
      rows: checkinsToRows(habits),
      columns: columnsFor(CHECKIN_COLUMNS, [16, 32, 14, 12, 26]),
    },
    {
      sheet: SHEETS.notes,
      rows: notesToRows(notes),
      columns: columnsFor(NOTE_COLUMNS, [16, 14, 60, 26, 26]),
    },
  ]
}

// ----------------------------------------------------------------- read side

/**
 * Turns raw sheet rows (array of arrays, first row = headers) into objects
 * keyed by lower-cased header, so reordered or extra columns don't break it.
 */
export function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return []
  const [header, ...body] = rows
  if (!Array.isArray(header)) return []
  const keys = header.map((h) => text(h).toLowerCase())

  return body
    .filter((row) => Array.isArray(row) && row.some((cell) => text(cell) !== ''))
    .map((row) => {
      const obj = {}
      keys.forEach((key, i) => {
        if (key) obj[key] = row[i]
      })
      return obj
    })
}

// Accept both spellings so a hand-edited sheet still imports.
const pick = (row, ...keys) => {
  for (const key of keys) {
    const value = text(row[key])
    if (value) return value
  }
  return ''
}

/**
 * Rebuilds habits and notes from the three sheets. Check-in rows are matched
 * to a habit by id first, then by name — a sheet edited by hand often has the
 * name but not the id. Rows that match nothing are counted, never guessed at.
 */
export function sheetsToData({ habitRows = [], checkinRows = [], noteRows = [] }) {
  const habits = habitRows
    .map((row) => {
      // One column holds either an icon key or a legacy emoji; whichever it
      // is, normalizeHabits sorts it out below.
      const mark = pick(row, 'icon', 'emoji')
      return {
        id: pick(row, 'id') || newId('h'),
        name: pick(row, 'habit', 'name'),
        icon: isKnownIcon(mark) ? mark : null,
        emoji: isKnownIcon(mark) ? null : mark || null,
        // A spreadsheet may hand this back as a Date cell if someone reformats
        // the column, so accept that shape too. normalizeHabits drops anything
        // that still is not HH:MM.
        reminder: asTime(row.reminder),
        color: pick(row, 'colour', 'color').toLowerCase(),
        createdAt: asIso(row.created),
        history: {},
      }
    })
    .filter((h) => h.name)

  const byId = new Map(habits.map((h) => [h.id, h]))
  const byName = new Map(habits.map((h) => [h.name.toLowerCase(), h]))

  let skipped = 0
  for (const row of checkinRows) {
    const day = asDay(row.date)
    if (!day) {
      skipped++
      continue
    }
    const habit =
      byId.get(pick(row, 'habit id', 'habitid')) ??
      byName.get(pick(row, 'habit', 'name').toLowerCase())
    if (!habit) {
      skipped++
      continue
    }
    habit.history[day] = { done: true, at: asIso(row['logged at']) }
  }

  const notes = noteRows
    .map((row) => ({
      id: pick(row, 'id') || newId('n'),
      day: asDay(row.date),
      text: text(row.note ?? row.text),
      createdAt: asIso(row.created),
      updatedAt: asIso(row.updated),
    }))
    .filter((n) => n.text)

  // Same validation as the JSON path and as first load, so a spreadsheet can
  // never introduce a shape the app would otherwise reject.
  return {
    habits: normalizeHabits(habits),
    notes: normalizeNotes(notes),
    skipped,
  }
}

export const workbookFilename = (now = new Date()) =>
  `consistency-backup-${dayKey(now)}.xlsx`

/** True when the file name looks like a spreadsheet rather than JSON. */
export const isSpreadsheet = (filename) => /\.xlsx?$/i.test(text(filename))

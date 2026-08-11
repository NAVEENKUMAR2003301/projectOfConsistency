import { dayKey, timeLabel } from './dates'
import { isKnownIcon } from './icons'
import {
  newId,
  normalizeCategories,
  normalizeExpenses,
  normalizeHabits,
  normalizeNotes,
} from './storage'

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
  expenses: 'Expenses',
  categories: 'Categories',
}

export const HABIT_COLUMNS = ['ID', 'Habit', 'Icon', 'Colour', 'Target', 'Reminder', 'Reminder end', 'Created']
export const CHECKIN_COLUMNS = ['Habit ID', 'Habit', 'Date', 'Count', 'Time', 'Logged At']
export const NOTE_COLUMNS = ['ID', 'Date', 'Note', 'Created', 'Updated']
export const EXPENSE_COLUMNS = ['ID', 'Date', 'Category', 'Amount', 'Note', 'Category ID', 'Created']
export const CATEGORY_COLUMNS = ['ID', 'Category', 'Icon', 'Colour']

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

/**
 * Sheet amounts are major units ('12.50'); storage wants integer minor units.
 * Excel may hand back a number, so both shapes are accepted. Returns null for
 * anything unusable so the row is skipped and counted, never stored as zero.
 */
function parseSheetAmount(value) {
  const raw = typeof value === 'number' ? String(value) : text(value)
  if (!raw) return null
  const cleaned = raw.replace(/[\s,]/g, '').replace(/[^\d.-]/g, '')
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100)
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
    Target: String(h.target ?? 1),
    Reminder: h.reminder ?? '',
    'Reminder end': h.reminderEnd ?? '',
    Created: h.createdAt ?? '',
  }))

export const checkinsToRows = (habits) =>
  habits.flatMap((h) => {
    const target = Math.max(1, Math.round(Number(h.target)) || 1)
    // Days with partial progress have no history entry, so iterating history
    // alone silently dropped them from the backup. Both sources are merged.
    const days = [
      ...new Set([...Object.keys(h.history ?? {}), ...Object.keys(h.progress ?? {})]),
    ].sort((a, b) => a.localeCompare(b))

    return days.map((day) => {
      const occurrence = h.history?.[day]
      const count = occurrence ? target : Math.min(target, Number(h.progress?.[day]) || 0)
      return {
        'Habit ID': h.id,
        Habit: h.name,
        Date: day,
        // How many of the day's repeats were logged; the day counts as done
        // only when this reaches the habit's target.
        Count: String(count),
        // Friendly for reading; "Logged At" is what survives the round trip.
        Time: occurrence?.at ? timeLabel(occurrence.at) : '',
        'Logged At': occurrence?.at ?? '',
      }
    })
  })

export const notesToRows = (notes) =>
  notes.map((n) => ({
    ID: n.id,
    Date: n.day,
    Note: n.text,
    Created: n.createdAt ?? '',
    Updated: n.updatedAt ?? '',
  }))

export const categoriesToRows = (categories) =>
  categories.map((c) => ({
    ID: c.id,
    Category: c.name,
    Icon: c.icon,
    Colour: c.color,
  }))

export const expensesToRows = (expenses, categories) => {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return [...expenses]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((e) => ({
      ID: e.id,
      Date: e.day,
      // Human-readable name for reading; the ID below is what round-trips.
      Category: byId.get(e.categoryId)?.name ?? '',
      // Written in major units so the sheet is meaningful to a person; parsed
      // back into integer minor units on import.
      Amount: (e.amount / 100).toFixed(2),
      Note: e.note,
      'Category ID': e.categoryId ?? '',
      Created: e.createdAt ?? '',
    }))
}

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
export function buildWorkbook({ habits, notes, expenses = [], categories = [] }) {
  return [
    {
      sheet: SHEETS.habits,
      rows: habitsToRows(habits),
      columns: columnsFor(HABIT_COLUMNS, [16, 32, 8, 12, 8, 10, 12, 26]),
    },
    {
      sheet: SHEETS.checkins,
      rows: checkinsToRows(habits),
      columns: columnsFor(CHECKIN_COLUMNS, [16, 32, 14, 8, 12, 26]),
    },
    {
      sheet: SHEETS.notes,
      rows: notesToRows(notes),
      columns: columnsFor(NOTE_COLUMNS, [16, 14, 60, 26, 26]),
    },
    {
      sheet: SHEETS.expenses,
      rows: expensesToRows(expenses, categories),
      columns: columnsFor(EXPENSE_COLUMNS, [16, 14, 20, 12, 34, 16, 26]),
    },
    {
      sheet: SHEETS.categories,
      rows: categoriesToRows(categories),
      columns: columnsFor(CATEGORY_COLUMNS, [16, 24, 14, 12]),
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
export function sheetsToData({
  habitRows = [],
  checkinRows = [],
  noteRows = [],
  expenseRows = [],
  categoryRows = [],
}) {
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
        target: Number(text(row.target)) || 1,
        reminder: asTime(row.reminder),
        reminderEnd: asTime(row['reminder end']),
        color: pick(row, 'colour', 'color').toLowerCase(),
        createdAt: asIso(row.created),
        history: {},
        progress: {},
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
    // A row with no Count comes from a backup written before repeats existed,
    // where every row meant a finished day.
    const rowTarget = Math.max(1, Math.round(Number(habit.target)) || 1)
    const rawCount = text(row.count)
    const count =
      rawCount === ''
        ? rowTarget
        : Math.min(rowTarget, Math.max(0, Math.round(Number(rawCount)) || 0))
    if (count <= 0) continue

    habit.progress[day] = count
    // Only a full count finishes the day. normalizeHabits reconciles the two
    // fields afterwards, but setting them correctly here means a partial day
    // never briefly looks complete.
    if (count >= rowTarget) {
      habit.history[day] = { done: true, at: asIso(row['logged at']) }
    }
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

  const categories = categoryRows
    .map((row) => ({
      id: pick(row, 'id') || newId('c'),
      name: pick(row, 'category', 'name'),
      icon: pick(row, 'icon') || 'receipt',
      color: pick(row, 'colour', 'color').toLowerCase(),
    }))
    .filter((c) => c.name)

  // Expenses reference a category by id where present, else by the readable
  // name — a hand-written row usually has the name and not the id.
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))

  const expenses = expenseRows
    .map((row) => {
      const amount = parseSheetAmount(row.amount)
      if (amount === null) {
        skipped++
        return null
      }
      const match =
        categoryById.get(pick(row, 'category id', 'categoryid')) ??
        categoryByName.get(pick(row, 'category', 'name').toLowerCase())
      return {
        id: pick(row, 'id') || newId('e'),
        amount,
        categoryId: match?.id ?? null,
        note: pick(row, 'note'),
        day: asDay(row.date),
        createdAt: asIso(row.created),
      }
    })
    .filter(Boolean)

  // Same validation as the JSON path and as first load, so a spreadsheet can
  // never introduce a shape the app would otherwise reject.
  return {
    habits: normalizeHabits(habits),
    notes: normalizeNotes(notes),
    expenses: normalizeExpenses(expenses),
    categories: normalizeCategories(categories),
    skipped,
  }
}

export const workbookFilename = (now = new Date()) =>
  `consistency-backup-${dayKey(now)}.xlsx`

/** True when the file name looks like a spreadsheet rather than JSON. */
export const isSpreadsheet = (filename) => /\.xlsx?$/i.test(text(filename))

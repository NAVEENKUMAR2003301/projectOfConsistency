// All day keys are local-time 'YYYY-MM-DD' so a check-in belongs to the day
// the user actually experienced, not UTC.

export const dayKey = (date = new Date()) => {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const today = () => dayKey()

export const addDays = (key, delta) => {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d + delta)
  return dayKey(date)
}

/** The last `count` day keys, oldest first, ending today. */
export const lastDays = (count) =>
  Array.from({ length: count }, (_, i) => addDays(today(), i - (count - 1)))

export const weekdayLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(y, m - 1, d).getDay()]
}

export const monthDayLabel = (key) => {
  const [, m, d] = key.split('-').map(Number)
  return `${d}/${m}`
}

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Day keys sort lexicographically, so plain string compare is correct here. */
export const isFuture = (key) => key > today()

/**
 * A month as 7-column calendar cells: leading/trailing blanks are null so the
 * grid always starts on Sunday and ends on a full week.
 */
export function monthMatrix(year, monthIndex) {
  const leading = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

  const cells = Array(leading).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dayKey(new Date(year, monthIndex, d)))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function monthTitle(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** Shifts a {year, month} pair by whole months, rolling the year over. */
export function shiftMonth({ year, month }, delta) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/**
 * Whether a habit existed on a given day. Without this, adding a habit today
 * would retroactively mark every past day as "missed".
 */
export function existedOn(habit, key) {
  if (!habit?.createdAt) return true // legacy habit: assume it always existed
  const created = new Date(habit.createdAt)
  if (Number.isNaN(created.getTime())) return true
  return dayKey(created) <= key
}

/** 'Today' / 'Yesterday' / 'Mon, 3 Aug' for a day key. */
export function dayLabel(key) {
  if (key === today()) return 'Today'
  if (key === addDays(today(), -1)) return 'Yesterday'
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return key
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Short time-of-day for a stored ISO timestamp; '' when absent or invalid. */
export function timeLabel(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * Current streak: consecutive completed days ending today (or yesterday, so a
 * streak isn't declared dead until the day is actually over).
 */
export function currentStreak(history = {}) {
  let cursor = today()
  if (!history[cursor]) {
    cursor = addDays(cursor, -1)
    if (!history[cursor]) return 0
  }
  let streak = 0
  while (history[cursor]) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function bestStreak(history = {}) {
  const keys = Object.keys(history)
    .filter((k) => history[k])
    .sort()
  let best = 0
  let run = 0
  let prev = null
  for (const key of keys) {
    run = prev && addDays(prev, 1) === key ? run + 1 : 1
    best = Math.max(best, run)
    prev = key
  }
  return best
}

/** Share of the last `window` days that were completed, as 0–100. */
export function completionRate(history = {}, window = 30) {
  const days = lastDays(window)
  const done = days.filter((d) => history[d]).length
  return Math.round((done / window) * 100)
}

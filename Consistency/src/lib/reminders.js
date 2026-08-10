import { dayKey, today } from './dates'
import { readJSON, writeJSON } from './storage'

// Reminder times are stored as plain 'HH:MM' local strings — not timestamps —
// so "19:30" keeps meaning half past seven if you travel or the clocks change.

export const REMINDER_STATE_KEY = 'consistency.reminders.v1'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const isValidTime = (value) =>
  typeof value === 'string' && TIME_PATTERN.test(value)

export const normalizeTime = (value) => (isValidTime(value) ? value : null)

/** '19:30' → '7:30 PM' (or 19:30, per the reader's locale). */
export function formatTime(value) {
  if (!isValidTime(value)) return ''
  const [h, m] = value.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** The Date at which `time` next occurs — today if still ahead, else tomorrow. */
export function nextOccurrence(time, from = new Date()) {
  if (!isValidTime(time)) return null
  const [h, m] = time.split(':').map(Number)
  const at = new Date(from)
  at.setHours(h, m, 0, 0)
  if (at.getTime() <= from.getTime()) at.setDate(at.getDate() + 1)
  return at
}

/** Milliseconds until `time` next comes round. */
export function msUntil(time, from = new Date()) {
  const at = nextOccurrence(time, from)
  return at ? at.getTime() - from.getTime() : null
}

/** Today's reminder moment has passed (whether or not we were running). */
export function isPastToday(time, from = new Date()) {
  if (!isValidTime(time)) return false
  const [h, m] = time.split(':').map(Number)
  const at = new Date(from)
  at.setHours(h, m, 0, 0)
  return from.getTime() >= at.getTime()
}

export const hasReminder = (habit) => isValidTime(habit?.reminder)

/**
 * A habit is due when it has a reminder, that time has passed today, and it is
 * still not done. Used both for firing notifications and for the in-app list,
 * so the two can never disagree.
 */
export function isDue(habit, from = new Date()) {
  if (!hasReminder(habit)) return false
  if (habit.history?.[dayKey(from)]) return false
  return isPastToday(habit.reminder, from)
}

export const dueHabits = (habits, from = new Date()) =>
  habits.filter((h) => isDue(h, from))

// --- "already told you today" bookkeeping -----------------------------------
// Keyed by habit id → day, so reopening the app or a re-render cannot produce a
// second notification for the same reminder.

export const readNotified = () => {
  const raw = readJSON(REMINDER_STATE_KEY, {})
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

export const wasNotifiedToday = (habitId, state = readNotified()) =>
  state[habitId] === today()

export function markNotified(habitId, state = readNotified()) {
  const next = { ...state, [habitId]: today() }
  // Drop entries for days gone by so this cannot grow without bound.
  for (const [id, day] of Object.entries(next)) {
    if (day !== today()) delete next[id]
  }
  writeJSON(REMINDER_STATE_KEY, next)
  return next
}

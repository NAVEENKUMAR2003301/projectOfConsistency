import { dayKey, today } from './dates'
import { readJSON, writeJSON } from './storage'
import { countFor, reminderSlots } from './targets'

export { reminderSlots }

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
 * A habit is due when it has a reminder, at least one of its slots has passed
 * today, and it is still not finished. Used both for firing notifications and
 * for the in-app list, so the two can never disagree.
 */
export function isDue(habit, from = new Date()) {
  if (!hasReminder(habit)) return false
  if (habit.history?.[dayKey(from)]) return false
  return reminderSlots(habit).some((slot) => isPastToday(slot, from))
}

/**
 * Slots whose time has passed today. For a repeating habit only the first
 * `count` are considered answered, so logging keeps pace with the nudges
 * instead of silencing all of them at once.
 */
export function dueSlots(habit, from = new Date()) {
  if (!hasReminder(habit)) return []
  if (habit.history?.[dayKey(from)]) return []
  const done = countFor(habit, dayKey(from))
  return reminderSlots(habit)
    .map((time, index) => ({ time, index }))
    .filter(({ time, index }) => index >= done && isPastToday(time, from))
}

/**
 * Habits with at least one nudge still outstanding. A habit whose due slots
 * have all been skipped drops off the list until its next slot comes round.
 */
export const dueHabits = (habits, from = new Date(), state = readNotified()) =>
  habits.filter((h) => unskippedSlots(h, from, state).length > 0)

// --- "already told you today" bookkeeping -----------------------------------
// Keyed by habit id → day, so reopening the app or a re-render cannot produce a
// second notification for the same reminder.

export const readNotified = () => {
  const raw = readJSON(REMINDER_STATE_KEY, {})
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

// Keyed per slot, not per habit: a repeating habit must be able to nudge you
// again later in the day without the first nudge silencing the rest.
export const slotKey = (habitId, slotIndex = 0) => `${habitId}#${slotIndex}`

// Skipping is recorded per slot too, so dismissing one nudge clears only that
// one — the later ones in the day still come round.
export const skipKey = (habitId, slotIndex = 0) => `skip:${habitId}#${slotIndex}`

export const wasSkippedToday = (habitId, slotIndex, state = readNotified()) =>
  state[skipKey(habitId, slotIndex)] === today()

/** Marks the given slots as skipped for today. */
export function markSkipped(habitId, slotIndexes, state = readNotified()) {
  const next = { ...state }
  for (const index of slotIndexes) next[skipKey(habitId, index)] = today()
  for (const [key, day] of Object.entries(next)) {
    if (day !== today()) delete next[key]
  }
  writeJSON(REMINDER_STATE_KEY, next)
  return next
}

/** Due slots the user has not already waved away today. */
export const unskippedSlots = (habit, from = new Date(), state = readNotified()) =>
  dueSlots(habit, from).filter(({ index }) => !wasSkippedToday(habit.id, index, state))

export const wasNotifiedToday = (habitId, state = readNotified(), slotIndex = 0) =>
  state[slotKey(habitId, slotIndex)] === today()

export function markNotified(habitId, state = readNotified(), slotIndex = 0) {
  const next = { ...state, [slotKey(habitId, slotIndex)]: today() }
  // Drop entries for days gone by so this cannot grow without bound.
  for (const [key, day] of Object.entries(next)) {
    if (day !== today()) delete next[key]
  }
  writeJSON(REMINDER_STATE_KEY, next)
  return next
}

import { today } from './dates'
import { isValidTime } from './reminders'

// A habit can ask for several repeats a day ("drink water, 8 times").
//
// Two fields hold the day's state, and the split is deliberate:
//   progress[day] — how many times you have logged it today (0..target)
//   history[day]  — present ONLY once the day is finished
//
// Every existing reader (streaks, calendar, stats, rates) tests the truthiness
// of history[day]. Keeping that field meaning "complete" means none of them had
// to change, and a half-finished day can never be mistaken for a done one.

export const MIN_TARGET = 1
export const MAX_TARGET = 20

export const normalizeTarget = (value) => {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return MIN_TARGET
  return Math.min(MAX_TARGET, Math.max(MIN_TARGET, n))
}

export const targetOf = (habit) => normalizeTarget(habit?.target ?? MIN_TARGET)

export const isRepeating = (habit) => targetOf(habit) > 1

/** Times logged on a day, never above the target. */
export function countFor(habit, day = today()) {
  const target = targetOf(habit)
  // A finished day counts as full even if the tally is missing (legacy data).
  if (habit?.history?.[day]) return target
  const raw = Math.round(Number(habit?.progress?.[day]))
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(raw, target)
}

export const isComplete = (habit, day = today()) => countFor(habit, day) >= targetOf(habit)

export const remainingFor = (habit, day = today()) =>
  Math.max(0, targetOf(habit) - countFor(habit, day))

/** 0–100, for the ring on the card. */
export function percentFor(habit, day = today()) {
  const target = targetOf(habit)
  return target === 0 ? 0 : Math.round((countFor(habit, day) / target) * 100)
}

// --- reminder slots ---------------------------------------------------------

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const toTime = (minutes) => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * The times of day this habit should nudge you, evenly spread across the
 * window. Eight glasses between 08:00 and 20:00 land every ~1h43m.
 *
 * Returns [] when there is no reminder set. Falls back to a single reminder
 * when the window is missing or ends before it starts, rather than inventing
 * times that make no sense.
 */
export function reminderSlots(habit) {
  const start = habit?.reminder
  if (!isValidTime(start)) return []

  const target = targetOf(habit)
  if (target <= 1) return [start]

  const end = habit?.reminderEnd
  if (!isValidTime(end) || toMinutes(end) <= toMinutes(start)) return [start]

  const from = toMinutes(start)
  const step = (toMinutes(end) - from) / (target - 1)

  // De-duplicated: a narrow window with a high target can round two slots onto
  // the same minute, which would fire two identical notifications.
  return [...new Set(Array.from({ length: target }, (_, i) => toTime(from + step * i)))]
}

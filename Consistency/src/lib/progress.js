import { existedOn, lastDays, today } from './dates'

// Progress colour is a function of completion, so bars and figures shift from
// rose → amber → emerald as consistency improves. Classes are literal so
// Tailwind can see them.

const TONES = {
  none: { bar: 'bg-track', text: 'text-ink-3', label: 'Not started' },
  low: { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-300', label: 'Slipping' },
  mid: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', label: 'Building' },
  high: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'Strong',
  },
}

export function toneFor(pct) {
  if (!pct) return TONES.none
  if (pct >= 80) return TONES.high
  if (pct >= 50) return TONES.mid
  return TONES.low
}

/** Habits that already existed on a given day — the fair denominator. */
export const habitsOn = (habits, key) => habits.filter((h) => existedOn(h, key))

/** { total, done, pct } for one day across all habits alive that day. */
export function dayProgress(habits, key) {
  const alive = habitsOn(habits, key)
  const done = alive.filter((h) => h.history[key]).length
  return {
    total: alive.length,
    done,
    pct: alive.length === 0 ? 0 : Math.round((done / alive.length) * 100),
  }
}

/**
 * Completion rate for one habit over a window, counting only days the habit
 * actually existed. A habit created yesterday reads 100%, not 3%.
 */
export function habitRate(habit, window = 30) {
  const days = lastDays(window).filter((key) => existedOn(habit, key))
  if (days.length === 0) return 0
  const done = days.filter((key) => habit.history[key]).length
  return Math.round((done / days.length) * 100)
}

/** Same idea across every habit — the headline number. */
export function overallRate(habits, window = 30) {
  if (habits.length === 0) return 0
  let slots = 0
  let done = 0
  for (const key of lastDays(window)) {
    const alive = habitsOn(habits, key)
    slots += alive.length
    done += alive.filter((h) => h.history[key]).length
  }
  return slots === 0 ? 0 : Math.round((done / slots) * 100)
}

/** Per-day series for the bar chart, oldest → today. */
export const progressSeries = (habits, window = 14) =>
  lastDays(window).map((key) => ({ key, ...dayProgress(habits, key) }))

/** Days in the window where every living habit was completed. */
export function perfectDays(habits, window = 60) {
  return lastDays(window).filter((key) => {
    const { total, done } = dayProgress(habits, key)
    return total > 0 && done === total
  }).length
}

export const isDoneToday = (habit) => Boolean(habit.history[today()])

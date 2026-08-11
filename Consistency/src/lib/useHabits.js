import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_COLOR } from './colors'
import { today } from './dates'
import { DEFAULT_ICON } from './icons'
import { countFor, normalizeTarget, targetOf } from './targets'
import {
  HABITS_KEY,
  MAX_NAME_LENGTH,
  newId,
  normalizeHabits,
  readJSON,
  writeJSON,
} from './storage'

// Habits are the student's to choose — nothing is preset. HabitForm offers
// suggestions instead of shipping someone else's goals as defaults.

export function useHabits() {
  const [habits, setHabits] = useState(() => normalizeHabits(readJSON(HABITS_KEY, [])))

  useEffect(() => {
    writeJSON(HABITS_KEY, habits)
  }, [habits])

  // CREATE
  const addHabit = useCallback(
    ({ name, icon, color, reminder, reminderEnd, target }) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setHabits((prev) => [
        ...prev,
        {
          id: newId('h'),
          name: trimmed.slice(0, MAX_NAME_LENGTH),
          icon: icon || DEFAULT_ICON,
          emoji: null,
          reminder: reminder || null,
          reminderEnd: reminderEnd || null,
          target: normalizeTarget(target),
          color: color || DEFAULT_COLOR,
          // Recorded so past days aren't counted as missed for a brand-new habit.
          createdAt: new Date().toISOString(),
          history: {},
          progress: {},
        },
      ])
    },
    [],
  )

  // UPDATE — name/icon/colour only; history is never touched here.
  const updateHabit = useCallback(
    (id, { name, icon, color, reminder, reminderEnd, target }) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h
          const nextTarget = normalizeTarget(target)
          const key = today()
          // Lowering the target below what is already logged would leave the
          // day short of a total it has passed, so re-settle today's entry.
          const count = Math.min(countFor(h, key), nextTarget)
          const progress = { ...h.progress }
          const history = { ...h.history }
          if (count > 0) progress[key] = count
          else delete progress[key]
          if (count >= nextTarget) history[key] = h.history[key] ?? { done: true, at: null }
          else delete history[key]

          return {
            ...h,
            name: trimmed.slice(0, MAX_NAME_LENGTH),
            icon: icon || h.icon,
            // Picking an icon retires the legacy emoji for good.
            emoji: icon ? null : h.emoji,
            // `null` is a real value here — clearing the time must stick,
            // so this cannot fall back to the previous reminder.
            reminder: reminder ?? null,
            reminderEnd: reminderEnd ?? null,
            target: nextTarget,
            color,
            progress,
            history,
          }
        }),
      )
    },
    [],
  )

  // DELETE
  const removeHabit = useCallback((id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }, [])

  /**
   * Record one repeat. The day is only written to `history` — the field every
   * streak and stat reads — once the target is met, so a partly-done day can
   * never be counted as complete.
   */
  const logOnce = useCallback((id) => {
    const key = today()
    const at = new Date().toISOString()
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h
        const target = targetOf(h)
        const count = Math.min(target, countFor(h, key) + 1)
        const progress = { ...h.progress, [key]: count }
        const history = { ...h.history }
        if (count >= target) history[key] = { done: true, at }
        else delete history[key]
        return { ...h, progress, history }
      }),
    )
  }, [])

  /** Complete the day outright, whatever the tally. */
  const completeToday = useCallback((id) => {
    const key = today()
    const at = new Date().toISOString()
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              progress: { ...h.progress, [key]: targetOf(h) },
              history: { ...h.history, [key]: { done: true, at } },
            }
          : h,
      ),
    )
  }, [])

  /** Step back one repeat, for the inevitable mis-tap. */
  const undoOnce = useCallback((id) => {
    const key = today()
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h
        const count = Math.max(0, countFor(h, key) - 1)
        const progress = { ...h.progress }
        const history = { ...h.history }
        // Dropping below the target un-completes the day.
        delete history[key]
        if (count === 0) delete progress[key]
        else progress[key] = count
        return { ...h, progress, history }
      }),
    )
  }, [])

  /** Clear today entirely. */
  const undoToday = useCallback((id) => {
    const key = today()
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h
        const history = { ...h.history }
        const progress = { ...h.progress }
        delete history[key]
        delete progress[key]
        return { ...h, history, progress }
      }),
    )
  }, [])

  /** Wholesale replacement, used by backup import and reset. */
  const replaceHabits = useCallback((next) => {
    setHabits(normalizeHabits(next))
  }, [])

  return {
    habits,
    addHabit,
    updateHabit,
    removeHabit,
    logOnce,
    completeToday,
    undoOnce,
    undoToday,
    replaceHabits,
  }
}

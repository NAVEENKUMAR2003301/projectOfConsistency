import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_COLOR } from './colors'
import { today } from './dates'
import { DEFAULT_ICON } from './icons'
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
  const addHabit = useCallback(({ name, icon, color, reminder }) => {
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
        color: color || DEFAULT_COLOR,
        // Recorded so past days aren't counted as missed for a brand-new habit.
        createdAt: new Date().toISOString(),
        history: {},
      },
    ])
  }, [])

  // UPDATE — name/icon/colour only; history is never touched here.
  const updateHabit = useCallback((id, { name, icon, color, reminder }) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? {
              ...h,
              name: trimmed.slice(0, MAX_NAME_LENGTH),
              icon: icon || h.icon,
              // Picking an icon retires the legacy emoji for good.
              emoji: icon ? null : h.emoji,
              // `null` is a real value here — clearing the time must stick,
              // so this cannot fall back to the previous reminder.
              reminder: reminder ?? null,
              color,
            }
          : h,
      ),
    )
  }, [])

  // DELETE
  const removeHabit = useCallback((id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id))
  }, [])

  /** Log today's occurrence, stamped with the time it happened. */
  const completeToday = useCallback((id) => {
    const key = today()
    const at = new Date().toISOString()
    setHabits((prev) =>
      prev.map((h) =>
        h.id === id
          ? { ...h, history: { ...h.history, [key]: { done: true, at } } }
          : h,
      ),
    )
  }, [])

  /** Undo today's check-in, for the inevitable mis-tap. */
  const undoToday = useCallback((id) => {
    const key = today()
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h
        const history = { ...h.history }
        delete history[key]
        return { ...h, history }
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
    completeToday,
    undoToday,
    replaceHabits,
  }
}

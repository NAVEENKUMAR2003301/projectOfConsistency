import { DEFAULT_COLOR } from './colors'
import { today } from './dates'
import { DEFAULT_ICON, isKnownIcon } from './icons'

// One place that knows the localStorage keys and the shape of what lives in
// them. Both first-load and backup-import validate through the same
// normalisers, so an imported file can never introduce a shape that the app
// wouldn't have accepted on boot.

export const HABITS_KEY = 'consistency.habits.v1'
export const NOTES_KEY = 'consistency.notes.v1'
export const THEME_KEY = 'consistency.theme.v1'
export const BACKUP_META_KEY = 'consistency.backup-meta.v1'
export const EXPENSES_KEY = 'consistency.expenses.v1'
export const CATEGORIES_KEY = 'consistency.categories.v1'
export const SETTINGS_KEY = 'consistency.settings.v1'
export const ONBOARDED_KEY = 'consistency.onboarded.v1'

export const MAX_NAME_LENGTH = 60
export const MAX_NOTE_LENGTH = 2000
export const MAX_OCCURRENCE_NOTE = 300

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// Kept here rather than imported from reminders.js: that module imports this
// one, and a cycle would leave the pattern undefined at load time.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const newId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}${Math.random()
    .toString(36)
    .slice(2, 5)}`

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** Returns false when storage is full or blocked, so callers can warn. */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const isoOrNull = (value) => (typeof value === 'string' && value ? value : null)

/**
 * A completion used to be stored as `true`; it is now an occurrence object
 * carrying a timestamp. Both shapes are accepted and normalised to the object,
 * and every reader only tests truthiness — so old data keeps working.
 */
export function normalizeHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [day, entry] of Object.entries(value)) {
    if (!DAY_PATTERN.test(day) || !entry) continue
    if (entry === true) {
      out[day] = { done: true, at: null }
      continue
    }
    if (typeof entry === 'object' && entry.done) {
      const occurrence = { done: true, at: isoOrNull(entry.at) }
      if (typeof entry.note === 'string' && entry.note.trim()) {
        occurrence.note = entry.note.trim().slice(0, MAX_OCCURRENCE_NOTE)
      }
      out[day] = occurrence
    }
  }
  return out
}

const MAX_TARGET = 20

/** Day → times logged. Values are clamped to the habit's target. */
function normalizeProgress(value, target) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  for (const [day, raw] of Object.entries(value)) {
    if (!DAY_PATTERN.test(day)) continue
    const count = Math.round(Number(raw))
    if (!Number.isFinite(count) || count <= 0) continue
    out[day] = Math.min(count, target)
  }
  return out
}

/**
 * Keeps the two day fields consistent, whatever shape the data arrived in:
 *   - a full tally implies the day is finished, so history gains an entry
 *   - a history entry implies a full tally, so progress is filled in
 * Enforced here alone, so no caller can leave them disagreeing.
 */
function reconcileDays(history, progress, target) {
  const nextHistory = { ...history }
  const nextProgress = { ...progress }

  for (const [day, count] of Object.entries(nextProgress)) {
    if (count >= target && !nextHistory[day]) nextHistory[day] = { done: true, at: null }
  }
  for (const day of Object.keys(nextHistory)) {
    if (!nextProgress[day]) nextProgress[day] = target
  }
  return { history: nextHistory, progress: nextProgress }
}

export function normalizeHabits(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value
    .filter((h) => h && typeof h.name === 'string' && h.name.trim())
    .map((h) => {
      // A backup could carry duplicate ids; React keys and merges depend on
      // them being unique, so collisions get a fresh one.
      let id = typeof h.id === 'string' && h.id ? h.id : newId('h')
      if (seen.has(id)) id = newId('h')
      seen.add(id)
      // Legacy habits stored only an emoji. Keep it so their card looks the
      // same, and only fall back to the default icon when there is neither.
      const emoji = typeof h.emoji === 'string' && h.emoji ? h.emoji : null
      const icon = isKnownIcon(h.icon) ? h.icon : emoji ? null : DEFAULT_ICON

      // Times per day. Anything unusable means "once", which is how every
      // habit behaved before targets existed.
      const parsedTarget = Math.round(Number(h.target))
      const target = Number.isFinite(parsedTarget)
        ? Math.min(MAX_TARGET, Math.max(1, parsedTarget))
        : 1

      const { history, progress } = reconcileDays(
        normalizeHistory(h.history),
        normalizeProgress(h.progress, target),
        target,
      )

      return {
        id,
        name: h.name.trim().slice(0, MAX_NAME_LENGTH),
        icon,
        emoji,
        // Local 'HH:MM' or null; anything malformed becomes "no reminder"
        // rather than a time that silently never fires.
        reminder: TIME_PATTERN.test(h.reminder) ? h.reminder : null,
        // Only meaningful with a target above 1; the slots span reminder→end.
        reminderEnd: TIME_PATTERN.test(h.reminderEnd) ? h.reminderEnd : null,
        target,
        color: typeof h.color === 'string' && h.color ? h.color : DEFAULT_COLOR,
        createdAt: isoOrNull(h.createdAt),
        history,
        progress,
      }
    })
}

export const MAX_CATEGORY_NAME = 30
export const MAX_EXPENSE_NOTE = 80

export function normalizeCategories(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .map((c) => {
      let id = typeof c.id === 'string' && c.id ? c.id : newId('c')
      if (seen.has(id)) id = newId('c')
      seen.add(id)
      return {
        id,
        name: c.name.trim().slice(0, MAX_CATEGORY_NAME),
        icon: typeof c.icon === 'string' && c.icon ? c.icon : 'receipt',
        color: typeof c.color === 'string' && c.color ? c.color : DEFAULT_COLOR,
      }
    })
}

export function normalizeExpenses(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value
    .map((e) => {
      if (!e) return null
      // Stored as integer minor units; anything else is unusable, and a
      // silently-zeroed expense would quietly understate every total.
      const amount = Math.round(Number(e.amount))
      if (!Number.isFinite(amount) || amount <= 0) return null

      let id = typeof e.id === 'string' && e.id ? e.id : newId('e')
      if (seen.has(id)) id = newId('e')
      seen.add(id)

      return {
        id,
        amount,
        categoryId: typeof e.categoryId === 'string' && e.categoryId ? e.categoryId : null,
        note: typeof e.note === 'string' ? e.note.trim().slice(0, MAX_EXPENSE_NOTE) : '',
        day: DAY_PATTERN.test(e.day) ? e.day : today(),
        createdAt: isoOrNull(e.createdAt),
      }
    })
    .filter(Boolean)
}

export function normalizeNotes(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  return value
    .filter((n) => n && typeof n.text === 'string' && n.text.trim())
    .map((n) => {
      let id = typeof n.id === 'string' && n.id ? n.id : newId('n')
      if (seen.has(id)) id = newId('n')
      seen.add(id)
      return {
        id,
        text: n.text.slice(0, MAX_NOTE_LENGTH),
        day: DAY_PATTERN.test(n.day) ? n.day : today(),
        createdAt: isoOrNull(n.createdAt),
        updatedAt: isoOrNull(n.updatedAt),
      }
    })
}

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

export const MAX_NAME_LENGTH = 60
export const MAX_NOTE_LENGTH = 2000
export const MAX_OCCURRENCE_NOTE = 300

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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

      return {
        id,
        name: h.name.trim().slice(0, MAX_NAME_LENGTH),
        icon,
        emoji,
        color: typeof h.color === 'string' && h.color ? h.color : DEFAULT_COLOR,
        createdAt: isoOrNull(h.createdAt),
        history: normalizeHistory(h.history),
      }
    })
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

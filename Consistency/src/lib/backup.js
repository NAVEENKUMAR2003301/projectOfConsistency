import { dayKey } from './dates'
import { normalizeHabits, normalizeNotes } from './storage'

export const BACKUP_VERSION = 1
export const BACKUP_APP = 'consistency'

export function buildBackup({ habits, notes }, now = new Date()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    habits,
    notes,
  }
}

export const backupFilename = (now = new Date()) =>
  `consistency-backup-${dayKey(now)}.json`

/**
 * Parses and validates a backup file. Throws Errors whose messages are written
 * for the person who picked the wrong file, not for a developer.
 */
export function parseBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON. Pick the .json file you exported.')
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('That file does not look like a Consistency backup.')
  }
  if (data.app && data.app !== BACKUP_APP) {
    throw new Error('That backup was made by a different app.')
  }
  if (!('habits' in data) && !('notes' in data)) {
    throw new Error('That file has no habits or notes in it.')
  }
  if (typeof data.version === 'number' && data.version > BACKUP_VERSION) {
    throw new Error(
      'That backup came from a newer version of the app. Update it before importing.',
    )
  }

  // Reuse the boot-time normalisers, so an import can never introduce a shape
  // the app would have rejected on load.
  const habits = normalizeHabits(data.habits)
  const notes = normalizeNotes(data.notes)

  if (habits.length === 0 && notes.length === 0) {
    throw new Error('That backup is empty — nothing to import.')
  }

  return { habits, notes, exportedAt: data.exportedAt ?? null }
}

const nameKey = (habit) => habit.name.trim().toLowerCase()

/**
 * Union of two habit lists. Ids are random per device, so a habit created
 * separately on a phone and a laptop is matched by name too — otherwise a
 * merge would silently produce two "Revise 1 chapter" cards.
 * Existing name/emoji/colour win; history is unioned so no check-in is lost.
 */
export function mergeHabits(current, incoming) {
  const merged = current.map((h) => ({ ...h, history: { ...h.history } }))
  const byId = new Map(merged.map((h) => [h.id, h]))
  const byName = new Map(merged.map((h) => [nameKey(h), h]))

  for (const candidate of incoming) {
    const match = byId.get(candidate.id) ?? byName.get(nameKey(candidate))
    if (match) {
      for (const [day, occurrence] of Object.entries(candidate.history)) {
        if (!match.history[day]) match.history[day] = occurrence
      }
      // Keep the earliest known creation date, or the merge could hide history.
      if (candidate.createdAt && (!match.createdAt || candidate.createdAt < match.createdAt)) {
        match.createdAt = candidate.createdAt
      }
    } else {
      const copy = { ...candidate, history: { ...candidate.history } }
      merged.push(copy)
      byId.set(copy.id, copy)
      byName.set(nameKey(copy), copy)
    }
  }
  return merged
}

/** Union of two note lists, newest first, skipping identical re-imports. */
export function mergeNotes(current, incoming) {
  const merged = [...current]
  const ids = new Set(merged.map((n) => n.id))
  const fingerprints = new Set(merged.map((n) => `${n.day}::${n.text}`))

  for (const note of incoming) {
    const fingerprint = `${note.day}::${note.text}`
    if (ids.has(note.id) || fingerprints.has(fingerprint)) continue
    merged.push(note)
    ids.add(note.id)
    fingerprints.add(fingerprint)
  }

  return merged.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

/** Triggers a file download. Returns false if the browser blocked it. */
export function downloadBackup(payload, filename) {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoke on the next tick; revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}

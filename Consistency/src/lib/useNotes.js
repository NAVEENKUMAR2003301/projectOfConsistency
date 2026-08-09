import { useCallback, useEffect, useState } from 'react'
import { today } from './dates'
import {
  MAX_NOTE_LENGTH,
  NOTES_KEY,
  newId,
  normalizeNotes,
  readJSON,
  writeJSON,
} from './storage'

export { MAX_NOTE_LENGTH }

/** Plans written in the student's own words. Newest first. */
export function useNotes() {
  const [notes, setNotes] = useState(() => normalizeNotes(readJSON(NOTES_KEY, [])))

  useEffect(() => {
    writeJSON(NOTES_KEY, notes)
  }, [notes])

  const addNote = useCallback((text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    setNotes((prev) => [
      {
        id: newId('n'),
        text: trimmed.slice(0, MAX_NOTE_LENGTH),
        day: today(),
        createdAt: now,
        updatedAt: now,
      },
      ...prev,
    ])
  }, [])

  const updateNote = useCallback((id, text) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, text: trimmed.slice(0, MAX_NOTE_LENGTH), updatedAt: now }
          : n,
      ),
    )
  }, [])

  const removeNote = useCallback((id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  /** Wholesale replacement, used by backup import and reset. */
  const replaceNotes = useCallback((next) => {
    setNotes(normalizeNotes(next))
  }, [])

  return { notes, addNote, updateNote, removeNote, replaceNotes }
}

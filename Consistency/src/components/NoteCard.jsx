import { useEffect, useState } from 'react'
import PaperTextarea from './PaperTextarea'
import { dayLabel, timeLabel } from '../lib/dates'
import { UI } from '../lib/icons'
import { MAX_NOTE_LENGTH } from '../lib/useNotes'

export default function NoteCard({ note, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.text)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Deleting is destructive and there is no undo, so the confirm expires
  // rather than sitting armed under the cursor.
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const startEdit = () => {
    setDraft(note.text)
    setEditing(true)
  }

  const save = () => {
    if (!draft.trim()) return
    onUpdate(note.id, draft)
    setEditing(false)
  }

  const edited = note.updatedAt && note.updatedAt !== note.createdAt
  const time = timeLabel(note.createdAt)

  return (
    <article className="overflow-hidden rounded-2xl border border-line shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-4 py-2">
        <p className="text-xs text-ink-3">
          {dayLabel(note.day)}
          {time && ` · ${time}`}
          {edited && ' · edited'}
        </p>

        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={!draft.trim()}
                className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-2 py-1 text-xs text-ink-3 transition hover:bg-card-hover hover:text-ink"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                aria-label="Edit note"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition hover:bg-card-hover hover:text-ink"
              >
                <UI.edit size={15} strokeWidth={1.9} aria-hidden="true" />
              </button>
              <button
                onClick={() =>
                  confirmDelete ? onRemove(note.id) : setConfirmDelete(true)
                }
                aria-label={confirmDelete ? 'Confirm delete note' : 'Delete note'}
                className={`flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs transition ${
                  confirmDelete
                    ? 'bg-rose-500 font-semibold text-white'
                    : 'w-8 text-ink-3 hover:bg-card-hover hover:text-rose-500'
                }`}
              >
                {confirmDelete ? 'Sure?' : <UI.remove size={15} strokeWidth={1.9} aria-hidden="true" />}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <>
          <PaperTextarea
            value={draft}
            onChange={setDraft}
            onCancel={() => setEditing(false)}
            onSubmit={save}
            autoFocus
            minRows={3}
            label="Edit note"
          />
          <p className="bg-card px-4 py-1.5 text-right text-[11px] text-ink-3">
            {draft.length}/{MAX_NOTE_LENGTH} · Esc to cancel
          </p>
        </>
      ) : (
        // whitespace-pre-wrap preserves the student's own line breaks.
        <div className="paper whitespace-pre-wrap">{note.text}</div>
      )}
    </article>
  )
}

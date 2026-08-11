import { useState } from 'react'
import NoteCard from './NoteCard'
import PaperTextarea from './PaperTextarea'
import { UI } from '../lib/icons'
import { MAX_NOTE_LENGTH } from '../lib/useNotes'

const VISIBLE_STEP = 4

export default function NotesSection({ notes, onAdd, onUpdate, onRemove }) {
  const [draft, setDraft] = useState('')
  const [visible, setVisible] = useState(VISIBLE_STEP)

  const save = () => {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
    // A brand-new note lands on top; make sure it is within the visible slice.
    setVisible((v) => Math.max(v, VISIBLE_STEP))
  }

  const shown = notes.slice(0, visible)
  const hidden = notes.length - shown.length

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <UI.notes size={18} strokeWidth={1.9} aria-hidden="true" />
          Plan &amp; notes
        </h2>
        <p className="text-xs text-ink-3">
          {notes.length === 0
            ? 'Nothing written yet'
            : `${notes.length} note${notes.length === 1 ? '' : 's'}`}
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        Write the plan in your own words — what you will actually do today.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-line shadow-sm">
        <PaperTextarea
          value={draft}
          onChange={setDraft}
          onSubmit={save}
          onCancel={() => setDraft('')}
          placeholder="Today I will…"
          minRows={3}
          label="Write a new note"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-card px-4 py-2.5">
          <p className="text-[11px] text-ink-3">
            {draft.length}/{MAX_NOTE_LENGTH} · Ctrl + Enter to save
          </p>
          <div className="flex items-center gap-1">
            {draft && (
              <button
                onClick={() => setDraft('')}
                className="rounded-lg px-3 py-1.5 text-xs text-ink-3 transition hover:bg-card-hover hover:text-ink"
              >
                Clear
              </button>
            )}
            {/* Matches the filled primary action used on the other tabs. */}
            <button
              onClick={save}
              disabled={!draft.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/25 transition-all duration-200 hover:bg-violet-500 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              <UI.plus size={14} strokeWidth={2.6} aria-hidden="true" />
              Add note
            </button>
          </div>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="mt-4 space-y-4">
          {shown.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}

          {hidden > 0 && (
            <button
              onClick={() => setVisible((v) => v + VISIBLE_STEP)}
              className="w-full rounded-2xl border border-dashed border-line-strong py-3 text-sm text-ink-3 transition hover:bg-card hover:text-ink"
            >
              Show {Math.min(hidden, VISIBLE_STEP)} older note
              {Math.min(hidden, VISIBLE_STEP) === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

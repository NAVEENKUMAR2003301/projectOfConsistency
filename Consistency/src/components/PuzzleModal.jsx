import { useEffect, useRef, useState } from 'react'
import HabitGlyph from './HabitGlyph'
import { generatePuzzle } from '../lib/puzzles'
import { colorOf } from '../lib/colors'
import { UI } from '../lib/icons'

/**
 * A ten-second gate in front of a check-in. Wrong answers never block you —
 * they just hand you a fresh puzzle, so the app can't become a reason to quit.
 */
export default function PuzzleModal({ habit, onSolved, onClose }) {
  const [puzzle, setPuzzle] = useState(generatePuzzle)
  const [wrong, setWrong] = useState(null)
  const [solved, setSolved] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const panelRef = useRef(null)
  const timers = useRef([])
  const c = colorOf(habit.color)

  // Track every timeout so none of them fire after the modal is gone.
  const later = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (e) => {
      // Once solved, the check-in is already on its way — closing here would
      // drop it on the floor.
      if (e.key === 'Escape' && !solved) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, solved])

  const answer = (option) => {
    if (solved || wrong) return

    if (option === puzzle.answer) {
      setSolved(true)
      // Let the correct-answer state render before handing control back.
      later(onSolved, 450)
      return
    }

    setWrong(option)
    const missed = attempts + 1
    setAttempts(missed)
    later(() => {
      setWrong(null)
      if (missed >= 2) {
        // Two misses is enough friction — swap in a different puzzle.
        setPuzzle(generatePuzzle())
        setAttempts(0)
        setShowHint(false)
      } else {
        setShowHint(true)
      }
    }, 500)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4"
      style={{ background: 'var(--backdrop)', backdropFilter: 'blur(4px)' }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Puzzle to check in: ${habit.name}`}
        className={`glass animate-pop my-auto w-full max-w-md rounded-3xl p-5 outline-none sm:p-6 ${
          wrong ? 'animate-shake' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.18em] text-ink-3 uppercase">
              {puzzle.type}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold break-words text-ink">
              <HabitGlyph habit={habit} size={20} className={`shrink-0 ${c.text}`} />
              {habit.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={solved}
            aria-label="Cancel"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-card-hover hover:text-ink disabled:opacity-30"
          >
            <UI.close size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div
          className={`mt-6 rounded-2xl border border-line ${c.soft} px-4 py-6 text-center sm:px-5 sm:py-7`}
        >
          <p className="text-xl leading-relaxed font-semibold break-words whitespace-pre-line text-ink sm:text-2xl">
            {puzzle.prompt}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
          {puzzle.options.map((option) => {
            const isWrong = wrong === option
            const isRight = solved && option === puzzle.answer
            return (
              <button
                key={option}
                onClick={() => answer(option)}
                disabled={solved}
                className={`rounded-2xl border px-3 py-4 text-base font-semibold break-words transition-all duration-200 sm:text-lg ${
                  isRight
                    ? 'scale-105 border-emerald-500 bg-emerald-500/20 text-emerald-700 shadow-lg shadow-emerald-500/20 dark:text-emerald-200'
                    : isWrong
                      ? 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-200'
                      : 'border-line bg-card text-ink hover:-translate-y-0.5 hover:border-violet-500/50 hover:bg-card-hover hover:shadow-lg active:scale-95'
                } disabled:cursor-default`}
              >
                {option}
              </button>
            )
          })}
        </div>

        <p className="mt-5 min-h-10 text-center text-sm text-ink-3">
          {solved
            ? 'Nice. Locking it in…'
            : showHint
              ? puzzle.hint
              : 'Solve it to log today. No wrong answer costs you anything.'}
        </p>

        {!solved && (
          <button
            onClick={() => {
              setPuzzle(generatePuzzle())
              setShowHint(false)
              setAttempts(0)
            }}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm text-ink-3 transition hover:text-ink"
          >
            <UI.retry size={14} strokeWidth={1.9} aria-hidden="true" />
            Give me a different one
          </button>
        )}
      </div>
    </div>
  )
}

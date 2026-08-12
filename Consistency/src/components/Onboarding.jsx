import { useEffect, useState } from 'react'
import { UI } from '../lib/icons'

/**
 * Shown once, on a first visit. It explains the one thing that is genuinely
 * surprising about this app — that logging a habit asks you a puzzle — and then
 * gets out of the way. It is skippable from the first frame: nobody should have
 * to read four screens before they can start.
 */

const STEPS = [
  {
    Icon: UI.today,
    title: 'Build one day at a time',
    body: 'Track the habits that matter to you. Nothing is preset — you choose what to add, and you can change or delete any of it later.',
    detail: 'Miss a day? Start again. The streak is a nudge, not a punishment.',
  },
  {
    Icon: UI.sparkles,
    title: 'A tiny puzzle to check in',
    body: 'Logging a habit asks you a five-second puzzle first. It sounds odd, and it is the point: a checkbox gets tapped without thinking, a puzzle makes you notice you actually did the thing.',
    detail: 'Wrong answers never cost you anything — you just get a different puzzle.',
  },
  {
    Icon: UI.bell,
    title: 'Reminders that fit your day',
    body: 'Set a time for any habit. For things you repeat — eight glasses of water, say — set how many times, and reminders spread across the hours you choose.',
    detail: 'Skip one and only that one goes quiet; the rest still arrive.',
  },
  {
    Icon: UI.money,
    title: 'Money and notes, in the same place',
    body: 'Track what you spend with your own categories, and write your plan out by hand on ruled paper. Consistency is not only about habits.',
    detail: 'Everything stays on your device unless you choose otherwise.',
  },
  {
    Icon: UI.data,
    title: 'Your data is yours',
    body: 'No account needed. Nothing is uploaded, and there is no tracking of any kind. Export a backup any time as a spreadsheet or JSON file.',
    detail: 'Sign in later only if you want reminders while the app is closed.',
  },
]

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const { Icon, title, body, detail } = STEPS[step]

  // Escape skips, like any other dialog in the app.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onDone()
      if (e.key === 'ArrowRight' && step < STEPS.length - 1) setStep((s) => s + 1)
      if (e.key === 'ArrowLeft' && step > 0) setStep((s) => s - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone, step])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-4 sm:items-center"
      style={{ background: 'var(--backdrop)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Consistency"
    >
      <div className="glass animate-rise my-auto w-full max-w-md rounded-3xl p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
          </span>
          {/* Reachable from the very first frame. */}
          <button
            onClick={onDone}
            className="rounded-lg px-3 py-1.5 text-xs text-ink-3 transition hover:bg-card-hover hover:text-ink"
          >
            Skip
          </button>
        </div>

        {/* Keyed so each step animates in rather than swapping text in place. */}
        <div key={step} className="animate-tab mt-5">
          <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
          <p className="mt-3 text-xs text-ink-3">{detail}</p>
        </div>

        <div className="mt-6 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-violet-500' : 'w-1.5 bg-track'
              }`}
            />
          ))}
          <span className="ml-auto text-[11px] text-ink-3">
            {step + 1} of {STEPS.length}
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-line px-4 py-3 text-sm text-ink-2 transition hover:bg-card-hover hover:text-ink"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-500 active:scale-[0.98]"
          >
            {isLast ? 'Start' : 'Next'}
            {!isLast && <UI.next size={16} strokeWidth={2.4} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  )
}

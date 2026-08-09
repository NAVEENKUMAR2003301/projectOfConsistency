import { useMemo, useState } from 'react'
import HabitGlyph from './HabitGlyph'
import {
  WEEKDAY_INITIALS,
  dayLabel,
  isFuture,
  monthMatrix,
  monthTitle,
  shiftMonth,
  timeLabel,
  today,
} from '../lib/dates'
import { UI } from '../lib/icons'
import { dayProgress, habitsOn } from '../lib/progress'

const now = () => {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() }
}

// Five heat levels rather than done/not-done: a day where you managed 3 of 4
// habits should not look identical to one where you managed 1.
const HEAT = [
  'bg-track text-ink-3',
  'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200',
  'bg-emerald-500/40 text-emerald-900 dark:text-emerald-50',
  'bg-emerald-500/70 text-white',
  'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
]

function levelFor({ total, done }) {
  if (total === 0 || done === 0) return 0
  const ratio = done / total
  if (ratio === 1) return 4
  if (ratio >= 0.67) return 3
  if (ratio >= 0.34) return 2
  return 1
}

function Stat({ value, label, accent = 'text-ink' }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-3 py-2.5 text-center">
      <p className={`text-lg leading-none font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-ink-3">{label}</p>
    </div>
  )
}

export default function CalendarView({ habits }) {
  const [view, setView] = useState(now)
  const [selected, setSelected] = useState(null)

  const cells = useMemo(() => monthMatrix(view.year, view.month), [view])
  const current = now()
  // Nothing to see in the future, so forward navigation stops at this month.
  const atCurrentMonth = view.year === current.year && view.month === current.month

  const summary = useMemo(() => {
    let slots = 0
    let done = 0
    let perfect = 0
    let active = 0
    let tracked = 0

    for (const key of cells) {
      if (!key || isFuture(key)) continue
      const progress = dayProgress(habits, key)
      if (progress.total === 0) continue
      tracked++
      slots += progress.total
      done += progress.done
      if (progress.done === progress.total) perfect++
      if (progress.done > 0) active++
    }

    return {
      tracked,
      perfect,
      active,
      pct: slots === 0 ? 0 : Math.round((done / slots) * 100),
    }
  }, [habits, cells])

  const goto = (delta) => {
    setSelected(null) // a day key from the old month would be off-screen
    setView((v) => shiftMonth(v, delta))
  }

  const selectedProgress = selected ? dayProgress(habits, selected) : null
  const selectedHabits = selected ? habitsOn(habits, selected) : []

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink">
            {monthTitle(view.year, view.month)}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {summary.tracked === 0
              ? 'Nothing tracked this month yet'
              : `${summary.pct}% of everything you set out to do`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => goto(-1)}
            aria-label="Previous month"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-2 transition hover:bg-card-hover hover:text-ink"
          >
            <UI.prev size={15} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <button
            onClick={() => {
              setSelected(null)
              setView(now)
            }}
            disabled={atCurrentMonth}
            className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink-2 transition hover:bg-card-hover hover:text-ink disabled:opacity-40"
          >
            Today
          </button>
          <button
            onClick={() => goto(1)}
            disabled={atCurrentMonth}
            aria-label="Next month"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line text-ink-2 transition hover:bg-card-hover hover:text-ink disabled:opacity-40"
          >
            <UI.next size={15} strokeWidth={1.9} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat
          value={summary.perfect}
          label="Perfect days"
          accent="text-emerald-600 dark:text-emerald-300"
        />
        <Stat value={summary.active} label="Days with progress" />
        <Stat value={summary.tracked} label="Days tracked" />
      </div>

      <div className="mt-3 overflow-hidden rounded-3xl border border-line bg-card p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAY_INITIALS.map((d, i) => (
            <div
              key={i}
              className="pb-1.5 text-center text-[10px] font-semibold tracking-wider text-ink-3 uppercase"
            >
              {d}
            </div>
          ))}

          {cells.map((key, i) => {
            if (!key) return <div key={`pad-${i}`} />

            const future = isFuture(key)
            const progress = dayProgress(habits, key)
            const level = levelFor(progress)
            const isToday = key === today()
            const isSelected = key === selected
            const dayNumber = Number(key.slice(-2))

            return (
              <button
                key={key}
                type="button"
                disabled={future}
                onClick={() => setSelected(isSelected ? null : key)}
                aria-label={`${dayLabel(key)} — ${
                  future
                    ? 'upcoming'
                    : progress.total === 0
                      ? 'nothing tracked'
                      : `${progress.done} of ${progress.total} done`
                }`}
                aria-pressed={isSelected}
                // Stagger keeps the month from snapping in all at once.
                style={{ animationDelay: `${Math.min(i * 8, 240)}ms` }}
                className={`animate-rise grid aspect-square place-items-center rounded-xl text-xs font-semibold transition-transform duration-200 ${
                  future
                    ? 'cursor-default border border-dashed border-line text-ink-3/50'
                    : `${HEAT[level]} hover:z-10 hover:scale-110`
                } ${isToday ? 'ring-2 ring-violet-500 ring-offset-1 ring-offset-card' : ''} ${
                  isSelected ? 'ring-2 ring-ink ring-offset-1 ring-offset-card' : ''
                }`}
              >
                {dayNumber}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">Tap a day for detail</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-3">Less</span>
          {HEAT.map((cls, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded ${cls.split(' ')[0]}`} />
          ))}
          <span className="text-[10px] text-ink-3">More</span>
        </div>
      </div>

      {selected && (
        <div className="animate-rise mt-4 rounded-3xl border border-line bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">{dayLabel(selected)}</h3>
              <p className="mt-0.5 text-xs text-ink-3">
                {selectedProgress.total === 0
                  ? 'No habits were being tracked yet'
                  : `${selectedProgress.done} of ${selectedProgress.total} done · ${selectedProgress.pct}%`}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close day detail"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-card-hover hover:text-ink"
            >
              <UI.close size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {selectedHabits.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {selectedHabits.map((habit) => {
                const occurrence = habit.history[selected]
                const at = occurrence ? timeLabel(occurrence.at) : ''
                return (
                  <li
                    key={habit.id}
                    className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2 text-sm"
                  >
                    <HabitGlyph habit={habit} size={16} className="shrink-0 text-ink-3" />
                    <span className={`min-w-0 flex-1 truncate ${occurrence ? 'text-ink' : 'text-ink-3'}`}>
                      {habit.name}
                    </span>
                    {at && <span className="shrink-0 text-[11px] text-ink-3">{at}</span>}
                    {occurrence ? (
                      <UI.today
                        size={16}
                        strokeWidth={2}
                        className="shrink-0 text-emerald-500"
                        aria-label="Done"
                      />
                    ) : (
                      <UI.close
                        size={16}
                        strokeWidth={2}
                        className="shrink-0 text-ink-3/60"
                        aria-label="Missed"
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-ink-3">
        Days before a habit was created are not counted against you.
      </p>
    </section>
  )
}

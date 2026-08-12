import { useEffect, useState } from 'react'
import BadgeRow from './BadgeRow'
import HabitGlyph from './HabitGlyph'
import { colorOf } from '../lib/colors'
import { UI } from '../lib/icons'
import {
  bestStreak,
  currentStreak,
  lastDays,
  monthDayLabel,
  timeLabel,
  today,
  weekdayLabel,
} from '../lib/dates'
import { habitRate, toneFor } from '../lib/progress'
import { formatTime } from '../lib/reminders'
import { countFor, reminderSlots, targetOf } from '../lib/targets'

export default function HabitCard({
  habit,
  onCheckIn,
  onLogOne,
  onUndoOne,
  onUndo,
  onEdit,
  onRemove,
  index = 0,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const c = colorOf(habit.color)
  const done = Boolean(habit.history[today()])
  const target = targetOf(habit)
  const logged = countFor(habit)
  const repeating = target > 1
  const streak = currentStreak(habit.history)
  const best = bestStreak(habit.history)
  const slots = reminderSlots(habit)
  const rate = habitRate(habit, 30)
  const tone = toneFor(rate)
  const days = lastDays(14)

  // Deleting is destructive and there is no undo, so the confirm expires
  // rather than sitting armed under the cursor.
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(false), 4000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  return (
    <article
      // Cards arrive in sequence rather than all at once; capped so a long
      // list never feels like it is loading slowly.
      style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
      className={`group animate-rise relative overflow-hidden rounded-3xl p-4 transition-all duration-300 hover:-translate-y-0.5 sm:p-5 ${
        done ? `border ${c.border} ${c.soft}` : 'glass glass-hover'
      }`}
    >
      {done && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br ${c.glowFrom} to-transparent blur-2xl`}
        />
      )}

      <header className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${c.soft} ${c.text} ${
              done ? 'animate-float' : ''
            }`}
          >
            <HabitGlyph habit={habit} size={21} />
          </span>
          <div className="min-w-0">
            <h3 className="leading-tight font-semibold break-words text-ink">
              {habit.name}
            </h3>
            {habit.reminder && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                <UI.bell size={12} strokeWidth={1.9} aria-hidden="true" />
                {/* Counted from the slots that will actually fire, not from the
                    target: an end time earlier than the start collapses to a
                    single reminder, and claiming otherwise would be a lie. */}
                {slots.length > 1
                  ? `${slots.length} reminders, ${formatTime(slots[0])}–${formatTime(slots.at(-1))}`
                  : `Reminder at ${formatTime(habit.reminder)}`}
              </p>
            )}
            <p className="mt-0.5 text-sm text-ink-3">
              {streak > 0 ? (
                <span className={`inline-flex items-center gap-1 ${c.text}`}>
                  <UI.flame size={14} strokeWidth={2} aria-hidden="true" />
                  {streak} day{streak === 1 ? '' : 's'} in a row
                </span>
              ) : (
                'No streak yet — today can start one'
              )}
            </p>
          </div>
        </div>

        {/* Always visible on touch devices; hover-revealed on desktop. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onEdit(habit)}
            aria-label={`Edit ${habit.name}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition hover:bg-card-hover hover:text-ink"
          >
            <UI.edit size={15} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <button
            onClick={() => (confirmDelete ? onRemove(habit.id) : setConfirmDelete(true))}
            aria-label={confirmDelete ? `Confirm delete ${habit.name}` : `Delete ${habit.name}`}
            className={`flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs transition ${
              confirmDelete
                ? 'bg-rose-500 font-semibold text-white'
                : 'w-8 text-ink-3 hover:bg-card-hover hover:text-rose-500'
            }`}
          >
            {confirmDelete ? 'Sure?' : <UI.remove size={15} strokeWidth={1.9} aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* Today's tally, so a part-finished day is visible at a glance. */}
      {repeating && !done && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between text-[11px] text-ink-3">
            <span>Today</span>
            <span className="flex items-center gap-2">
              <span className="tabular">
                {logged} of {target}
              </span>
              {/* Without this there is no way back from a mis-tap: the undo
                  below only appears once the day is finished. */}
              {logged > 0 && (
                <button
                  onClick={() => onUndoOne(habit)}
                  aria-label={`Undo one for ${habit.name}`}
                  className="rounded px-1.5 py-0.5 text-[11px] text-ink-3 transition hover:bg-card-hover hover:text-ink"
                >
                  undo one
                </button>
              )}
            </span>
          </div>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: target }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < logged ? c.fill : 'bg-track'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <p className="relative mt-5 text-[11px] tracking-wide text-ink-3 uppercase">
        Last <span className="sm:hidden">7</span>
        <span className="hidden sm:inline">14</span> days
      </p>

      <div className="relative mt-2 flex items-end gap-1">
        {days.map((key, i) => {
          const occurrence = habit.history[key]
          const hit = Boolean(occurrence)
          const isToday = key === today()
          // Occurrences carry a timestamp, so the tooltip can say when.
          const at = hit ? timeLabel(occurrence.at) : ''
          return (
            <div
              key={key}
              // 14 cells is unreadable under ~380px, so phones show the last 7.
              className={`flex-1 flex-col items-center gap-1.5 ${
                i < 7 ? 'hidden sm:flex' : 'flex'
              }`}
            >
              <div
                title={`${monthDayLabel(key)} — ${hit ? `done${at ? ` at ${at}` : ''}` : 'missed'}`}
                className={`h-8 w-full rounded-md transition-all duration-300 ${
                  hit ? c.fill : 'bg-track'
                } ${isToday ? 'ring-2 ring-ink-3 ring-offset-2 ring-offset-surface' : ''}`}
              />
              <span className="text-[10px] text-ink-3">{weekdayLabel(key)}</span>
            </div>
          )
        })}
      </div>

      <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        <dl className="flex gap-5 text-sm">
          <div>
            <dt className="text-[11px] tracking-wide text-ink-3 uppercase">Best</dt>
            <dd className="tabular font-semibold text-ink">{best}d</dd>
          </div>
          <div>
            <dt className="text-[11px] tracking-wide text-ink-3 uppercase">30-day</dt>
            {/* Colour tracks the number, so a slipping habit reads as slipping. */}
            <dd className={`tabular font-semibold ${tone.text}`}>{rate}%</dd>
          </div>
        </dl>

        {done ? (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-sm font-semibold ${c.text}`}>
              <UI.today size={16} strokeWidth={2} aria-hidden="true" />
              Done today
            </span>
            <button
              onClick={() => onUndo(habit.id)}
              className="rounded-lg px-2 py-1 text-xs text-ink-3 transition hover:bg-card-hover hover:text-ink"
            >
              undo
            </button>
          </div>
        ) : (
          <button
            // A repeating habit logs one tap at a time; only the tap that
            // completes the day goes through the puzzle, so logging water
            // eight times does not mean eight puzzles.
            onClick={() => (repeating && logged < target - 1 ? onLogOne(habit) : onCheckIn(habit))}
            className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.03] active:scale-95 sm:flex-none ${c.button}`}
          >
            {repeating ? `Log one · ${logged}/${target}` : 'Check in'}
          </button>
        )}
      </div>

      <BadgeRow best={best} tone={tone} />
    </article>
  )
}

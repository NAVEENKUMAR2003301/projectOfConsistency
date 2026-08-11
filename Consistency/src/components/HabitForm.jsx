import { useState } from 'react'
import { COLORS, COLOR_KEYS, DEFAULT_COLOR, colorOf } from '../lib/colors'
import { DEFAULT_ICON, HABIT_ICONS, HABIT_ICON_MAP, UI } from '../lib/icons'
import { formatTime } from '../lib/reminders'
import { MAX_TARGET, MIN_TARGET, normalizeTarget, reminderSlots } from '../lib/targets'

// Starting points, not defaults — one tap fills the form, then it's editable.
const SUGGESTIONS = [
  { name: 'Revise 1 chapter', icon: 'book' },
  { name: '30 min focused study', icon: 'timer' },
  { name: 'Solve 5 practice problems', icon: 'calculator' },
  { name: 'Learn 10 new words', icon: 'languages' },
  { name: 'Review yesterday’s notes', icon: 'notebook' },
  { name: 'No phone for the first hour', icon: 'phone-off' },
  { name: 'Sleep before 11 PM', icon: 'moon' },
  { name: '20 min exercise', icon: 'run' },
]

export default function HabitForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Add habit',
  takenNames = [],
}) {
  const [name, setName] = useState(initial?.name ?? '')
  // A legacy habit has an emoji and no icon; leave the grid unselected rather
  // than silently reassigning one, so nothing changes unless they choose.
  const [icon, setIcon] = useState(
    initial ? (HABIT_ICON_MAP[initial.icon] ? initial.icon : null) : DEFAULT_ICON,
  )
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR)
  const [reminder, setReminder] = useState(initial?.reminder ?? '')
  const [reminderEnd, setReminderEnd] = useState(initial?.reminderEnd ?? '')
  const [target, setTarget] = useState(String(initial?.target ?? 1))
  const [error, setError] = useState('')

  const targetNumber = normalizeTarget(target)
  const repeating = targetNumber > 1
  // Shows the actual times before saving, so the spread is never a surprise.
  const slotPreview = reminderSlots({ reminder, reminderEnd, target: targetNumber })

  const isEdit = Boolean(initial)

  const submit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the habit a name first.')
      return
    }
    const clash = takenNames.some(
      (n) => n.toLowerCase() === trimmed.toLowerCase(),
    )
    if (clash) {
      setError('You already track a habit with that name.')
      return
    }
    onSubmit({
      name: trimmed,
      icon,
      color,
      reminder: reminder || null,
      // Only meaningful for a repeating habit; stored as null otherwise so a
      // stale window cannot resurface if the target goes back to once a day.
      reminderEnd: repeating ? reminderEnd || null : null,
      target: targetNumber,
    })
  }

  return (
    <form
      onSubmit={submit}
      className="animate-rise glass rounded-3xl p-4 sm:p-5"
    >
      <label htmlFor="habit-name" className="text-sm font-medium text-ink-2">
        {isEdit ? 'Habit name' : 'What will you do every day?'}
      </label>
      <input
        id="habit-name"
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError('')
        }}
        placeholder="e.g. Solve 5 practice problems"
        maxLength={60}
        aria-invalid={Boolean(error)}
        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder-ink-3 outline-none focus:border-violet-500"
      />
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <p className={`text-xs ${error ? 'text-rose-500' : 'text-transparent'}`}>
          {error || '.'}
        </p>
        <p className="shrink-0 text-xs text-ink-3">{name.length}/60</p>
      </div>

      {!isEdit && (
        <>
          <p className="mt-1 text-sm font-medium text-ink-2">Need an idea?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => {
              const { Icon } = HABIT_ICON_MAP[s.icon]
              return (
                <button
                  type="button"
                  key={s.name}
                  onClick={() => {
                    setName(s.name)
                    setIcon(s.icon)
                    setError('')
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2 transition hover:border-line-strong hover:text-ink"
                >
                  <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                  {s.name}
                </button>
              )
            })}
          </div>
        </>
      )}

      <p className="mt-4 text-sm font-medium text-ink-2">Icon</p>
      {initial?.emoji && !icon && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
          <span aria-hidden="true">{initial.emoji}</span>
          Currently using an emoji — pick an icon below to replace it.
        </p>
      )}
      <div className="mt-2 grid grid-cols-8 gap-1.5 sm:gap-2">
        {HABIT_ICONS.map(({ key, label, Icon }) => {
          const active = icon === key
          return (
            <button
              type="button"
              key={key}
              onClick={() => setIcon(key)}
              aria-pressed={active}
              aria-label={label}
              title={label}
              className={`grid aspect-square place-items-center rounded-xl transition ${
                active
                  ? 'bg-violet-600 text-white ring-2 ring-violet-400'
                  : 'bg-surface text-ink-2 hover:bg-card-hover hover:text-ink'
              }`}
            >
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-sm font-medium text-ink-2">Colour</p>
      <div className="mt-2 flex flex-wrap gap-2.5">
        {COLOR_KEYS.map((key) => {
          const active = color === key
          return (
            <button
              type="button"
              key={key}
              onClick={() => setColor(key)}
              aria-label={COLORS[key].label}
              aria-pressed={active}
              className={`grid h-9 w-9 place-items-center rounded-full text-white transition ${
                colorOf(key).dot
              } ${
                active
                  ? 'ring-2 ring-ink ring-offset-2 ring-offset-card'
                  : 'opacity-55 hover:opacity-100'
              }`}
            >
              {active && <UI.check size={16} strokeWidth={3} aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-sm font-medium text-ink-2">How many times a day?</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setTarget(String(Math.max(MIN_TARGET, targetNumber - 1)))}
            disabled={targetNumber <= MIN_TARGET}
            aria-label="One fewer time a day"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 transition hover:bg-card-hover hover:text-ink disabled:opacity-30"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_TARGET}
            max={MAX_TARGET}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() => setTarget(String(targetNumber))}
            aria-label="Times per day"
            className="w-12 bg-transparent text-center text-lg font-semibold text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => setTarget(String(Math.min(MAX_TARGET, targetNumber + 1)))}
            disabled={targetNumber >= MAX_TARGET}
            aria-label="One more time a day"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 transition hover:bg-card-hover hover:text-ink disabled:opacity-30"
          >
            +
          </button>
        </div>
        <span className="text-xs text-ink-3">
          {repeating
            ? `Counts as done once you log it ${targetNumber} times`
            : 'Once a day'}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-ink-2">
        {repeating ? 'Remind me between' : 'Daily reminder'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="relative">
          <UI.bell
            size={15}
            strokeWidth={1.9}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
          />
          <input
            type="time"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            aria-label="Reminder time"
            className="rounded-xl border border-line bg-surface py-2.5 pr-3 pl-9 text-ink outline-none focus:border-violet-500"
          />
        </div>
        {repeating && (
          <>
            <span className="text-sm text-ink-3">and</span>
            <input
              type="time"
              value={reminderEnd}
              onChange={(e) => setReminderEnd(e.target.value)}
              aria-label="Last reminder time"
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-violet-500"
            />
          </>
        )}
        {reminder && (
          <button
            type="button"
            onClick={() => {
              setReminder('')
              setReminderEnd('')
            }}
            className="rounded-lg px-3 py-2 text-xs text-ink-3 transition hover:bg-card-hover hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
      {repeating && reminder && (
        <p className="mt-1.5 text-xs text-ink-3">
          {slotPreview.length > 1
            ? `${slotPreview.length} nudges: ${slotPreview.map(formatTime).join(', ')}`
            : 'Add an end time to spread the reminders across the day.'}
        </p>
      )}
      <p className="mt-1.5 text-xs text-ink-3">
        Optional. Reminders arrive while Consistency is open in a tab, and anything
        missed is shown the moment you come back.
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-line px-5 py-3 text-ink-2 transition hover:bg-card-hover hover:text-ink sm:border-transparent"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 rounded-xl bg-violet-600 py-3 font-semibold text-white transition hover:bg-violet-500 active:scale-[0.98]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

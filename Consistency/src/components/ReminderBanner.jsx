import HabitGlyph from './HabitGlyph'
import { UI } from '../lib/icons'
import { formatTime } from '../lib/reminders'

/**
 * Two jobs: ask for notification permission once reminders exist, and show
 * anything already due. The "due" list is the fallback that always works —
 * even with notifications blocked, or on a browser that has none.
 */
export default function ReminderBanner({
  permission,
  supported,
  anyReminders,
  due,
  onRequest,
  onCheckIn,
}) {
  const askable = anyReminders && supported && permission === 'default'
  const blocked = anyReminders && supported && permission === 'denied'

  if (!askable && !blocked && due.length === 0) return null

  return (
    <div className="mb-4 space-y-3">
      {askable && (
        <div className="animate-rise flex flex-wrap items-center gap-3 rounded-2xl border border-violet-500/40 bg-violet-500/10 px-4 py-3">
          <UI.bell
            size={20}
            strokeWidth={1.9}
            className="shrink-0 text-violet-600 dark:text-violet-300"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Turn on reminder notifications</p>
            <p className="mt-0.5 text-xs text-ink-3">
              They arrive while Consistency is open in a tab. With the site closed, no
              website can notify you — use your phone&apos;s clock app for that.
            </p>
          </div>
          <button
            onClick={onRequest}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
          >
            Allow
          </button>
        </div>
      )}

      {blocked && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
          <UI.bellOff size={18} strokeWidth={1.9} className="shrink-0 text-ink-3" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs text-ink-3">
            Notifications are blocked for this site, so reminders appear here instead.
            Re-enable them in your browser&apos;s site settings if you want them back.
          </p>
        </div>
      )}

      {due.length > 0 && (
        <div className="animate-rise rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <UI.bell size={16} strokeWidth={2} aria-hidden="true" />
            Due now
          </p>
          <ul className="mt-2 space-y-1.5">
            {due.map((habit) => (
              <li key={habit.id} className="flex items-center gap-2.5 text-sm">
                <HabitGlyph habit={habit} size={15} className="shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate text-ink">{habit.name}</span>
                <span className="shrink-0 text-[11px] text-ink-3">
                  {formatTime(habit.reminder)}
                </span>
                <button
                  onClick={() => onCheckIn(habit)}
                  className="shrink-0 rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-500"
                >
                  Check in
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Safari's tracking prevention can evict localStorage after ~7 days of not
 * visiting a site, and clearing browser data wipes it anywhere. The only real
 * defence is an export, so nudge for one — quietly, and dismissibly.
 */
import { UI } from '../lib/icons'

export default function BackupReminder({ onGoToData, onDismiss }) {
  return (
    <div className="animate-rise mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <UI.warning
        size={20}
        strokeWidth={2}
        className="shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm text-ink-2">
        Your streaks only exist in this browser. Export a backup so a cleared cache
        cannot erase them.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onGoToData}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500"
        >
          Back up now
        </button>
        <button
          onClick={onDismiss}
          className="rounded-lg px-3 py-1.5 text-xs text-ink-3 transition hover:text-ink"
        >
          Later
        </button>
      </div>
    </div>
  )
}

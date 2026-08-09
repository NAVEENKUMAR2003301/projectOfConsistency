import { badgeProgress, earnedBadges, nextBadge } from '../lib/badges'
import { BADGE_ICONS } from '../lib/icons'

export default function BadgeRow({ best, tone }) {
  const earned = earnedBadges(best)
  const next = nextBadge(best)
  const pct = badgeProgress(best)

  if (earned.length === 0 && best === 0) return null

  return (
    <div className="relative mt-4 border-t border-line/60 pt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {earned.map((b) => {
          const Icon = BADGE_ICONS[b.icon]
          return (
            <span
              key={b.days}
              title={`${b.name} — ${b.days}-day streak`}
              className="flex items-center gap-1 rounded-full bg-card-hover px-2 py-1 text-[11px] font-medium text-ink-2"
            >
              <Icon size={12} strokeWidth={2} aria-hidden="true" />
              {b.name}
            </span>
          )
        })}
        {earned.length === 0 && (
          <span className="text-[11px] text-ink-3">No badges yet</span>
        )}
      </div>

      {next && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[11px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              Next:
              {(() => {
                const Icon = BADGE_ICONS[next.icon]
                return <Icon size={12} strokeWidth={2} aria-hidden="true" />
              })()}
              {next.name}
            </span>
            <span>{next.days - best} day{next.days - best === 1 ? '' : 's'} to go</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-track">
            <div
              className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

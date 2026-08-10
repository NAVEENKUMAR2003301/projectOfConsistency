import { UI } from '../lib/icons'
import { formatMoney } from '../lib/money'

/**
 * Today against yesterday. Spending more is worth noticing, not scolding — the
 * wording states the fact and leaves the judgement to you, which is the same
 * stance the habit side takes about a missed day.
 */
export default function SpendTrend({ trend, currency }) {
  const { direction, delta, pct, yesterday, spike } = trend

  // Nothing either day: there is no comparison worth showing.
  if (direction === 'idle') return null

  const money = (minor) => formatMoney(Math.abs(minor), currency)

  if (direction === 'same') {
    return (
      <p className="text-center text-xs text-ink-3">
        Exactly the same as yesterday.
      </p>
    )
  }

  const up = direction === 'up'
  const Icon = up ? UI.trendUp : UI.trendDown

  const tone = up
    ? spike
      ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'

  // A percentage needs a base to be a percentage; yesterday's zero has none.
  const change = pct === null ? null : `${up ? '+' : ''}${pct}%`

  return (
    <div
      className={`animate-rise flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border px-4 py-2.5 text-sm ${tone}`}
    >
      <Icon size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
      <span className="font-semibold">
        {money(delta)} {up ? 'more' : 'less'} than yesterday
      </span>
      {change && <span className="text-xs opacity-80">({change})</span>}

      {yesterday === 0 && (
        <span className="text-xs opacity-80">— you spent nothing yesterday</span>
      )}

      {up && spike && (
        <span className="w-full text-xs opacity-90">
          That is well above your usual day this week.
        </span>
      )}
    </div>
  )
}

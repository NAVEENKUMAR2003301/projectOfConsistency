import HabitGlyph from './HabitGlyph'
import { bestStreak, currentStreak, monthDayLabel } from '../lib/dates'
import { UI } from '../lib/icons'
import { habitRate, overallRate, perfectDays, progressSeries, toneFor } from '../lib/progress'

function Bar({ point }) {
  const tone = toneFor(point.pct)
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="flex h-24 w-full items-end">
        <div
          title={`${monthDayLabel(point.key)} — ${point.done}/${point.total}`}
          className={`w-full rounded-t transition-all duration-500 ${
            point.pct === 0 ? 'bg-track' : tone.bar
          }`}
          // A zero day still gets a sliver, so the axis reads as a bar chart.
          style={{ height: `${Math.max(point.pct, 4)}%` }}
        />
      </div>
      <span className="text-[9px] text-ink-3">{point.key.slice(-2)}</span>
    </div>
  )
}

export default function StatsDashboard({ habits }) {
  if (habits.length === 0) {
    return (
      <section className="glass rounded-3xl p-8 text-center">
        <UI.stats size={30} strokeWidth={1.6} className="mx-auto text-ink-3" aria-hidden="true" />
        <p className="mt-3 font-medium text-ink">No statistics yet</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-ink-3">
          Add a habit and check in a few times — the numbers appear here.
        </p>
      </section>
    )
  }

  const rate30 = overallRate(habits, 30)
  const rate7 = overallRate(habits, 7)
  const tone30 = toneFor(rate30)
  const tone7 = toneFor(rate7)
  const series = progressSeries(habits, 14)
  const perfect = perfectDays(habits, 30)

  const ranked = habits
    .map((h) => ({ habit: h, rate: habitRate(h, 30), streak: currentStreak(h.history) }))
    .sort((a, b) => b.rate - a.rate)

  const strongest = ranked[0]
  const weakest = ranked[ranked.length - 1]
  const trend = rate7 - rate30

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Last 30 days', value: `${rate30}%`, tone: tone30, note: tone30.label },
          { label: 'Last 7 days', value: `${rate7}%`, tone: tone7, note: tone7.label },
          {
            label: 'All done days',
            value: perfect,
            tone: toneFor(100),
            // Spells out the meaning and the window, so the label needs no glossary.
            note: 'all done, last 30 days',
          },
          {
            label: 'Longest ever',
            value: `${habits.reduce((m, h) => Math.max(m, bestStreak(h.history)), 0)}d`,
            tone: toneFor(100),
            note: 'best streak',
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-[11px] tracking-wide text-ink-3 uppercase">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.tone.text}`}>{s.value}</p>
            <p className="text-[11px] text-ink-3">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-ink">Last 14 days</h3>
          <p
            className={`text-xs ${
              trend > 0 ? toneFor(100).text : trend < 0 ? toneFor(20).text : 'text-ink-3'
            }`}
          >
            {trend > 0
              ? `${trend} points better than your 30-day average`
              : trend < 0
                ? `${Math.abs(trend)} points below your 30-day average`
                : 'Holding steady against your 30-day average'}
          </p>
        </div>
        <div className="mt-4 flex items-end gap-1">
          {series.map((point) => (
            <Bar key={point.key} point={point} />
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-4 sm:p-5">
        <h3 className="font-semibold text-ink">Per habit — last 30 days</h3>
        <ul className="mt-4 space-y-3">
          {ranked.map(({ habit, rate, streak }) => {
            const tone = toneFor(rate)
            return (
              <li key={habit.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-ink">
                    <HabitGlyph habit={habit} size={16} className="shrink-0 text-ink-2" />
                    <span className="truncate">{habit.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {streak > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-ink-3">
                        <UI.flame size={12} strokeWidth={2} aria-hidden="true" />
                        {streak}
                      </span>
                    )}
                    <span className={`font-semibold ${tone.text}`}>{rate}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>

        {habits.length > 1 && strongest.rate !== weakest.rate && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <p className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              <UI.trophy size={13} strokeWidth={2} aria-hidden="true" />
              Strongest: {strongest.habit.name} ({strongest.rate}%)
            </p>
            <p className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <UI.warning size={13} strokeWidth={2} aria-hidden="true" />
              Needs attention: {weakest.habit.name} ({weakest.rate}%)
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

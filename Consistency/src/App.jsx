import { useCallback, useEffect, useMemo, useState } from 'react'
import BackupReminder from './components/BackupReminder'
import CalendarView from './components/CalendarView'
import Confetti from './components/Confetti'
import DataManager from './components/DataManager'
import HabitCard from './components/HabitCard'
import HabitForm from './components/HabitForm'
import MobileNav from './components/MobileNav'
import MoneyTab from './components/MoneyTab'
import NotesSection from './components/NotesSection'
import ProgressRing from './components/ProgressRing'
import PuzzleModal from './components/PuzzleModal'
import ReminderBanner from './components/ReminderBanner'
import StatsDashboard from './components/StatsDashboard'
import Tabs from './components/Tabs'
import ThemeToggle from './components/ThemeToggle'
import Toast from './components/Toast'
import { currentStreak, today } from './lib/dates'
import { ALL_DONE_MESSAGES, encouragementFor } from './lib/encouragement'
import { UI } from './lib/icons'
import { FEEDBACK_URL } from './lib/links'
import { overallRate, perfectDays, toneFor } from './lib/progress'
import { BACKUP_META_KEY, readJSON, writeJSON } from './lib/storage'
import { useExpenses } from './lib/useExpenses'
import { useHabits } from './lib/useHabits'
import { useReminders } from './lib/useReminders'
import { useNotes } from './lib/useNotes'
import { useTheme } from './lib/useTheme'

const DAY_MS = 24 * 60 * 60 * 1000
const BACKUP_NAG_DAYS = 14
const DISMISS_DAYS = 7

const prettyDate = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

const olderThan = (iso, days) =>
  !iso || Date.now() - new Date(iso).getTime() > days * DAY_MS

export default function App() {
  const {
    habits,
    addHabit,
    updateHabit,
    removeHabit,
    completeToday,
    undoToday,
    replaceHabits,
  } = useHabits()
  const { notes, addNote, updateNote, removeNote, replaceNotes } = useNotes()
  const { theme, setTheme } = useTheme()
  const reminders = useReminders(habits)
  const money = useExpenses()

  const [tab, setTab] = useState('today')
  const [puzzleFor, setPuzzleFor] = useState(null)
  const [celebration, setCelebration] = useState(null) // { id, message, streak }
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dayTick, setDayTick] = useState(0)
  const [backupMeta, setBackupMeta] = useState(() =>
    readJSON(BACKUP_META_KEY, { lastBackupAt: null, dismissedAt: null }),
  )

  // Everything below reads today() at render time, so a tab left open
  // overnight would keep showing yesterday. Re-render just after midnight.
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      2,
    )
    const t = setTimeout(() => setDayTick((n) => n + 1), midnight - now)
    return () => clearTimeout(t)
  }, [dayTick])

  const saveBackupMeta = useCallback((patch) => {
    setBackupMeta((prev) => {
      const next = { ...prev, ...patch }
      writeJSON(BACKUP_META_KEY, next)
      return next
    })
  }, [])

  const doneToday = habits.filter((h) => h.history[today()]).length
  const allDone = habits.length > 0 && doneToday === habits.length

  const stats = useMemo(() => {
    const longest = habits.reduce((max, h) => Math.max(max, currentStreak(h.history)), 0)
    const checkIns = habits.reduce(
      (sum, h) => sum + Object.values(h.history).filter(Boolean).length,
      0,
    )
    return { longest, checkIns, perfect: perfectDays(habits, 60), rate: overallRate(habits, 30) }
    // dayTick looks unused to the linter, but these helpers read the wall
    // clock — without it the figures stay frozen on yesterday.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, dayTick])

  // Celebration is self-dismissing so nothing lingers over the board.
  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(() => setCelebration(null), 3600)
    return () => clearTimeout(t)
  }, [celebration])

  const handleSolved = () => {
    const habit = puzzleFor
    setPuzzleFor(null)
    if (!habit) return

    completeToday(habit.id)

    // Streak state is pre-check-in here, so +1 gives the streak being earned.
    const before = currentStreak(habit.history)
    const streak = before + 1
    const wasComeback = before === 0 && Object.values(habit.history).some(Boolean)

    const othersDone = habits.filter((h) => h.id !== habit.id && h.history[today()]).length
    const finishesTheDay = habits.length > 1 && othersDone === habits.length - 1

    setCelebration({
      // Keys the burst so back-to-back check-ins each replay the animation
      // instead of reusing the already-finished one.
      id: `${habit.id}-${Date.now()}`,
      streak,
      message: finishesTheDay
        ? ALL_DONE_MESSAGES[Math.floor(Math.random() * ALL_DONE_MESSAGES.length)]
        : encouragementFor(streak, wasComeback),
    })
  }

  const hasData = habits.length > 0 || notes.length > 0
  const showBackupReminder =
    hasData &&
    tab !== 'data' &&
    olderThan(backupMeta.lastBackupAt, BACKUP_NAG_DAYS) &&
    olderThan(backupMeta.dismissedAt, DISMISS_DAYS)

  const headerTone = toneFor(stats.rate)

  return (
    <div className="relative min-h-full bg-surface">
      {/* Colour pools the frosted panels refract; fixed so they never scroll away. */}
      <div className="ambient" aria-hidden="true" />
      {/* Bottom padding reserves room for the fixed mobile nav. */}
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10 sm:pb-10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs tracking-[0.22em] text-ink-3 uppercase">{prettyDate()}</p>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>

        <header className="animate-rise mt-6 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Consistency
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2 sm:mx-0">
              {habits.length === 0
                ? 'Add the habits that matter to you — nothing here is preset.'
                : allDone
                  ? 'Every habit is done. That is a clean sweep.'
                  : 'Solve a tiny puzzle, log the day, keep the chain alive.'}
            </p>
          </div>
          <div className="shrink-0">
            <ProgressRing done={doneToday} total={habits.length} />
          </div>
        </header>

        <section className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              label: 'Longest active streak',
              value: `${stats.longest}d`,
              Icon: UI.flame,
              hint: 'Consecutive days you have kept a habit going',
            },
            {
              label: 'Total check-ins',
              value: stats.checkIns,
              Icon: UI.today,
              hint: 'Every habit you have ever logged',
            },
            {
              // "Perfect" would imply every other day was a failure, which is
              // the opposite of what this app is for.
              label: 'Clean sweeps',
              value: stats.perfect,
              Icon: UI.trophy,
              hint: 'Days you completed every habit',
            },
          ].map(({ label, value, Icon, hint }, i) => (
            <div
              key={label}
              title={hint}
              className="glass glass-hover animate-rise rounded-2xl p-3 text-center transition-all duration-300 hover:-translate-y-0.5 sm:p-4"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <Icon
                size={20}
                strokeWidth={1.8}
                className="mx-auto text-ink-3"
                aria-hidden="true"
              />
              {/* Keyed on the value so the number pops when it changes. */}
              <p key={String(value)} className="animate-count mt-1.5 text-xl font-bold text-ink">
                {value}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-ink-3">{label}</p>
            </div>
          ))}
        </section>

        {habits.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
              <div
                className={`h-full rounded-full transition-all duration-700 ${headerTone.bar}`}
                style={{ width: `${stats.rate}%` }}
              />
            </div>
            <span className={`shrink-0 text-xs font-medium ${headerTone.text}`}>
              {stats.rate}% · {headerTone.label}
            </span>
          </div>
        )}

        {/* Sticky so the sections stay reachable without scrolling back up.
            Hidden on phones, where MobileNav is pinned to the bottom instead —
            otherwise this leaves an empty sticky strip taking up space. */}
        <div className="sticky top-0 z-20 mt-6 hidden py-2 sm:block">
          <Tabs active={tab} onChange={setTab} />
        </div>

        {/* Keyed on the tab so switching sections animates in rather than snapping. */}
        <div key={tab} className="animate-tab mt-6 sm:mt-4">
          {showBackupReminder && (
            <BackupReminder
              onGoToData={() => setTab('data')}
              onDismiss={() => saveBackupMeta({ dismissedAt: new Date().toISOString() })}
            />
          )}

          {tab === 'today' && (
            <main className="space-y-4">
              <ReminderBanner
                permission={reminders.permission}
                supported={reminders.supported}
                anyReminders={reminders.anyReminders}
                due={reminders.due}
                onRequest={reminders.request}
                onCheckIn={setPuzzleFor}
              />
              {habits.map((habit, i) => (
                <HabitCard
                  key={habit.id}
                  index={i}
                  habit={habit}
                  onCheckIn={setPuzzleFor}
                  onUndo={undoToday}
                  onEdit={setEditing}
                  onRemove={removeHabit}
                />
              ))}

              {habits.length === 0 && !creating && (
                <div className="rounded-3xl border border-line bg-card p-8 text-center">
                  <UI.sprout
                    size={30}
                    strokeWidth={1.6}
                    className="mx-auto text-ink-3"
                    aria-hidden="true"
                  />
                  <p className="mt-3 font-medium text-ink">Nothing tracked yet</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-ink-3">
                    Start with one habit — genuinely just one. You choose what it is.
                  </p>
                </div>
              )}

              {creating ? (
                <HabitForm
                  onSubmit={(data) => {
                    addHabit(data)
                    setCreating(false)
                  }}
                  onCancel={() => setCreating(false)}
                  submitLabel="Add habit"
                  takenNames={habits.map((h) => h.name)}
                />
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong py-6 text-ink-3 transition hover:bg-card hover:text-ink"
                >
                  <UI.plus size={17} strokeWidth={2} aria-hidden="true" />
                  Add a habit
                </button>
              )}
            </main>
          )}

          {tab === 'calendar' && <CalendarView habits={habits} />}

          {tab === 'stats' && <StatsDashboard habits={habits} />}

          {tab === 'money' && (
            <MoneyTab
              expenses={money.expenses}
              categories={money.categories}
              currency={money.currency}
              onSetCurrency={money.setCurrency}
              onAdd={money.addExpense}
              onUpdate={money.updateExpense}
              onRemove={money.removeExpense}
              onAddCategory={money.addCategory}
              onRemoveCategory={money.removeCategory}
            />
          )}

          {tab === 'notes' && (
            <NotesSection
              notes={notes}
              onAdd={addNote}
              onUpdate={updateNote}
              onRemove={removeNote}
            />
          )}

          {tab === 'data' && (
            <DataManager
              habits={habits}
              notes={notes}
              expenses={money.expenses}
              categories={money.categories}
              onReplaceHabits={replaceHabits}
              onReplaceNotes={replaceNotes}
              onReplaceExpenses={money.replaceExpenses}
              onReplaceCategories={money.replaceCategories}
              onExported={() => saveBackupMeta({ lastBackupAt: new Date().toISOString() })}
              lastBackupAt={backupMeta.lastBackupAt}
            />
          )}
        </div>

        <footer className="mt-12 border-t border-line pt-6 text-center">
          <a
            href={FEEDBACK_URL}
            target="_blank"
            // noreferrer also stops the new tab from reaching back via opener.
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-medium text-ink-2 transition hover:border-line-strong hover:bg-card-hover hover:text-ink"
          >
            <UI.feedback size={16} strokeWidth={1.9} aria-hidden="true" />
            Share feedback
            <UI.external size={13} strokeWidth={1.9} aria-hidden="true" />
          </a>
          <p className="mx-auto mt-2 max-w-xs text-[11px] text-ink-3">
            Opens a Google Form in a new tab. Nothing is sent unless you submit it.
          </p>

          <p className="mt-6 text-xs text-ink-3">
            Miss a day, start again — the streak is not the point.
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Your data is saved locally in this browser. Cloud sync coming later.
          </p>
          <p className="mt-4 text-sm font-medium text-ink-2">
            Created by <span className="text-ink">Naveenkumar V</span>
          </p>
        </footer>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4"
          style={{ background: 'var(--backdrop)', backdropFilter: 'blur(4px)' }}
        >
          <div className="my-auto w-full max-w-md">
            <HabitForm
              initial={editing}
              onSubmit={(data) => {
                updateHabit(editing.id, data)
                setEditing(null)
              }}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
              // The habit keeps its own name; only clashes with others count.
              takenNames={habits.filter((h) => h.id !== editing.id).map((h) => h.name)}
            />
          </div>
        </div>
      )}

      {puzzleFor && (
        <PuzzleModal
          habit={puzzleFor}
          onSolved={handleSolved}
          onClose={() => setPuzzleFor(null)}
        />
      )}

      <MobileNav active={tab} onChange={setTab} />

      {celebration && (
        <>
          <Confetti key={celebration.id} />
          <Toast
            key={`toast-${celebration.id}`}
            message={celebration.message}
            streak={celebration.streak}
          />
        </>
      )}
    </div>
  )
}

// Renders every component, with hostile data as well as ordinary data.
// A component that throws here would throw in the browser, so this is the
// cheapest way to find crashes without a real DOM.
import { renderToString } from 'react-dom/server'

import App from '../../src/App.jsx'
import AddButton from '../../src/components/AddButton.jsx'
import BackupReminder from '../../src/components/BackupReminder.jsx'
import BadgeRow from '../../src/components/BadgeRow.jsx'
import CalendarView from '../../src/components/CalendarView.jsx'
import Confetti from '../../src/components/Confetti.jsx'
import DataManager from '../../src/components/DataManager.jsx'
import ExpenseForm from '../../src/components/ExpenseForm.jsx'
import HabitCard from '../../src/components/HabitCard.jsx'
import HabitForm from '../../src/components/HabitForm.jsx'
import HabitGlyph from '../../src/components/HabitGlyph.jsx'
import MobileNav from '../../src/components/MobileNav.jsx'
import MoneyTab from '../../src/components/MoneyTab.jsx'
import NoteCard from '../../src/components/NoteCard.jsx'
import NotesSection from '../../src/components/NotesSection.jsx'
import Onboarding from '../../src/components/Onboarding.jsx'
import PaperTextarea from '../../src/components/PaperTextarea.jsx'
import ProgressRing from '../../src/components/ProgressRing.jsx'
import PuzzleModal from '../../src/components/PuzzleModal.jsx'
import ReminderBanner from '../../src/components/ReminderBanner.jsx'
import SpendTrend from '../../src/components/SpendTrend.jsx'
import StatsDashboard from '../../src/components/StatsDashboard.jsx'
import Tabs from '../../src/components/Tabs.jsx'
import ThemeToggle from '../../src/components/ThemeToggle.jsx'
import Toast from '../../src/components/Toast.jsx'

import { addDays, today } from '../../src/lib/dates.js'
import { COLOR_KEYS } from '../../src/lib/colors.js'
import { spendingTrend } from '../../src/lib/money.js'
import { toneFor } from '../../src/lib/progress.js'
import { TABS } from '../../src/lib/tabs.js'

const T = today()
const noop = () => {}
const occ = (at = null) => ({ done: true, at })

// --- fixtures ---------------------------------------------------------------

const habit = {
  id: 'h1',
  name: 'Solve 5 practice problems',
  icon: 'calculator',
  emoji: null,
  color: 'emerald',
  target: 1,
  reminder: '19:30',
  reminderEnd: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  history: { [addDays(T, -1)]: occ(), [addDays(T, -2)]: occ() },
  progress: {},
}

const repeating = {
  ...habit,
  id: 'h2',
  name: 'Drink water',
  icon: 'droplet',
  target: 8,
  reminder: '08:00',
  reminderEnd: '20:00',
  progress: { [T]: 3 },
}

const doneToday = { ...habit, id: 'h3', history: { ...habit.history, [T]: occ() } }

// Saved before icons, targets and progress existed: history is raw `true`,
// the mark is an emoji, and several fields are simply absent.
const legacy = {
  id: 'h4',
  name: 'Legacy habit',
  emoji: '\u{1F4DA}',
  color: 'sky',
  history: { [T]: true, [addDays(T, -1)]: true },
}

// Deliberately awful: unknown colour and icon, no history, absurd target,
// a name with no spaces to break wrapping, and a reminder window that ends
// before it starts.
const hostile = {
  id: 'h5',
  name: 'Supercalifragilisticexpialidociousandthensomemoretexttobesure',
  icon: 'not-a-real-icon',
  emoji: null,
  color: 'chartreuse',
  target: 20,
  reminder: '22:00',
  reminderEnd: '06:00',
  createdAt: null,
  history: {},
  progress: {},
}

const note = {
  id: 'n1',
  text: 'Finish chapter 4\nRevise formulas',
  day: T,
  createdAt: '2026-08-09T09:15:00.000Z',
  updatedAt: '2026-08-09T09:15:00.000Z',
}
const brokenNote = { id: 'n2', text: 'no timestamps', day: T, createdAt: null, updatedAt: null }

const categories = [{ id: 'c1', name: 'Food', icon: 'food', color: 'violet' }]
const expense = { id: 'e1', amount: 12550, day: T, categoryId: 'c1', note: 'lunch', createdAt: null }
// Category deleted out from under it, and a huge amount.
const orphanExpense = { id: 'e2', amount: 99999999, day: T, categoryId: 'gone', note: '', createdAt: null }

const card = (h, extra = {}) =>
  renderToString(
    <HabitCard
      habit={h}
      onCheckIn={noop}
      onLogOne={noop}
      onUndoOne={noop}
      onUndo={noop}
      onEdit={noop}
      onRemove={noop}
      {...extra}
    />,
  )

const moneyTab = (expenses, cats) =>
  renderToString(
    <MoneyTab
      expenses={expenses}
      categories={cats}
      currency="INR"
      onSetCurrency={noop}
      onAdd={noop}
      onUpdate={noop}
      onRemove={noop}
      onAddCategory={() => 'c'}
      onRemoveCategory={noop}
    />,
  )

const dataManager = (props = {}) =>
  renderToString(
    <DataManager
      habits={[habit]}
      notes={[note]}
      expenses={[expense]}
      categories={categories}
      onReplaceHabits={noop}
      onReplaceNotes={noop}
      onReplaceExpenses={noop}
      onReplaceCategories={noop}
      onExported={noop}
      lastBackupAt={null}
      {...props}
    />,
  )

export function render() {
  return {
    TAB_COUNT: String(TABS.length),

    // Whole app, first run and returning.
    App: renderToString(<App />),

    // Habit cards across every shape of data.
    CardPlain: card(habit),
    CardDone: card(doneToday),
    CardRepeating: card(repeating),
    CardLegacy: card(legacy),
    CardHostile: card(hostile),
    CardIndexed: card(habit, { index: 3 }),
    CardAllColours: COLOR_KEYS.map((color) => card({ ...habit, color })).join(''),

    // Forms, empty and prefilled.
    FormNew: renderToString(
      <HabitForm onSubmit={noop} onCancel={noop} submitLabel="Add habit" takenNames={[]} />,
    ),
    FormEdit: renderToString(
      <HabitForm initial={habit} onSubmit={noop} onCancel={noop} submitLabel="Save" takenNames={[]} />,
    ),
    FormEditRepeating: renderToString(
      <HabitForm initial={repeating} onSubmit={noop} onCancel={noop} submitLabel="Save" takenNames={[]} />,
    ),
    FormEditLegacy: renderToString(
      <HabitForm initial={legacy} onSubmit={noop} onCancel={noop} submitLabel="Save" takenNames={[]} />,
    ),
    FormEditHostile: renderToString(
      <HabitForm initial={hostile} onSubmit={noop} onCancel={noop} submitLabel="Save" takenNames={[]} />,
    ),

    // Puzzle, including for a habit whose data is broken.
    Puzzle: renderToString(<PuzzleModal habit={habit} onSolved={noop} onClose={noop} />),
    PuzzleLegacy: renderToString(<PuzzleModal habit={legacy} onSolved={noop} onClose={noop} />),
    PuzzleHostile: renderToString(<PuzzleModal habit={hostile} onSolved={noop} onClose={noop} />),

    // Calendar and stats, empty and populated.
    CalendarEmpty: renderToString(<CalendarView habits={[]} />),
    CalendarFull: renderToString(<CalendarView habits={[habit, repeating, legacy, hostile]} />),
    StatsEmpty: renderToString(<StatsDashboard habits={[]} />),
    StatsFull: renderToString(<StatsDashboard habits={[habit, repeating, legacy, hostile]} />),
    StatsSingle: renderToString(<StatsDashboard habits={[habit]} />),

    // Money.
    MoneyEmpty: moneyTab([], []),
    MoneyFull: moneyTab([expense, orphanExpense], categories),
    MoneyOrphanOnly: moneyTab([orphanExpense], []),
    ExpenseNew: renderToString(
      <ExpenseForm categories={categories} onSubmit={noop} onCancel={noop} onAddCategory={() => 'c'} />,
    ),
    ExpenseEdit: renderToString(
      <ExpenseForm initial={expense} categories={categories} onSubmit={noop} onCancel={noop} onAddCategory={() => 'c'} submitLabel="Save" />,
    ),
    ExpenseNoCategories: renderToString(
      <ExpenseForm categories={[]} onSubmit={noop} onCancel={noop} onAddCategory={() => 'c'} />,
    ),
    TrendUp: renderToString(<SpendTrend trend={spendingTrend([expense])} currency="INR" />),
    TrendIdle: renderToString(<SpendTrend trend={spendingTrend([])} currency="INR" />),

    // Notes.
    NotesEmpty: renderToString(<NotesSection notes={[]} onAdd={noop} onUpdate={noop} onRemove={noop} />),
    NotesFull: renderToString(
      <NotesSection notes={[note, brokenNote]} onAdd={noop} onUpdate={noop} onRemove={noop} />,
    ),
    NoteCard: renderToString(<NoteCard note={note} onUpdate={noop} onRemove={noop} />),
    NoteBroken: renderToString(<NoteCard note={brokenNote} onUpdate={noop} onRemove={noop} />),
    Paper: renderToString(<PaperTextarea value="x" onChange={noop} label="Write" placeholder="Today I will…" />),

    // Data tab.
    DataFull: dataManager(),
    DataEmpty: dataManager({ habits: [], notes: [], expenses: [], categories: [] }),

    // Chrome.
    Tabs: renderToString(<Tabs active="today" onChange={noop} />),
    MobileNav: renderToString(<MobileNav active="money" onChange={noop} />),
    ThemeToggle: renderToString(<ThemeToggle theme="system" onChange={noop} />),
    Onboarding: renderToString(<Onboarding onDone={noop} />),
    AddButton: renderToString(<AddButton onClick={noop}>Add a habit</AddButton>),
    Toast: renderToString(<Toast message="Nice work" streak={9} />),
    Confetti: renderToString(<Confetti />),
    RingZero: renderToString(<ProgressRing done={0} total={0} />),
    RingFull: renderToString(<ProgressRing done={3} total={3} />),
    BadgeZero: renderToString(<BadgeRow best={0} tone={toneFor(0)} />),
    BadgeMax: renderToString(<BadgeRow best={999} tone={toneFor(100)} />),
    BackupReminder: renderToString(<BackupReminder onGoToData={noop} onDismiss={noop} />),
    GlyphIcon: renderToString(<HabitGlyph habit={habit} />),
    GlyphEmoji: renderToString(<HabitGlyph habit={legacy} />),
    GlyphUnknown: renderToString(<HabitGlyph habit={hostile} />),
    GlyphEmpty: renderToString(<HabitGlyph habit={{}} />),

    ReminderAsk: renderToString(
      <ReminderBanner permission="default" supported anyReminders due={[]} onRequest={noop} onCheckIn={noop} onSkip={noop} />,
    ),
    ReminderDue: renderToString(
      <ReminderBanner permission="granted" supported anyReminders due={[repeating]} onRequest={noop} onCheckIn={noop} onSkip={noop} />,
    ),
    ReminderSilent: renderToString(
      <ReminderBanner permission="granted" supported anyReminders={false} due={[]} onRequest={noop} onCheckIn={noop} onSkip={noop} />,
    ),
  }
}

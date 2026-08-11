import { useState } from 'react'
import { COLOR_KEYS, DEFAULT_COLOR, colorOf } from '../lib/colors'
import { today } from '../lib/dates'
import { CATEGORY_ICONS, UI, categoryIcon } from '../lib/icons'
import { parseAmount, toAmountInput } from '../lib/money'
import { MAX_EXPENSE_NOTE } from '../lib/storage'

// Names offered when you have no categories yet — a starting point, not a set
// of defaults. Nothing exists until you pick or type one.
const SUGGESTIONS = [
  { name: 'Food', icon: 'food' },
  { name: 'Transport', icon: 'transport' },
  { name: 'Study', icon: 'study' },
  { name: 'Phone', icon: 'phone' },
  { name: 'Rent', icon: 'rent' },
  { name: 'Fun', icon: 'fun' },
]

export default function ExpenseForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  onAddCategory,
  submitLabel = 'Add expense',
}) {
  const [amount, setAmount] = useState(initial ? toAmountInput(initial.amount) : '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? null)
  const [note, setNote] = useState(initial?.note ?? '')
  const [day, setDay] = useState(initial?.day ?? today())
  const [error, setError] = useState('')

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('receipt')
  const [newColor, setNewColor] = useState(DEFAULT_COLOR)

  const submit = (e) => {
    e.preventDefault()
    // parseAmount already rejects zero, negatives and anything above the cap,
    // so a null result covers every failure — no second check needed.
    const minor = parseAmount(amount)
    if (minor === null) {
      setError(
        amount.trim() === ''
          ? 'Enter how much you spent.'
          : 'Enter a positive amount, like 250 or 12.50.',
      )
      return
    }
    onSubmit({ amount: minor, categoryId, note, day })
  }

  const createCategory = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const id = onAddCategory({ name: trimmed, icon: newIcon, color: newColor })
    if (id) setCategoryId(id)
    setCreating(false)
    setNewName('')
    setNewIcon('receipt')
    setNewColor(DEFAULT_COLOR)
  }

  return (
    <form
      onSubmit={submit}
      className="animate-rise glass rounded-3xl p-4 sm:p-5"
    >
      <label htmlFor="expense-amount" className="text-sm font-medium text-ink-2">
        How much?
      </label>
      <input
        id="expense-amount"
        autoFocus
        // `decimal` gives phones a number pad that still has a decimal point.
        inputMode="decimal"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value)
          setError('')
        }}
        placeholder="0.00"
        className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-2xl font-semibold text-ink placeholder-ink-3 outline-none focus:border-violet-500"
      />
      <p className={`mt-1.5 min-h-4 text-xs ${error ? 'text-rose-500' : 'text-transparent'}`}>
        {error || '.'}
      </p>

      <p className="text-sm font-medium text-ink-2">Category</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = categoryIcon(category.icon)
          const active = categoryId === category.id
          return (
            <button
              type="button"
              key={category.id}
              onClick={() => setCategoryId(active ? null : category.id)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? `${colorOf(category.color).border} ${colorOf(category.color).soft} ${colorOf(category.color).text}`
                  : 'border-line bg-surface text-ink-2 hover:text-ink'
              }`}
            >
              <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
              {category.name}
            </button>
          )
        })}

        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-xs text-ink-3 transition hover:text-ink"
          >
            <UI.plus size={13} strokeWidth={2} aria-hidden="true" />
            New category
          </button>
        )}
      </div>

      {categories.length === 0 && !creating && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-xs text-ink-3">Need an idea?</span>
          {SUGGESTIONS.map((s) => (
            <button
              type="button"
              key={s.name}
              onClick={() => {
                const id = onAddCategory({ name: s.name, icon: s.icon, color: DEFAULT_COLOR })
                if (id) setCategoryId(id)
              }}
              className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 transition hover:text-ink"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {creating && (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            maxLength={30}
            className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base sm:text-sm text-ink placeholder-ink-3 outline-none focus:border-violet-500"
          />
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {CATEGORY_ICONS.map(({ key, label, Icon }) => (
              <button
                type="button"
                key={key}
                onClick={() => setNewIcon(key)}
                aria-label={label}
                title={label}
                aria-pressed={newIcon === key}
                className={`grid aspect-square place-items-center rounded-lg transition ${
                  newIcon === key
                    ? 'bg-violet-600 text-white'
                    : 'bg-card text-ink-2 hover:text-ink'
                }`}
              >
                <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLOR_KEYS.map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setNewColor(key)}
                aria-label={key}
                aria-pressed={newColor === key}
                className={`h-7 w-7 rounded-full transition ${colorOf(key).dot} ${
                  newColor === key ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'opacity-55'
                }`}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={createCategory}
              disabled={!newName.trim()}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-ink-3 transition hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="expense-note" className="text-sm font-medium text-ink-2">
            Note <span className="text-ink-3">(optional)</span>
          </label>
          <input
            id="expense-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. lunch with friends"
            maxLength={MAX_EXPENSE_NOTE}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base sm:text-sm text-ink placeholder-ink-3 outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label htmlFor="expense-day" className="text-sm font-medium text-ink-2">
            Date
          </label>
          <input
            id="expense-day"
            type="date"
            value={day}
            // No future spending: you cannot have bought it yet.
            max={today()}
            onChange={(e) => setDay(e.target.value || today())}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base sm:text-sm text-ink outline-none focus:border-violet-500"
          />
        </div>
      </div>

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

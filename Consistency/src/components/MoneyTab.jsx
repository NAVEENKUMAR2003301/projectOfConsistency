import { useMemo, useState } from 'react'
import ExpenseForm from './ExpenseForm'
import { colorOf } from '../lib/colors'
import { dayLabel } from '../lib/dates'
import { CURRENCIES, categoryTotals, formatMoney, groupByDay, inMonth, totals } from '../lib/money'
import { UI, categoryIcon } from '../lib/icons'

const VISIBLE_DAYS = 7

function Stat({ label, value, strong = false }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3 text-center sm:p-4">
      <p className="text-[11px] tracking-wide text-ink-3 uppercase">{label}</p>
      <p
        className={`mt-1 font-bold break-words ${
          strong ? 'text-xl text-ink sm:text-2xl' : 'text-lg text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default function MoneyTab({
  expenses,
  categories,
  currency,
  onSetCurrency,
  onAdd,
  onUpdate,
  onRemove,
  onAddCategory,
  onRemoveCategory,
}) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [visibleDays, setVisibleDays] = useState(VISIBLE_DAYS)

  const sums = useMemo(() => totals(expenses), [expenses])
  const monthExpenses = useMemo(() => inMonth(expenses), [expenses])
  const breakdown = useMemo(
    () => categoryTotals(monthExpenses, categories),
    [monthExpenses, categories],
  )
  const days = useMemo(() => groupByDay(expenses), [expenses])
  const shownDays = days.slice(0, visibleDays)
  const hiddenDays = days.length - shownDays.length

  const money = (minor) => formatMoney(minor, currency)

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <UI.money size={18} strokeWidth={1.9} aria-hidden="true" />
            Spending
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">
            Track what you actually spend on — you name the categories.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-3">
          <span className="sr-only">Currency</span>
          <select
            value={currency}
            onChange={(e) => onSetCurrency(e.target.value)}
            aria-label="Currency"
            className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink outline-none focus:border-violet-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Today" value={money(sums.today)} />
        <Stat label="Last 7 days" value={money(sums.week)} />
        <Stat label="This month" value={money(sums.month)} strong />
      </div>

      {creating ? (
        <ExpenseForm
          categories={categories}
          onAddCategory={onAddCategory}
          onSubmit={(data) => {
            onAdd(data)
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
          submitLabel="Add expense"
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong py-5 text-ink-3 transition hover:bg-card hover:text-ink"
        >
          <UI.plus size={17} strokeWidth={2} aria-hidden="true" />
          Add an expense
        </button>
      )}

      {expenses.length === 0 && !creating && (
        <div className="rounded-3xl border border-line bg-card p-8 text-center">
          <UI.receipt size={30} strokeWidth={1.6} className="mx-auto text-ink-3" aria-hidden="true" />
          <p className="mt-3 font-medium text-ink">Nothing recorded yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-3">
            Add one expense. Categories appear as you create them — nothing is preset.
          </p>
        </div>
      )}

      {breakdown.length > 0 && (
        <div className="rounded-3xl border border-line bg-card p-4 sm:p-5">
          <h3 className="font-semibold text-ink">This month by category</h3>
          <ul className="mt-4 space-y-3">
            {breakdown.map(({ category, total, pct }) => {
              const Icon = category ? categoryIcon(category.icon) : UI.receipt
              const tone = category ? colorOf(category.color) : null
              return (
                <li key={category?.id ?? 'uncategorised'}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-ink">
                      <Icon
                        size={15}
                        strokeWidth={1.9}
                        className={`shrink-0 ${tone ? tone.text : 'text-ink-3'}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{category?.name ?? 'Uncategorised'}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-ink-3">{pct}%</span>
                      <span className="font-semibold text-ink">{money(total)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        tone ? tone.fill : 'bg-ink-3'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {days.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-ink">History</h3>
          {shownDays.map(({ day, items, total }) => (
            <div key={day} className="overflow-hidden rounded-2xl border border-line">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-2">
                <p className="text-xs font-medium text-ink-2">{dayLabel(day)}</p>
                <p className="text-xs font-semibold text-ink">{money(total)}</p>
              </div>
              <ul className="divide-y divide-line">
                {items.map((expense) =>
                  editing === expense.id ? (
                    <li key={expense.id} className="bg-card p-3">
                      <ExpenseForm
                        initial={expense}
                        categories={categories}
                        onAddCategory={onAddCategory}
                        onSubmit={(data) => {
                          onUpdate(expense.id, data)
                          setEditing(null)
                        }}
                        onCancel={() => setEditing(null)}
                        submitLabel="Save changes"
                      />
                    </li>
                  ) : (
                    <li
                      key={expense.id}
                      className="flex items-center gap-3 bg-card px-4 py-2.5 text-sm"
                    >
                      {(() => {
                        const category = categories.find((c) => c.id === expense.categoryId)
                        const Icon = category ? categoryIcon(category.icon) : UI.receipt
                        const tone = category ? colorOf(category.color) : null
                        return (
                          <Icon
                            size={16}
                            strokeWidth={1.9}
                            className={`shrink-0 ${tone ? tone.text : 'text-ink-3'}`}
                            aria-hidden="true"
                          />
                        )
                      })()}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">
                          {categories.find((c) => c.id === expense.categoryId)?.name ??
                            'Uncategorised'}
                        </span>
                        {expense.note && (
                          <span className="block truncate text-xs text-ink-3">
                            {expense.note}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-ink">
                        {money(expense.amount)}
                      </span>
                      <button
                        onClick={() => setEditing(expense.id)}
                        aria-label={`Edit expense ${money(expense.amount)}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-card-hover hover:text-ink"
                      >
                        <UI.edit size={14} strokeWidth={1.9} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() =>
                          confirmDelete === expense.id
                            ? (onRemove(expense.id), setConfirmDelete(null))
                            : setConfirmDelete(expense.id)
                        }
                        aria-label={
                          confirmDelete === expense.id ? 'Confirm delete' : 'Delete expense'
                        }
                        className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs transition ${
                          confirmDelete === expense.id
                            ? 'bg-rose-500 font-semibold text-white'
                            : 'w-8 text-ink-3 hover:bg-card-hover hover:text-rose-500'
                        }`}
                      >
                        {confirmDelete === expense.id ? (
                          'Sure?'
                        ) : (
                          <UI.remove size={14} strokeWidth={1.9} aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}

          {hiddenDays > 0 && (
            <button
              onClick={() => setVisibleDays((v) => v + VISIBLE_DAYS)}
              className="w-full rounded-2xl border border-dashed border-line-strong py-3 text-sm text-ink-3 transition hover:bg-card hover:text-ink"
            >
              Show {Math.min(hiddenDays, VISIBLE_DAYS)} earlier day
              {Math.min(hiddenDays, VISIBLE_DAYS) === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <div className="rounded-3xl border border-line bg-card p-4 sm:p-5">
          <h3 className="font-semibold text-ink">Your categories</h3>
          <p className="mt-1 text-xs text-ink-3">
            Deleting one keeps its expenses — they simply become uncategorised, so no
            total ever changes behind your back.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = categoryIcon(category.icon)
              const tone = colorOf(category.color)
              return (
                <li
                  key={category.id}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${tone.border} ${tone.soft} ${tone.text}`}
                >
                  <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
                  {category.name}
                  <button
                    onClick={() => onRemoveCategory(category.id)}
                    aria-label={`Delete category ${category.name}`}
                    className="text-ink-3 transition hover:text-rose-500"
                  >
                    <UI.close size={12} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

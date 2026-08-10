import { addDays, dayKey, today } from './dates'

// Amounts are stored as INTEGER minor units (hundredths), never as floats.
// 0.1 + 0.2 !== 0.3 in binary floating point, and a spending tracker that
// disagrees with your own arithmetic is worse than none.

export const CURRENCIES = [
  { code: 'INR', label: '₹ Indian rupee' },
  { code: 'USD', label: '$ US dollar' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'GBP', label: '£ Pound sterling' },
  { code: 'JPY', label: '¥ Japanese yen' },
  { code: 'AUD', label: '$ Australian dollar' },
  { code: 'CAD', label: '$ Canadian dollar' },
  { code: 'AED', label: 'د.إ UAE dirham' },
]

export const DEFAULT_CURRENCY = 'INR'

export const isKnownCurrency = (code) => CURRENCIES.some((c) => c.code === code)

/** Largest amount accepted, in minor units — guards against a stray keypress. */
export const MAX_AMOUNT = 1_000_000_000_00

/**
 * '1,234.50' → 123450. Returns null for anything that is not a positive
 * amount, so the caller can reject rather than store a silent zero.
 */
export function parseAmount(input) {
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? Math.round(input * 100) : null
  }
  if (typeof input !== 'string') return null

  // Reject negatives BEFORE sanitising: the strip below removes the minus sign,
  // which would silently turn "-5" into a 5.00 expense.
  if (input.includes('-')) return null

  // Strip grouping separators, spaces and any currency symbol the user pasted.
  const cleaned = input.replace(/[\s,]/g, '').replace(/[^\d.]/g, '')
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null

  const minor = Math.round(value * 100)
  return minor > 0 && minor <= MAX_AMOUNT ? minor : null
}

/** 123450 → '₹1,234.50' in the reader's locale. */
export function formatMoney(minor, currency = DEFAULT_CURRENCY) {
  const amount = (Number(minor) || 0) / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      // Always show the hundredths we store, even for zero-decimal currencies,
      // so a displayed figure never disagrees with the stored one.
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return amount.toFixed(2)
  }
}

/** Minor units as a plain editable string: 123450 → '1234.50'. */
export const toAmountInput = (minor) => ((Number(minor) || 0) / 100).toFixed(2)

export const sumOf = (expenses) =>
  expenses.reduce((total, e) => total + (Number(e.amount) || 0), 0)

// --- windows ----------------------------------------------------------------

export const onDay = (expenses, day) => expenses.filter((e) => e.day === day)

/** The last `days` days including today. */
export function inLastDays(expenses, days) {
  const from = addDays(today(), -(days - 1))
  return expenses.filter((e) => e.day >= from && e.day <= today())
}

/** A calendar month, as 'YYYY-MM'. */
export const inMonth = (expenses, month = today().slice(0, 7)) =>
  expenses.filter((e) => e.day.startsWith(month))

export const monthOf = (date = new Date()) => dayKey(date).slice(0, 7)

export function totals(expenses) {
  return {
    today: sumOf(onDay(expenses, today())),
    week: sumOf(inLastDays(expenses, 7)),
    month: sumOf(inMonth(expenses)),
    all: sumOf(expenses),
  }
}

// --- grouping ---------------------------------------------------------------

/** Expenses bucketed by day, newest day first, newest entry first within it. */
export function groupByDay(expenses) {
  const byDay = new Map()
  for (const expense of expenses) {
    if (!byDay.has(expense.day)) byDay.set(expense.day, [])
    byDay.get(expense.day).push(expense)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, items]) => ({
      day,
      items: [...items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
      total: sumOf(items),
    }))
}

/** How many times today's spend must beat the usual day to count as a spike. */
export const SPIKE_MULTIPLE = 1.5

/**
 * Days of actual spending needed in the previous week before "your usual day"
 * means anything. With one or two, the average is dragged near zero and every
 * ordinary day looks like a spike — a false alarm on someone's second day of
 * using the app is the fastest way to make them ignore the warning.
 */
export const SPIKE_MIN_HISTORY = 3

/**
 * Today measured against yesterday, plus whether today is unusually high for
 * you. The comparison is deliberately RELATIVE — an absolute "too much"
 * threshold cannot be right across currencies or incomes.
 *
 *   direction: 'up' | 'down' | 'same' | 'idle'   ('idle' = nothing either day)
 *   pct:       null when yesterday was zero, because n/0 is not a percentage
 *   spike:     today is >= 1.5x your average day over the previous week
 */
export function spendingTrend(expenses) {
  const todayKey = today()
  const yesterdayKey = addDays(todayKey, -1)

  const todayTotal = sumOf(onDay(expenses, todayKey))
  const yesterdayTotal = sumOf(onDay(expenses, yesterdayKey))
  const delta = todayTotal - yesterdayTotal

  // The seven days BEFORE today — including today would flatten the very
  // spike we are trying to detect.
  const previousWeek = Array.from({ length: 7 }, (_, i) =>
    sumOf(onDay(expenses, addDays(todayKey, -(i + 1)))),
  )
  const average = previousWeek.reduce((a, b) => a + b, 0) / previousWeek.length
  const activeDays = previousWeek.filter((total) => total > 0).length

  const direction =
    todayTotal === 0 && yesterdayTotal === 0
      ? 'idle'
      : delta > 0
        ? 'up'
        : delta < 0
          ? 'down'
          : 'same'

  return {
    today: todayTotal,
    yesterday: yesterdayTotal,
    delta,
    // Rounded percentage change; null when there is no base to compare against.
    pct: yesterdayTotal > 0 ? Math.round((delta / yesterdayTotal) * 100) : null,
    direction,
    average: Math.round(average),
    activeDays,
    // Only claim "unusual" once there is enough history for "usual" to exist.
    spike:
      activeDays >= SPIKE_MIN_HISTORY &&
      average > 0 &&
      todayTotal >= average * SPIKE_MULTIPLE,
  }
}

/**
 * Spend per category, largest first. Expenses whose category was deleted are
 * collected under a null category rather than vanishing from the totals.
 */
export function categoryTotals(expenses, categories) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const sums = new Map()

  for (const expense of expenses) {
    const key = byId.has(expense.categoryId) ? expense.categoryId : null
    sums.set(key, (sums.get(key) ?? 0) + (Number(expense.amount) || 0))
  }

  const grand = sumOf(expenses)
  return [...sums.entries()]
    .map(([id, total]) => ({
      category: id ? byId.get(id) : null,
      total,
      pct: grand === 0 ? 0 : Math.round((total / grand) * 100),
    }))
    .sort((a, b) => b.total - a.total)
}

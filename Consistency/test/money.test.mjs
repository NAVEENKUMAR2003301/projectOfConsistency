import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Money tests. Currency arithmetic in floats drifts silently, and a tracker
// whose totals disagree with your own sums is worthless.
const { money, storage, excel, backup, dates } = await loadLibs()

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const { parseAmount, formatMoney, toAmountInput, sumOf, totals, groupByDay, categoryTotals, inMonth, MAX_AMOUNT } = money
const { today, addDays } = dates
const T = today()

// ---------- parsing ----------
check('plain decimal', parseAmount('12.50') === 1250)
check('integer', parseAmount('100') === 10000)
check('grouped', parseAmount('1,234.50') === 123450)
check('spaces', parseAmount(' 42 ') === 4200)
check('currency symbol stripped', parseAmount('₹99.99') === 9999)
check('one decimal place', parseAmount('5.5') === 550)
check('number input', parseAmount(12.34) === 1234)
// Rounding must be to the nearest paisa, never truncation.
check('rounds up', parseAmount('0.005') === 1, String(parseAmount('0.005')))
check('rounds down', parseAmount('0.004') === 0 || parseAmount('0.004') === null)
for (const bad of ['', '   ', 'abc', '0', '-5', '-0.01', null, undefined, {}, NaN, Infinity]) {
  check(`rejects ${JSON.stringify(bad)}`, parseAmount(bad) === null, String(parseAmount(bad)))
}
check('rejects absurd amounts', parseAmount('99999999999') === null)
check('accepts the maximum', parseAmount(String(MAX_AMOUNT / 100)) === MAX_AMOUNT)

// ---------- the float trap ----------
// 0.1 + 0.2 !== 0.3 in floats; in minor units it must be exact.
const cents = [parseAmount('0.10'), parseAmount('0.20')]
check('0.10 + 0.20 is exactly 0.30', cents[0] + cents[1] === 30, String(cents[0] + cents[1]))
// A long run of awkward amounts must stay exact.
const many = Array.from({ length: 1000 }, () => parseAmount('0.07'))
check('1000 x 0.07 is exactly 70.00', many.reduce((a, b) => a + b, 0) === 7000)

// ---------- formatting ----------
check('formats with 2 decimals', /1[.,\s]?234[.,]50/.test(formatMoney(123450, 'INR')), formatMoney(123450, 'INR'))
check('formats zero', formatMoney(0, 'USD').includes('0'))
check('unknown currency does not throw', typeof formatMoney(1000, 'ZZZ') === 'string')
check('round trip through the input', parseAmount(toAmountInput(123456)) === 123456)
check('toAmountInput keeps 2dp', toAmountInput(500) === '5.00')

// ---------- windows ----------
const e = (amount, day, categoryId = null, note = '') => ({
  id: 'e' + Math.random().toString(36).slice(2),
  amount,
  day,
  categoryId,
  note,
  createdAt: '2026-08-09T10:00:00.000Z',
})
const set = [
  e(1000, T),
  e(2000, T),
  e(500, addDays(T, -3)),
  e(700, addDays(T, -10)),
  e(900, addDays(T, -40)),
]
const t = totals(set)
check('today total', t.today === 3000, String(t.today))
check('week total includes 3 days ago', t.week === 3500, String(t.week))
check('week total excludes 10 days ago', t.week < 4200)
check('all total', t.all === 5100, String(t.all))
check('empty totals are zero', totals([]).all === 0)
check('month filter uses YYYY-MM', inMonth(set, T.slice(0, 7)).length >= 3)

// ---------- grouping ----------
const groups = groupByDay(set)
check('groups per day', groups.length === 4, String(groups.length))
check('newest day first', groups[0].day === T)
check('day total sums its items', groups[0].total === 3000)
check('group totals equal the grand total', groups.reduce((a, g) => a + g.total, 0) === 5100)

// ---------- category breakdown ----------
const cats = [
  { id: 'c1', name: 'Food', icon: 'food', color: 'violet' },
  { id: 'c2', name: 'Travel', icon: 'transport', color: 'sky' },
]
const withCats = [e(6000, T, 'c1'), e(3000, T, 'c2'), e(1000, T, 'deleted-cat'), e(0 + 500, T, null)]
const breakdown = categoryTotals(withCats, cats)
check('breakdown sorted by size', breakdown[0].total >= breakdown[1].total)
check('breakdown totals match', breakdown.reduce((a, b) => a + b.total, 0) === 10500)
// An expense whose category was deleted must still be counted.
const orphan = breakdown.find((b) => b.category === null)
check('orphaned spend is kept', orphan && orphan.total === 1500, JSON.stringify(orphan))
check('percentages are sane', breakdown.every((b) => b.pct >= 0 && b.pct <= 100))

// ---------- persistence ----------
const norm = storage.normalizeExpenses([
  { amount: 1000, day: T },
  { amount: 0, day: T }, // zero is not an expense
  { amount: -5, day: T },
  { amount: 'abc', day: T },
  { amount: 12.7, day: T }, // rounded to an integer minor unit
  null,
  { amount: 100, day: 'junk' },
])
check('valid expense kept', norm[0].amount === 1000)
check('zero rejected', !norm.some((x) => x.amount === 0))
check('negative rejected', !norm.some((x) => x.amount < 0))
check('non-numeric rejected', norm.length === 3, String(norm.length))
check('fractional minor unit rounded', norm.some((x) => x.amount === 13))
check('bad day falls back to today', norm[norm.length - 1].day === T)
check('non-array is empty', storage.normalizeExpenses('nope').length === 0)

const normCats = storage.normalizeCategories([
  { name: 'Food' },
  { name: '  ' },
  { id: 'dup', name: 'A' },
  { id: 'dup', name: 'B' },
])
check('blank category dropped', normCats.length === 3)
check('category ids de-collided', normCats[1].id !== normCats[2].id)
check('category defaults filled', normCats[0].icon === 'receipt')

// ---------- JSON backup ----------
const payload = backup.buildBackup({ habits: [], notes: [], expenses: set, categories: cats })
const restored = backup.parseBackup(JSON.stringify(payload))
check('backup carries expenses', restored.expenses.length === 5)
check('backup carries categories', restored.categories.length === 2)
check('backup preserves the total exactly', sumOf(restored.expenses) === 5100)
// An expenses-only backup is valid.
check(
  'expenses-only backup accepted',
  backup.parseBackup(JSON.stringify({ app: 'consistency', expenses: [e(100, T)] })).expenses.length === 1,
)

// ---------- merge ----------
const { categories: mergedCats, remap } = backup.mergeCategories(
  [{ id: 'local-food', name: 'Food', icon: 'food', color: 'violet' }],
  [{ id: 'remote-food', name: 'food', icon: 'food', color: 'rose' }],
)
check('categories merge by name', mergedCats.length === 1, String(mergedCats.length))
check('remap points at the local id', remap.get('remote-food') === 'local-food')

const localExp = [e(1000, T, 'local-food', 'lunch')]
const remoteExp = [{ ...e(1000, T, 'remote-food', 'lunch'), id: 'remote-1' }]
const mergedExp = backup.mergeExpenses(localExp, remoteExp, remap)
check('duplicate expense not double counted', mergedExp.length === 1, String(mergedExp.length))
check('merged total unchanged', sumOf(mergedExp) === 1000)
const distinct = backup.mergeExpenses(localExp, [{ ...e(2500, T, 'remote-food', 'books'), id: 'r2' }], remap)
check('genuinely new expense added', distinct.length === 2)
check('remapped category applied', distinct[1].categoryId === 'local-food' || distinct[0].categoryId === 'local-food')
check('merge is idempotent', backup.mergeExpenses(mergedExp, remoteExp, remap).length === 1)

// ---------- spreadsheet ----------
check('Expenses sheet defined', excel.SHEETS.expenses === 'Expenses')
const rows = excel.expensesToRows(withCats, cats)
check('amount written in major units', rows[0].Amount === '60.00', rows[0].Amount)
check('category name written', rows[0].Category === 'Food')
const back = excel.sheetsToData({
  categoryRows: excel.rowsToObjects([excel.CATEGORY_COLUMNS, ['c1', 'Food', 'food', 'violet']]),
  expenseRows: excel.rowsToObjects([
    excel.EXPENSE_COLUMNS,
    ['e1', T, 'Food', '60.00', 'lunch', 'c1', ''],
    ['e2', T, 'Food', '1,234.50', '', 'c1', ''],
    ['e3', T, 'Food', 'free', '', 'c1', ''], // unusable → skipped, not zero
  ]),
})
check('sheet amount parsed to minor units', back.expenses[0].amount === 6000, String(back.expenses[0]?.amount))
check('grouped sheet amount parsed', back.expenses[1].amount === 123450)
check('unusable amount skipped not zeroed', back.expenses.length === 2, String(back.expenses.length))
check('skip is counted', back.skipped >= 1, String(back.skipped))
check('category linked by id', back.expenses[0].categoryId === back.categories[0].id)
// A hand-written row with only the category NAME must still link.
const byName = excel.sheetsToData({
  categoryRows: excel.rowsToObjects([excel.CATEGORY_COLUMNS, ['c1', 'Food', 'food', 'violet']]),
  expenseRows: excel.rowsToObjects([excel.EXPENSE_COLUMNS, ['e9', T, 'food', '10.00', '', '', '']]),
})
check('links by category name', byName.expenses[0].categoryId === byName.categories[0].id)

console.log(fails === 0 ? '\nALL MONEY TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

import { APP_DIR, appPath, loadLibs, readApp, readBuiltCss, readBuiltJs } from './_setup.mjs'

// Spend-vs-yesterday tests. The failure modes here are division by zero, a
// percentage with no base, and flagging a "spike" from meaningless noise.
const { money, dates } = await loadLibs()

let fails = 0
const check = (name, cond, extra = '') => {
  if (!cond) {
    fails++
    console.log(`FAIL  ${name} ${extra}`)
  }
}

const { spendingTrend, SPIKE_MULTIPLE } = money
const { today, addDays } = dates
const T = today()

let seq = 0
const e = (amount, dayOffset) => ({
  id: `e${seq++}`,
  amount,
  day: addDays(T, -dayOffset),
  categoryId: null,
  note: '',
  createdAt: null,
})

// ---------- direction ----------
let t = spendingTrend([e(5000, 0), e(2000, 1)])
check('spent more today -> up', t.direction === 'up', t.direction)
check('delta is the difference', t.delta === 3000, String(t.delta))
check('percentage against yesterday', t.pct === 150, String(t.pct))

t = spendingTrend([e(1000, 0), e(4000, 1)])
check('spent less today -> down', t.direction === 'down', t.direction)
check('delta is negative', t.delta === -3000, String(t.delta))
check('percentage is negative', t.pct === -75, String(t.pct))

t = spendingTrend([e(2500, 0), e(2500, 1)])
check('identical days -> same', t.direction === 'same', t.direction)
check('delta is zero', t.delta === 0)
check('percentage is zero', t.pct === 0)

// ---------- the divide-by-zero cases ----------
t = spendingTrend([e(3000, 0)])
check('nothing yesterday -> up', t.direction === 'up', t.direction)
check('no percentage without a base', t.pct === null, String(t.pct))
check('yesterday reported as zero', t.yesterday === 0)
check('delta is the whole amount', t.delta === 3000)

t = spendingTrend([e(3000, 1)])
check('nothing today -> down', t.direction === 'down', t.direction)
check('down from yesterday has a percentage', t.pct === -100, String(t.pct))

t = spendingTrend([])
check('no data at all -> idle', t.direction === 'idle', t.direction)
check('idle totals are zero', t.today === 0 && t.yesterday === 0)
check('idle has no percentage', t.pct === null)
check('idle is not a spike', t.spike === false)

t = spendingTrend([e(5000, 3)])
check('both days empty -> idle', t.direction === 'idle', t.direction)

// ---------- spike detection ----------
// A quiet week then a big day.
const quietWeek = [1, 2, 3, 4, 5, 6, 7].map((d) => e(1000, d)) // 10.00 a day
t = spendingTrend([...quietWeek, e(5000, 0)]) // 50.00 today
check('spike detected above the multiple', t.spike === true, JSON.stringify(t))
check('average excludes today', t.average === 1000, String(t.average))

// Exactly at the threshold counts.
t = spendingTrend([...quietWeek, e(1000 * SPIKE_MULTIPLE, 0)])
check('threshold itself counts as a spike', t.spike === true, String(t.average))

// Just under does not.
t = spendingTrend([...quietWeek, e(1000 * SPIKE_MULTIPLE - 1, 0)])
check('just under the threshold is not a spike', t.spike === false)

// A normal day is not a spike even though it is above yesterday.
t = spendingTrend([...quietWeek, e(1100, 0)])
check('slightly above average is not a spike', t.spike === false, JSON.stringify(t))
check('but still reads as up', t.direction === 'up')

// With no history there is no "usual", so nothing can be called unusual.
t = spendingTrend([e(999999, 0)])
check('no history means no spike claim', t.spike === false, JSON.stringify(t))

// Thin history is the dangerous case: one prior day drags the average to near
// zero, so an ordinary day would look like a spike unless we require a real
// baseline first.
t = spendingTrend([e(2000, 1), e(5000, 0)])
check('one prior day is not enough to claim a spike', t.spike === false, JSON.stringify(t))
check('...but it still reads as up', t.direction === 'up')
t = spendingTrend([e(2000, 1), e(2000, 2), e(9000, 0)])
check('two prior days is still not enough', t.spike === false, JSON.stringify(t))
t = spendingTrend([e(2000, 1), e(2000, 2), e(2000, 3), e(9000, 0)])
check('three prior days is a usable baseline', t.spike === true, JSON.stringify(t))
check('active days are counted', t.activeDays === 3, String(t.activeDays))

// ---------- windows ----------
// Only yesterday counts as yesterday — not "the last time you spent".
t = spendingTrend([e(5000, 0), e(9000, 4)])
check('older days are not yesterday', t.yesterday === 0, String(t.yesterday))
// The average covers exactly the previous seven days, not eight.
t = spendingTrend([e(7000, 8), e(100, 0)])
check('day 8 is outside the average window', t.average === 0, String(t.average))

// Multiple expenses on the same day are summed.
t = spendingTrend([e(1000, 0), e(2000, 0), e(500, 1)])
check('today sums all its expenses', t.today === 3000, String(t.today))
check('yesterday sums all its expenses', t.yesterday === 500)

// ---------- integer safety ----------
// Everything stays in integer minor units; no float drift into the totals.
t = spendingTrend([e(7, 0), e(7, 0), e(7, 0), e(3, 1)])
check('sums stay exact integers', t.today === 21 && Number.isInteger(t.today), String(t.today))
check('average is an integer', Number.isInteger(t.average), String(t.average))
check('percentage is a whole number', Number.isInteger(t.pct), String(t.pct))

console.log(fails === 0 ? '\nALL TREND TESTS PASS' : `\n${fails} FAILURES`)
process.exit(fails === 0 ? 0 : 1)

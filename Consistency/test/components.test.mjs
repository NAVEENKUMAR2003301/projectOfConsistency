import { createChecker, loadUI, visibleText } from './_setup.mjs'

// Renders every component against ordinary, legacy and deliberately broken
// data. Two things are being tested: that nothing throws (a component that
// crashes here crashes in a browser), and that what it says is true.
const ui = await loadUI()
const { check, done } = createChecker()

let out
try {
  out = ui.render()
} catch (error) {
  console.log(`FAIL  a component threw while rendering: ${error.message}`)
  console.log(error.stack.split('\n').slice(0, 8).join('\n'))
  process.exit(1)
}

const text = (key) => visibleText(out[key])
const says = (key, needle, extra = '') =>
  check(`${key} says "${needle}"`, text(key).includes(needle), extra)
const silent = (key, needle, extra = '') =>
  check(`${key} does not say "${needle}"`, !text(key).includes(needle), extra)

// Form fields carry their content in attributes, which visibleText strips.
const hasValue = (key, value, extra = '') =>
  check(`${key} is prefilled with "${value}"`, out[key].includes(`value="${value}"`), extra)

// --- everything rendered ----------------------------------------------------
// Three components render nothing by design: no spend history, no streak yet,
// and no reminders set. Everything else must produce markup.
const BLANK_BY_DESIGN = ['TrendIdle', 'BadgeZero', 'ReminderSilent']
const cases = Object.keys(out).filter((k) => k !== 'TAB_COUNT')
check(
  'every case produced markup',
  cases.filter((k) => out[k].length === 0).join(',') === BLANK_BY_DESIGN.join(','),
  `blank: ${cases.filter((k) => out[k].length === 0).join(',') || 'none'}`,
)
check('more than 50 cases covered', cases.length > 50, `only ${cases.length}`)

// --- the app itself ---------------------------------------------------------
says('App', 'Consistency')
says('App', 'Naveenkumar V', 'the credit is required')
says('App', 'Add the habits that matter to you', 'empty state on first run')
says('App', 'Build one day at a time', 'first run opens the tour')

// --- habit cards ------------------------------------------------------------
says('CardPlain', 'Solve 5 practice problems')
says('CardPlain', '2 days in a row')
says('CardPlain', 'Check in')
says('CardDone', 'Done today')
silent('CardDone', 'Check in', 'a finished habit offers undo, not another check-in')

// A repeating habit logs one at a time and can take one back.
says('CardRepeating', 'Log one · 3/8')
says('CardRepeating', '3 of 8')
says('CardRepeating', 'undo one')
silent('CardPlain', 'undo one', 'a once-a-day habit has nothing to take back')

// Legacy rows: history stored as raw `true`, an emoji instead of an icon, and
// no target/progress at all. These must still read correctly.
says('CardLegacy', 'Legacy habit')
says('CardLegacy', 'Done today')
says('CardLegacy', '\u{1F4DA}', 'the original emoji is kept, not replaced')
check('no streak crash on legacy history', text('CardLegacy').includes('days in a row'))

// --- the reminder line must describe what will actually happen --------------
// An end time earlier than the start collapses the spread to a single slot.
// Counting from the target instead of the slots claimed "20 reminders" for a
// habit that nudges once.
says('CardRepeating', '8 reminders', 'a valid window spreads across the day')
says('CardHostile', 'Reminder at', 'a backwards window is one reminder, not many')
silent('CardHostile', '20 reminders', 'this would be a promise the app cannot keep')
silent('CardHostile', 'reminders,', 'no range should be shown for a single slot')

// --- forms ------------------------------------------------------------------
says('FormNew', 'Add habit')
hasValue('FormEdit', 'Solve 5 practice problems', 'editing must start from the current name')
hasValue('FormEdit', '19:30', 'the existing reminder time is kept')
hasValue('FormEditRepeating', '20:00', 'the reminder window survives a round trip')
says('FormEditRepeating', '8 nudges', 'the spread is previewed before saving')
says(
  'FormEditHostile',
  'later in the day than the first',
  'a backwards window is named, not answered with "add an end time"',
)
says('FormNew', 'Revise 1 chapter', 'suggestions are offered as starting points')

// A legacy habit has an emoji and no icon; the grid stays unselected rather
// than silently reassigning one.
hasValue('FormEditLegacy', 'Legacy habit')

// --- puzzles ----------------------------------------------------------------
// Generation is randomised, so assert the frame rather than the question.
for (const key of ['Puzzle', 'PuzzleLegacy', 'PuzzleHostile']) {
  check(`${key} produced a question`, out[key].length > 200)
}

// --- calendar and stats -----------------------------------------------------
says('CalendarEmpty', 'Nothing tracked this month yet')
says('CalendarEmpty', 'All done days', 'plain words, not "perfect days"')
says('StatsEmpty', 'No statistics yet')
says('StatsFull', 'Per habit')
says('StatsFull', 'Longest ever')
check('stats survive one habit only', text('StatsSingle').includes('Last 30 days'))

// --- money ------------------------------------------------------------------
says('MoneyEmpty', 'Spending')
says('MoneyEmpty', '₹0.00', 'zero is shown, not a blank')
says('MoneyFull', 'lunch')
// The category can be deleted while expenses still point at it.
says('MoneyOrphanOnly', 'Uncategorised', 'an orphaned expense must still show up')
says('MoneyOrphanOnly', '₹9,99,999.99', 'large amounts are not truncated')
says('ExpenseNoCategories', 'Add', 'the form works before any category exists')
check('idle trend renders nothing', text('TrendIdle') === '')

// --- notes ------------------------------------------------------------------
says('NotesEmpty', 'Nothing written yet')
says('NotesFull', 'Finish chapter 4')
says('NoteBroken', 'no timestamps', 'a note with no dates still renders')
says('NotesEmpty', '0/2000', 'the character budget is visible')

// --- data tab ---------------------------------------------------------------
says('DataFull', 'Export')
says('DataEmpty', 'Export', 'exporting is offered even with nothing to export')

// --- chrome -----------------------------------------------------------------
check(
  'desktop tabs cover every section',
  (out.Tabs.match(/role="tab"/g) ?? []).length === Number(out.TAB_COUNT),
)
check(
  'mobile nav covers every section',
  (out.MobileNav.match(/<button/g) ?? []).length === Number(out.TAB_COUNT),
  'the phone nav must not hide a section',
)
check('mobile nav clears the home indicator', out.MobileNav.includes('safe-area-inset-bottom'))
says('Onboarding', '1 of 5')
says('Onboarding', 'Skip', 'the tour is escapable')
says('Toast', 'Nice work')
says('BackupReminder', 'backup')

// A habit with no streak at all shows no badge strip — an empty progress bar
// on a brand-new habit is discouraging, not informative. Once a streak exists
// the strip appears, naming the next milestone.
check('no badge strip before the first streak', out.BadgeZero === '')
says('CardPlain', 'No badges yet')
says('CardPlain', 'First steps', 'the next milestone is named once a streak exists')
says('BadgeMax', 'One year', 'every milestone is listed at the top end')

// Glyphs fall back rather than rendering nothing for unknown or absent icons.
for (const key of ['GlyphIcon', 'GlyphEmoji', 'GlyphUnknown', 'GlyphEmpty']) {
  check(`${key} draws something`, out[key].length > 20)
}

// --- reminder banner --------------------------------------------------------
says('ReminderAsk', 'Turn on', 'permission is requested, never assumed')
says('ReminderDue', 'Drink water')
says('ReminderDue', 'Skip', 'a nudge can be waved away without silencing the rest')
check('nothing shown when no reminders are set', text('ReminderSilent') === '')

// --- accessibility ----------------------------------------------------------
// Icon-only controls are unusable with a screen reader without a label.
check('delete control is labelled', out.CardPlain.includes('aria-label="Delete'))
check('edit control is labelled', out.CardPlain.includes('aria-label="Edit'))
check('decorative icons are hidden from screen readers', out.CardPlain.includes('aria-hidden="true"'))

done('components')

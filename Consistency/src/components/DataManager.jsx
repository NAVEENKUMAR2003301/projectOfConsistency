import { useMemo, useRef, useState } from 'react'
import {
  backupFilename,
  buildBackup,
  downloadBackup,
  mergeCategories,
  mergeExpenses,
  mergeHabits,
  mergeNotes,
  parseBackup,
} from '../lib/backup'
import { isSpreadsheet } from '../lib/excel'
import { UI } from '../lib/icons'

// The spreadsheet libraries are ~120 KB and only matter on this tab, so they
// are fetched on first use rather than shipped in the initial bundle.
const loadExcel = () => import('../lib/excelFile')

// localStorage is commonly capped near 5 MB per origin.
const QUOTA_BYTES = 5 * 1024 * 1024

const formatBytes = (bytes) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

export default function DataManager({
  habits,
  notes,
  expenses = [],
  categories = [],
  onReplaceHabits,
  onReplaceNotes,
  onReplaceExpenses,
  onReplaceCategories,
  onExported,
  lastBackupAt,
}) {
  const fileRef = useRef(null)
  const [pending, setPending] = useState(null) // parsed backup awaiting a choice
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // Measured from the in-memory data rather than by reading localStorage during
  // render: the write happens in an effect, so reading storage here would show
  // the size from before the change that triggered this render.
  const used = useMemo(
    () =>
      JSON.stringify(habits).length +
      JSON.stringify(notes).length +
      JSON.stringify(expenses).length +
      JSON.stringify(categories).length,
    [habits, notes, expenses, categories],
  )
  const usedPct = Math.min(100, Math.round((used / QUOTA_BYTES) * 100))
  const isEmpty = habits.length === 0 && notes.length === 0 && expenses.length === 0

  const handleExportExcel = async () => {
    setError('')
    setStatus('')
    setBusy(true)
    try {
      const { exportWorkbook } = await loadExcel()
      await exportWorkbook({ habits, notes, expenses, categories })
      onExported()
      setStatus('Excel backup downloaded.')
    } catch {
      setError('The spreadsheet could not be created. Try the JSON export instead.')
    } finally {
      setBusy(false)
    }
  }

  const handleExportJson = () => {
    setError('')
    setStatus('')
    const ok = downloadBackup(buildBackup({ habits, notes, expenses, categories }), backupFilename())
    if (ok) {
      onExported()
      setStatus('JSON backup downloaded.')
    } else {
      setError('The browser blocked the download. Check its download settings.')
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    // Reset the input so picking the SAME file twice still fires onChange.
    event.target.value = ''
    if (!file) return

    setError('')
    setStatus('')
    setBusy(true)
    // One picker for both formats — the extension decides the reader.
    const spreadsheet = isSpreadsheet(file.name)
    try {
      const parsed = spreadsheet
        ? await (await loadExcel()).importWorkbook(file)
        : parseBackup(await file.text())
      setPending({ ...parsed, source: spreadsheet ? 'Excel' : 'JSON' })
    } catch (e) {
      setPending(null)
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const applyImport = (mode) => {
    if (!pending) return
    if (mode === 'replace') {
      onReplaceHabits(pending.habits)
      onReplaceNotes(pending.notes)
      onReplaceCategories(pending.categories ?? [])
      onReplaceExpenses(pending.expenses ?? [])
    } else {
      onReplaceHabits(mergeHabits(habits, pending.habits))
      onReplaceNotes(mergeNotes(notes, pending.notes))
      // Categories merge first: expenses reference them, and incoming ids get
      // remapped onto the matching local category.
      const { categories: mergedCategories, remap } = mergeCategories(
        categories,
        pending.categories ?? [],
      )
      onReplaceCategories(mergedCategories)
      onReplaceExpenses(mergeExpenses(expenses, pending.expenses ?? [], remap))
    }
    setStatus(
      mode === 'replace'
        ? 'Everything was replaced with the backup.'
        : 'Backup merged into your current data.',
    )
    setPending(null)
  }

  const handleReset = () => {
    onReplaceHabits([])
    onReplaceNotes([])
    onReplaceExpenses([])
    onReplaceCategories([])
    setConfirmReset(false)
    setStatus('All habits, notes and expenses were deleted.')
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-line bg-card p-4 sm:p-5">
        <h3 className="font-semibold text-ink">Backup your data</h3>
        <p className="mt-1 text-sm text-ink-2">
          Everything lives in this browser only. Clearing site data, switching browsers
          or a new device means starting over — unless you keep an export.
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleExportExcel}
            disabled={busy || isEmpty}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40"
          >
            <UI.download size={16} strokeWidth={2} aria-hidden="true" />
            Export Excel (.xlsx)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-card-hover disabled:opacity-40"
          >
            <UI.upload size={16} strokeWidth={2} aria-hidden="true" />
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/json,.json"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={handleExportJson}
            disabled={busy || isEmpty}
            className="rounded-lg px-2 py-1 text-xs text-ink-3 underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-40"
          >
            or export as JSON
          </button>
          <p className="text-xs text-ink-3">
            {lastBackupAt
              ? `Last export: ${new Date(lastBackupAt).toLocaleDateString()}`
              : 'You have never exported a backup.'}
          </p>
        </div>

        <p className="mt-3 text-xs text-ink-3">
          The spreadsheet has five sheets — <strong>Habits</strong>,{' '}
          <strong>Check-ins</strong> (one row per completed day), <strong>Notes</strong>,{' '}
          <strong>Expenses</strong> (one row per expense) and{' '}
          <strong>Categories</strong> — so you can read or edit it in Excel, Google
          Sheets or LibreOffice. Import accepts either format.
        </p>

        {busy && <p className="mt-3 text-sm text-ink-3">Working…</p>}

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
        {status && !error && (
          <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {status}
          </p>
        )}

        {pending && (
          <div className="animate-rise mt-4 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm font-medium text-ink">
              {pending.source} backup: {pending.habits.length} habit
              {pending.habits.length === 1 ? '' : 's'}, {pending.notes.length} note
              {pending.notes.length === 1 ? '' : 's'} and {pending.expenses?.length ?? 0}{' '}
              expense{(pending.expenses?.length ?? 0) === 1 ? '' : 's'}.
            </p>
            {pending.skipped > 0 && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {pending.skipped} check-in row
                {pending.skipped === 1 ? '' : 's'} skipped — no matching habit or a
                missing date.
              </p>
            )}
            <p className="mt-1 text-xs text-ink-3">
              Merge keeps what you have and adds anything missing. Replace throws away
              your current data.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => applyImport('merge')}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Merge (recommended)
              </button>
              <button
                onClick={() => applyImport('replace')}
                className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-card-hover"
              >
                Replace everything
              </button>
              <button
                onClick={() => setPending(null)}
                className="rounded-xl px-4 py-2.5 text-sm text-ink-3 transition hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-line bg-card p-4 sm:p-5">
        <h3 className="font-semibold text-ink">Storage used</h3>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-500"
            style={{ width: `${Math.max(usedPct, 1)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          {formatBytes(used)} of roughly 5 MB ({usedPct}%). Habits and notes are text,
          so this stays tiny — you would need thousands of entries to fill it.
        </p>
      </div>

      <div className="rounded-3xl border border-line bg-card p-4 sm:p-5">
        <h3 className="font-semibold text-ink">Privacy</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
          {[
            'No account, no sign-up, no server',
            'Nothing you write ever leaves this device',
            'No analytics and no tracking of any kind',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <UI.check
                size={15}
                strokeWidth={2.4}
                className="mt-0.5 shrink-0 text-emerald-500"
                aria-hidden="true"
              />
              {line}
            </li>
          ))}
        </ul>
        {/* Stated plainly, so "nothing leaves this device" stays true. */}
        <p className="mt-3 text-xs text-ink-3">
          The one exception is the feedback link in the footer: tapping it opens a
          Google Form in a new tab. None of your habits or notes go with it.
        </p>
      </div>

      <div className="rounded-3xl border border-rose-500/40 bg-rose-500/5 p-4 sm:p-5">
        <h3 className="font-semibold text-ink">Start fresh</h3>
        <p className="mt-1 text-sm text-ink-2">
          Deletes every habit, streak and note on this device. This cannot be undone —
          export a backup first if you might want any of it back.
        </p>
        {confirmReset ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={handleReset}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Yes, delete everything
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="rounded-xl border border-line px-4 py-2.5 text-sm text-ink transition hover:bg-card-hover"
            >
              Keep my data
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            disabled={isEmpty && expenses.length === 0}
            className="mt-3 rounded-xl border border-rose-500/50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-40 dark:text-rose-300"
          >
            Reset all data
          </button>
        )}
      </div>
    </section>
  )
}

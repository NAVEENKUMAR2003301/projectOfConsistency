// Both packages expose no root export — the browser build must be imported
// by its explicit subpath, or the bundler fails to resolve it.
import readXlsxFile from 'read-excel-file/browser'
import writeXlsxFile, { getSheetData } from 'write-excel-file/browser'
import {
  SHEETS,
  buildWorkbook,
  rowsToObjects,
  sheetsToData,
  workbookFilename,
} from './excel'

// Thin I/O wrappers around the spreadsheet libraries. All the mapping logic
// lives in excel.js as pure functions so it can be tested without a browser.

/** Turns the library-agnostic spec from excel.js into v4 sheet descriptors. */
export const toSheets = (spec) =>
  spec.map(({ sheet, rows, columns }) => ({
    sheet,
    data: getSheetData(rows, columns),
    // Sheet-level columns carry width only; the mappers did their job above.
    columns: columns.map(({ width }) => ({ width })),
  }))

export async function exportWorkbook({ habits, notes }) {
  const sheets = toSheets(buildWorkbook({ habits, notes }))
  await writeXlsxFile(sheets).toFile(workbookFilename())
}

export async function importWorkbook(file) {
  let sheets
  try {
    // One read returns every sheet with its rows, so the file is parsed once.
    sheets = await readXlsxFile(file, { getSheets: true })
  } catch {
    throw new Error(
      'That file could not be opened as a spreadsheet. Export a fresh backup and try again.',
    )
  }

  const byName = new Map(
    (Array.isArray(sheets) ? sheets : []).map((s) => [s.sheet, s.data ?? []]),
  )

  if (!byName.has(SHEETS.habits) && !byName.has(SHEETS.notes)) {
    throw new Error(
      `That workbook has no "${SHEETS.habits}" or "${SHEETS.notes}" sheet, so there is nothing to import.`,
    )
  }

  let parsed
  try {
    parsed = sheetsToData({
      habitRows: rowsToObjects(byName.get(SHEETS.habits) ?? []),
      checkinRows: rowsToObjects(byName.get(SHEETS.checkins) ?? []),
      noteRows: rowsToObjects(byName.get(SHEETS.notes) ?? []),
    })
  } catch {
    throw new Error('That workbook could not be read. Some sheets may be damaged.')
  }

  if (parsed.habits.length === 0 && parsed.notes.length === 0) {
    throw new Error('That workbook is empty — nothing to import.')
  }

  return parsed
}

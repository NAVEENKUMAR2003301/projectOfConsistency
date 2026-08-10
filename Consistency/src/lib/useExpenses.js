import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_COLOR } from './colors'
import { today } from './dates'
import { DEFAULT_CURRENCY, isKnownCurrency } from './money'
import {
  CATEGORIES_KEY,
  EXPENSES_KEY,
  MAX_CATEGORY_NAME,
  MAX_EXPENSE_NOTE,
  SETTINGS_KEY,
  newId,
  normalizeCategories,
  normalizeExpenses,
  readJSON,
  writeJSON,
} from './storage'

// Categories start empty on purpose: what you spend on is yours to name, the
// same way habits are. ExpenseForm offers suggestions instead of defaults.

const loadCurrency = () => {
  const stored = readJSON(SETTINGS_KEY, {})?.currency
  return isKnownCurrency(stored) ? stored : DEFAULT_CURRENCY
}

export function useExpenses() {
  const [expenses, setExpenses] = useState(() =>
    normalizeExpenses(readJSON(EXPENSES_KEY, [])),
  )
  const [categories, setCategories] = useState(() =>
    normalizeCategories(readJSON(CATEGORIES_KEY, [])),
  )
  const [currency, setCurrencyState] = useState(loadCurrency)

  useEffect(() => {
    writeJSON(EXPENSES_KEY, expenses)
  }, [expenses])

  useEffect(() => {
    writeJSON(CATEGORIES_KEY, categories)
  }, [categories])

  const setCurrency = useCallback((code) => {
    if (!isKnownCurrency(code)) return
    setCurrencyState(code)
    writeJSON(SETTINGS_KEY, { ...readJSON(SETTINGS_KEY, {}), currency: code })
  }, [])

  // --- expenses ---
  const addExpense = useCallback(({ amount, categoryId, note, day }) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    setExpenses((prev) => [
      {
        id: newId('e'),
        amount: Math.round(amount),
        categoryId: categoryId || null,
        note: (note ?? '').trim().slice(0, MAX_EXPENSE_NOTE),
        day: day || today(),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ])
  }, [])

  const updateExpense = useCallback((id, { amount, categoryId, note, day }) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              amount: Math.round(amount),
              categoryId: categoryId || null,
              note: (note ?? '').trim().slice(0, MAX_EXPENSE_NOTE),
              day: day || e.day,
            }
          : e,
      ),
    )
  }, [])

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // --- categories ---
  /** Returns the new id so a form can select what it just created. */
  const addCategory = useCallback(({ name, icon, color }) => {
    const trimmed = (name ?? '').trim()
    if (!trimmed) return null
    const id = newId('c')
    setCategories((prev) => [
      ...prev,
      {
        id,
        name: trimmed.slice(0, MAX_CATEGORY_NAME),
        icon: icon || 'receipt',
        color: color || DEFAULT_COLOR,
      },
    ])
    return id
  }, [])

  const updateCategory = useCallback((id, { name, icon, color }) => {
    const trimmed = (name ?? '').trim()
    if (!trimmed) return
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, name: trimmed.slice(0, MAX_CATEGORY_NAME), icon: icon || c.icon, color }
          : c,
      ),
    )
  }, [])

  /**
   * Deleting a category keeps its expenses and unlinks them, so the totals
   * never change behind your back — they simply become uncategorised.
   */
  const removeCategory = useCallback((id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setExpenses((prev) =>
      prev.map((e) => (e.categoryId === id ? { ...e, categoryId: null } : e)),
    )
  }, [])

  const replaceExpenses = useCallback((next) => {
    setExpenses(normalizeExpenses(next))
  }, [])

  const replaceCategories = useCallback((next) => {
    setCategories(normalizeCategories(next))
  }, [])

  return {
    expenses,
    categories,
    currency,
    setCurrency,
    addExpense,
    updateExpense,
    removeExpense,
    addCategory,
    updateCategory,
    removeCategory,
    replaceExpenses,
    replaceCategories,
  }
}

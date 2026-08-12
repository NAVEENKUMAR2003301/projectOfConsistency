import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// Imported rather than repeated: this key is also written by the pre-paint
// script in index.html, and previously existed as a second literal in
// storage.js. Three copies of one string is three chances to break the theme
// silently.
import { THEME_KEY } from './storage'

const THEMES = ['light', 'dark', 'system']

const DARK_QUERY = '(prefers-color-scheme: dark)'

// The OS preference is an external store, so React subscribes to it directly
// rather than mirroring it into state inside an effect.
const subscribeToSystem = (onChange) => {
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const getSystemSnapshot = () => window.matchMedia(DARK_QUERY).matches
const getSystemServerSnapshot = () => false

const readStored = () => {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return THEMES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(readStored)
  const systemDark = useSyncExternalStore(
    subscribeToSystem,
    getSystemSnapshot,
    getSystemServerSnapshot,
  )

  // Derived during render, so it can never lag a frame behind `theme`.
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  // Push the resolved value onto <html>; the `dark:` variant keys off it.
  useEffect(() => {
    document.documentElement.dataset.theme = resolved
  }, [resolved])

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return
    setThemeState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Private mode — the choice just won't survive a reload.
    }
  }, [])

  return { theme, resolved, setTheme }
}

// Tailwind scans source for literal class names, so every variant is spelled
// out here — never built by string concatenation. Accents carry both light and
// dark values because a 300-weight text colour is unreadable on white.

export const COLORS = {
  violet: {
    label: 'Violet',
    dot: 'bg-violet-500',
    text: 'text-violet-600 dark:text-violet-300',
    fill: 'bg-violet-500',
    soft: 'bg-violet-500/10 dark:bg-violet-500/15',
    border: 'border-violet-500/45',
    glowFrom: 'from-violet-500/20',
    button: 'bg-violet-600 hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400',
  },
  emerald: {
    label: 'Emerald',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    fill: 'bg-emerald-500',
    soft: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/45',
    glowFrom: 'from-emerald-500/20',
    button: 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400',
  },
  sky: {
    label: 'Sky',
    dot: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-300',
    fill: 'bg-sky-500',
    soft: 'bg-sky-500/10 dark:bg-sky-500/15',
    border: 'border-sky-500/45',
    glowFrom: 'from-sky-500/20',
    button: 'bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400',
  },
  amber: {
    label: 'Amber',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    fill: 'bg-amber-500',
    soft: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/45',
    glowFrom: 'from-amber-500/20',
    button: 'bg-amber-600 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400',
  },
  rose: {
    label: 'Rose',
    dot: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-300',
    fill: 'bg-rose-500',
    soft: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/45',
    glowFrom: 'from-rose-500/20',
    button: 'bg-rose-600 hover:bg-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400',
  },
}

export const COLOR_KEYS = Object.keys(COLORS)

export const DEFAULT_COLOR = 'violet'

/** Falls back rather than returning undefined for a hand-edited/unknown key. */
export const colorOf = (key) => COLORS[key] ?? COLORS[DEFAULT_COLOR]

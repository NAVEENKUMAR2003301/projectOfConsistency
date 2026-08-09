import { UI } from './icons'

// Single source of truth for navigation: the desktop pill row and the mobile
// bottom bar both render from this, so they can never fall out of sync.
export const TABS = [
  { key: 'today', label: 'Today', Icon: UI.today },
  { key: 'calendar', label: 'Calendar', Icon: UI.calendar },
  { key: 'stats', label: 'Stats', Icon: UI.stats },
  { key: 'notes', label: 'Notes', Icon: UI.notes },
  { key: 'data', label: 'Data', Icon: UI.data },
]

export const TAB_KEYS = TABS.map((t) => t.key)

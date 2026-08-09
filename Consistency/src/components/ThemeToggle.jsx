import { UI } from '../lib/icons'

const OPTIONS = [
  { key: 'light', Icon: UI.sun, label: 'Light' },
  { key: 'dark', Icon: UI.moon, label: 'Dark' },
  { key: 'system', Icon: UI.system, label: 'System' },
]

export default function ThemeToggle({ theme, onChange }) {
  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-full border border-line bg-card p-1"
    >
      {OPTIONS.map(({ key, Icon, label }) => {
        const active = theme === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={active}
            title={label}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? 'bg-card-hover text-ink shadow-sm'
                : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
            {/* Labels collapse on narrow phones; the icon carries the meaning. */}
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

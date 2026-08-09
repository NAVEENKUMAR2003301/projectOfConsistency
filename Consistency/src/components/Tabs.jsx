import { TABS } from '../lib/tabs'

/** Desktop/tablet navigation. Phones get MobileNav instead. */
export default function Tabs({ active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="hidden gap-1 overflow-x-auto pb-1 sm:flex"
    >
      {TABS.map(({ key, Icon, label }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-transparent bg-violet-600 text-white'
                : 'border-line bg-card text-ink-2 hover:bg-card-hover hover:text-ink'
            }`}
          >
            <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

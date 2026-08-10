import { TABS } from '../lib/tabs'

/** Desktop/tablet navigation. Phones get MobileNav instead. */
export default function Tabs({ active, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className="glass hidden gap-1 rounded-full p-1.5 sm:flex"
    >
      {TABS.map(({ key, Icon, label }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'scale-[1.03] bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                : 'text-ink-2 hover:bg-card-hover hover:text-ink'
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

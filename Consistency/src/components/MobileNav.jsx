import { TABS } from '../lib/tabs'

/**
 * Bottom navigation for phones — thumb-reachable, unlike a row of pills at the
 * top of a scrolled page. Hidden from `sm` up, where Tabs takes over.
 *
 * The bar is fixed, so App reserves space for it with bottom padding and the
 * celebration toast lifts above it; otherwise both would sit underneath.
 */
export default function MobileNav({ active, onChange }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur sm:hidden"
      // Keeps the row clear of the iPhone home indicator.
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-3xl">
        {TABS.map(({ key, Icon, label }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                isActive ? 'text-violet-600 dark:text-violet-300' : 'text-ink-3'
              }`}
            >
              {/* Sits on the border itself, so the active tab reads as attached. */}
              <span
                aria-hidden="true"
                className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${
                  isActive ? 'bg-violet-500 opacity-100' : 'opacity-0'
                }`}
              />
              <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

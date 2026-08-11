import { UI } from '../lib/icons'

/**
 * The primary "create" action, shared by habits, expenses and notes so the one
 * thing you came to do looks and sits the same everywhere. Filled rather than
 * outlined, and placed above the list it adds to — a dashed button at the
 * bottom of a long list is the hardest thing on the page to reach on a phone.
 */
export default function AddButton({ onClick, children, tone = 'violet' }) {
  const filled =
    tone === 'emerald'
      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
      : 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/25'

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${filled}`}
    >
      <UI.plus
        size={18}
        strokeWidth={2.6}
        aria-hidden="true"
        // Small flourish that makes the button feel like an action.
        className="transition-transform duration-300 group-hover:rotate-90"
      />
      {children}
    </button>
  )
}

import { UI } from '../lib/icons'

export default function Toast({ message, streak }) {
  const Icon = streak >= 7 ? UI.trophy : streak >= 3 ? UI.flame : UI.sparkles

  return (
    <div
      role="status"
      // Clears the fixed mobile nav on phones; sits low on wider screens.
      className="animate-rise pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-6"
    >
      <div className="glass animate-glow relative flex max-w-md items-center gap-3 overflow-hidden rounded-2xl px-5 py-4">
        {/* Light sweep across the toast — a small "reward" flourish. */}
        <span
          aria-hidden="true"
          className="animate-sweep absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-ink/10 to-transparent"
        />
        <Icon size={24} strokeWidth={1.8} className="shrink-0 text-violet-500" aria-hidden="true" />
        <p className="relative text-sm leading-snug font-medium text-ink">{message}</p>
      </div>
    </div>
  )
}

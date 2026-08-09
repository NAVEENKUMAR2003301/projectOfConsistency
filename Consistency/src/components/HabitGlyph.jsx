import { HABIT_ICON_MAP, UI } from '../lib/icons'

/**
 * Renders a habit's mark. Habits created before the icon set stored an emoji
 * character instead of an icon key, so that still renders as text — nobody's
 * existing habits change appearance without them asking.
 */
export default function HabitGlyph({ habit, size = 20, className = '' }) {
  const entry = HABIT_ICON_MAP[habit?.icon]

  if (entry) {
    const { Icon } = entry
    return <Icon size={size} strokeWidth={1.9} className={className} aria-hidden="true" />
  }

  if (habit?.emoji) {
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{ fontSize: `${size}px`, lineHeight: 1 }}
      >
        {habit.emoji}
      </span>
    )
  }

  return <UI.check size={size} strokeWidth={1.9} className={className} aria-hidden="true" />
}

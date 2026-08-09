// Milestones are judged on the BEST streak, not the current one — a badge you
// earned should not disappear because you missed a day.

// `icon` is a key into BADGE_ICONS, never a component — badges are plain data.
export const BADGES = [
  { days: 3, icon: 'sprout', name: 'First steps' },
  { days: 7, icon: 'flame', name: 'One week' },
  { days: 14, icon: 'zap', name: 'Two weeks' },
  { days: 30, icon: 'star', name: 'One month' },
  { days: 100, icon: 'gem', name: '100 days' },
  { days: 365, icon: 'crown', name: 'One year' },
]

export const earnedBadges = (best) => BADGES.filter((b) => best >= b.days)

export const nextBadge = (best) => BADGES.find((b) => best < b.days) ?? null

/** How far through the current milestone, 0–100, for the progress bar. */
export function badgeProgress(best) {
  const next = nextBadge(best)
  if (!next) return 100
  const previous = [...BADGES].reverse().find((b) => best >= b.days)?.days ?? 0
  const span = next.days - previous
  if (span <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((best - previous) / span) * 100)))
}

// Copy shown after a successful check-in. Tone: warm, short, never preachy.

const FIRST = [
  'Day one. The hardest one is behind you.',
  'You started. That is the whole trick.',
  'First mark on the board.',
]

const EARLY = [
  'Two in a row is not luck anymore.',
  'You showed up again. That counts double.',
  'Momentum is quietly building.',
  'Small day, real progress.',
]

const MID = [
  'A week of you keeping your word.',
  'This is starting to look like who you are.',
  'You are past the part where most people stop.',
  'Steady beats intense. You are steady.',
]

const LONG = [
  'This is no longer a habit. It is an identity.',
  'Long streaks are built exactly like this — one boring day at a time.',
  'You have done this more days than not. That is the whole game.',
  'Future you is already thanking you.',
]

const COMEBACK = [
  'Back on the board. Missing a day was never the problem — stopping was.',
  'Restarting is a skill. You just used it.',
  'Streak broken, not you. Day one again.',
]

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export function encouragementFor(streak, wasComeback) {
  if (wasComeback && streak <= 1) return pick(COMEBACK)
  if (streak <= 1) return pick(FIRST)
  if (streak < 5) return pick(EARLY)
  if (streak < 14) return pick(MID)
  return pick(LONG)
}

export const ALL_DONE_MESSAGES = [
  'Every habit done. Close the laptop, you earned it.',
  'Clean sweep today.',
  'That is a perfect day on the board.',
  'All of them. Today was yours.',
]

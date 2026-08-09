// Tiny puzzles that gate a habit check-in. Each generator returns:
// { type, prompt, hint, options: string[], answer: string }
// Keep them solvable in ~5 seconds — the point is a spark of focus, not a wall.

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[rand(0, arr.length - 1)]

const shuffle = (arr) => {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(0, i)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Build 4 unique options around the correct numeric answer. Decoys stay
// non-negative when the answer is, so the choices never look obviously wrong.
const numericOptions = (answer, spread = 6) => {
  const set = new Set([answer])
  const floor = answer >= 0 ? 0 : answer - spread
  // Widen the search rather than loop forever if `spread` is too tight to
  // yield three distinct decoys above the floor.
  for (let reach = spread; set.size < 4; reach++) {
    const candidate = answer + rand(1, reach) * pick([1, -1])
    if (candidate >= floor) set.add(candidate)
  }
  return shuffle([...set]).map(String)
}

function quickMath() {
  const a = rand(6, 19)
  const b = rand(3, 12)
  const op = pick(['+', '-', '×'])
  // Order the operands for subtraction so the answer is never negative.
  const [hi, lo] = a >= b ? [a, b] : [b, a]
  const answer = op === '+' ? a + b : op === '-' ? hi - lo : a * b
  return {
    type: 'Quick math',
    prompt: op === '-' ? `${hi} − ${lo} = ?` : `${a} ${op} ${b} = ?`,
    hint: 'One breath. You know this.',
    options: numericOptions(answer, op === '×' ? 14 : 5),
    answer: String(answer),
  }
}

function nextInSequence() {
  const start = rand(2, 9)
  const step = rand(2, 9)
  const kind = pick(['arithmetic', 'doubling', 'squares'])

  let seq, answer
  if (kind === 'doubling') {
    seq = [start, start * 2, start * 4, start * 8]
    answer = start * 16
  } else if (kind === 'squares') {
    seq = [1, 4, 9, 16]
    answer = 25
  } else {
    seq = [start, start + step, start + step * 2, start + step * 3]
    answer = start + step * 4
  }

  return {
    type: 'What comes next',
    prompt: `${seq.join(',  ')},  ?`,
    hint: 'Look at the gap between each pair.',
    options: numericOptions(answer, Math.max(3, Math.round(answer * 0.2))),
    answer: String(answer),
  }
}

const WORDS = [
  'FOCUS',
  'HABIT',
  'DAILY',
  'START',
  'STEADY',
  'REPEAT',
  'SHOWUP',
  'STREAK',
  'EFFORT',
  'GROWTH',
  'MOMENT',
  'ANCHOR',
]

function unscramble() {
  const word = pick(WORDS)
  let scrambled = word
  while (scrambled === word) scrambled = shuffle(word.split('')).join('')

  // Prefer same-length decoys — otherwise letter count alone gives it away.
  const others = WORDS.filter((w) => w !== word)
  const sameLength = shuffle(others.filter((w) => w.length === word.length))
  const decoys = [...sameLength, ...shuffle(others.filter((w) => w.length !== word.length))].slice(0, 3)
  return {
    type: 'Unscramble',
    prompt: scrambled.split('').join(' '),
    hint: 'Every letter is used exactly once.',
    options: shuffle([word, ...decoys]),
    answer: word,
  }
}

const ODD_GROUPS = [
  { theme: 'fruit', members: ['🍎', '🍌', '🍇', '🍊', '🍓'], odd: '🚗' },
  { theme: 'animals', members: ['🐶', '🐱', '🐼', '🦊', '🐨'], odd: '🌵' },
  { theme: 'weather', members: ['☀️', '🌧️', '❄️', '🌈', '⛈️'], odd: '📕' },
  { theme: 'sports', members: ['⚽', '🏀', '🎾', '🏈', '🏓'], odd: '🍕' },
]

function oddOneOut() {
  const group = pick(ODD_GROUPS)
  const members = shuffle(group.members).slice(0, 3)
  return {
    type: 'Odd one out',
    prompt: 'Which one does not belong?',
    hint: 'Three share a theme. One does not.',
    options: shuffle([...members, group.odd]),
    answer: group.odd,
  }
}

function countEmoji() {
  const target = pick(['⭐', '🔥', '💧', '🍀'])
  const filler = pick(['•', '·', '✦']) // visually quiet distractors
  const count = rand(3, 7)
  const total = count + rand(6, 11)

  const cells = shuffle([
    ...Array(count).fill(target),
    ...Array(total - count).fill(filler),
  ])

  return {
    type: 'Count them',
    prompt: `How many ${target} below?\n${cells.join(' ')}`,
    hint: 'Scan left to right, once.',
    options: numericOptions(count, 3),
    answer: String(count),
  }
}

const GENERATORS = [
  quickMath,
  nextInSequence,
  unscramble,
  oddOneOut,
  countEmoji,
  quickMath, // slightly weight the fastest one
]

export function generatePuzzle() {
  return pick(GENERATORS)()
}

import { createChecker, loadLibs } from './_setup.mjs'

// The normalizers are the trust boundary. Everything downstream — every
// component, every streak calculation — assumes they returned a well-formed
// array, so a file someone was handed off a USB stick must not be able to
// crash the app or reach through into Object.prototype.
const { storage, backup } = await loadLibs()
const { check, done } = createChecker()

const HOSTILE = [
  // wrong type entirely
  null, undefined, 0, '', 'string', true, [], {}, NaN, Infinity, -0,
  // right shape, wrong contents
  [null], [undefined], [[]], [{}], ['x'], [0], [NaN],
  // fields of the wrong type
  [{ id: null }], [{ id: {} }], [{ id: [] }],
  [{ name: null }], [{ name: {} }], [{ name: [] }], [{ name: 42 }],
  [{ history: null }], [{ history: 'x' }], [{ history: [] }], [{ history: { bad: 'x' } }],
  [{ progress: 'x' }], [{ progress: { '2026-01-01': -5 } }], [{ progress: { x: NaN } }],
  [{ target: -1 }], [{ target: 0 }], [{ target: 1e9 }], [{ target: 'abc' }], [{ target: null }],
  [{ reminder: '99:99' }], [{ reminder: 123 }], [{ reminder: '7:5' }], [{ reminderEnd: 'x' }],
  [{ color: {} }], [{ icon: [] }],
  [{ createdAt: 'not-a-date' }], [{ createdAt: {} }], [{ createdAt: -1 }],
  // money, where a wrong sign or a float is a real-world mistake
  [{ amount: -1 }], [{ amount: 'x' }], [{ amount: NaN }], [{ amount: Infinity }], [{ amount: 1.5 }],
  [{ day: 'x' }], [{ day: null }], [{ day: '2026-13-45' }], [{ categoryId: {} }],
  [{ text: null }], [{ text: {} }], [{ text: 'a'.repeat(50_000) }],
  // prototype pollution, the reason this app parses files with its own code
  JSON.parse('{"__proto__":{"polluted":1}}'),
  JSON.parse('[{"__proto__":{"polluted":1}}]'),
  JSON.parse('[{"history":{"__proto__":{"polluted":1}}}]'),
  [{ constructor: { prototype: { pollutedCtor: 1 } } }],
]

const NORMALIZERS = Object.keys(storage).filter((k) => k.startsWith('normalize'))
check('normalizers were found', NORMALIZERS.length >= 4, `found ${NORMALIZERS.length}`)

for (const name of NORMALIZERS) {
  let threw = null
  let notArray = null
  for (const input of HOSTILE) {
    let result
    try {
      result = storage[name](input)
    } catch (error) {
      threw ??= `${JSON.stringify(input)?.slice(0, 60)} → ${error.message}`
      continue
    }
    // normalizeHistory returns an object; the collection normalizers must
    // always hand back an array, because callers .map over the result.
    if (name !== 'normalizeHistory' && !Array.isArray(result)) {
      notArray ??= `${JSON.stringify(input)?.slice(0, 60)} → ${typeof result}`
    }
  }
  check(`${name} never throws`, threw === null, String(threw))
  check(`${name} always returns an array`, notArray === null, String(notArray))
}

// parseBackup reads the raw text of a file the user picked. Rejecting bad
// input is correct; crashing the tab is not.
const TEXTS = [
  '', 'null', '[]', '{}', 'not json', '{', '[[[[[', '"str"', '123', 'undefined',
  '{"habits":"x"}', '{"habits":[null]}', '{"habits":{}}', '{"notes":0}',
  '{"__proto__":{"pollutedText":1}}',
  '{"habits":[{"__proto__":{"pollutedText":1}}]}',
  '{"habits":[{"history":{"__proto__":1}}]}',
]
let hardFailure = null
for (const text of TEXTS) {
  try {
    backup.parseBackup(text)
  } catch (error) {
    // A thrown Error carrying a readable message is the designed path — it
    // becomes the message shown next to the file picker.
    if (!(error instanceof Error) || !error.message) {
      hardFailure ??= `${text.slice(0, 40)} → unusable error`
    }
  }
}
check('parseBackup fails readably or not at all', hardFailure === null, String(hardFailure))

// The whole point of hand-rolling the parsing rather than pulling in `xlsx`.
for (const key of ['polluted', 'pollutedCtor', 'pollutedText']) {
  check(`Object.prototype is clean (${key})`, {}[key] === undefined, 'prototype pollution')
}

done('hostile input')

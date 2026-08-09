import { useState } from 'react'

const PALETTE = ['#a78bfa', '#34d399', '#38bdf8', '#fbbf24', '#fb7185', '#f472b6']

// Built once outside render — the randomness must not change on re-render, or
// pieces would jump mid-flight.
function makeBits(pieces) {
  return Array.from({ length: pieces }, (_, i) => {
    const angle = (Math.PI * 2 * i) / pieces + Math.random() * 0.4
    const distance = 90 + Math.random() * 190
    return {
      id: i,
      dx: `${Math.cos(angle) * distance}px`,
      dy: `${Math.sin(angle) * distance + 120}px`,
      rot: `${Math.round(Math.random() * 720 - 360)}deg`,
      delay: `${Math.random() * 0.15}s`,
      color: PALETTE[i % PALETTE.length],
      size: 6 + Math.random() * 7,
      round: Math.random() > 0.5,
    }
  })
}

/**
 * Purely decorative burst. Rendered for a fixed lifetime by the parent, which
 * unmounts it — so there is no timer or cleanup to get wrong here.
 */
export default function Confetti({ pieces = 34 }) {
  const [bits] = useState(() => makeBits(pieces))

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
    >
      <div className="relative">
        {bits.map((b) => (
          <span
            key={b.id}
            className="animate-confetti absolute block"
            style={{
              '--dx': b.dx,
              '--dy': b.dy,
              '--rot': b.rot,
              animationDelay: b.delay,
              background: b.color,
              width: `${b.size}px`,
              height: `${b.size * (b.round ? 1 : 1.8)}px`,
              borderRadius: b.round ? '9999px' : '2px',
            }}
          />
        ))}
      </div>
    </div>
  )
}

import type { GateGlyphKind } from '../data/cv'

/* Small IEEE gate symbol, stroke = currentColor. */
export default function GateGlyph({ kind, size = 34 }: { kind: GateGlyphKind; size?: number }) {
  const body = (() => {
    switch (kind) {
      case 'AND':
        return <path d="M10 7 H19 A 8.5 8.5 0 0 1 19 24 H10 Z" />
      case 'NAND':
        return (
          <>
            <path d="M9 7 H17 A 8.5 8.5 0 0 1 17 24 H9 Z" />
            <circle cx="28" cy="15.5" r="2.4" />
          </>
        )
      case 'OR':
        return <path d="M9 7 Q19 7 26 15.5 Q19 24 9 24 Q13 15.5 9 7 Z" />
      case 'XOR':
        return (
          <>
            <path d="M12 7 Q21 7 28 15.5 Q21 24 12 24 Q16 15.5 12 7 Z" />
            <path d="M8 7 Q12 15.5 8 24" fill="none" />
          </>
        )
      case 'NOT':
        return (
          <>
            <path d="M10 7 L24 15.5 L10 24 Z" />
            <circle cx="27" cy="15.5" r="2.4" />
          </>
        )
    }
  })()

  return (
    <svg
      className="proj-glyph"
      width={size}
      height={size}
      viewBox="0 0 36 31"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 11 H9 M2 20 H9 M28 15.5 H34" strokeLinecap="round" />
      {body}
    </svg>
  )
}

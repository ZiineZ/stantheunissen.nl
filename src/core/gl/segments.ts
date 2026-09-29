/* 7- and 16-segment readouts built from pointed line segments. Each segment
   springs on/off with a per-character delay so a new value ripples across
   the display the way it would behind a real decoder. */

import { LineField, K, type Seg } from './lines'

// 16-seg order: a1 a2 b c d2 d1 e f g1 g2 h i j k l m
const N16 = ['a1', 'a2', 'b', 'c', 'd2', 'd1', 'e', 'f', 'g1', 'g2', 'h', 'i', 'j', 'k', 'l', 'm'] as const
const M16: Record<string, string> = {
  '0': 'a1 a2 b c d2 d1 e f',
  '1': 'b c j',
  '2': 'a1 a2 b g1 g2 e d1 d2',
  '3': 'a1 a2 b c d1 d2 g2',
  '4': 'f g1 g2 b c',
  '5': 'a1 a2 f g1 g2 c d1 d2',
  '6': 'a1 a2 f e d1 d2 c g1 g2',
  '7': 'a1 a2 b c',
  '8': 'a1 a2 b c d1 d2 e f g1 g2',
  '9': 'a1 a2 b c d1 d2 f g1 g2',
  A: 'e f a1 a2 b c g1 g2',
  B: 'a1 a2 b c d1 d2 g2 i l',
  C: 'a1 a2 f e d1 d2',
  D: 'a1 a2 b c d1 d2 i l',
  E: 'a1 a2 f g1 e d1 d2',
  F: 'a1 a2 f g1 e',
  G: 'a1 a2 f e d1 d2 c g2',
  H: 'f e b c g1 g2',
  I: 'a1 a2 i l d1 d2',
  J: 'b c d2 d1 e',
  K: 'f e g1 j m',
  L: 'f e d1 d2',
  M: 'f e h j b c',
  N: 'f e h m c b',
  O: 'a1 a2 b c d2 d1 e f',
  P: 'a1 a2 b f e g1 g2',
  Q: 'a1 a2 b c d2 d1 e f m',
  R: 'a1 a2 b f e g1 g2 m',
  S: 'a1 a2 f g1 g2 c d2 d1',
  T: 'a1 a2 i l',
  U: 'f e d1 d2 c b',
  V: 'f e k j',
  W: 'f e k m c b',
  X: 'h j k m',
  Y: 'h j l',
  Z: 'a1 a2 j k d1 d2',
  '-': 'g1 g2',
  '+': 'g1 g2 i l',
  '/': 'j k',
  '=': 'g1 g2 d1 d2',
  _: 'd1 d2',
  ' ': '',
}

// 7-seg order: a b c d e f g
const N7 = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const
const M7: Record<string, string> = {
  '0': 'a b c d e f',
  '1': 'b c',
  '2': 'a b g e d',
  '3': 'a b g c d',
  '4': 'f g b c',
  '5': 'a f g c d',
  '6': 'a f g e d c',
  '7': 'a b c',
  '8': 'a b c d e f g',
  '9': 'a b c d f g',
  A: 'a b c e f g',
  B: 'c d e f g',
  C: 'a d e f',
  D: 'b c d e g',
  E: 'a d e f g',
  F: 'a e f g',
  H: 'b c e f g',
  L: 'd e f',
  N: 'c e g',
  O: 'c d e g',
  P: 'a b e f g',
  R: 'e g',
  S: 'a f g c d',
  T: 'd e f g',
  U: 'b c d e f',
  Y: 'b c d f g',
  '-': 'g',
  _: 'd',
  ' ': '',
}

function mask(map: Record<string, string>, names: readonly string[], ch: string): boolean[] {
  const on = new Set((map[ch.toUpperCase()] ?? '').split(' ').filter(Boolean))
  return names.map((n) => on.has(n))
}

export interface DisplayOpts {
  x: number
  y: number
  chars: number
  kind: 7 | 16
  cellW: number
  cellH: number
  gap: number
  thick: number
  slant?: number
}

export class SegmentDisplay {
  readonly field: LineField
  readonly kind: 7 | 16
  readonly chars: number
  private per: number
  private state: boolean[] = []
  text = ''

  constructor(o: DisplayOpts) {
    this.kind = o.kind
    this.chars = o.chars
    this.per = o.kind === 16 ? 16 : 7
    const segs: Seg[] = []
    const hw = o.thick / 2
    const gap = Math.max(1.2, o.thick * 0.55)
    const sl = o.slant ?? 0.1
    for (let ci = 0; ci < o.chars; ci++) {
      const ox = o.x + ci * (o.cellW + o.gap)
      const oy = o.y
      const w = o.cellW
      const h = o.cellH
      // shear to lean the digits like a real display
      const P = (u: number, v: number) => ({ x: ox + u * w + (1 - v) * h * sl, y: oy + v * h })
      const pts: Record<string, [number, number]> = {
        TL: [0, 0], TC: [0.5, 0], TR: [1, 0],
        ML: [0, 0.5], MC: [0.5, 0.5], MR: [1, 0.5],
        BL: [0, 1], BC: [0.5, 1], BR: [1, 1],
      }
      const def16: [string, string][] = [
        ['TL', 'TC'], ['TC', 'TR'], ['TR', 'MR'], ['MR', 'BR'], ['BC', 'BR'], ['BL', 'BC'], ['ML', 'BL'], ['TL', 'ML'],
        ['ML', 'MC'], ['MC', 'MR'], ['TL', 'MC'], ['TC', 'MC'], ['TR', 'MC'], ['MC', 'BL'], ['MC', 'BC'], ['MC', 'BR'],
      ]
      const def7: [string, string][] = [
        ['TL', 'TR'], ['TR', 'MR'], ['MR', 'BR'], ['BL', 'BR'], ['ML', 'BL'], ['TL', 'ML'], ['ML', 'MR'],
      ]
      const defs = o.kind === 16 ? def16 : def7
      for (const [a, b] of defs) {
        const A = P(...pts[a])
        const B = P(...pts[b])
        const len = Math.hypot(B.x - A.x, B.y - A.y)
        const ux = (B.x - A.x) / len
        const uy = (B.y - A.y) / len
        const diag = Math.abs(ux) > 0.1 && Math.abs(uy) > 0.1
        const g = diag ? gap * 1.9 : gap
        segs.push({
          x1: A.x + ux * g, y1: A.y + uy * g, x2: B.x - ux * g, y2: B.y - uy * g,
          d1: 0, d2: 0, kind: K.Seg, index: 0, hw: diag ? hw * 0.8 : hw, cap: 2,
        })
      }
    }
    this.field = new LineField(segs)
    this.field.mesh.renderOrder = 3
    this.state = new Array(segs.length).fill(false)
  }

  /** Show `text` (padded/cut to fit). Characters light left to right, `stagger` s apart. */
  set(text: string, t0: number, stagger = 0.045, align: 'left' | 'right' = 'left') {
    let s = text.slice(0, this.chars)
    s = align === 'right' ? s.padStart(this.chars, ' ') : s.padEnd(this.chars, ' ')
    this.text = s
    const names = this.kind === 16 ? N16 : N7
    const map = this.kind === 16 ? M16 : M7
    for (let ci = 0; ci < this.chars; ci++) {
      const m = mask(map, names, s[ci])
      for (let k = 0; k < this.per; k++) {
        const i = ci * this.per + k
        if (this.state[i] === m[k]) continue
        this.state[i] = m[k]
        this.field.setLit(i, m[k] ? 1 : 0, t0 + ci * stagger + k * 0.004)
      }
    }
  }
}

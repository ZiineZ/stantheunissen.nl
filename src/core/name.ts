/* The name as it is stored in memory: two lines of Mona Sans, sized to fill a
   plane of cols x rows cells. Shared by every version of the site. */

import { measureEm, DISPLAY, type TextLine } from './bitmap'

let capCache = 0
export function capRatio(): number {
  if (capCache) return capCache
  const c = document.createElement('canvas').getContext('2d')!
  c.font = `900 200px ${DISPLAY}`
  const m = c.measureText('H')
  capCache = m.actualBoundingBoxAscent / 200 || 0.72
  return capCache
}

export interface NameLayout {
  lines: (wdth: number) => TextLine[]
  size: number
}

export function nameLayout(cols: number, rows: number, first = 'STAN', last = 'THEUNISSEN'): NameLayout {
  const cap = capRatio()
  const pad = Math.max(1, Math.round(cols * 0.012))
  const wide = cols / rows > 1.9
  if (wide) {
    const em = measureEm(last, 125, 900, -0.01)
    let size = (cols - pad * 2) / em
    const block = (s: number) => s * cap * 2 + s * cap * 0.36
    if (block(size) > rows - pad * 2) size = (rows - pad * 2) / (cap * 2.36)
    const c = size * cap
    const gap = c * 0.36
    const top = Math.round((rows - (2 * c + gap)) / 2)
    return {
      size,
      lines: (wdth) => [
        { text: first, wdth, weight: 900, size, baseline: top + c, x: pad, tracking: -0.01 },
        { text: last, wdth, weight: 900, size, baseline: top + 2 * c + gap, x: pad, tracking: -0.01 },
      ],
    }
  }
  // tall/narrow planes: first name wide and huge, surname condensed underneath
  const emFirst = measureEm(first, 125, 900)
  const emLast = measureEm(last, 75, 900)
  let s1 = (cols - pad * 2) / emFirst
  let s2 = (cols - pad * 2) / emLast
  const need = () => s1 * cap + s2 * cap + s2 * cap * 0.4
  if (need() > rows - pad * 2) {
    const k = (rows - pad * 2) / need()
    s1 *= k
    s2 *= k
  }
  const top = Math.round((rows - need()) / 2)
  return {
    size: s1,
    lines: (wdth) => {
      const t = (wdth - 75) / 50 // 0..1
      return [
        { text: first, wdth: 75 + 50 * t, weight: 900, size: s1, baseline: top + s1 * cap, x: pad },
        { text: last, wdth: 75, weight: 900, size: s2, baseline: top + s1 * cap + s2 * cap * 1.4, x: pad },
      ]
    },
  }
}

/* Loading a picture into a core plane. Every load picks one of six
   choreographies at random (never the one used just before) and each has
   its own randomness inside, so no two loads look alike:

     blocks   the picture resolves coarse to fine, like an interlaced image
     static   memory powers up full of garbage, then the picture is written over it
     shuffle  rows are written in random order, each by its own current
     bloom    two currents cross at one core and the picture spreads out from it
     rain     every column pours down (or up) at its own speed
     wipe     a slanted current front sweeps across at a random angle

   All of them end on exactly the target levels. Changes are scheduled on
   the GPU; later stages queue on the field and run from the plane's frame. */

import type { RingField } from './rings'

export const STYLES = ['blocks', 'static', 'shuffle', 'bloom', 'rain', 'wipe'] as const
export type RevealStyle = (typeof STYLES)[number]

let lastStyle: RevealStyle | null = null

function pick(): RevealStyle {
  const pool = STYLES.filter((s) => s !== lastStyle)
  lastStyle = pool[Math.floor(Math.random() * pool.length)]
  return lastStyle
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const EPS = 1 / 512
const same = (a: number, b: number) => Math.abs(a - b) < EPS
const sign = () => (Math.random() < 0.5 ? -1 : 1)

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Write `levels` into `f`, starting at `t0`. Returns when the last core starts its final change. */
export function reveal(f: RingField, levels: ArrayLike<number>, now: number, t0: number, style: RevealStyle = pick()): number {
  f.cancel()
  const end = WRITERS[style](f, levels, now, t0)
  f.commit()
  return end
}

type Writer = (f: RingField, bits: ArrayLike<number>, now: number, t0: number) => number

/** Rows in the given order, each carried by its own current. */
function rowsInOrder(f: RingField, bits: ArrayLike<number>, now: number, t0: number, order: number[], stagger: number, speed: [number, number], dur: number) {
  let last = t0
  order.forEach((r, k) => {
    const start = t0 + k * stagger
    const dir = sign()
    const v = rand(speed[0], speed[1])
    let changed = false
    for (let c = 0; c < f.cols; c++) {
      const i = r * f.cols + c
      const b = bits[i]
      if (same(b, f.levels[i])) continue
      changed = true
      const x = f.x0 + c * f.pitch
      const t = start + (dir > 0 ? x : f.planeW - x) / v
      f.flipAt(i, b, t, dur, now)
      last = Math.max(last, t)
    }
    if (changed) f.pulseRow(r, start, v * dir, 0.95, 130)
  })
  return last
}

const WRITERS: Record<RevealStyle, Writer> = {
  blocks(f, bits, _now, t0) {
    const { cols, rows } = f
    const sizes = [8, 4, 2].filter((b) => b * 3 <= Math.min(cols, rows))
    const gap = 0.24
    sizes.forEach((B, k) => {
      const at = t0 + k * gap
      f.at(at, (n) => {
        // a fresh grid phase each pass, so the blocks never line up the same way
        const px = Math.floor(Math.random() * B)
        const py = Math.floor(Math.random() * B)
        for (let by = -py; by < rows; by += B) {
          for (let bx = -px; bx < cols; bx += B) {
            let sum = 0
            let cnt = 0
            for (let y = Math.max(0, by); y < Math.min(rows, by + B); y++) {
              for (let x = Math.max(0, bx); x < Math.min(cols, bx + B); x++) {
                sum += bits[y * cols + x]
                cnt++
              }
            }
            if (!cnt) continue
            // the block shows its average, a little brighter so coarse passes read
            const v = Math.min(1, (sum / cnt) * 1.25)
            const t = Math.max(n, at) + Math.random() * 0.1
            for (let y = Math.max(0, by); y < Math.min(rows, by + B); y++) {
              for (let x = Math.max(0, bx); x < Math.min(cols, bx + B); x++) {
                const i = y * cols + x
                if (!same(f.levels[i], v)) f.flipAt(i, v, t, 0.16, n)
              }
            }
          }
        }
        f.commit()
        for (let j = 0; j < 3; j++) f.pulseRow(Math.floor(Math.random() * rows), at, rand(2600, 3800) * sign(), 0.6, 90)
      })
    })
    const fin = t0 + sizes.length * gap
    f.at(fin, (n) => {
      for (let i = 0; i < bits.length; i++) {
        if (!same(f.levels[i], bits[i])) f.flipAt(i, bits[i], Math.max(n, fin) + Math.random() * 0.08, 0.16, n)
      }
      f.commit()
    })
    return fin + 0.08
  },

  static(f, bits, now, t0) {
    const { cols, rows } = f
    const density = rand(0.26, 0.46)
    for (let i = 0; i < cols * rows; i++) {
      const v = Math.random() < density ? 1 : 0
      if (!same(v, f.levels[i])) f.flipAt(i, v, t0 + Math.random() * 0.4, 0.12, now)
    }
    for (let j = 0; j < 6; j++) f.pulseRow(Math.floor(Math.random() * rows), t0 + rand(0, 0.3), rand(2400, 4200) * sign(), 0.7, 80)
    const t1 = t0 + 0.62
    const order = shuffled(rows)
    const stagger = Math.min(0.016, 0.55 / rows)
    f.at(t1, (n) => {
      rowsInOrder(f, bits, n, Math.max(n, t1), order, stagger, [3000, 4200], 0.24)
      f.commit()
    })
    return t1 + rows * stagger + f.planeW / 3000
  },

  shuffle(f, bits, now, t0) {
    return rowsInOrder(f, bits, now, t0, shuffled(f.rows), Math.min(0.02, 0.9 / f.rows), [2200, 3400], 0.3)
  },

  bloom(f, bits, now, t0) {
    const { cols, rows, pitch, x0, y0 } = f
    // start inside the picture: a random lit core, or anywhere if it is blank
    const lit: number[] = []
    for (let i = 0; i < bits.length; i++) if (bits[i] > 0.5) lit.push(i)
    const o = lit.length ? lit[Math.floor(Math.random() * lit.length)] : Math.floor(Math.random() * bits.length)
    const oc = o % cols
    const or = Math.floor(o / cols)
    const fx = x0 + oc * pitch
    const fy = y0 + or * pitch
    // the row and column currents enter the plane together and meet at that core
    const v = 1900
    const meet = t0 + Math.max(fx - x0, fy - y0) / v
    f.pulseRow(or, meet - fx / v, v, 1, 220)
    f.pulseCol(oc, meet - fy / v, v, 1, 220)
    const far = Math.max(Math.hypot(fx - x0, fy - y0), Math.hypot(fx - x0 - (cols - 1) * pitch, fy - y0), Math.hypot(fx - x0, fy - y0 - (rows - 1) * pitch), Math.hypot(fx - x0 - (cols - 1) * pitch, fy - y0 - (rows - 1) * pitch))
    let last = meet
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i]
      if (same(b, f.levels[i])) continue
      const d = Math.hypot(x0 + (i % cols) * pitch - fx, y0 + Math.floor(i / cols) * pitch - fy) / Math.max(far, 1)
      const t = meet + 0.05 + 1.05 * (0.74 * d + 0.26 * Math.random())
      f.flipAt(i, b, t, rand(0.22, 0.42), now)
      last = Math.max(last, t)
    }
    return last
  },

  rain(f, bits, now, t0) {
    const { cols, rows, pitch, y0 } = f
    const up = Math.random() < 0.3
    const top = y0
    const bottom = y0 + (rows - 1) * pitch
    let last = t0
    for (let c = 0; c < cols; c++) {
      const start = t0 + Math.random() * 0.55
      const v = rand(650, 1600)
      let changed = false
      for (let r = 0; r < rows; r++) {
        const i = r * cols + c
        const b = bits[i]
        if (same(b, f.levels[i])) continue
        changed = true
        const y = y0 + r * pitch
        const t = start + (up ? bottom - y : y - top) / v
        f.flipAt(i, b, t, 0.28, now)
        last = Math.max(last, t)
      }
      // the column current reaches the plane's edge exactly at `start`
      if (changed) f.pulseCol(c, start - (up ? f.planeH - bottom : top) / v, up ? -v : v, 0.85, 110)
    }
    return last
  },

  wipe(f, bits, now, t0) {
    const { cols, rows, pitch, x0, y0 } = f
    // mostly sideways, so every row's current can carry the slanted front
    const a = rand(-0.85, 0.85) + (Math.random() < 0.5 ? 0 : Math.PI)
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const xs = [x0, x0 + (cols - 1) * pitch]
    const ys = [y0, y0 + (rows - 1) * pitch]
    const ps = xs.flatMap((x) => ys.map((y) => x * ux + y * uy))
    const pmin = Math.min(...ps)
    const span = Math.max(...ps) - pmin || 1
    const T = 0.95
    const when = (x: number, y: number) => t0 + (T * (x * ux + y * uy - pmin)) / span
    let last = t0
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * pitch
      let changed = false
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const b = bits[i]
        if (same(b, f.levels[i])) continue
        changed = true
        const t = when(x0 + c * pitch, y) + Math.random() * 0.07
        f.flipAt(i, b, t, 0.3, now)
        last = Math.max(last, t)
      }
      if (!changed) continue
      // along a row the front moves at span / (T * |ux|) px/s
      const v = span / (T * Math.abs(ux))
      if (ux > 0) f.pulseRow(r, when(0, y), v, 0.9, 120)
      else f.pulseRow(r, when(f.planeW, y), -v, 0.9, 120)
    }
    return last
  },
}

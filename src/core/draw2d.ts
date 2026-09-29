/* Canvas 2D renderer for circuits: the same picture as the WebGL line field,
   used by the sandbox and as the fallback when WebGL is unavailable. For each
   wire segment it splits at the fronts currently on it, so partial highs are
   drawn exactly, and draws a small glow at every rising edge in flight. */

import type { Circuit } from './sim/circuit'
import { circuitSegs, K, type Seg } from './gl/lines'

export interface Colors {
  line: string
  lineHi: string
  signal: string
  ground: string
}

export function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement)
  const g = (n: string) => cs.getPropertyValue(n).trim()
  return { line: g('--gl-line-hi'), lineHi: g('--gl-line-hi'), signal: g('--gl-signal'), ground: g('--gl-ground') }
}

function valueAt(c: Circuit, net: number, d: number, t: number): { v: boolean; head: number } {
  const n = c.nets[net]
  for (let k = n.fronts.length - 1; k >= 0; k--) {
    const f = n.fronts[k]
    const pos = (t - f.t) * c.speed
    if (pos >= d) return { v: f.v, head: f.v ? Math.max(0, 1 - (pos - d) / 110) : 0 }
  }
  return { v: n.base, head: 0 }
}

export class Circuit2D {
  segs: Seg[]
  constructor(
    private c: Circuit,
    private ctx: CanvasRenderingContext2D,
  ) {
    this.segs = circuitSegs(c, { wire: 0.7, body: 0.7, dot: 2.4 })
  }

  rebuild() {
    this.segs = circuitSegs(this.c, { wire: 0.7, body: 0.7, dot: 2.4 })
  }

  draw(t: number, col: Colors) {
    const x = this.ctx
    const c = this.c
    x.lineCap = 'round'
    x.lineJoin = 'round'
    for (const s of this.segs) {
      const w = Math.max(1, s.hw * 2)
      if (s.x1 === s.x2 && s.y1 === s.y2) {
        // dot
        let on = false
        if (s.kind === K.Net) on = valueAt(c, s.index, s.d1, t).v
        else if (s.kind === K.Gate) on = c.gates[s.index].glow > 0.5
        x.fillStyle = on ? col.signal : col.lineHi
        x.beginPath()
        x.arc(s.x1, s.y1, s.hw, 0, Math.PI * 2)
        x.fill()
        continue
      }
      if (s.kind === K.Gate) {
        const g = c.gates[s.index].glow
        x.strokeStyle = g > 0.5 ? col.signal : col.lineHi
        x.globalAlpha = g > 0.5 ? 0.6 + 0.4 * g : 1
        x.lineWidth = w
        x.beginPath()
        x.moveTo(s.x1, s.y1)
        x.lineTo(s.x2, s.y2)
        x.stroke()
        x.globalAlpha = 1
        continue
      }
      if (s.kind !== K.Net) {
        x.strokeStyle = col.line
        x.lineWidth = w
        x.beginPath()
        x.moveTo(s.x1, s.y1)
        x.lineTo(s.x2, s.y2)
        x.stroke()
        continue
      }
      // split the segment wherever a front currently sits on it
      const net = c.nets[s.index]
      const lo = Math.min(s.d1, s.d2)
      const hi = Math.max(s.d1, s.d2)
      const cuts = [lo, hi]
      for (const f of net.fronts) {
        const p = (t - f.t) * c.speed
        if (p > lo && p < hi) cuts.push(p)
      }
      cuts.sort((a, b) => a - b)
      const at = (d: number) => {
        const u = s.d2 === s.d1 ? 0 : (d - s.d1) / (s.d2 - s.d1)
        return [s.x1 + (s.x2 - s.x1) * u, s.y1 + (s.y2 - s.y1) * u]
      }
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i]
        const b = cuts[i + 1]
        if (b - a < 0.2) continue
        const v = valueAt(c, s.index, (a + b) / 2, t)
        const [ax, ay] = at(a)
        const [bx, by] = at(b)
        x.strokeStyle = v.v ? col.signal : col.line
        x.globalAlpha = v.v ? 0.75 + v.head * 0.25 : 1
        x.lineWidth = v.v ? w + 0.4 : w
        x.beginPath()
        x.moveTo(ax, ay)
        x.lineTo(bx, by)
        x.stroke()
      }
      x.globalAlpha = 1
      for (const f of net.fronts) {
        if (!f.v) continue
        const p = (t - f.t) * c.speed
        if (p <= lo || p >= hi) continue
        const [px, py] = at(p)
        const g = x.createRadialGradient(px, py, 0, px, py, 9)
        g.addColorStop(0, col.signal)
        g.addColorStop(1, 'transparent')
        x.fillStyle = g
        x.beginPath()
        x.arc(px, py, 9, 0, Math.PI * 2)
        x.fill()
      }
    }
  }
}

/* Event-driven logic simulator with real propagation.

   A net is the tree of wires hanging off one gate output. When the output
   changes, a "front" leaves the driver pin and travels every branch at
   `speed` px/s; each sink sees the new value when the front reaches it, then
   evaluates after its gate delay. Renderers read each net's fronts to paint
   exactly which part of a wire is high right now. */

export type Kind = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR' | 'NOT' | 'BUF' | 'IN' | 'OUT'

export interface Pt {
  x: number
  y: number
}

export interface Front {
  t: number // sim seconds when it left the driver
  v: boolean
}

export interface Branch {
  pts: Pt[]
  cum: number[] // cumulative length at each point, from the driver pin
  length: number
  sink: number // gate index
  port: number
}

export interface Net {
  driver: number
  branches: Branch[]
  maxLength: number
  base: boolean // value everywhere the newest completed front has reached
  fronts: Front[] // oldest first
  dots: Pt[] // junction / tap dots drawn on this net
}

export interface Gate {
  kind: Kind
  x: number
  y: number
  n: number // number of inputs
  s: number // scale in px (body half-height)
  ins: boolean[]
  out: boolean
  delay: number // seconds
  net: number // output net index, -1 until connected
  label?: string
  glow: number // eased 0..1 for renderers
}

interface Ev {
  t: number
  kind: 0 | 1 // 0 = arrival at sink port, 1 = evaluate gate
  gate: number
  port: number
  v: boolean
  seq: number
}

function evaluate(kind: Kind, ins: boolean[]): boolean {
  switch (kind) {
    case 'AND':
      return ins.every(Boolean)
    case 'NAND':
      return !ins.every(Boolean)
    case 'OR':
      return ins.some(Boolean)
    case 'NOR':
      return !ins.some(Boolean)
    case 'XOR':
      return ins.reduce((a, b) => a !== b, false)
    case 'XNOR':
      return !ins.reduce((a, b) => a !== b, false)
    case 'NOT':
      return !ins[0]
    default:
      return ins[0] ?? false
  }
}

/* Min-heap on (t, seq) so simultaneous events keep insertion order. */
class Queue {
  private a: Ev[] = []
  get size() {
    return this.a.length
  }
  peek(): Ev | undefined {
    return this.a[0]
  }
  push(e: Ev) {
    const a = this.a
    a.push(e)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].t < e.t || (a[p].t === e.t && a[p].seq < e.seq)) break
      a[i] = a[p]
      i = p
    }
    a[i] = e
  }
  pop(): Ev | undefined {
    const a = this.a
    if (a.length === 0) return undefined
    const top = a[0]
    const last = a.pop()!
    const n = a.length
    if (n > 0) {
      a[0] = last
      const lt = (x: Ev, y: Ev) => x.t < y.t || (x.t === y.t && x.seq < y.seq)
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < n && lt(a[l], a[m])) m = l
        if (r < n && lt(a[r], a[m])) m = r
        if (m === i) break
        const tmp = a[i]
        a[i] = a[m]
        a[m] = tmp
        i = m
      }
    }
    return top
  }
  clear() {
    this.a.length = 0
  }
}

export function polylineCum(pts: Pt[]): number[] {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  return cum
}

export class Circuit {
  gates: Gate[] = []
  nets: Net[] = []
  /** signal travel speed, px per sim second */
  speed: number
  time = 0
  /** called whenever a gate output changes (after its delay) */
  onChange: ((gate: number, v: boolean, t: number) => void) | null = null
  private q = new Queue()
  private seq = 0

  constructor(speed = 320) {
    this.speed = speed
  }

  add(kind: Kind, x: number, y: number, opts: { n?: number; s?: number; delay?: number; label?: string } = {}): number {
    const n = opts.n ?? (kind === 'NOT' || kind === 'BUF' || kind === 'OUT' ? 1 : kind === 'IN' ? 0 : 2)
    this.gates.push({
      kind,
      x,
      y,
      n,
      s: opts.s ?? 8,
      ins: new Array(n).fill(false),
      out: evaluate(kind, new Array(n).fill(false)),
      delay: opts.delay ?? (kind === 'IN' || kind === 'OUT' ? 0 : 0.06),
      net: -1,
      label: opts.label,
      glow: 0,
    })
    return this.gates.length - 1
  }

  /** Output pin of a gate, in plane px. */
  outPin(g: number): Pt {
    const gate = this.gates[g]
    const s = gate.s
    const reach = gate.kind === 'IN' ? 1.1 : gate.kind === 'NAND' || gate.kind === 'NOR' || gate.kind === 'XNOR' || gate.kind === 'NOT' ? 2.1 : 1.9
    return { x: gate.x + reach * s, y: gate.y }
  }

  /** Input pin `port` of a gate, in plane px. */
  inPin(g: number, port: number): Pt {
    const gate = this.gates[g]
    const s = gate.s
    if (gate.kind === 'OUT') return { x: gate.x - 1.1 * s, y: gate.y }
    const n = gate.n
    const span = pinHalfSpan(gate) * 2
    const y = n <= 1 ? gate.y : gate.y - span / 2 + (span * (port + 0.5)) / n
    return { x: gate.x - 1.9 * s, y }
  }

  private netOf(g: number): Net {
    const gate = this.gates[g]
    if (gate.net < 0) {
      this.nets.push({ driver: g, branches: [], maxLength: 0, base: gate.out, fronts: [], dots: [] })
      gate.net = this.nets.length - 1
    }
    return this.nets[gate.net]
  }

  /** Wire driver `from` into `to`.`port`. `via` are waypoints; the router adds Manhattan elbows. */
  connect(from: number, to: number, port: number, via: Pt[] = []): Branch {
    const net = this.netOf(from)
    const a = this.outPin(from)
    const b = this.inPin(to, port)
    const raw: Pt[] = [a, ...via, b]
    const pts: Pt[] = [raw[0]]
    for (let i = 1; i < raw.length; i++) {
      const p = pts[pts.length - 1]
      const q = raw[i]
      if (p.x !== q.x && p.y !== q.y) pts.push({ x: q.x, y: p.y }) // horizontal first, then vertical
      pts.push(q)
    }
    const clean = dedupe(pts)
    const cum = polylineCum(clean)
    const branch: Branch = { pts: clean, cum, length: cum[cum.length - 1], sink: to, port }
    net.branches.push(branch)
    net.maxLength = Math.max(net.maxLength, branch.length)
    this.gates[to].ins[port] = net.base
    return branch
  }

  /** Settle every gate from current inputs without animation (used at build time). */
  settle(maxPasses = 64) {
    for (let pass = 0; pass < maxPasses; pass++) {
      let changed = false
      for (const net of this.nets) {
        const v = this.gates[net.driver].out
        net.base = v
        net.fronts.length = 0
        for (const b of net.branches) this.gates[b.sink].ins[b.port] = v
      }
      for (const g of this.gates) {
        if (g.kind === 'IN') continue
        const v = evaluate(g.kind, g.ins)
        if (v !== g.out) {
          g.out = v
          changed = true
        }
      }
      if (!changed) break
    }
    for (const g of this.gates) g.glow = g.out ? 1 : 0
    this.q.clear()
  }

  /** Drive an input gate. Takes effect at `t` (defaults to now). */
  set(g: number, v: boolean, t = this.time) {
    const gate = this.gates[g]
    if (gate.out === v) return
    gate.out = v
    this.drive(g, v, t)
  }

  /** Re-evaluate every gate at `t`. Loops with no stable state (a ring
      oscillator) start running from here. */
  nudge(t = this.time) {
    this.gates.forEach((g, i) => {
      if (g.kind === 'IN' || g.kind === 'OUT') return
      this.q.push({ t, kind: 1, gate: i, port: 0, v: false, seq: this.seq++ })
    })
  }

  toggle(g: number, t = this.time) {
    this.set(g, !this.gates[g].out, t)
  }

  private drive(g: number, v: boolean, t: number) {
    const gate = this.gates[g]
    this.onChange?.(g, v, t)
    if (gate.net < 0) return
    const net = this.nets[gate.net]
    net.fronts.push({ t, v })
    if (net.fronts.length > 12) {
      // too many edges in flight: collapse the oldest into the base
      const old = net.fronts.shift()!
      net.base = old.v
    }
    for (const b of net.branches) {
      this.q.push({ t: t + b.length / this.speed, kind: 0, gate: b.sink, port: b.port, v, seq: this.seq++ })
    }
  }

  /** Advance simulation to `t` seconds, processing every due event in order. */
  advance(t: number) {
    for (;;) {
      const e = this.q.peek()
      if (!e || e.t > t) break
      this.q.pop()
      this.time = e.t
      const gate = this.gates[e.gate]
      if (e.kind === 0) {
        gate.ins[e.port] = e.v
        if (gate.kind === 'OUT') {
          if (gate.out !== e.v) {
            gate.out = e.v
            this.onChange?.(e.gate, e.v, e.t)
          }
        } else {
          this.q.push({ t: e.t + gate.delay, kind: 1, gate: e.gate, port: 0, v: false, seq: this.seq++ })
        }
      } else {
        const v = evaluate(gate.kind, gate.ins)
        if (v !== gate.out) {
          gate.out = v
          this.drive(e.gate, v, e.t)
        }
      }
    }
    this.time = t
    // retire fronts that have run off the end of every branch
    for (const net of this.nets) {
      while (net.fronts.length > 0 && (t - net.fronts[0].t) * this.speed > net.maxLength + 1) {
        net.base = net.fronts.shift()!.v
      }
    }
  }

  /** Ease gate glow toward output, for renderers. */
  ease(dt: number) {
    const k = 1 - Math.exp(-dt / 0.12)
    for (const g of this.gates) g.glow += ((g.out ? 1 : 0) - g.glow) * k
  }

  get busy() {
    return this.q.size > 0 || this.nets.some((n) => n.fronts.length > 0)
  }

  /** Mark junction dots where a net's branches part ways (schematic convention). */
  junctions() {
    const at = (b: Branch, d: number): Pt => {
      for (let i = 1; i < b.pts.length; i++) {
        if (b.cum[i] >= d) {
          const f = (d - b.cum[i - 1]) / Math.max(1e-6, b.cum[i] - b.cum[i - 1])
          return { x: b.pts[i - 1].x + (b.pts[i].x - b.pts[i - 1].x) * f, y: b.pts[i - 1].y + (b.pts[i].y - b.pts[i - 1].y) * f }
        }
      }
      return b.pts[b.pts.length - 1]
    }
    for (const net of this.nets) {
      if (net.branches.length < 2) continue
      const seen = new Set<string>()
      for (let k = 1; k < net.branches.length; k++) {
        const b = net.branches[k]
        let best = 0
        for (let j = 0; j < k; j++) {
          const a = net.branches[j]
          const max = Math.min(a.length, b.length)
          let d = 0
          while (d <= max) {
            const p = at(a, d)
            const q = at(b, d)
            if (Math.abs(p.x - q.x) > 0.5 || Math.abs(p.y - q.y) > 0.5) break
            d += 1
          }
          best = Math.max(best, d - 1)
        }
        if (best <= 1) continue
        const p = at(b, best)
        const key = `${Math.round(p.x)},${Math.round(p.y)}`
        if (seen.has(key)) continue
        seen.add(key)
        net.dots.push(p)
      }
    }
  }
}

/** Half the vertical span over which input pins are spread. */
export function pinHalfSpan(g: { n: number; s: number }): number {
  if (g.n <= 1) return 0
  return g.s * Math.max(0.9, g.n * 0.45)
}

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (q && Math.abs(q.x - p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01) continue
    out.push(p)
  }
  // drop collinear midpoints
  const res: Pt[] = [out[0]]
  for (let i = 1; i < out.length - 1; i++) {
    const a = res[res.length - 1]
    const b = out[i]
    const c = out[i + 1]
    const collinear = (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) || (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01)
    if (!collinear) res.push(b)
  }
  if (out.length > 1) res.push(out[out.length - 1])
  return res
}

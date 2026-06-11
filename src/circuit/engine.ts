/* ──────────────────────────────────────────────────────────────────
   Living circuit background engine.
   Procedural combinational network (sources → gates → LEDs) with
   Manhattan-routed traces. Signals propagate with real travel time
   and gate delay. Rising edges sweep in with a gradient comet,
   falling edges drain softly, and gates/LEDs ease their glow in and
   out. Static geometry is pre-rendered offscreen; each frame only
   paints live signal regions.
   ────────────────────────────────────────────────────────────────── */

export type GateKind = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOT' | 'SRC' | 'LED'

interface Pt {
  x: number
  y: number
}

interface Front {
  value: boolean
  start: number
}

interface Span {
  a: number
  b: number
  v: boolean
  fadeA: boolean // sits ahead of a falling front: soft drain near a
  cometB: boolean // sits behind a rising front: bright comet near b
}

interface Wire {
  pts: Pt[]
  cum: number[]
  totalLen: number
  toNode: number
  toPort: number
  baseValue: boolean
  fronts: Front[] // oldest (furthest along) first
}

interface Node {
  kind: GateKind
  x: number
  y: number
  inVals: boolean[]
  value: boolean
  glow: number // eased 0..1 visual intensity
  outWires: number[]
  nextToggle: number
  period: number // 0 = random duty cycle, >0 = clock source
  lastPoke: number
}

interface PendingEval {
  node: number
  time: number
}

const SPEED = 250 // px/s signal travel
const GATE_DELAY = 110 // ms
const CORNER_R = 10
const SETTLED_ALPHA = 0.38

const C = {
  dot: '#f4efe0',
  trace: '#ebe3cb',
  gate: '#ddd3ad',
  gateFill: '#fffefa',
  lit: '#fa520f',
  litGlow: 'rgba(250, 82, 15, 0.5)',
  padInner: '#d3c89e',
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

function evalGate(kind: GateKind, ins: boolean[]): boolean {
  switch (kind) {
    case 'AND':
      return ins[0] && ins[1]
    case 'OR':
      return ins[0] || ins[1]
    case 'XOR':
      return ins[0] !== ins[1]
    case 'NAND':
      return !(ins[0] && ins[1])
    case 'NOT':
      return !ins[0]
    default:
      return ins[0] ?? false
  }
}

/* Round interior corners so distance-based partial strokes follow
   the exact same path as the full static trace. */
function tessellate(raw: Pt[]): Pt[] {
  const out: Pt[] = [raw[0]]
  for (let i = 1; i < raw.length - 1; i++) {
    const a = raw[i - 1]
    const b = raw[i]
    const c = raw[i + 1]
    const dab = Math.hypot(b.x - a.x, b.y - a.y)
    const dbc = Math.hypot(c.x - b.x, c.y - b.y)
    const r = Math.min(CORNER_R, dab / 2, dbc / 2)
    if (r < 1) {
      out.push(b)
      continue
    }
    const inPt = { x: b.x - ((b.x - a.x) / dab) * r, y: b.y - ((b.y - a.y) / dab) * r }
    const outPt = { x: b.x + ((c.x - b.x) / dbc) * r, y: b.y + ((c.y - b.y) / dbc) * r }
    out.push(inPt)
    for (const t of [0.35, 0.65]) {
      const mt = 1 - t
      out.push({
        x: mt * mt * inPt.x + 2 * mt * t * b.x + t * t * outPt.x,
        y: mt * mt * inPt.y + 2 * mt * t * b.y + t * t * outPt.y,
      })
    }
    out.push(outPt)
  }
  out.push(raw[raw.length - 1])
  return out
}

function buildWire(from: Pt, to: Pt, toNode: number, toPort: number, lane: number): Wire {
  const raw: Pt[] = [from]
  const span = to.x - from.x
  const dy = to.y - from.y

  if (Math.abs(dy) < 3) {
    raw.push(to)
  } else if (Math.abs(dy) > 120 && span > 160 && Math.random() < 0.35) {
    // double-elbow route: longer, more architectural path
    const mx1 = from.x + span * rand(0.18, 0.38)
    const mx2 = from.x + span * rand(0.62, 0.85)
    const ym = from.y + dy * rand(0.4, 0.6) + rand(-30, 30)
    raw.push({ x: mx1, y: from.y })
    raw.push({ x: mx1, y: ym })
    raw.push({ x: mx2, y: ym })
    raw.push({ x: mx2, y: to.y })
    raw.push(to)
  } else {
    const mx = from.x + Math.max(20, Math.min(span - 20, span * rand(0.3, 0.7) + lane * 9))
    raw.push({ x: mx, y: from.y })
    raw.push({ x: mx, y: to.y })
    raw.push(to)
  }

  const pts = tessellate(raw)
  const cum: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  return {
    pts,
    cum,
    totalLen: cum[cum.length - 1],
    toNode,
    toPort,
    baseValue: false,
    fronts: [],
  }
}

export class CircuitEngine {
  private nodes: Node[] = []
  private wires: Wire[] = []
  private pending: PendingEval[] = []
  private simTime = 0
  private staticLayer: HTMLCanvasElement | null = null
  private w = 0
  private h = 0
  private dpr = 1
  private mouse: Pt = { x: -9999, y: -9999 }
  readonly reducedMotion: boolean

  constructor() {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  setMouse(x: number, y: number) {
    this.mouse = { x, y }
  }

  /* ── layout ─────────────────────────────────────────────────── */

  build(w: number, h: number, dpr: number) {
    this.w = w
    this.h = h
    this.dpr = dpr
    this.nodes = []
    this.wires = []
    this.pending = []
    this.simTime = 0

    const colW = 300
    const rowH = 200
    const marginX = 56
    const marginY = 92
    const stages = Math.max(3, Math.min(7, Math.round((w - marginX * 2) / colW) + 1))
    const rows = Math.max(2, Math.floor((h - marginY * 2) / rowH) + 1)
    const stageX = (s: number) => marginX + (s * (w - marginX * 2)) / (stages - 1)

    const stageNodes: number[][] = []
    const gateKinds: GateKind[] = ['AND', 'OR', 'XOR', 'NAND', 'AND', 'OR', 'NOT', 'XOR']

    for (let s = 0; s < stages; s++) {
      const ids: number[] = []
      for (let r = 0; r < rows; r++) {
        if (s > 0 && s < stages - 1 && Math.random() < 0.25) continue
        const kind: GateKind = s === 0 ? 'SRC' : s === stages - 1 ? 'LED' : pick(gateKinds)
        const x = stageX(s) + (s === 0 || s === stages - 1 ? 0 : rand(-34, 34))
        const y = marginY + (r * (h - marginY * 2)) / Math.max(1, rows - 1) + rand(-26, 26)
        this.nodes.push({
          kind,
          x,
          y,
          inVals: [false, false],
          value: false,
          glow: 0,
          outWires: [],
          nextToggle: rand(400, 5600),
          period: kind === 'SRC' && Math.random() < 0.2 ? pick([2600, 3400, 4200]) : 0,
          lastPoke: -9999,
        })
        ids.push(this.nodes.length - 1)
      }
      stageNodes.push(ids)
    }

    for (let s = 1; s < stages; s++) {
      for (const id of stageNodes[s]) {
        const node = this.nodes[id]
        const nIns = node.kind === 'NOT' || node.kind === 'LED' ? 1 : 2
        for (let port = 0; port < nIns; port++) {
          let srcStage = s - 1
          if (s > 1 && Math.random() < 0.16) srcStage = s - 2
          const cands = [...stageNodes[srcStage]].sort(
            (a, b) => Math.abs(this.nodes[a].y - node.y) - Math.abs(this.nodes[b].y - node.y),
          )
          const fromId = cands[Math.floor(Math.random() * Math.min(3, cands.length))]
          const from = this.nodes[fromId]
          const wire = buildWire(
            this.outPin(from),
            this.inPin(node, port, nIns),
            id,
            port,
            from.outWires.length,
          )
          this.wires.push(wire)
          from.outWires.push(this.wires.length - 1)
        }
      }
    }

    this.renderStaticLayer()
  }

  private outPin(n: Node): Pt {
    if (n.kind === 'SRC') return { x: n.x + 16, y: n.y }
    return { x: n.x + 36, y: n.y }
  }

  private inPin(n: Node, port: number, nIns: number): Pt {
    if (n.kind === 'LED') return { x: n.x - 15, y: n.y }
    const dy = nIns === 1 ? 0 : port === 0 ? -9 : 9
    return { x: n.x - 36, y: n.y + dy }
  }

  /* ── static layer ───────────────────────────────────────────── */

  private renderStaticLayer() {
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(this.w * this.dpr))
    cv.height = Math.max(1, Math.round(this.h * this.dpr))
    const ctx = cv.getContext('2d')!
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    // engineering-paper dot grid
    ctx.fillStyle = C.dot
    const step = 36
    for (let x = step / 2; x < this.w; x += step) {
      for (let y = step / 2; y < this.h; y += step) {
        ctx.fillRect(x - 1, y - 1, 2, 2)
      }
    }

    ctx.strokeStyle = C.trace
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const w of this.wires) {
      ctx.beginPath()
      ctx.moveTo(w.pts[0].x, w.pts[0].y)
      for (let i = 1; i < w.pts.length; i++) ctx.lineTo(w.pts[i].x, w.pts[i].y)
      ctx.stroke()
    }

    ctx.fillStyle = C.trace
    for (const n of this.nodes) {
      if (n.outWires.length > 1) {
        const p = this.outPin(n)
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    for (const n of this.nodes) this.drawNode(ctx, n, false)

    this.staticLayer = cv
  }

  private gatePath(ctx: CanvasRenderingContext2D, n: Node) {
    const { x, y } = n
    ctx.beginPath()
    switch (n.kind) {
      case 'AND':
      case 'NAND':
        ctx.moveTo(x - 24, y - 18)
        ctx.lineTo(x + 2, y - 18)
        ctx.arc(x + 2, y, 18, -Math.PI / 2, Math.PI / 2)
        ctx.lineTo(x - 24, y + 18)
        ctx.closePath()
        break
      case 'OR':
      case 'XOR':
        ctx.moveTo(x - 22, y - 18)
        ctx.quadraticCurveTo(x + 5, y - 18, x + 24, y)
        ctx.quadraticCurveTo(x + 5, y + 18, x - 22, y + 18)
        ctx.quadraticCurveTo(x - 12, y, x - 22, y - 18)
        break
      case 'NOT':
        ctx.moveTo(x - 18, y - 15)
        ctx.lineTo(x + 15, y)
        ctx.lineTo(x - 18, y + 15)
        ctx.closePath()
        break
    }
  }

  private drawNode(ctx: CanvasRenderingContext2D, n: Node, lit: boolean) {
    const { x, y } = n
    ctx.strokeStyle = lit ? C.lit : C.gate
    ctx.fillStyle = lit ? 'rgba(250, 82, 15, 0.08)' : C.gateFill
    ctx.lineWidth = 2.2

    if (n.kind === 'SRC') {
      ctx.beginPath()
      ctx.roundRect(x - 12, y - 12, 24, 24, 5)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = lit ? C.lit : C.padInner
      ctx.beginPath()
      ctx.arc(x, y, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(x + 12, y)
      ctx.lineTo(x + 16, y)
      ctx.stroke()
      return
    }

    if (n.kind === 'LED') {
      ctx.beginPath()
      ctx.moveTo(x - 15, y)
      ctx.lineTo(x - 9, y)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, lit ? 9 + n.glow * 2 : 9, 0, Math.PI * 2)
      if (lit) {
        ctx.save()
        ctx.shadowColor = C.litGlow
        ctx.shadowBlur = 18
        ctx.fillStyle = C.lit
        ctx.fill()
        ctx.restore()
      } else {
        ctx.fill()
        ctx.stroke()
      }
      return
    }

    const nIns = n.kind === 'NOT' ? 1 : 2
    ctx.beginPath()
    if (nIns === 1) {
      ctx.moveTo(x - 36, y)
      ctx.lineTo(x - 18, y)
    } else {
      const edgeX = n.kind === 'AND' || n.kind === 'NAND' ? x - 24 : x - 17
      ctx.moveTo(x - 36, y - 9)
      ctx.lineTo(edgeX, y - 9)
      ctx.moveTo(x - 36, y + 9)
      ctx.lineTo(edgeX, y + 9)
    }
    ctx.stroke()

    const tipX =
      n.kind === 'NAND'
        ? x + 29
        : n.kind === 'NOT'
          ? x + 24
          : n.kind === 'AND'
            ? x + 20
            : x + 24
    ctx.beginPath()
    ctx.moveTo(tipX, y)
    ctx.lineTo(x + 36, y)
    ctx.stroke()

    this.gatePath(ctx, n)
    ctx.fill()
    ctx.stroke()

    if (n.kind === 'NAND' || n.kind === 'NOT') {
      const bx = n.kind === 'NAND' ? x + 24.5 : x + 19.5
      ctx.beginPath()
      ctx.arc(bx, y, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = C.gateFill
      ctx.fill()
      ctx.stroke()
    }

    if (n.kind === 'XOR') {
      ctx.beginPath()
      ctx.moveTo(x - 28, y - 18)
      ctx.quadraticCurveTo(x - 18, y, x - 28, y + 18)
      ctx.stroke()
    }
  }

  /* ── simulation ─────────────────────────────────────────────── */

  tick(dtMs: number) {
    const dt = Math.min(dtMs, 50)
    this.simTime += dt
    const t = this.simTime

    // ease node glow toward its logical value
    const k = 1 - Math.exp(-dt / 150)
    for (const n of this.nodes) {
      n.glow += ((n.value ? 1 : 0) - n.glow) * k
    }

    // sources: clocks tick regularly, the rest pulse with a short
    // HIGH duty cycle; cursor proximity pokes a toggle
    for (const n of this.nodes) {
      if (n.kind !== 'SRC') continue
      const near = Math.abs(n.x - this.mouse.x) < 60 && Math.abs(n.y - this.mouse.y) < 60
      if (t >= n.nextToggle || (near && t - n.lastPoke > 900)) {
        n.value = !n.value
        n.nextToggle =
          t + (n.period > 0 ? n.period / 2 : n.value ? rand(1700, 4200) : rand(5200, 14000))
        if (near) n.lastPoke = t
        for (const wi of n.outWires) this.wires[wi].fronts.push({ value: n.value, start: t })
      }
    }

    for (const w of this.wires) {
      while (w.fronts.length > 0) {
        const f = w.fronts[0]
        if (((t - f.start) / 1000) * SPEED < w.totalLen) break
        w.fronts.shift()
        w.baseValue = f.value
        this.nodes[w.toNode].inVals[w.toPort] = f.value
        this.pending.push({ node: w.toNode, time: t + GATE_DELAY })
      }
    }

    if (this.pending.length > 0) {
      const due = this.pending.filter((p) => p.time <= t)
      if (due.length > 0) {
        this.pending = this.pending.filter((p) => p.time > t)
        for (const p of due) {
          const n = this.nodes[p.node]
          if (n.kind === 'LED') {
            n.value = n.inVals[0]
            continue
          }
          const out = evalGate(n.kind, n.inVals)
          if (out !== n.value) {
            n.value = out
            for (const wi of n.outWires) this.wires[wi].fronts.push({ value: out, start: t })
          }
        }
      }
    }
  }

  /* ── dynamic render ─────────────────────────────────────────── */

  private buildSpans(w: Wire, t: number): Span[] {
    const fronts = w.fronts.map((f) => ({
      pos: Math.min(w.totalLen, ((t - f.start) / 1000) * SPEED),
      value: f.value,
    }))
    const spans: Span[] = []
    let far = w.totalLen
    let farValue = w.baseValue
    let boundary: { value: boolean } | null = null
    for (const f of fronts) {
      spans.push({
        a: f.pos,
        b: far,
        v: farValue,
        fadeA: farValue && !f.value,
        cometB: farValue && boundary !== null && boundary.value,
      })
      boundary = f
      far = f.pos
      farValue = f.value
    }
    spans.push({
      a: 0,
      b: far,
      v: farValue,
      fadeA: false,
      cometB: farValue && boundary !== null && boundary.value,
    })
    return spans
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)
    if (this.staticLayer) ctx.drawImage(this.staticLayer, 0, 0, this.w, this.h)

    const t = this.simTime
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = C.lit

    for (const w of this.wires) {
      const spans = this.buildSpans(w, t)

      for (const s of spans) {
        if (!s.v || s.b - s.a < 0.5) continue

        // piecewise alpha: soft drain ramp near a (falling edge ahead),
        // bright comet ramp near b (rising edge leading)
        const cuts = new Set<number>([s.a, s.b])
        if (s.fadeA) {
          cuts.add(Math.min(s.b, s.a + 40))
          cuts.add(Math.min(s.b, s.a + 80))
        }
        if (s.cometB) {
          cuts.add(Math.max(s.a, s.b - 130))
          cuts.add(Math.max(s.a, s.b - 86))
          cuts.add(Math.max(s.a, s.b - 42))
        }
        const edges = [...cuts].sort((p, q) => p - q)

        for (let i = 0; i < edges.length - 1; i++) {
          const from = edges[i]
          const to = edges[i + 1]
          if (to - from < 0.5) continue
          const mid = (from + to) / 2
          let alpha = SETTLED_ALPHA
          if (s.fadeA) {
            const d = mid - s.a
            if (d < 80) alpha = Math.min(alpha, 0.1 + (d / 80) * (SETTLED_ALPHA - 0.1))
          }
          if (s.cometB) {
            const d = s.b - mid
            if (d < 130) alpha = Math.max(alpha, 0.95 - (d / 130) * (0.95 - SETTLED_ALPHA))
          }
          ctx.globalAlpha = alpha
          ctx.lineWidth = alpha > 0.6 ? 2.6 : 2.3
          this.strokeSub(ctx, w, from, to)
        }
      }
      ctx.globalAlpha = 1

      // glowing head on rising fronts
      for (let i = 0; i < w.fronts.length; i++) {
        const f = w.fronts[i]
        if (!f.value) continue
        const pos = Math.min(w.totalLen, ((t - f.start) / 1000) * SPEED)
        if (pos <= 0.5 || pos >= w.totalLen - 0.5) continue
        const p = this.pointAt(w, pos)
        ctx.save()
        ctx.shadowColor = C.litGlow
        ctx.shadowBlur = 14
        ctx.fillStyle = C.lit
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // glowing nodes: eased in/out via per-node glow
    for (const n of this.nodes) {
      if (n.glow > 0.02) {
        ctx.globalAlpha = Math.min(1, n.glow)
        this.drawNode(ctx, n, true)
      }
    }
    ctx.globalAlpha = 1
  }

  private pointAt(w: Wire, dist: number): Pt {
    const { pts, cum } = w
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] >= dist) {
        const segLen = cum[i] - cum[i - 1]
        const f = segLen === 0 ? 0 : (dist - cum[i - 1]) / segLen
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
        }
      }
    }
    return pts[pts.length - 1]
  }

  private strokeSub(ctx: CanvasRenderingContext2D, w: Wire, a: number, b: number) {
    const { pts, cum } = w
    const pa = this.pointAt(w, a)
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] <= a) continue
      if (cum[i] >= b) break
      ctx.lineTo(pts[i].x, pts[i].y)
    }
    const pb = this.pointAt(w, b)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }
}

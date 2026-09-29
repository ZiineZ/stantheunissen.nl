/* The sandbox: place gates, drag wires from an output to an input, flip
   inputs, share the result as a link. Rebuilt from a tiny model on every edit;
   simulated with the same propagation engine as the rest of the site. */

import { Circuit, type Kind } from '../core/sim/circuit'
import { Circuit2D, readColors } from '../core/draw2d'
import { onTheme } from '../core/theme'
import { flash } from '../core/ui/flash'
import type { Stage } from '../core/gl/stage'

type SKind = Kind | 'CLK'
interface SGate {
  id: number
  kind: SKind
  x: number
  y: number
  on?: boolean
}
interface SWire {
  from: number
  to: number
  port: number
}
interface Model {
  gates: SGate[]
  wires: SWire[]
}

const GRID = 16
const S = 10
const snap = (v: number) => Math.round(v / GRID) * GRID
const inputs = (k: SKind) => (k === 'NOT' || k === 'OUT' || k === 'BUF' ? 1 : k === 'IN' || k === 'CLK' ? 0 : 2)

const PRESETS: Record<string, Model> = {
  'Half adder': {
    gates: [
      { id: 1, kind: 'IN', x: 96, y: 128, on: true },
      { id: 2, kind: 'IN', x: 96, y: 256 },
      { id: 3, kind: 'XOR', x: 320, y: 144 },
      { id: 4, kind: 'AND', x: 320, y: 272 },
      { id: 5, kind: 'OUT', x: 480, y: 144 },
      { id: 6, kind: 'OUT', x: 480, y: 272 },
    ],
    wires: [
      { from: 1, to: 3, port: 0 },
      { from: 2, to: 3, port: 1 },
      { from: 1, to: 4, port: 0 },
      { from: 2, to: 4, port: 1 },
      { from: 3, to: 5, port: 0 },
      { from: 4, to: 6, port: 0 },
    ],
  },
  'Ring oscillator': {
    gates: [
      { id: 1, kind: 'NOT', x: 224, y: 192 },
      { id: 2, kind: 'NOT', x: 400, y: 192 },
      { id: 3, kind: 'NOT', x: 576, y: 192 },
      { id: 4, kind: 'OUT', x: 736, y: 192 },
    ],
    wires: [
      { from: 1, to: 2, port: 0 },
      { from: 2, to: 3, port: 0 },
      { from: 3, to: 1, port: 0 },
      { from: 3, to: 4, port: 0 },
    ],
  },
  'SR latch': {
    gates: [
      { id: 1, kind: 'IN', x: 96, y: 128 },
      { id: 2, kind: 'IN', x: 96, y: 320 },
      { id: 3, kind: 'NOR', x: 352, y: 144 },
      { id: 4, kind: 'NOR', x: 352, y: 304 },
      { id: 5, kind: 'OUT', x: 560, y: 144 },
      { id: 6, kind: 'OUT', x: 560, y: 304 },
    ],
    wires: [
      { from: 1, to: 3, port: 0 },
      { from: 4, to: 3, port: 1 },
      { from: 3, to: 4, port: 0 },
      { from: 2, to: 4, port: 1 },
      { from: 3, to: 5, port: 0 },
      { from: 4, to: 6, port: 0 },
    ],
  },
}

function encode(m: Model) {
  const s = JSON.stringify([m.gates.map((g) => [g.id, g.kind, g.x, g.y, g.on ? 1 : 0]), m.wires.map((w) => [w.from, w.to, w.port])])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(s: string): Model | null {
  try {
    const [gs, ws] = JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/'))) as [[number, SKind, number, number, number][], [number, number, number][]]
    const kinds: SKind[] = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR', 'NOT', 'BUF', 'IN', 'OUT', 'CLK']
    const gates = gs
      .filter((g) => kinds.includes(g[1]))
      .slice(0, 80)
      .map(([id, kind, x, y, on]) => ({ id: Number(id), kind, x: snap(Number(x)), y: snap(Number(y)), on: on === 1 }))
    const ids = new Set(gates.map((g) => g.id))
    const wires = ws.filter((w) => ids.has(w[0]) && ids.has(w[1])).slice(0, 200).map(([from, to, port]) => ({ from, to, port }))
    return { gates, wires }
  } catch {
    return null
  }
}

export function mountSandbox(article: HTMLElement, _stage: () => Stage | null) {
  const found = article.querySelector<HTMLElement>('[data-sandbox]')
  if (!found) return
  const host: HTMLElement = found
  host.innerHTML = `
    <div class="sb-tools" role="toolbar" aria-label="Gates">
      ${(['IN', 'CLK', 'AND', 'OR', 'XOR', 'NAND', 'NOR', 'NOT', 'OUT'] as SKind[])
        .map((k) => `<button type="button" class="sb-tool" data-tool="${k}" aria-pressed="false">${k === 'IN' ? 'Input' : k === 'OUT' ? 'Output' : k === 'CLK' ? 'Clock' : k}</button>`)
        .join('')}
      <span class="sb-sep"></span>
      <button type="button" class="sb-tool" data-tool="DEL" aria-pressed="false">Delete</button>
    </div>
    <div class="sb-stage"><canvas aria-label="Circuit canvas. Choose a gate, click to place it, drag from an output to an input to wire. Click inputs to flip them."></canvas></div>
    <div class="sb-foot">
      <span class="mono">Load</span>
      ${Object.keys(PRESETS).map((p) => `<button type="button" class="wire" data-preset="${p}">${p}</button>`).join('')}
      <span class="sb-sep"></span>
      <button type="button" class="wire" data-act="clear">Clear</button>
      <button type="button" class="wire" data-act="share">Copy link</button>
    </div>`
  const canvas = host.querySelector('canvas')!
  const stageEl = host.querySelector<HTMLElement>('.sb-stage')!
  const x = canvas.getContext('2d')!
  let model: Model = decode(location.hash.replace(/^#c=/, '')) ?? structuredClone(PRESETS['Ring oscillator'])
  let nextId = Math.max(0, ...model.gates.map((g) => g.id)) + 1
  let tool: SKind | 'DEL' | null = null
  let selected: number | null = null
  let c = new Circuit(260)
  let idx = new Map<number, number>()
  let r2d = new Circuit2D(c, x)
  let colors = readColors()
  const t0 = performance.now()
  const now = () => (performance.now() - t0) / 1000
  let W = 0
  let H = 0

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1)
    W = stageEl.clientWidth
    H = Math.max(420, Math.min(640, Math.round(window.innerHeight * 0.62)))
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function build() {
    const t = now()
    c = new Circuit(260)
    idx = new Map()
    for (const g of model.gates) {
      const k = g.kind === 'CLK' ? 'IN' : g.kind
      const i = c.add(k, g.x, g.y, { s: S, n: inputs(g.kind) })
      idx.set(g.id, i)
      if (k === 'IN') c.gates[i].out = !!g.on
    }
    for (const w of model.wires) {
      const a = idx.get(w.from)
      const b = idx.get(w.to)
      if (a === undefined || b === undefined) continue
      const p = c.outPin(a)
      const q = c.inPin(b, w.port)
      if (q.x - p.x > GRID * 1.5) {
        const mx = snap((p.x + q.x) / 2)
        c.connect(a, b, w.port, [{ x: mx, y: p.y }, { x: mx, y: q.y }])
      } else {
        const my = snap(Math.max(p.y, q.y) + GRID * 3)
        c.connect(a, b, w.port, [{ x: p.x + GRID, y: p.y }, { x: p.x + GRID, y: my }, { x: q.x - GRID, y: my }, { x: q.x - GRID, y: q.y }])
      }
    }
    c.junctions()
    c.settle()
    c.time = t
    // gates left inconsistent by settle (loops with no stable state) start moving here
    c.nudge(t)
    r2d = new Circuit2D(c, x)
    history.replaceState(null, '', `${location.pathname}#c=${encode(model)}`)
  }

  function hitGate(px: number, py: number) {
    for (let k = model.gates.length - 1; k >= 0; k--) {
      const g = model.gates[k]
      if (Math.abs(px - g.x) < S * 1.5 && Math.abs(py - g.y) < S * 1.4) return g
    }
    return null
  }

  function hitPin(px: number, py: number, out: boolean) {
    for (const g of model.gates) {
      const i = idx.get(g.id)
      if (i === undefined) continue
      if (out) {
        if (g.kind === 'OUT') continue
        const p = c.outPin(i)
        if (Math.hypot(p.x - px, p.y - py) < 11) return { g, port: 0, p }
      } else {
        for (let port = 0; port < inputs(g.kind); port++) {
          const p = c.inPin(i, port)
          if (Math.hypot(p.x - px, p.y - py) < 11) return { g, port, p }
        }
      }
    }
    return null
  }

  let drag: { id: number; dx: number; dy: number } | null = null
  let wiring: { from: number; x: number; y: number; px: number; py: number } | null = null

  const pos = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  canvas.addEventListener('pointerdown', (e) => {
    const [px, py] = pos(e)
    canvas.setPointerCapture(e.pointerId)
    const pin = hitPin(px, py, true)
    if (pin && tool !== 'DEL') {
      wiring = { from: pin.g.id, x: pin.p.x, y: pin.p.y, px, py }
      return
    }
    const g = hitGate(px, py)
    if (g) {
      if (tool === 'DEL') {
        model.gates = model.gates.filter((q) => q.id !== g.id)
        model.wires = model.wires.filter((w) => w.from !== g.id && w.to !== g.id)
        build()
        return
      }
      selected = g.id
      if (g.kind === 'IN') {
        g.on = !g.on
        const i = idx.get(g.id)
        if (i !== undefined) c.set(i, !!g.on, now())
        history.replaceState(null, '', `${location.pathname}#c=${encode(model)}`)
      }
      drag = { id: g.id, dx: g.x - px, dy: g.y - py }
      return
    }
    selected = null
    if (tool && tool !== 'DEL') {
      if (model.gates.length >= 80) return flash('Memory full: 80 gates is the limit here.', e.clientX, e.clientY)
      model.gates.push({ id: nextId++, kind: tool, x: snap(px), y: snap(py) })
      build()
    }
  })

  canvas.addEventListener('pointermove', (e) => {
    const [px, py] = pos(e)
    if (wiring) {
      wiring.px = px
      wiring.py = py
    } else if (drag) {
      const g = model.gates.find((q) => q.id === drag!.id)
      if (g) {
        const nx = snap(px + drag.dx)
        const ny = snap(py + drag.dy)
        if (nx !== g.x || ny !== g.y) {
          g.x = Math.max(GRID * 2, Math.min(W - GRID * 2, nx))
          g.y = Math.max(GRID * 2, Math.min(H - GRID * 2, ny))
          build()
        }
      }
    }
    canvas.style.cursor = hitPin(px, py, true) ? 'crosshair' : hitGate(px, py) ? 'pointer' : tool ? 'copy' : 'default'
  })

  canvas.addEventListener('pointerup', (e) => {
    const [px, py] = pos(e)
    if (wiring) {
      const pin = hitPin(px, py, false)
      if (pin && pin.g.id !== wiring.from) {
        model.wires = model.wires.filter((w) => !(w.to === pin.g.id && w.port === pin.port))
        model.wires.push({ from: wiring.from, to: pin.g.id, port: pin.port })
        build()
      }
    }
    wiring = null
    drag = null
  })

  host.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool], [data-preset], [data-act]')
    if (!b) return
    if (b.dataset.tool) {
      const t = b.dataset.tool as SKind | 'DEL'
      tool = tool === t ? null : t
      host.querySelectorAll('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String((q as HTMLElement).dataset.tool === tool)))
    } else if (b.dataset.preset) {
      model = structuredClone(PRESETS[b.dataset.preset])
      nextId = Math.max(0, ...model.gates.map((g) => g.id)) + 1
      build()
    } else if (b.dataset.act === 'clear') {
      model = { gates: [], wires: [] }
      build()
    } else if (b.dataset.act === 'share') {
      navigator.clipboard
        .writeText(location.href)
        .then(() => flash('Link copied: the circuit is in the URL.', (e as MouseEvent).clientX, (e as MouseEvent).clientY))
        .catch(() => flash(location.href, (e as MouseEvent).clientX, (e as MouseEvent).clientY, 4000))
    }
  })

  window.addEventListener('keydown', onKey)
  function onKey(e: KeyboardEvent) {
    if (!document.body.contains(canvas)) return window.removeEventListener('keydown', onKey)
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && !(e.target as HTMLElement).closest('input, textarea')) {
      model.gates = model.gates.filter((g) => g.id !== selected)
      model.wires = model.wires.filter((w) => w.from !== selected && w.to !== selected)
      selected = null
      build()
    } else if (e.key === 'Escape') {
      tool = null
      selected = null
      host.querySelectorAll('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', 'false'))
    }
  }

  const off = onTheme(() => (colors = readColors()))
  let lastClk = 0
  function frame() {
    if (!document.body.contains(canvas)) {
      off()
      return
    }
    const t = now()
    if (t - lastClk > 0.8) {
      lastClk = t
      model.gates.forEach((g) => {
        if (g.kind !== 'CLK') return
        const i = idx.get(g.id)
        if (i !== undefined) c.toggle(i, t)
      })
    }
    c.advance(t)
    c.ease(1 / 60)
    x.clearRect(0, 0, W, H)
    x.fillStyle = colors.line
    x.globalAlpha = 0.55
    for (let gx = GRID; gx < W; gx += GRID) for (let gy = GRID; gy < H; gy += GRID) x.fillRect(gx - 0.5, gy - 0.5, 1, 1)
    x.globalAlpha = 1
    r2d.draw(t, colors)
    if (selected !== null) {
      const g = model.gates.find((q) => q.id === selected)
      if (g) {
        x.strokeStyle = colors.signal
        x.setLineDash([3, 3])
        x.strokeRect(g.x - S * 2.2, g.y - S * 1.6, S * 4.6, S * 3.2)
        x.setLineDash([])
      }
    }
    if (wiring) {
      x.strokeStyle = colors.signal
      x.lineWidth = 1.2
      x.beginPath()
      x.moveTo(wiring.x, wiring.y)
      x.lineTo(wiring.px, wiring.py)
      x.stroke()
    }
    requestAnimationFrame(frame)
  }
  size()
  build()
  window.addEventListener('resize', () => {
    size()
  })
  requestAnimationFrame(frame)
}

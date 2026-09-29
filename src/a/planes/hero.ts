/* Hero plane: the name, written into a core plane by row currents.
   On wide screens a real row decoder sits on the plane's left edge. A refresh
   counter (Gray code, so the decoder never glitches) walks the address bus;
   the selected row's AND gate fires and a read current slides along that row. */

import { Plane, InkNudge } from './base'
import { RingField } from '../../core/gl/rings'
import { LineField, K, NetTexture, GateTexture, type Seg } from '../../core/gl/lines'
import { Circuit } from '../../core/sim/circuit'
import { gateOutline } from '../../core/sim/shapes'
import { textCoverage } from '../../core/bitmap'
import { nameLayout, type NameLayout } from '../../core/name'
import { reveal } from '../../core/gl/reveal'
import { SIM_SPEED } from '../../core/motion'

export class HeroPlane extends Plane {
  ring!: RingField
  private layout!: NameLayout
  private wdth = 125
  private rasterW = 125
  private morphTarget = 125
  private inverted = false
  private nudge: InkNudge | null = null
  private liveFrom = Infinity
  private dec: Circuit | null = null
  private decNets: NetTexture | null = null
  private decGates: GateTexture | null = null
  private decSpeed = { value: SIM_SPEED }
  private pads: number[] = []
  private rowGates: number[] = []
  private step = 0
  private nextStep = 0
  private written = false

  build() {
    const r = this.slot('name')
    if (!r) return
    // phones get a finer weave so the surname still reads at condensed width
    const P = this.ctx.mobile ? 5 : this.ctx.pitch
    const cols = Math.max(8, Math.floor(r.w / P))
    const rows = Math.max(6, Math.floor(r.h / P))
    const x0 = r.x + (r.w - (cols - 1) * P) / 2
    const y0 = r.y + (r.h - (rows - 1) * P) / 2
    this.ring = new RingField({
      cols,
      rows,
      pitch: P,
      x0,
      y0,
      planeW: this.ctx.w,
      planeH: this.el.offsetHeight,
      opacity: this.opacity,
      blur: this.blur,
      mouse: this.mouse,
    })
    this.group.add(this.ring.group)
    this.rings.push(this.ring)
    this.layout = nameLayout(cols, rows)
    this.nudge = new InkNudge(this.ring, this.nameInk(this.wdth), { x: 3, y: 2 })
    if (!this.ctx.mobile && x0 > 80) this.buildDecoder(x0, y0, rows, P)
  }

  /** Coverage of the name at a width, as ink (1 = lit). */
  private nameInk(wdth: number) {
    const ink = textCoverage(this.ring.cols, this.ring.rows, this.layout.lines(wdth))
    if (this.inverted) for (let i = 0; i < ink.length; i++) ink[i] = 1 - ink[i]
    return ink
  }

  /* ── decoder ─────────────────────────────────────────────────────── */

  private buildDecoder(x0: number, y0: number, rows: number, P: number) {
    const c = new Circuit(SIM_SPEED)
    const nb = Math.max(1, Math.ceil(Math.log2(rows)))
    const left = x0 - P / 2
    const sb = 5
    const busX = (k: number, inv: boolean) => left - 16 - (nb * 2 - 1) * sb + (k * 2 + (inv ? 1 : 0)) * sb
    const padY = y0 - P * 2.2
    // register outputs Q and Q-bar head each bus line
    for (let k = 0; k < nb; k++) {
      for (const inv of [false, true]) {
        const g = c.add('IN', busX(k, inv), padY, { s: 2.2 })
        this.pads.push(g)
      }
    }
    const gx = left - 8
    const segs: Seg[] = []
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * P
      const g = c.add('AND', gx, y, { n: nb, s: P * 0.3, delay: 0.04 })
      this.rowGates.push(g)
      for (let k = 0; k < nb; k++) {
        const bit = (r >> k) & 1
        const pad = this.pads[k * 2 + (bit ? 0 : 1)]
        const x = busX(k, !bit)
        c.connect(pad, g, k, [{ x, y: padY }, { x, y }])
      }
    }
    // register starts at address 0 (all Q low)
    for (let k = 0; k < nb; k++) {
      c.gates[this.pads[k * 2]].out = false
      c.gates[this.pads[k * 2 + 1]].out = true
    }
    c.settle()
    c.onChange = (g, v, t) => {
      if (!v) return
      const r = this.rowGates.indexOf(g)
      if (r >= 0) this.ring.pulseRow(r, t, 1100, 0.7, 240)
    }

    // custom drawing: bus lines + taps are the nets, the product line is the gate
    const nets = new NetTexture(c)
    const gates = new GateTexture(c)
    const bottom = y0 + (rows - 1) * P + P * 0.6
    for (let k = 0; k < nb; k++) {
      for (const inv of [false, true]) {
        const pad = this.pads[k * 2 + (inv ? 1 : 0)]
        const x = busX(k, inv)
        const net = c.gates[pad].net
        if (net < 0) continue
        const dTop = c.nets[net].branches[0]?.cum[1] ?? 0
        segs.push({ x1: x, y1: padY, x2: x, y2: bottom, d1: dTop, d2: dTop + (bottom - padY), kind: K.Net, index: net, hw: 0.5, cap: 0 })
      }
    }
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * P
      const g = this.rowGates[r]
      const firstBus = busX(0, false) - 2
      segs.push({ x1: firstBus, y1: y, x2: gx - P * 0.3, y2: y, d1: 0, d2: 0, kind: K.Gate, index: g, hw: 0.45, cap: 0 })
      for (let k = 0; k < nb; k++) {
        const bit = (r >> k) & 1
        const pad = this.pads[k * 2 + (bit ? 0 : 1)]
        const net = c.gates[pad].net
        const x = busX(k, !bit)
        const d = Math.abs(c.outPin(pad).x - x) + Math.abs(y - padY)
        segs.push({ x1: x, y1: y, x2: x, y2: y, d1: d, d2: d, kind: K.Net, index: net, hw: 1.25, cap: 1 })
      }
      const ol = gateOutline(c.gates[g], [], null)
      for (const line of ol.body) {
        for (let i = 1; i < line.length; i++) {
          segs.push({ x1: line[i - 1].x, y1: line[i - 1].y, x2: line[i].x, y2: line[i].y, d1: 0, d2: 0, kind: K.Gate, index: g, hw: 0.45, cap: 1 })
        }
      }
      // output lead into the plane's row wire
      segs.push({ x1: gx + P * 0.3, y1: y, x2: left, y2: y, d1: 0, d2: 0, kind: K.Gate, index: g, hw: 0.45, cap: 0 })
    }
    for (const pad of this.pads) {
      const ol = gateOutline(c.gates[pad], [], null)
      for (const line of ol.body) for (let i = 1; i < line.length; i++) segs.push({ x1: line[i - 1].x, y1: line[i - 1].y, x2: line[i].x, y2: line[i].y, d1: 0, d2: 0, kind: K.Gate, index: pad, hw: 0.45, cap: 1 })
      for (const d of ol.dots) segs.push({ x1: d.p.x, y1: d.p.y, x2: d.p.x, y2: d.p.y, d1: 0, d2: 0, kind: K.Gate, index: pad, hw: d.r, cap: 1 })
    }
    const field = new LineField(segs, { nets: nets.texture, gates: gates.texture, speed: this.decSpeed, opacity: this.opacity, blur: this.blur, highK: { value: 0.42 } })
    field.mesh.renderOrder = 1
    this.group.add(field.mesh)
    this.dec = c
    this.decNets = nets
    this.decGates = gates
  }

  preload() {
    if (!this.nudge) return false
    this.ring.setInstant(this.nudge.levels())
    return true
  }

  enter(t: number) {
    if (this.written || !this.nudge) return
    this.written = true
    const bits = this.nudge.levels()
    if (this.ctx.reduced()) this.ring.setInstant(bits)
    else this.liveFrom = reveal(this.ring, bits, t, t + 0.15) + 0.5
    this.nextStep = t + 2.4
  }

  frame(t: number, dt: number, active: boolean) {
    if (!this.ring) return
    // decoder refresh: Gray-code counter, one bit per step
    if (this.dec) {
      if (active && t >= this.nextStep && !this.ctx.reduced()) {
        const nb = this.pads.length / 2
        let g = 0
        do {
          this.step = (this.step + 1) % (1 << nb)
          g = this.step ^ (this.step >> 1)
        } while (g >= this.ring.rows)
        for (let k = 0; k < nb; k++) {
          const bit = ((g >> k) & 1) === 1
          this.dec.set(this.pads[k * 2], bit, t)
          this.dec.set(this.pads[k * 2 + 1], !bit, t)
        }
        this.nextStep = t + 1.5
      }
      this.dec.advance(t)
      this.dec.ease(dt)
      this.decNets!.update()
      this.decGates!.update()
    }
    // the name's width follows the pointer across the whole page; once the
    // first write is done the image also leans toward it
    const diff = this.morphTarget - this.wdth
    this.wdth += diff * (1 - Math.exp(-dt / 0.22))
    if (this.nudge && Math.abs(this.wdth - this.rasterW) >= 1) {
      this.rasterW = Math.round(this.wdth)
      this.nudge.ink = this.nameInk(this.rasterW)
    }
    if (this.nudge && active && t >= this.liveFrom && !this.ctx.reduced()) {
      this.nudge.tick(dt, this.px, this.py, this.pin)
    }
  }

  pointer(x: number, y: number, inside: boolean, t: number) {
    super.pointer(x, y, inside, t)
    if (!inside || this.ctx.reduced()) {
      this.morphTarget = 125
      return
    }
    // absolute: anywhere on the page, left edge = condensed, right edge = extended
    const u = Math.min(1, Math.max(0, x / this.ctx.w))
    this.morphTarget = 78 + u * 47
  }

  press(x: number, y: number, t: number) {
    const r = this.slot('name')
    if (!r || !this.ring) return false
    if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) return false
    this.inverted = !this.inverted
    if (!this.nudge) return true
    this.nudge.ink = this.nameInk(this.rasterW)
    this.ring.wave(this.nudge.levels(), t, x, y, t, 1500, 0.4)
    this.liveFrom = t + 0.9
    return true
  }

  /** Invert everything with a wave from the centre (used by an easter egg). */
  invertAll(t: number) {
    this.inverted = !this.inverted
    if (!this.nudge) return
    this.nudge.ink = this.nameInk(this.rasterW)
    this.ring.wave(this.nudge.levels(), t, this.ring.x0 + (this.ring.cols * this.ring.pitch) / 2, this.ring.y0 + (this.ring.rows * this.ring.pitch) / 2, t, 1200, 0.45)
    this.liveFrom = t + 1
  }
}

/* Skills crossbar: each skill is an input driving a vertical line; each
   project row ORs the skills it was built with. Switch a skill on and the
   signal runs down its line, through the taps, and lights what it built. */

import { Plane } from './base'
import { Circuit } from '../../core/sim/circuit'
import { gateOutline } from '../../core/sim/shapes'
import { LineField, K, NetTexture, GateTexture, type Seg } from '../../core/gl/lines'
import { projects, skills } from '../../content/site'
import { SIM_SPEED } from '../../core/motion'

export class SkillsPlane extends Plane {
  private c: Circuit | null = null
  private nets: NetTexture | null = null
  private gates: GateTexture | null = null
  private ins: number[] = []
  private outs = new Map<number, HTMLElement>()

  build() {
    const slot = this.el.querySelector<HTMLElement>('[data-slot="skills"]')
    const r = this.slot('skills')
    if (!slot || !r) return
    const buttons = [...slot.querySelectorAll<HTMLButtonElement>('.skill')]
    const labels = [...slot.querySelectorAll<HTMLElement>('.skill-outs li')]
    slot.style.setProperty('--n', String(buttons.length))
    const c = new Circuit(SIM_SPEED * 1.6)
    const segs: Seg[] = []
    const rowRects = labels.map((l) => this.rect(l)!)
    const firstRow = rowRects[0]
    const lastRow = rowRects[rowRects.length - 1]
    if (!firstRow || !lastRow) return
    const outsLeft = firstRow.x
    const s = 7
    const gx = outsLeft - 46
    const padYs = buttons.map((b) => {
      const br = this.rect(b)
      return (br?.y ?? r.y) + (br?.h ?? 30) + 12
    })
    const bottom = lastRow.y + lastRow.h / 2 + 12
    const lineX = buttons.map((b) => {
      const br = this.rect(b)!
      return br.x + 6
    })

    this.ins = buttons.map((_, i) => c.add('IN', lineX[i], padYs[i], { s: 4 }))
    const orGates: number[] = []
    projects.forEach((p, j) => {
      const used = skills.map((sk, i) => (sk.projects.includes(p.slug) ? i : -1)).filter((i) => i >= 0)
      const y = rowRects[j].y + rowRects[j].h / 2
      const g = c.add('OR', gx, y, { n: Math.max(1, used.length), s, delay: 0.05 })
      orGates.push(g)
      used.forEach((i, port) => c.connect(this.ins[i], g, port, [{ x: lineX[i], y: padYs[i] }, { x: lineX[i], y }]))
      const led = c.add('OUT', outsLeft - 12, y, { s: 5 })
      c.connect(g, led, 0)
      this.outs.set(led, labels[j])
      // row line: from the leftmost tap to the gate, lit when the OR is high
      if (used.length) {
        const x0 = Math.min(...used.map((i) => lineX[i])) - 2
        segs.push({ x1: x0, y1: y, x2: gx - s, y2: y, d1: 0, d2: 0, kind: K.Gate, index: g, hw: 0.5, cap: 0 })
      }
      used.forEach((i) => {
        const net = c.gates[this.ins[i]].net
        const d = Math.abs(c.outPin(this.ins[i]).x - lineX[i]) + (y - padYs[i])
        segs.push({ x1: lineX[i], y1: y, x2: lineX[i], y2: y, d1: d, d2: d, kind: K.Net, index: net, hw: 2.2, cap: 1 })
      })
    })
    c.settle()

    // skill lines
    this.ins.forEach((g, i) => {
      const net = c.gates[g].net
      const x = lineX[i]
      const dTop = Math.abs(c.outPin(g).x - x)
      const py = padYs[i]
      if (net >= 0) segs.push({ x1: x, y1: py, x2: x, y2: bottom, d1: dTop, d2: dTop + (bottom - py), kind: K.Net, index: net, hw: 0.55, cap: 0 })
      else segs.push({ x1: x, y1: py, x2: x, y2: bottom, d1: 0, d2: 0, kind: K.Faint, index: 0, hw: 0.55, cap: 0 })
      const ol = gateOutline(c.gates[g], [], null)
      ol.body.forEach((l) => l.forEach((p, k) => k && segs.push({ x1: l[k - 1].x, y1: l[k - 1].y, x2: p.x, y2: p.y, d1: 0, d2: 0, kind: K.Gate, index: g, hw: 0.5, cap: 1 })))
      ol.dots.forEach((d) => segs.push({ x1: d.p.x, y1: d.p.y, x2: d.p.x, y2: d.p.y, d1: 0, d2: 0, kind: K.Gate, index: g, hw: d.r, cap: 1 }))
    })
    // OR bodies, output leads, LEDs
    c.gates.forEach((g, gi) => {
      if (g.kind !== 'OR' && g.kind !== 'OUT') return
      const ol = gateOutline(g, [], g.kind === 'OR' ? c.outPin(gi) : null)
      ol.body.forEach((l) => l.forEach((p, k) => k && segs.push({ x1: l[k - 1].x, y1: l[k - 1].y, x2: p.x, y2: p.y, d1: 0, d2: 0, kind: K.Gate, index: gi, hw: 0.5, cap: 1 })))
      ol.dots.forEach((d) => segs.push({ x1: d.p.x, y1: d.p.y, x2: d.p.x, y2: d.p.y, d1: 0, d2: 0, kind: K.Gate, index: gi, hw: d.r, cap: 1 }))
      if (g.kind === 'OR' && g.net >= 0) {
        const a = c.outPin(gi)
        const net = c.nets[g.net]
        const b = net.branches[0]
        if (b) segs.push({ x1: a.x - s * 0.85, y1: a.y, x2: b.pts[b.pts.length - 1].x, y2: a.y, d1: 0, d2: b.length, kind: K.Net, index: g.net, hw: 0.55, cap: 0 })
      }
    })

    c.onChange = (g, v) => {
      const li = this.outs.get(g)
      if (li) li.classList.toggle('on', v)
    }
    this.nets = new NetTexture(c)
    this.gates = new GateTexture(c)
    const field = new LineField(segs, { nets: this.nets.texture, gates: this.gates.texture, speed: { value: c.speed }, opacity: this.opacity, blur: this.blur, faint: { value: 0.6 } })
    this.group.add(field.mesh)
    this.c = c

    buttons.forEach((b, i) => {
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true'
        b.setAttribute('aria-pressed', String(on))
        this.c?.set(this.ins[i], on, this.ctx.stage.now())
      })
    })
  }

  frame(t: number, dt: number) {
    if (!this.c) return
    this.c.advance(t)
    this.c.ease(dt)
    this.nets!.update()
    this.gates!.update()
  }
}

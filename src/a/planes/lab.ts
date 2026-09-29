/* Lab: a four-bit ripple-carry adder you can play. Bit 0 sits on the left so
   the carry flows the way schematics read, left to right. Each full adder is
   two XORs, two ANDs and an OR; the sum settles only after its carry arrives,
   and you can watch that happen. */

import { Plane } from './base'
import { Circuit, type Pt } from '../../core/sim/circuit'
import { LineField, NetTexture, GateTexture, circuitSegs } from '../../core/gl/lines'
import { SegmentDisplay } from '../../core/gl/segments'
import { SIM_SPEED } from '../../core/motion'
import { scan } from '../../core/kinetic'

export class LabPlane extends Plane {
  private c: Circuit | null = null
  private nets: NetTexture | null = null
  private gates: GateTexture | null = null
  private a: number[] = []
  private b: number[] = []
  private sum: number[] = []
  private carry = -1
  private readout: SegmentDisplay | null = null
  private buttons: HTMLButtonElement[] = []

  build() {
    const slotEl = this.el.querySelector<HTMLElement>('[data-slot="adder"]')
    const R = this.slot('adder')
    if (!slotEl || !R) return
    slotEl.querySelectorAll('.adder-in, .adder-label').forEach((n) => n.remove())
    const c = new Circuit(SIM_SPEED * 4.5)
    const cw = R.w / 4.3
    const H = R.h
    const s = Math.max(5.5, Math.min(9, cw * 0.05))
    const yPad = R.y + 34
    const yC = R.y + H * 0.15
    const yOut = R.y + H * 0.74
    const Y = (f: number) => R.y + H * f
    const X = (i: number, f: number) => R.x + i * cw + f * cw

    let cin = c.add('IN', R.x - 6, yC, { s: 3.2 }) // carry into bit 0 is held low
    const PAD = 9
    const LED = 10
    let cinVia: Pt[] = []
    for (let i = 0; i < 4; i++) {
      const A = c.add('IN', X(i, 0.06), yPad, { s: PAD })
      const B = c.add('IN', X(i, 0.17), yPad, { s: PAD })
      this.a.push(A)
      this.b.push(B)
      const x1 = c.add('XOR', X(i, 0.33), Y(0.26), { s })
      const a1 = c.add('AND', X(i, 0.33), Y(0.62), { s })
      const x2 = c.add('XOR', X(i, 0.6), Y(0.3), { s })
      const a2 = c.add('AND', X(i, 0.6), Y(0.46), { s })
      const or = c.add('OR', X(i, 0.8), Y(0.56), { s })
      const xA = X(i, 0.06)
      const xB = X(i, 0.17)
      const xm = X(i, 0.44)
      const xc = X(i, 0.51)
      const pinY = (g: number, port: number) => c.inPin(g, port).y
      c.connect(A, x1, 0, [{ x: xA, y: yPad }, { x: xA, y: pinY(x1, 0) }])
      c.connect(A, a1, 0, [{ x: xA, y: yPad }, { x: xA, y: pinY(a1, 0) }])
      c.connect(B, x1, 1, [{ x: xB, y: yPad }, { x: xB, y: pinY(x1, 1) }])
      c.connect(B, a1, 1, [{ x: xB, y: yPad }, { x: xB, y: pinY(a1, 1) }])
      c.connect(x1, x2, 0, [{ x: xm, y: Y(0.26) }, { x: xm, y: pinY(x2, 0) }])
      c.connect(x1, a2, 0, [{ x: xm, y: Y(0.26) }, { x: xm, y: pinY(a2, 0) }])
      c.connect(cin, x2, 1, [...cinVia, { x: xc, y: yC }, { x: xc, y: pinY(x2, 1) }])
      c.connect(cin, a2, 1, [...cinVia, { x: xc, y: yC }, { x: xc, y: pinY(a2, 1) }])
      c.connect(a2, or, 0, [{ x: X(i, 0.7), y: Y(0.46) }, { x: X(i, 0.7), y: pinY(or, 0) }])
      c.connect(a1, or, 1, [{ x: X(i, 0.72), y: Y(0.62) }, { x: X(i, 0.72), y: pinY(or, 1) }])
      const xs = X(i, 0.97)
      const led = c.add('OUT', xs + 1.1 * LED, yOut, { s: LED })
      c.connect(x2, led, 0, [{ x: xs, y: Y(0.3) }, { x: xs, y: yOut }])
      this.sum.push(led)
      const xo = X(i, 0.92)
      cin = or
      cinVia = [{ x: xo, y: Y(0.56) }, { x: xo, y: yC }]
    }
    const xC = X(4, 0.05)
    this.carry = c.add('OUT', xC + 1.1 * LED, yOut, { s: LED })
    c.connect(cin, this.carry, 0, [...cinVia, { x: xC, y: yC }, { x: xC, y: yOut }])
    c.junctions()
    c.settle()

    this.nets = new NetTexture(c)
    this.gates = new GateTexture(c)
    const field = new LineField(circuitSegs(c, { wire: 0.6, body: 0.65, dot: 2.2 }), {
      nets: this.nets.texture,
      gates: this.gates.texture,
      speed: { value: c.speed },
      opacity: this.opacity,
      blur: this.blur,
    })
    this.group.add(field.mesh)

    // the result sits centred under the circuit
    const cell = Math.max(18, Math.min(30, cw * 0.1))
    const total = 8 * cell + 7 * cell * 0.5
    this.readout = new SegmentDisplay({ x: R.x + (R.w - total) / 2, y: R.y + H - cell * 1.6 - 6, chars: 8, kind: 16, cellW: cell, cellH: cell * 1.6, gap: cell * 0.5, thick: Math.max(2.2, cell * 0.13) })
    this.readout.field.material.uniforms.uOpacity = this.opacity
    this.group.add(this.readout.field.mesh)
    this.c = c
    c.onChange = (g) => {
      if (this.sum.includes(g) || g === this.carry) this.showReadout(this.ctx.stage.now())
    }

    // DOM toggles sit exactly on the input pads
    const place = (g: number, label: string, key: string) => {
      const gate = c.gates[g]
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'adder-in'
      btn.setAttribute('aria-pressed', 'false')
      btn.setAttribute('aria-label', label)
      btn.style.left = `${gate.x - R.x}px`
      btn.style.top = `${gate.y - R.y}px`
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') !== 'true'
        btn.setAttribute('aria-pressed', String(on))
        this.c?.set(g, on, this.ctx.stage.now())
        this.showReadout(this.ctx.stage.now())
      })
      slotEl.appendChild(btn)
      this.buttons.push(btn)
      this.hold(btn)
      const tag = document.createElement('span')
      tag.className = 'adder-label mono'
      tag.textContent = key
      tag.style.left = `${gate.x - R.x}px`
      tag.style.top = `${gate.y - R.y - 42}px`
      slotEl.appendChild(tag)
      this.hold(tag)
    }
    this.a.forEach((g, i) => place(g, `Input A, bit ${i}`, `A${i}`))
    this.b.forEach((g, i) => place(g, `Input B, bit ${i}`, `B${i}`))
    const outTag = (g: number, key: string) => {
      const gate = c.gates[g]
      const tag = document.createElement('span')
      tag.className = 'adder-label mono'
      tag.textContent = key
      tag.style.left = `${gate.x - R.x}px`
      tag.style.top = `${gate.y - R.y + 16}px`
      slotEl.appendChild(tag)
      this.hold(tag)
    }
    this.sum.forEach((g, i) => outTag(g, `S${i}`))
    outTag(this.carry, 'C')
  }

  /** Switches and labels wait, hidden, until the camera has landed. */
  private held: HTMLElement[] = []
  private hold(el: HTMLElement) {
    if (this.ctx.reduced()) return
    el.style.clipPath = 'inset(0 100% 0 0)'
    this.held.push(el)
  }

  private value(gs: number[]) {
    return gs.reduce((v, g, i) => v | ((this.c!.gates[g].out ? 1 : 0) << i), 0)
  }

  private showReadout(t: number) {
    if (!this.c || !this.readout) return
    const a = this.value(this.a)
    const b = this.value(this.b)
    const s = this.value(this.sum) | ((this.c.gates[this.carry].out ? 1 : 0) << 4)
    const p = (n: number) => String(n).padStart(2, '0')
    this.readout.set(`${p(a)}+${p(b)}=${p(s)}`, t, 0.03)
  }

  enter(t: number) {
    this.held.forEach((el, i) => scan(el, 0.05 + i * 0.025))
    this.held = []
    this.showReadout(t)
    // a first sum so the adder isn't idle on arrival: 5 + 3
    if (!this.c || this.ctx.reduced()) return
    const demo: [number[], number][] = [
      [this.a, 5],
      [this.b, 3],
    ]
    demo.forEach(([gs, v], k) =>
      gs.forEach((g, i) => {
        const on = ((v >> i) & 1) === 1
        if (!on) return
        this.c!.set(g, true, t + 0.3 + k * 0.25 + i * 0.08)
        const btn = this.buttons[(k === 0 ? 0 : 4) + i]
        btn?.setAttribute('aria-pressed', 'true')
      }),
    )
  }

  frame(t: number, dt: number) {
    if (!this.c) return
    this.c.advance(t)
    this.c.ease(dt)
    this.nets!.update()
    this.gates!.update()
  }

  /** Easter egg: load two numbers (clamped to 4 bits each). */
  load(a: number, b: number) {
    if (!this.c) return
    const t = this.ctx.stage.now()
    ;[
      [this.a, a],
      [this.b, b],
    ].forEach(([gs, v], k) =>
      (gs as number[]).forEach((g, i) => {
        const on = (((v as number) >> i) & 1) === 1
        this.c!.set(g, on, t + i * 0.05)
        this.buttons[(k === 0 ? 0 : 4) + i]?.setAttribute('aria-pressed', String(on))
      }),
    )
  }
}

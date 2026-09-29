/* Contact: a serial line under the form. Every character you type goes out as
   a real UART frame (start bit, eight data bits LSB first, stop bit) and you
   can watch the bits travel down the wire to the receiver. */

import { Plane } from './base'
import { Circuit } from '../../core/sim/circuit'
import { LineField, NetTexture, GateTexture, circuitSegs } from '../../core/gl/lines'

export class ContactPlane extends Plane {
  private c: Circuit | null = null
  private nets: NetTexture | null = null
  private gates: GateTexture | null = null
  private tx = -1
  private queue: number[] = []
  private busyUntil = 0
  private bitTime = 1 / 16
  private readout: HTMLElement | null = null
  private last = ''

  build() {
    const r = this.slot('uart')
    if (!r) return
    const c = new Circuit(760)
    const y = r.y + Math.min(r.h / 2, 40)
    this.tx = c.add('IN', r.x + 8, y, { s: 5 })
    const rx = c.add('OUT', r.x + r.w - 12, y, { s: 5 })
    c.connect(this.tx, rx, 0)
    c.gates[this.tx].out = true // an idle UART line sits high
    c.settle()
    this.c = c
    this.nets = new NetTexture(c)
    this.gates = new GateTexture(c)
    const field = new LineField(circuitSegs(c, { wire: 0.7, body: 0.6 }), {
      nets: this.nets.texture,
      gates: this.gates.texture,
      speed: { value: c.speed },
      opacity: this.opacity,
      blur: this.blur,
      highK: { value: 0.55 },
    })
    this.group.add(field.mesh)

    const slot = this.el.querySelector<HTMLElement>('[data-slot="uart"]')
    if (slot) {
      this.readout = document.createElement('p')
      this.readout.className = 'uart-readout mono'
      this.readout.setAttribute('aria-hidden', 'true')
      slot.appendChild(this.readout)
    }
    const ta = this.el.querySelector<HTMLTextAreaElement>('[data-uart]')
    ta?.addEventListener('input', () => {
      const v = ta.value
      if (v.length > this.last.length) {
        const added = v.slice(this.last.length).slice(-6)
        for (const ch of added) this.send(ch)
      }
      this.last = v
    })
  }

  /** Queue one character for transmission. */
  send(ch: string) {
    const code = ch.charCodeAt(0) & 0xff
    if (this.queue.length > 12) return
    this.queue.push(code)
  }

  /** Send a string fast (used on submit). */
  burst(text: string) {
    this.bitTime = 1 / 40
    for (const ch of text.slice(0, 14)) this.send(ch)
    window.setTimeout(() => (this.bitTime = 1 / 16), 3000)
  }

  frame(t: number, dt: number) {
    const c = this.c
    if (!c) return
    if (this.queue.length && t >= this.busyUntil && !this.ctx.reduced()) {
      const code = this.queue.shift()!
      const bits = [0, ...Array.from({ length: 8 }, (_, i) => (code >> i) & 1), 1]
      bits.forEach((b, i) => c.set(this.tx, b === 1, t + i * this.bitTime))
      this.busyUntil = t + bits.length * this.bitTime + this.bitTime
      if (this.readout) {
        const ch = code === 32 ? '␠' : String.fromCharCode(code)
        this.readout.textContent = `'${ch}'  0 ${bits.slice(1, 9).join('')} 1`
      }
    }
    c.advance(t)
    c.ease(dt)
    this.nets!.update()
    this.gates!.update()
  }
}

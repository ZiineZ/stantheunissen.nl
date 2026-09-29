/* Index: every entry owns an address byte, stored in eight cores at the start
   of its row. Hovering a row reads it (destructively, like real core memory)
   and writes it straight back. */

import { Plane } from './base'
import type { RingField } from '../../core/gl/rings'
import { addressByte } from '../../core/marks'

interface Word {
  row: HTMLElement
  field: RingField
  bits: Uint8Array
}

export class IndexPlane extends Plane {
  private words: Word[] = []

  build() {
    if (this.ctx.mobile) return
    const P = this.ctx.pitch
    this.el.querySelectorAll<HTMLElement>('.row').forEach((row) => {
      const r = this.rect(row)
      if (!r) return
      const field = this.makeRing({ x: r.x + 2, y: r.y + r.h / 2 - P / 2, w: P * 8, h: P }, P, { frame: false })
      const byte = addressByte(row.dataset.row ?? '')
      const bits = new Uint8Array(8)
      for (let i = 0; i < 8; i++) bits[i] = (byte >> (7 - i)) & 1
      this.words.push({ row, field, bits })
      row.addEventListener('pointerenter', () => this.read(this.words.find((w) => w.row === row)!))
      row.addEventListener('focus', () => this.read(this.words.find((w) => w.row === row)!))
    })
  }

  private read(w: Word) {
    const t = this.ctx.stage.now()
    if (this.ctx.reduced()) return
    w.field.pulseRow(0, t, 900, 1, 70)
    const all = [...w.bits.keys()]
    w.field.set(all.filter((i) => w.bits[i]), 0, t, 0.18)
    window.setTimeout(() => {
      const t2 = this.ctx.stage.now()
      w.field.set(all.filter((i) => w.bits[i]), 1, t2, 0.3)
    }, 170)
  }

  preload() {
    this.words.forEach((w) => w.field.setInstant(w.bits))
    return this.words.length > 0
  }

  enter(t: number) {
    this.words.forEach((w, i) => {
      if (this.ctx.reduced()) w.field.setInstant(w.bits)
      else w.field.sweep(w.bits, t, { t0: t + 0.08 + i * 0.06, speed: 900, stagger: 0, strength: 1, tail: 60 })
    })
  }
}

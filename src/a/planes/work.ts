/* A featured project: its mark stored in a core plane beside the text,
   loaded with a random write and nudged toward the pointer. */

import { Plane, InkNudge } from './base'
import type { RingField } from '../../core/gl/rings'
import { markInk } from '../../core/marks'
import { reveal } from '../../core/gl/reveal'
import { projects } from '../../content/site'

export class WorkPlane extends Plane {
  field: RingField | null = null
  private nudge: InkNudge | null = null
  private liveFrom = Infinity
  private nextRead = 0

  build() {
    const r = this.slot('mark')
    const p = projects.find((q) => q.slug === this.el.dataset.slug)
    if (!r || !p) return
    this.field = this.makeRing(r)
    this.nudge = new InkNudge(this.field, markInk(p.mark, this.field.cols, this.field.rows), { x: 4, y: 3 })
  }

  preload() {
    if (!this.field || !this.nudge) return false
    this.field.setInstant(this.nudge.levels())
    return true
  }

  enter(t: number) {
    if (!this.field || !this.nudge) return
    const bits = this.nudge.levels()
    if (this.ctx.reduced()) this.field.setInstant(bits)
    else this.liveFrom = reveal(this.field, bits, t, t + 0.05) + 0.45
    this.nextRead = t + 2.6
  }

  frame(t: number, dt: number, active: boolean) {
    const f = this.field
    if (!f || !active || this.ctx.reduced()) return
    if (this.nudge && t >= this.liveFrom) this.nudge.tick(dt, this.px, this.py, this.pin)
    if (t < this.nextRead) return
    // quiet refresh: now and then one row is read and restored
    f.pulseRow(Math.floor(Math.random() * f.rows), t, 700, 0.45, 260)
    this.nextRead = t + 2.2 + Math.random() * 2.4
  }
}

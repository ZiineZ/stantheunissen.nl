/* A case study's plane: the project's mark again, as a wide band on top. */

import { Plane, InkNudge } from './base'
import type { RingField } from '../../core/gl/rings'
import { markInk } from '../../core/marks'
import { reveal } from '../../core/gl/reveal'
import { projects } from '../../content/site'

export class CasePlane extends Plane {
  field: RingField | null = null
  private nudge: InkNudge | null = null
  private liveFrom = Infinity

  build() {
    const r = this.slot('mark')
    const p = projects.find((q) => q.slug === this.el.dataset.slug)
    if (!r || !p) return
    this.field = this.makeRing(r)
    this.nudge = new InkNudge(this.field, markInk(p.mark, this.field.cols, this.field.rows), { x: 5, y: 2 })
  }

  enter(t: number) {
    if (!this.field || !this.nudge) return
    const bits = this.nudge.levels()
    if (this.ctx.reduced()) this.field.setInstant(bits)
    else this.liveFrom = reveal(this.field, bits, t, t + 0.05) + 0.4
  }

  frame(t: number, dt: number, active: boolean) {
    if (!this.nudge || !active || this.ctx.reduced() || t < this.liveFrom) return
    this.nudge.tick(dt, this.px, this.py, this.pin)
  }
}

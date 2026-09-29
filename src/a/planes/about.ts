/* About: Stan's portrait stored 1-bit, loaded with a random write and nudged
   toward the pointer. Rewritten when the theme flips, since lit cores mean
   "light" in the dark theme and "ink" in the light one. */

import { Plane, InkNudge } from './base'
import type { RingField } from '../../core/gl/rings'
import { portraitInk } from '../../core/portrait'
import { onTheme } from '../../core/theme'
import { reveal } from '../../core/gl/reveal'

export class AboutPlane extends Plane {
  field: RingField | null = null
  private nudge: InkNudge | null = null
  private liveFrom = Infinity
  private off: (() => void) | null = null

  async build() {
    const r = this.slot('portrait')
    if (!r) return
    // a finer pitch than the rest of the site: a face needs the extra cores
    const P = Math.max(6, Math.round(this.ctx.pitch * 0.8))
    // keep the portrait's proportions: fill the slot height, 4:5
    const h = r.h
    const w = Math.min(r.w, h * 0.82)
    this.field = this.makeRing({ x: r.x + r.w - w, y: r.y, w, h }, P)
    const f = this.field
    this.nudge = new InkNudge(f, await portraitInk(f.cols, f.rows, this.ctx.stage.dark), { x: 4, y: 3 })
    this.off = onTheme(async (dark) => {
      if (!this.nudge) return
      this.nudge.ink = await portraitInk(f.cols, f.rows, dark)
      if (this.ghost) f.setInstant(this.nudge.levels())
      if (!this.entered) return
      const t = this.ctx.stage.now()
      this.liveFrom = f.wave(this.nudge.levels(), t, f.x0 + (f.cols * f.pitch) / 2, f.y0 + f.rows * f.pitch * 0.4, t, 1300, 0.4) + 0.4
    })
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
    else this.liveFrom = reveal(this.field, bits, t, t + 0.1) + 0.4
  }

  frame(t: number, dt: number, active: boolean) {
    if (!this.nudge || !active || this.ctx.reduced() || t < this.liveFrom) return
    this.nudge.tick(dt, this.px, this.py, this.pin)
  }

  dispose() {
    this.off?.()
    super.dispose()
  }
}

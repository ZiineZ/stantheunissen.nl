/* A plane is one section's piece of the memory: whatever GL content lives
   behind that section, laid out in section-local px (y down) from the DOM's
   own slot elements, so layout stays in CSS and GL just follows it. */

import * as THREE from 'three'
import type { Stage } from '../../core/gl/stage'
import { RingField, type RingOpts } from '../../core/gl/rings'
import { shiftLevels } from '../../core/bitmap'

export interface Ctx {
  stage: Stage
  /** viewport size */
  w: number
  h: number
  pitch: number
  mobile: boolean
  reduced: () => boolean
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** How far (in cores, fractional) a plane's picture leans toward the
    pointer. Measured against the plane itself, so moving across it runs the
    full range; beyond its edges the lean holds at `reach`. */
function leanOf(f: RingField, px: number, py: number, inside: boolean, reach: { x: number; y: number }) {
  if (!inside) return [0, 0]
  const hw = ((f.cols - 1) * f.pitch) / 2
  const hh = ((f.rows - 1) * f.pitch) / 2
  const k = (d: number, half: number) => Math.max(-1, Math.min(1, d / Math.max(half, f.pitch * 6)))
  return [k(px - (f.x0 + hw), hw) * reach.x, k(py - (f.y0 + hh), hh) * reach.y]
}

/* A picture that can only move in whole cores (the guestbook's tiles, whose
   cores move with them): it steps one core at a time, 12 steps a second. */
export class Nudge {
  ox = 0
  oy = 0
  private next = 0
  private dirty = false

  constructor(
    readonly field: RingField,
    readonly reach: { x: number; y: number },
    private onDraw: (t: number) => void,
  ) {}

  /** Back to centre; the caller writes the centred picture itself. */
  reset() {
    this.ox = this.oy = 0
    this.dirty = false
  }

  tick(t: number, px: number, py: number, inside: boolean) {
    if (t < this.next) return
    this.next = t + 1 / 12
    const [lx, ly] = leanOf(this.field, px, py, inside, this.reach)
    const sx = Math.sign(Math.round(lx) - this.ox)
    const sy = Math.sign(Math.round(ly) - this.oy)
    if (!sx && !sy && !this.dirty) return
    this.ox += sx
    this.oy += sy
    this.dirty = false
    this.onDraw(t)
  }
}

/* A tone picture (ink, 1 = lit) that leans toward the pointer. The offset
   glides in fractions of a core and the picture is resampled every frame it
   moves, so on the greyscale plane it slides smoothly instead of stepping.
   Nothing moves unless the pointer does. */
export class InkNudge {
  ox = 0
  oy = 0
  private shownX = 0
  private shownY = 0
  private dirty = false
  private out: Float32Array

  constructor(
    readonly field: RingField,
    private src: Float32Array,
    readonly reach: { x: number; y: number },
  ) {
    this.out = new Float32Array(src.length)
  }

  get ink() {
    return this.src
  }

  set ink(v: Float32Array) {
    this.src = v
    this.dirty = true
  }

  /** The centred picture, for the first write. */
  levels() {
    this.ox = this.oy = this.shownX = this.shownY = 0
    this.dirty = false
    return this.src
  }

  tick(dt: number, px: number, py: number, inside: boolean) {
    const f = this.field
    const [lx, ly] = leanOf(f, px, py, inside, this.reach)
    const k = 1 - Math.exp(-dt / 0.2)
    this.ox += (lx - this.ox) * k
    this.oy += (ly - this.oy) * k
    if (!this.dirty && Math.abs(this.ox - this.shownX) < 0.01 && Math.abs(this.oy - this.shownY) < 0.01) return
    this.shownX = this.ox
    this.shownY = this.oy
    this.dirty = false
    f.setInstant(shiftLevels(this.src, f.cols, f.rows, this.ox, this.oy, this.out))
  }
}

export function pitchFor(w: number) {
  return w < 480 ? 7 : w < 900 ? 8 : w < 1300 ? 9 : w < 1900 ? 10 : 12
}

export abstract class Plane {
  readonly group = new THREE.Group()
  readonly opacity = { value: 1 }
  readonly blur = { value: 0 }
  readonly mouse = { value: new THREE.Vector3(-1e4, -1e4, 0) }
  /** last pointer position in section-local px, and whether it is on the page */
  protected px = -1e4
  protected py = -1e4
  protected pin = false
  /** core planes on this plane, whose queued write stages run every frame */
  protected readonly rings: RingField[] = []
  entered = false
  /** its picture is stored but the camera has not landed here yet */
  ghost = false
  /** when the stored picture started clearing */
  clearedAt = -Infinity
  height = 0

  constructor(
    readonly el: HTMLElement,
    readonly ctx: Ctx,
  ) {
    this.height = el.offsetHeight
  }

  abstract build(): void | Promise<void>

  /** Rect of a child element in plane coordinates: x from the viewport's
      left edge (planes span the full width), y from this section's top. */
  rect(target: Element | null): Rect | null {
    if (!target) return null
    const a = this.el.getBoundingClientRect()
    const b = target.getBoundingClientRect()
    if (b.width === 0 && b.height === 0) return null
    return { x: b.left, y: b.top - a.top, w: b.width, h: b.height }
  }

  slot(name: string): Rect | null {
    return this.rect(this.el.querySelector(`[data-slot="${name}"]`))
  }

  /** A core plane filling `r` at `pitch`, centred, sharing this plane's fade/blur/pointer. */
  makeRing(r: Rect, pitch = this.ctx.pitch, extra: Partial<RingOpts> = {}): RingField {
    const cols = Math.max(2, Math.floor(r.w / pitch))
    const rows = Math.max(1, Math.floor(r.h / pitch))
    const f = new RingField({
      cols,
      rows,
      pitch,
      x0: r.x + (r.w - (cols - 1) * pitch) / 2,
      y0: r.y + (r.h - (rows - 1) * pitch) / 2,
      planeW: this.ctx.w,
      planeH: Math.max(this.ctx.h, this.el.offsetHeight),
      opacity: this.opacity,
      blur: this.blur,
      mouse: this.mouse,
      ...extra,
    })
    this.group.add(f.group)
    this.rings.push(f)
    return f
  }

  /** Run queued write stages; called every frame, visible or not. */
  tickRings(t: number) {
    for (const f of this.rings) f.tick(t)
  }

  /** Store the picture instantly, long before the camera arrives, so the
      plane already shows faintly down the stack. True if it wrote one. */
  preload(): boolean {
    return false
  }

  /** Clear the stored picture: in a quick scatter, or at once. */
  clear(t: number, instant = false) {
    this.clearedAt = t
    for (const f of this.rings) {
      if (instant) f.setInstant(new Float32Array(f.cols * f.rows))
      else f.erase(t)
    }
  }

  /** Camera has landed on this plane. */
  enter(_t: number) {}

  /** Camera is leaving. */
  leave(_t: number) {}

  frame(_t: number, _dt: number, _active: boolean) {}

  /** Pointer in section-local px; `inside` false when it left the page. */
  pointer(x: number, y: number, inside: boolean, _t: number) {
    this.mouse.value.set(x, y, inside ? 1 : 0)
    this.px = x
    this.py = y
    this.pin = inside
  }

  /** Primary press at section-local px. Return true if handled. */
  press(_x: number, _y: number, _t: number): boolean {
    return false
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose()
        const m = o.material as THREE.Material | THREE.Material[]
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m.dispose()
      }
    })
  }
}

/* Guestbook: a core plane tiled with 8x8 marks that visitors wrote. New marks
   are written with the same row currents as everything else, and they stay.
   Like every picture on the site, the tiles lean toward the pointer; here the
   tiles themselves move, cores and all, so a mark never splits across a gap.
   The footer's visitor counter is a 7-segment readout that ripples when it
   counts you in. */

import { Plane, Nudge } from './base'
import type { RingField } from '../../core/gl/rings'
import { SegmentDisplay } from '../../core/gl/segments'
import { reveal } from '../../core/gl/reveal'

export interface Mark {
  name: string
  bits: string // 64 chars of 0/1
  at?: string
  pending?: boolean
}

// the first entry: an S, signed by the owner
const OWN: Mark = {
  name: 'Stan · first write',
  bits: ['00111100', '01100110', '01100000', '00111100', '00000110', '01100110', '00111100', '00000000'].join(''),
}

// a tile is 8 cores and a 2-core gutter
const TILE = 10

export class GuestbookPlane extends Plane {
  field: RingField | null = null
  marks: Mark[] = [OWN]
  private tilesX = 0
  private tilesY = 0
  /** top-left core of the tile grid at rest */
  private gx = 0
  private gy = 0
  private nudge: Nudge | null = null
  private liveFrom = Infinity
  private counter: SegmentDisplay | null = null
  private written = false
  onHover: ((m: Mark | null, x: number, y: number) => void) | null = null

  build() {
    const r = this.slot('guestbook')
    if (r) {
      const P = this.ctx.pitch
      const cols = Math.max(2, Math.floor(r.w / P))
      const rows = Math.max(1, Math.floor(r.h / P))
      // keep two spare cores a side so the tiles have room to lean sideways
      this.tilesX = Math.max(1, Math.floor((cols + 2 - 4) / TILE))
      this.tilesY = Math.max(1, Math.floor((rows + 2) / TILE))
      this.gx = Math.floor((cols - (this.tilesX * TILE - 2)) / 2)
      this.gy = Math.floor((rows - (this.tilesY * TILE - 2)) / 2)
      const spare = (lo: number, span: number, n: number) => Math.max(0, Math.min(lo, n - lo - span))
      const reach = {
        x: Math.min(3, spare(this.gx, this.tilesX * TILE - 2, cols)),
        y: Math.min(2, spare(this.gy, this.tilesY * TILE - 2, rows)),
      }
      this.field = this.makeRing(r, P, { mask: this.tileMask(cols, rows, 0, 0) })
      const f = this.field
      this.nudge = new Nudge(f, reach, (t) => {
        f.setMask(this.tileMask(f.cols, f.rows, this.ox, this.oy))
        f.apply(this.layoutBits(), t, 0.16)
      })
    }
    const cr = this.slot('counter')
    if (cr) {
      const cell = cr.h * 0.62
      this.counter = new SegmentDisplay({ x: cr.x, y: cr.y + (cr.h - cell * 1.6) / 2, chars: 6, kind: 7, cellW: cell, cellH: cell * 1.6, gap: cell * 0.45, thick: Math.max(1.6, cell * 0.18) })
      this.counter.field.material.uniforms.uOpacity = this.opacity
      this.group.add(this.counter.field.mesh)
      this.counter.set('------', 0, 0)
    }
  }

  /** where the tile grid starts right now */
  private get ox() {
    return this.gx + (this.nudge?.ox ?? 0)
  }

  private get oy() {
    return this.gy + (this.nudge?.oy ?? 0)
  }

  /** Only the 8x8 tiles get cores; the gutters between them stay empty. */
  private tileMask(cols: number, rows: number, ox: number, oy: number) {
    const mask = new Uint8Array(cols * rows)
    const w = this.tilesX * TILE - 2
    const h = this.tilesY * TILE - 2
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tx = x - ox
        const ty = y - oy
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue
        if (tx % TILE < 8 && ty % TILE < 8) mask[y * cols + x] = 1
      }
    }
    return mask
  }

  capacity() {
    return this.tilesX * this.tilesY
  }

  private layoutBits(): Uint8Array {
    const f = this.field!
    const out = new Uint8Array(f.cols * f.rows)
    const ox = this.ox
    const oy = this.oy
    this.marks.slice(0, this.capacity()).forEach((m, k) => {
      const tx = k % this.tilesX
      const ty = Math.floor(k / this.tilesX)
      for (let i = 0; i < 64; i++) {
        if (m.bits[i] !== '1') continue
        const x = ox + tx * TILE + (i % 8)
        const y = oy + ty * TILE + Math.floor(i / 8)
        out[y * f.cols + x] = 1
      }
    })
    return out
  }

  setMarks(list: Mark[]) {
    this.marks = [OWN, ...list]
    if (this.ghost && this.field) this.field.setInstant(this.layoutBits())
    if (this.written && this.field) {
      const t = this.ctx.stage.now()
      this.liveFrom = this.field.sweep(this.layoutBits(), t, { t0: t, speed: 1800, stagger: 0.01, onlyChanged: true }) + 0.3
    }
  }

  add(m: Mark) {
    this.marks.push(m)
    if (!this.field) return
    const t = this.ctx.stage.now()
    this.liveFrom = this.field.sweep(this.layoutBits(), t, { t0: t, speed: 1400, stagger: 0.02, onlyChanged: true, strength: 1 }) + 0.3
  }

  setCount(n: number) {
    this.counter?.set(String(n).padStart(6, '0'), this.ctx.stage.now() + 0.2, 0.08)
  }

  preload() {
    if (!this.field) return false
    this.field.setInstant(this.layoutBits())
    return true
  }

  enter(t: number) {
    this.written = true
    const f = this.field
    if (!f) return
    this.nudge?.reset()
    f.setMask(this.tileMask(f.cols, f.rows, this.ox, this.oy))
    const bits = this.layoutBits()
    if (this.ctx.reduced()) f.setInstant(bits)
    else this.liveFrom = reveal(f, bits, t, t + 0.05) + 0.4
  }

  frame(t: number, _dt: number, active: boolean) {
    if (!this.nudge || !active || this.ctx.reduced() || t < this.liveFrom) return
    this.nudge.tick(t, this.px, this.py, this.pin)
  }

  pointer(x: number, y: number, inside: boolean, t: number) {
    super.pointer(x, y, inside, t)
    const f = this.field
    if (!f || !this.onHover) return
    const i = inside ? f.cellAt(x, y) : -1
    if (i < 0) return this.onHover(null, x, y)
    const col = i % f.cols - this.ox
    const row = Math.floor(i / f.cols) - this.oy
    const tx = Math.floor(col / TILE)
    const ty = Math.floor(row / TILE)
    const inTile = col >= 0 && row >= 0 && col % TILE < 8 && row % TILE < 8 && tx < this.tilesX && ty < this.tilesY
    const m = inTile ? this.marks[ty * this.tilesX + tx] : undefined
    this.onHover(m ?? null, x, y)
  }
}

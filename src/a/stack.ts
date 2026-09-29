/* The Stack: one memory plane per section, stacked in depth. Native scroll
   (snapping to sections) scrubs a camera forward through the planes; at
   rest the camera sits exactly one "rest distance" in front of the current
   plane, where 1 world unit is 1 CSS px, so GL and DOM line up. */

import * as THREE from 'three'
import type { Stage } from '../core/gl/stage'
import { U } from '../core/gl/palette'
import { Plane, type Ctx, pitchFor } from './planes/base'
import { reducedMotion } from '../core/motion'

export type Factory = (el: HTMLElement, ctx: Ctx) => Plane

const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)
/** how brightly the next plane down the stack shows behind the current one */
const FAINT = 0.1

type Cam = { x: number; y: number; z: number; rx: number; ry: number; rz: number }

/* A camera flight to or from a document, run on the render clock so every
   frame moves by exactly the right amount. */
interface Trip {
  from: Cam
  to: Cam
  t0: number
  dur: number
  side: number
  near?: () => void
  done: () => void
}
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uSize;
varying float vA;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.07 + aSeed * 6.28) * 18.0;
  p.y += cos(uTime * 0.05 + aSeed * 12.1) * 14.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = uSize * (1400.0 / max(d, 1.0));
  vA = smoothstep(80.0, 700.0, d) * (1.0 - smoothstep(4000.0, 9000.0, d));
}
`
const DUST_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uDust;
uniform float uFlight;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = smoothstep(0.5, 0.1, r) * vA * (0.18 + 0.7 * uFlight);
  if (a < 0.01) discard;
  gl_FragColor = vec4(uDust, a);
}
`

export class Stack {
  planes: Plane[] = []
  sections: HTMLElement[] = []
  private tops: number[] = []
  private heights: number[] = []
  private G = 1
  private D = 1
  private cam: Cam = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
  private target: Cam = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
  private trip: Trip | null = null
  private rush = 0
  private active = -1
  private landed = -1
  private pointerX = -1e4
  private pointerY = -1e4
  private pointerIn = false
  private dust: THREE.Points | null = null
  private flight = { value: 0 }
  private builtW = 0
  private builtH = 0
  private building: Promise<void> | null = null
  private first = true
  private mode: 'home' | 'flying' | 'doc' = 'home'
  private doc: Plane | null = null
  private docZ = 0
  onActive: ((i: number, el: HTMLElement) => void) | null = null
  onArrive: ((i: number, el: HTMLElement) => void) | null = null

  constructor(
    readonly stage: Stage,
    private factories: Record<string, Factory>,
    private root: HTMLElement,
  ) {
    stage.onFrame((t, dt) => this.frame(t, dt))
    let timer = 0
    stage.onResize((w, h) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (w !== this.builtW || Math.abs(h - this.builtH) > 150) this.rebuild()
        else this.measure()
      }, 220)
    })
    window.addEventListener('pointermove', (e) => {
      this.pointerX = e.clientX
      this.pointerY = e.clientY
      this.pointerIn = true
    }, { passive: true })
    document.documentElement.addEventListener('pointerleave', () => (this.pointerIn = false))
    window.addEventListener('pointerdown', (e) => this.press(e))
  }

  private ctx(): Ctx {
    const w = this.stage.w
    const h = this.stage.h
    return { stage: this.stage, w, h, pitch: pitchFor(w), mobile: w < 760, reduced: reducedMotion }
  }

  measure() {
    this.tops = this.sections.map((s) => s.offsetTop)
    this.heights = this.sections.map((s) => s.offsetHeight)
  }

  async rebuild() {
    this.planes.forEach((p) => {
      this.stage.scene.remove(p.group)
      p.dispose()
    })
    this.planes = []
    await this.build()
  }

  build(): Promise<void> {
    if (this.building) return this.building
    this.building = (async () => {
      const ctx = this.ctx()
      this.builtW = ctx.w
      this.builtH = ctx.h
      this.sections = [...this.root.querySelectorAll<HTMLElement>('[data-plane]')]
      this.measure()
      this.D = this.stage.restDistance()
      this.G = this.D * 1.3
      const t0 = performance.now()
      for (const el of this.sections) {
        const make = this.factories[el.dataset.plane ?? '']
        const plane = make ? make(el, ctx) : new EmptyPlane(el, ctx)
        const t1 = performance.now()
        await plane.build()
        if (import.meta.env.DEV) console.debug(`plane ${el.id}: ${(performance.now() - t1).toFixed(1)} ms`)
        plane.group.scale.set(1, -1, 1)
        this.stage.scene.add(plane.group)
        this.planes.push(plane)
      }
      if (import.meta.env.DEV) console.debug(`stack built in ${(performance.now() - t0).toFixed(1)} ms`)
      this.layoutPlanes()
      if (!this.dust) this.makeDust()
      this.snapCamera()
      // every plane but the one in view stores its picture now, so the whole
      // stack is already there, faintly, before the camera goes anywhere
      const start = this.solve().i
      this.planes.forEach((p, j) => {
        if (j !== start) p.ghost = p.preload()
      })
      this.active = -1
      this.landed = -1
      this.building = null
    })()
    return this.building
  }

  private layoutPlanes() {
    const { w, h } = this.stage
    this.planes.forEach((p, i) => p.group.position.set(-w / 2, h / 2, -i * this.G))
  }

  private makeDust() {
    const n = this.stage.w < 760 ? 420 : 1500
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    const depth = Math.max(8, this.planes.length + 2) * this.G
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.stage.w * 2.4
      pos[i * 3 + 1] = (Math.random() - 0.5) * this.stage.h * 2.4
      pos[i * 3 + 2] = this.D - Math.random() * depth
      seed[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { uTime: U.uTime, uDust: U.uDust, uFlight: this.flight, uSize: { value: this.stage.w < 760 ? 1.6 : 2.2 } },
    })
    this.dust = new THREE.Points(g, m)
    this.dust.frustumCulled = false
    this.dust.renderOrder = 0
    this.stage.scene.add(this.dust)
  }

  /** where the camera should be for the current scroll position */
  private solve() {
    const y = window.scrollY
    const h = this.stage.h
    let i = 0
    for (let k = 0; k < this.tops.length; k++) if (this.tops[k] <= y + 0.5) i = k
    const inside = Math.max(0, this.heights[i] - h)
    const shift = clamp(y - this.tops[i], 0, inside)
    const f = i < this.planes.length - 1 ? clamp((y - this.tops[i] - inside) / h) : 0
    return { i, f, shift }
  }

  private snapCamera() {
    const s = this.solve()
    this.aim(s.i, s.f, s.shift)
    Object.assign(this.cam, this.target)
    this.applyCamera()
  }

  private aim(i: number, f: number, shift: number) {
    const { w, h } = this.stage
    const reduced = reducedMotion()
    const e = reduced ? (f < 0.5 ? 0 : 1) : smoother(f)
    const wob = reduced ? 0 : Math.sin(Math.PI * f)
    const alt = i % 2 === 0 ? 1 : -1
    this.target.z = -(i + e) * this.G + this.D
    this.target.x = alt * wob * w * 0.06
    this.target.y = -shift - wob * h * 0.07
    this.target.rx = -wob * 0.24
    this.target.ry = alt * wob * 0.06
    this.target.rz = alt * wob * 0.03
  }

  private applyCamera() {
    const c = this.stage.camera
    c.position.set(this.cam.x, this.cam.y, this.cam.z)
    c.rotation.set(this.cam.rx, this.cam.ry, this.cam.rz)
  }

  private frame(t: number, dt: number) {
    if (!this.planes.length) return
    if (this.mode !== 'home') return this.docFrame(t, dt)
    const { i, f, shift } = this.solve()
    this.aim(i, f, shift)
    const k = 1 - Math.exp(-dt / 0.07)
    for (const key of Object.keys(this.cam) as (keyof typeof this.cam)[]) {
      this.cam[key] += (this.target[key] - this.cam[key]) * k
    }
    this.applyCamera()
    this.flight.value = Math.sin(Math.PI * f)

    this.planes.forEach((p, j) => {
      this.look(p, this.cam.z - p.group.position.z)
      // heading for a plane for the first time: clear its stored picture so
      // the landing can load it
      if (p.ghost && Math.abs(j - (i + f)) < 0.97) {
        p.ghost = false
        p.clear(t)
      }
    })

    // activation: the incoming plane takes over past the midpoint of the flight
    const active = f > 0.6 ? i + 1 : i
    if (active !== this.active) {
      if (this.active >= 0) this.planes[this.active]?.leave(t)
      this.active = active
      this.onActive?.(active, this.sections[active])
    }
    const settledFlight = f < 0.02 || f > 0.98
    const landed = f > 0.98 ? i + 1 : i
    if (settledFlight && landed !== this.landed) {
      this.landed = landed
      this.arrive(this.planes[landed], t)
      this.onArrive?.(landed, this.sections[landed])
    }
    if (this.first) {
      this.first = false
      this.arrive(this.planes[active], t)
    }

    // pointer goes to the active plane only while the camera is at rest
    const rest = f < 0.02
    this.planes.forEach((p, j) => {
      if (j === active && rest) p.pointer(this.pointerX, this.pointerY + shift, this.pointerIn, t)
      else p.pointer(-1e4, -1e4, false, t)
      p.tickRings(t)
      p.frame(t, dt, j === active)
    })
  }

  /** First landing on a plane: load its picture. A jump straight onto a
      plane leaves no time to clear it, so it is cleared at once. */
  private arrive(p: Plane | undefined, t: number) {
    if (!p || p.entered) return
    if (t - p.clearedAt < 0.5) p.clear(t, true)
    p.entered = true
    p.enter(t)
  }

  /** Fade and focus by distance in front of the camera. Planes further down
      the stack rest faintly in the distance, so none arrives from nowhere;
      a plane coming past the camera is gone before it fills the view. */
  private look(p: Plane, dz: number, rush = 0) {
    const D = this.D
    let o = 0
    let b = 0
    if (dz >= D) {
      const u = (dz - D) / this.G
      o = u <= 1 ? 1 + (FAINT - 1) * smoothstep(0, 1, u) : FAINT * Math.exp(-0.6 * (u - 1))
      b = Math.min(4.5, u * 2.4)
    } else if (dz > 0) {
      o = smoothstep(0.25 * D, 0.9 * D, dz)
      b = (1 - dz / D) * 1.5
    }
    p.opacity.value = o
    p.blur.value = b + rush
    p.group.visible = o > 0.005
  }

  private press(e: PointerEvent) {
    const el = e.target as HTMLElement
    if (el.closest('a, button, input, textarea, label, select, [data-pad], .palette')) return
    if (this.mode === 'doc') {
      this.doc?.press(e.clientX, e.clientY + window.scrollY, this.stage.now())
      return
    }
    if (this.mode !== 'home') return
    const { i, f, shift } = this.solve()
    if (f > 0.02) return
    this.planes[i]?.press(e.clientX, e.clientY + shift, this.stage.now())
  }

  /* ── documents (case studies, CV, colophon) ─────────────────────────
     A document gets its own plane far behind the stack. Opening one flies the
     camera there; while it is open the plane scrolls with the page. */

  /** Fly to a document's plane behind the stack. `near` runs late in the
      flight, when the document's own text should start to arrive. */
  async openDoc(el: HTMLElement, make?: Factory, near?: () => void) {
    this.closeDocNow()
    // hold the camera from this moment: the home page is about to be hidden
    this.mode = 'flying'
    const ctx = this.ctx()
    const plane = make ? make(el, ctx) : new EmptyPlane(el, ctx)
    await plane.build()
    plane.group.scale.set(1, -1, 1)
    this.docZ = -(this.planes.length + 1.5) * this.G
    plane.group.position.set(-ctx.w / 2, ctx.h / 2, this.docZ)
    this.stage.scene.add(plane.group)
    this.doc = plane
    this.look(plane, this.cam.z - this.docZ)
    await this.fly({ x: 0, y: -window.scrollY, z: this.docZ + this.D, rx: 0, ry: 0, rz: 0 }, near)
    this.mode = 'doc'
    plane.entered = true
    plane.enter(this.stage.now())
  }

  async closeDoc() {
    if (!this.doc) return
    this.measure()
    const { i, f, shift } = this.solve()
    this.aim(i, f, shift)
    this.mode = 'flying'
    await this.fly({ ...this.target })
    this.closeDocNow()
    this.mode = 'home'
    this.landed = -1
  }

  /* An unhurried flight: sine in-out keeps the top speed near 1.6x the
     average, the duration grows with the distance, and the camera banks
     through a shallow arc on the way. */
  private fly(to: Cam, near?: () => void): Promise<void> {
    const dist = Math.abs(to.z - this.cam.z) / this.G
    const dur = reducedMotion() ? 0 : clamp(1.5 + dist * 0.11, 1.6, 3)
    this.trip?.done()
    return new Promise<void>((done) => {
      this.trip = { from: { ...this.cam }, to, t0: this.stage.now(), dur, side: Math.random() < 0.5 ? -1 : 1, near, done }
      if (!dur) this.stepTrip(this.stage.now())
    })
  }

  private stepTrip(t: number) {
    const tr = this.trip
    if (!tr) return
    const k = tr.dur ? clamp((t - tr.t0) / tr.dur) : 1
    const p = 0.5 - 0.5 * Math.cos(Math.PI * k)
    const arc = tr.dur ? Math.sin(Math.PI * p) : 0
    const { w, h } = this.stage
    const { from, to, side } = tr
    const mix = (a: number, b: number) => a + (b - a) * p
    this.cam.x = mix(from.x, to.x) + side * arc * w * 0.07
    this.cam.y = mix(from.y, to.y) - arc * h * 0.04
    this.cam.z = mix(from.z, to.z)
    this.cam.rx = mix(from.rx, to.rx) - arc * 0.1
    this.cam.ry = mix(from.ry, to.ry) + side * arc * 0.05
    this.cam.rz = mix(from.rz, to.rz) + side * arc * 0.035
    this.applyCamera()
    // speed in planes per second: passing planes blur with it, dust brightens
    const v = tr.dur ? ((Math.abs(to.z - from.z) / this.G) * Math.PI * Math.sin(Math.PI * k)) / (2 * tr.dur) : 0
    this.rush = clamp((v - 1.2) * 0.32, 0, 2.2)
    this.flight.value = clamp(v / 5)
    if (tr.near && k >= 0.7) {
      const n = tr.near
      tr.near = undefined
      n()
    }
    if (k >= 1) {
      this.trip = null
      this.rush = 0
      tr.near?.()
      tr.done()
    }
  }

  private closeDocNow() {
    if (!this.doc) return
    this.stage.scene.remove(this.doc.group)
    this.doc.dispose()
    this.doc = null
  }

  private docFrame(t: number, dt: number) {
    if (this.mode === 'flying') this.stepTrip(t)
    if (this.mode === 'doc') {
      this.cam.y = -window.scrollY
      this.applyCamera()
      this.flight.value = 0
    }
    this.planes.forEach((p) => {
      this.look(p, this.cam.z - p.group.position.z, this.rush)
      p.pointer(-1e4, -1e4, false, t)
      p.tickRings(t)
      if (p.group.visible) p.frame(t, dt, false)
    })
    const d = this.doc
    if (d) {
      this.look(d, this.cam.z - this.docZ, this.rush)
      if (this.mode === 'doc') d.pointer(this.pointerX, this.pointerY + window.scrollY, this.pointerIn, t)
      d.tickRings(t)
      d.frame(t, dt, this.mode === 'doc')
    }
  }

  get inDoc() {
    return this.mode !== 'home'
  }

  get docPlane(): Plane | null {
    return this.doc
  }

  plane<T extends Plane>(id: string): T | undefined {
    return this.planes.find((p) => p.el.id === id) as T | undefined
  }
}

class EmptyPlane extends Plane {
  build() {}
}

/* A plane of magnetic cores.

   Every core is an instanced quad that draws a shaded ferrite ring, lit to a
   level between 0 and 1, so the plane shows greyscale: edges anti-alias and
   pictures can move by fractions of a core. A big change (half the range or
   more) turns the ring over around its diagonal like a flip-dot, the new face
   arriving at the edge-on point; a small one fades in place. Changes are
   scheduled on the GPU (from, to, start, duration), so a full-plane write is
   one attribute upload and zero per-frame work on the CPU.

   Row and column drive wires run through the ring holes. A row pulse is a
   current front travelling along the wire; cores warm as it passes. */

import * as THREE from 'three'
import { U } from './palette'
import { LineField, K, type Seg } from './lines'

const VERT = /* glsl */ `
attribute vec3 aCell;
attribute vec4 aFlip;
attribute vec2 aRC;
uniform float uTime;
uniform float uR;
uniform sampler2D uPulse;
uniform vec2 uPlaneSize;
uniform vec3 uMouse;
uniform float uPitch;
varying vec2 vUv;
varying float vS;
varying float vCos;
varying float vHeat;

float spring(float t) {
  if (t <= 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  return 1.0 - exp(-6.5 * t) * cos(9.5 * t);
}
float pulse(vec4 P, float d) {
  if (P.z <= 0.0) return 0.0;
  float pos = (uTime - P.x) * abs(P.y);
  float behind = pos - d;
  if (behind < 0.0) return 0.0;
  return P.z * exp(-behind / max(P.w, 1.0));
}
void main() {
  if (abs(aCell.z) < 0.5) {
    // masked out: no core at this crossing
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  // aFlip: from level, to level, start, duration (negative = always fade)
  float k = (uTime - aFlip.z) / max(abs(aFlip.w), 1e-3);
  float ang = 0.0;
  float lvl;
  if (aFlip.w > 0.0 && abs(aFlip.y - aFlip.x) >= 0.5) {
    // turn over: rest is always face-on, so the half-turn is split at the
    // edge-on point, where the new face takes over
    float h = clamp(spring(k), -0.25, 1.25);
    ang = (h < 0.5 ? h : h - 1.0) * 3.14159265;
    lvl = h < 0.5 ? aFlip.x : aFlip.y;
  } else {
    lvl = mix(aFlip.x, aFlip.y, smoothstep(0.0, 1.0, k));
  }
  vec2 axis = normalize(vec2(1.0, aCell.z));
  vec2 pd = vec2(-axis.y, axis.x);
  vec2 q = position.xy * uR;
  float along = dot(q, axis);
  float perp = dot(q, pd);
  vec3 local = vec3(axis * along + pd * perp * cos(ang), perp * sin(ang));
  vec3 p = vec3(aCell.xy + local.xy, local.z);
  vUv = position.xy;
  vS = clamp(lvl, 0.0, 1.0);
  vCos = cos(ang);

  vec4 R = texelFetch(uPulse, ivec2(int(aRC.x + 0.5), 0), 0);
  vec4 C = texelFetch(uPulse, ivec2(int(aRC.y + 0.5), 1), 0);
  float heat = pulse(R, R.y >= 0.0 ? aCell.x : uPlaneSize.x - aCell.x)
             + pulse(C, C.y >= 0.0 ? aCell.y : uPlaneSize.y - aCell.y);
  vec2 dm = aCell.xy - uMouse.xy;
  float spot = exp(-dot(dm, dm) / (2.0 * pow(uPitch * 2.4, 2.0)));
  float cross = exp(-abs(dm.y) / (uPitch * 0.55)) * exp(-abs(dm.x) / 150.0)
              + exp(-abs(dm.x) / (uPitch * 0.55)) * exp(-abs(dm.y) / 150.0);
  vHeat = heat + (spot * 0.4 + cross * 0.28) * uMouse.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uRingOff;
uniform vec3 uRingOn;
uniform vec3 uSignal;
uniform vec3 uRim;
uniform float uInner;
uniform float uBlur;
uniform float uOpacity;
uniform float uGlow;
uniform float uSpec;
varying vec2 vUv;
varying float vS;
varying float vCos;
varying float vHeat;
void main() {
  float r = length(vUv);
  float mid = (1.0 + uInner) * 0.5;
  float hw = (1.0 - uInner) * 0.5;
  float dist = abs(r - mid) - hw;
  float w = fwidth(dist) + uBlur;
  float a = clamp(0.5 - dist / max(w, 1e-4), 0.0, 1.0);
  if (a <= 0.002) discard;
  float qn = clamp((r - mid) / hw, -1.0, 1.0);
  vec2 dir = r > 1e-4 ? vUv / r : vec2(0.0);
  vec3 n = normalize(vec3(dir * qn * 0.85, sqrt(max(1.0 - qn * qn, 0.0)) + 0.2));
  vec3 L = normalize(vec3(-0.5, -0.6, 0.65));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 20.0);
  vec3 base = mix(uRingOff, uRingOn, vS);
  vec3 col = base * (0.7 + 0.42 * diff) + uRim * spec * uSpec * mix(1.0, 0.5, vS);
  col *= mix(0.5, 1.0, abs(vCos));
  float h = clamp(vHeat, 0.0, 1.4);
  col = mix(col, uSignal * (1.0 + uGlow * 0.9 * max(h - 0.5, 0.0)), clamp(h, 0.0, 1.0) * 0.82);
  gl_FragColor = vec4(col, a * uOpacity);
}
`

export interface RingOpts {
  cols: number
  rows: number
  pitch: number
  /** plane-local px of the centre of cell (0, 0) */
  x0: number
  y0: number
  planeW: number
  planeH: number
  radius?: number
  inner?: number
  wires?: boolean
  /** draw the plane's frame with corner ticks */
  frame?: boolean
  /** 1 where a core exists; 0 leaves the crossing empty */
  mask?: Uint8Array
  opacity?: { value: number }
  blur?: { value: number }
  mouse?: { value: THREE.Vector3 }
}

export interface SweepOpts {
  t0: number
  /** px per second the row current travels */
  speed?: number
  /** seconds between successive rows starting */
  stagger?: number
  dir?: 1 | -1
  order?: 'down' | 'up' | 'center'
  strength?: number
  tail?: number
  dur?: number
  /** only pulse rows that actually change */
  onlyChanged?: boolean
}

const spring = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-6.5 * t) * Math.cos(9.5 * t))
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
/** levels closer than this are the same */
const EPS = 1 / 512

export class RingField {
  readonly group = new THREE.Group()
  readonly cols: number
  readonly rows: number
  readonly pitch: number
  readonly x0: number
  readonly y0: number
  readonly planeW: number
  readonly planeH: number
  /** what each core shows once every scheduled change has landed, 0..1 */
  levels: Float32Array
  readonly pulseTex: THREE.DataTexture
  readonly mouse: { value: THREE.Vector3 }
  readonly material: THREE.ShaderMaterial
  readonly wires: LineField | null
  private flip: Float32Array
  private flipAttr: THREE.InstancedBufferAttribute
  private cellAttr: THREE.InstancedBufferAttribute
  private pulseData: Float32Array
  private pw: number

  constructor(o: RingOpts) {
    this.cols = o.cols
    this.rows = o.rows
    this.pitch = o.pitch
    this.x0 = o.x0
    this.y0 = o.y0
    this.planeW = o.planeW
    this.planeH = o.planeH
    const n = o.cols * o.rows
    this.levels = new Float32Array(n)
    this.mouse = o.mouse ?? { value: new THREE.Vector3(-1e4, -1e4, 0) }

    this.pw = Math.max(o.cols, o.rows, 1)
    this.pulseData = new Float32Array(this.pw * 2 * 4)
    this.pulseTex = new THREE.DataTexture(this.pulseData, this.pw, 2, THREE.RGBAFormat, THREE.FloatType)
    this.pulseTex.minFilter = this.pulseTex.magFilter = THREE.NearestFilter
    this.pulseTex.needsUpdate = true

    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3))
    g.setIndex([0, 1, 2, 2, 1, 3])
    const cell = new Float32Array(n * 3)
    const rc = new Float32Array(n * 2)
    this.flip = new Float32Array(n * 4)
    for (let r = 0; r < o.rows; r++) {
      for (let c = 0; c < o.cols; c++) {
        const i = r * o.cols + c
        cell[i * 3] = o.x0 + c * o.pitch
        cell[i * 3 + 1] = o.y0 + r * o.pitch
        cell[i * 3 + 2] = o.mask && !o.mask[i] ? 0 : (r + c) % 2 === 0 ? 1 : -1
        rc[i * 2] = r
        rc[i * 2 + 1] = c
        this.flip.set([0, 0, -100, 0.4], i * 4)
      }
    }
    this.cellAttr = new THREE.InstancedBufferAttribute(cell, 3)
    g.setAttribute('aCell', this.cellAttr)
    g.setAttribute('aRC', new THREE.InstancedBufferAttribute(rc, 2))
    this.flipAttr = new THREE.InstancedBufferAttribute(this.flip, 4)
    this.flipAttr.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aFlip', this.flipAttr)
    g.instanceCount = n

    const planeSize = new THREE.Vector2(o.planeW, o.planeH)
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: U.uTime,
        uRingOff: U.uRingOff,
        uRingOn: U.uRingOn,
        uSignal: U.uSignal,
        uRim: U.uRim,
        uGlow: U.uGlow,
        uSpec: U.uSpec,
        uR: { value: o.radius ?? o.pitch * 0.42 },
        uInner: { value: o.inner ?? 0.44 },
        uPitch: { value: o.pitch },
        uBlur: o.blur ?? { value: 0 },
        uOpacity: o.opacity ?? { value: 1 },
        uPulse: { value: this.pulseTex },
        uPlaneSize: { value: planeSize },
        uMouse: this.mouse,
      },
    })
    const cores = new THREE.Mesh(g, this.material)
    cores.frustumCulled = false
    cores.renderOrder = 2

    if (o.wires !== false) {
      const segs: Seg[] = []
      const left = o.x0 - o.pitch * 0.5
      const right = o.x0 + (o.cols - 0.5) * o.pitch
      const top = o.y0 - o.pitch * 0.5
      const bottom = o.y0 + (o.rows - 0.5) * o.pitch
      for (let r = 0; r < o.rows; r++) {
        const y = o.y0 + r * o.pitch
        segs.push({ x1: left, y1: y, x2: right, y2: y, d1: 0, d2: 0, kind: K.Row, index: r, hw: 0.32, cap: 0 })
      }
      for (let c = 0; c < o.cols; c++) {
        const x = o.x0 + c * o.pitch
        segs.push({ x1: x, y1: top, x2: x, y2: bottom, d1: 0, d2: 0, kind: K.Col, index: c, hw: 0.32, cap: 0 })
      }
      if (o.frame !== false) {
        // the plane's frame, a hair outside the grid, with registration ticks
        const m = o.pitch * 0.9
        const L = left - m
        const R = right + m
        const T = top - m
        const B = bottom + m
        const line = (x1: number, y1: number, x2: number, y2: number, hw = 0.45) => segs.push({ x1, y1, x2, y2, d1: 0, d2: 0, kind: K.Static, index: 0, hw, cap: 0 })
        line(L, T, R, T)
        line(R, T, R, B)
        line(R, B, L, B)
        line(L, B, L, T)
        const k = Math.max(6, o.pitch * 0.9)
        for (const [x, y, dx, dy] of [[L, T, -1, -1], [R, T, 1, -1], [R, B, 1, 1], [L, B, -1, 1]] as const) {
          line(x, y, x + dx * k, y, 0.45)
          line(x, y, x, y + dy * k, 0.45)
        }
      }
      this.wires = new LineField(segs, { pulse: this.pulseTex, planeSize, mouse: this.mouse, opacity: o.opacity, blur: o.blur })
      this.wires.mesh.renderOrder = 1
      this.group.add(this.wires.mesh)
    } else {
      this.wires = null
    }
    this.group.add(cores)
  }

  index(r: number, c: number) {
    return r * this.cols + c
  }

  /** Cell under a plane-local point, or -1. */
  cellAt(x: number, y: number): number {
    const c = Math.round((x - this.x0) / this.pitch)
    const r = Math.round((y - this.y0) / this.pitch)
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1
    return this.index(r, c)
  }

  /** Level a core shows at time t (matches the shader). */
  levelAt(i: number, t: number) {
    const f = this.flip
    const from = f[i * 4]
    const to = f[i * 4 + 1]
    const dur = f[i * 4 + 3]
    const k = (t - f[i * 4 + 2]) / Math.max(Math.abs(dur), 1e-3)
    if (dur > 0 && Math.abs(to - from) >= 0.5) return Math.min(1.25, spring(k)) < 0.5 ? from : to
    return from + (to - from) * smooth(k)
  }

  /* ── choreography ────────────────────────────────────────────────
     A core holds one pending flip on the GPU. Writes that need several
     stages (noise first, then the picture) queue their later stages here,
     and the plane runs them from its frame loop. */

  private jobs: { t: number; run: (now: number) => void }[] = []

  /** Run `fn` once the clock reaches `t`. */
  at(t: number, fn: (now: number) => void) {
    this.jobs.push({ t, run: fn })
  }

  /** Drop queued stages (a newer write takes over). */
  cancel() {
    this.jobs.length = 0
  }

  tick(now: number) {
    if (!this.jobs.length) return
    const due = this.jobs.filter((j) => j.t <= now).sort((a, b) => a.t - b.t)
    if (!due.length) return
    this.jobs = this.jobs.filter((j) => j.t > now)
    for (const j of due) j.run(now)
  }

  /** Schedule one core to change to level `v` at `t0` (call commit() after a batch). */
  flipAt(i: number, v: number, t0: number, dur: number, now: number) {
    this.setFlip(i, v, t0, dur, now)
    this.levels[i] = v
  }

  /** Upload a batch of flipAt() calls. */
  commit() {
    this.flipAttr.clearUpdateRanges()
    this.flipAttr.needsUpdate = true
  }

  private setFlip(i: number, to: number, t0: number, dur: number, now: number) {
    const f = this.flip
    const from = Math.min(1, Math.max(0, this.levelAt(i, Math.min(now, t0))))
    f[i * 4] = from
    f[i * 4 + 1] = to
    f[i * 4 + 2] = t0
    f[i * 4 + 3] = dur
  }

  pulseRow(r: number, t0: number, speed: number, strength = 1, tail = 140) {
    this.pulseData.set([t0, speed, strength, tail], r * 4)
    this.pulseTex.needsUpdate = true
  }

  pulseCol(c: number, t0: number, speed: number, strength = 1, tail = 140) {
    this.pulseData.set([t0, speed, strength, tail], (this.pw + c) * 4)
    this.pulseTex.needsUpdate = true
  }

  /** Change which crossings hold a core (1 = present). */
  setMask(mask: Uint8Array) {
    const a = this.cellAttr.array as Float32Array
    for (let i = 0; i < mask.length; i++) {
      const r = Math.floor(i / this.cols)
      a[i * 3 + 2] = mask[i] ? ((r + (i % this.cols)) % 2 === 0 ? 1 : -1) : 0
    }
    this.cellAttr.needsUpdate = true
  }

  /** Show levels at once (no animation). */
  setInstant(next: ArrayLike<number>) {
    this.cancel()
    const f = this.flip
    for (let i = 0; i < this.levels.length; i++) {
      const v = next[i]
      this.levels[i] = v
      f[i * 4] = v
      f[i * 4 + 1] = v
      f[i * 4 + 2] = -100
      f[i * 4 + 3] = 0.4
    }
    this.flipAttr.clearUpdateRanges()
    this.flipAttr.needsUpdate = true
  }

  /** Write `next` with visible row currents sweeping the plane. Returns the time the last flip starts. */
  sweep(next: ArrayLike<number>, now: number, o: SweepOpts): number {
    this.cancel()
    const speed = o.speed ?? 2600
    const stagger = o.stagger ?? 0.012
    const dir = o.dir ?? 1
    const dur = o.dur ?? 0.42
    let last = o.t0
    for (let r = 0; r < this.rows; r++) {
      const order = o.order === 'up' ? this.rows - 1 - r : o.order === 'center' ? Math.abs(r - (this.rows - 1) / 2) * 2 : r
      const rowStart = o.t0 + order * stagger
      let changed = false
      for (let c = 0; c < this.cols; c++) {
        const i = this.index(r, c)
        const v = next[i]
        if (Math.abs(v - this.levels[i]) < EPS) continue
        changed = true
        const x = this.x0 + c * this.pitch
        const d = dir > 0 ? x : this.planeW - x
        const t = rowStart + d / speed
        this.setFlip(i, v, t, dur, now)
        this.levels[i] = v
        last = Math.max(last, t)
      }
      if (changed || !o.onlyChanged) this.pulseRow(r, rowStart, speed * dir, o.strength ?? 0.9, o.tail ?? 120)
    }
    this.flipAttr.clearUpdateRanges()
    this.flipAttr.needsUpdate = true
    return last
  }

  /** Radial write from a point: cores flip as a circular front passes them. */
  wave(next: ArrayLike<number>, now: number, cx: number, cy: number, t0: number, speed = 900, dur = 0.4): number {
    this.cancel()
    let last = t0
    for (let i = 0; i < this.levels.length; i++) {
      const v = next[i]
      if (Math.abs(v - this.levels[i]) < EPS) continue
      const r = Math.floor(i / this.cols)
      const c = i % this.cols
      const d = Math.hypot(this.x0 + c * this.pitch - cx, this.y0 + r * this.pitch - cy)
      const t = t0 + d / speed
      this.setFlip(i, v, t, dur, now)
      this.levels[i] = v
      last = Math.max(last, t)
    }
    this.flipAttr.clearUpdateRanges()
    this.flipAttr.needsUpdate = true
    return last
  }

  /** Apply a whole new picture with quick changes (no currents). Returns cores changed. */
  apply(next: ArrayLike<number>, now: number, dur = 0.16): number {
    this.cancel()
    let n = 0
    for (let i = 0; i < next.length; i++) {
      const v = next[i]
      if (Math.abs(v - this.levels[i]) < EPS) continue
      this.setFlip(i, v, now, dur, now)
      this.levels[i] = v
      n++
    }
    if (n) {
      this.flipAttr.clearUpdateRanges()
      this.flipAttr.needsUpdate = true
    }
    return n
  }

  /** Clear the plane in a quick random scatter. */
  erase(now: number, spread = 0.3, dur = 0.14) {
    this.cancel()
    for (let i = 0; i < this.levels.length; i++) if (this.levels[i] > EPS) this.flipAt(i, 0, now + Math.random() * spread, dur, now)
    this.commit()
  }

  /** Change individual cores now (pointer writes). */
  set(indices: number[], v: number, now: number, dur = 0.35) {
    for (const i of indices) {
      if (Math.abs(this.levels[i] - v) < EPS) continue
      this.setFlip(i, v, now, dur, now)
      this.levels[i] = v
      this.flipAttr.addUpdateRange(i * 4, 4)
    }
    this.flipAttr.needsUpdate = true
  }

  dispose() {
    this.cancel()
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    })
    this.pulseTex.dispose()
  }
}

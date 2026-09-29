/* Instanced line segments with analytic anti-aliasing.

   One quad per segment, expanded in the vertex shader. The fragment shader
   evaluates a signed distance (butt, round or pointed cap) and colours the
   segment by what it carries:
     Net  - the live value of a circuit net at this distance from its driver
     Gate - the eased output glow of a gate (IEEE body outlines)
     Row / Col - the drive current pulsing along a core-memory row or column
     Seg  - a display segment (7/16-segment readouts), lit with a spring
   Plane-local coordinates, y down, 1 unit = 1 CSS px at rest. */

import * as THREE from 'three'
import { U } from './palette'
import type { Circuit, Pt } from '../sim/circuit'
import { gateOutline } from '../sim/shapes'

export const K = { Static: 0, Net: 1, Gate: 2, Row: 3, Col: 4, Seg: 5, Faint: 6 } as const

export interface Seg {
  x1: number
  y1: number
  x2: number
  y2: number
  d1: number
  d2: number
  kind: number
  index: number
  hw: number
  cap: 0 | 1 | 2
}

export const MAX_FRONTS = 12
const NET_TEXELS = 1 + MAX_FRONTS / 2

const VERT = /* glsl */ `
attribute vec4 aSeg;
attribute vec2 aDist;
attribute vec4 aMeta;
attribute vec3 aLit;
uniform float uAA;
varying vec2 vLocal;
varying float vLen;
varying float vHalfW;
varying float vCap;
varying float vKind;
varying float vIndex;
varying float vD;
varying vec3 vLit;
varying vec2 vPos;
void main() {
  vec2 p1 = aSeg.xy;
  vec2 p2 = aSeg.zw;
  vec2 dd = p2 - p1;
  float len = length(dd);
  vec2 t = len > 1e-4 ? dd / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float hw = aMeta.z;
  float pad = hw + uAA;
  float along = mix(-pad, len + pad, position.x);
  float across = position.y * pad;
  vec2 p = p1 + t * along + n * across;
  vLocal = vec2(along, across);
  vLen = len;
  vHalfW = hw;
  vCap = aMeta.w;
  vKind = aMeta.x;
  vIndex = aMeta.y;
  vD = mix(aDist.x, aDist.y, len > 1e-4 ? clamp(along / len, 0.0, 1.0) : 0.0);
  vLit = aLit;
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
}
`

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform float uTime;
uniform float uSpeed;
uniform float uOpacity;
uniform float uBlur;
uniform float uHigh;
uniform float uGlow;
uniform vec3 uLine;
uniform vec3 uLineHi;
uniform vec3 uSignal;
uniform vec3 uSegOff;
uniform vec3 uSegOn;
uniform sampler2D uNets;
uniform sampler2D uGates;
uniform sampler2D uPulse;
uniform vec2 uPlaneSize;
uniform vec3 uMouse;
uniform float uFaint;
uniform float uHighK;
varying vec2 vLocal;
varying float vLen;
varying float vHalfW;
varying float vCap;
varying float vKind;
varying float vIndex;
varying float vD;
varying vec3 vLit;
varying vec2 vPos;

float spring(float t) {
  if (t <= 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  return 1.0 - exp(-6.0 * t) * cos(8.0 * t);
}

// value of a net at distance d from its driver: settled level + comet head
vec2 netLevel(int idx, float d) {
  vec4 h = texelFetch(uNets, ivec2(0, idx), 0);
  float value = h.x;
  int count = int(h.y + 0.5);
  float head = 0.0;
  float drain = 0.0;
  for (int k = ${MAX_FRONTS - 1}; k >= 0; k--) {
    if (k >= count) continue;
    vec4 f = texelFetch(uNets, ivec2(1 + k / 2, idx), 0);
    bool even = (k - (k / 2) * 2) == 0;
    float ft = even ? f.x : f.z;
    float fv = even ? f.y : f.w;
    float pos = (uTime - ft) * uSpeed;
    if (pos >= d) {
      value = fv;
      float behind = pos - d;
      if (fv > 0.5) head = clamp(1.0 - behind / 110.0, 0.0, 1.0);
      else drain = clamp(1.0 - behind / 70.0, 0.0, 1.0);
      break;
    }
  }
  return vec2((value * uHigh + drain * uHigh * 0.5) * uHighK, head);
}

float pulse(vec4 P, float d) {
  if (P.z <= 0.0) return 0.0;
  float pos = (uTime - P.x) * abs(P.y);
  float behind = pos - d;
  if (behind < 0.0) return 0.0;
  return P.z * exp(-behind / max(P.w, 1.0));
}

float sd() {
  float along = vLocal.x;
  float across = vLocal.y;
  if (vCap < 0.5) return max(abs(across) - vHalfW, max(-along, along - vLen));
  if (vCap < 1.5) {
    float a = clamp(along, 0.0, vLen);
    return length(vec2(along - a, across)) - vHalfW;
  }
  return max(abs(across) - vHalfW, abs(along - vLen * 0.5) - vLen * 0.5 + abs(across));
}

void main() {
  float dist = sd();
  float w = fwidth(dist) + uBlur;
  float alpha = clamp(0.5 - dist / max(w, 1e-4), 0.0, 1.0);
  if (alpha <= 0.002) discard;

  int kind = int(vKind + 0.5);
  int idx = int(vIndex + 0.5);
  vec3 col = kind == 0 ? uLineHi : uLine;
  float lvl = 0.0;
  float head = 0.0;

  if (kind == 1) {
    if (vLen < 0.01) col = uLineHi; // junction and tap dots read even when low
    vec2 nl = netLevel(idx, vD);
    lvl = nl.x;
    head = nl.y;
  } else if (kind == 2) {
    float g = texelFetch(uGates, ivec2(idx - (idx / 256) * 256, idx / 256), 0).r;
    col = uLineHi;
    lvl = g * uHigh * uHighK;
  } else if (kind == 3 || kind == 4) {
    bool row = kind == 3;
    vec4 P = texelFetch(uPulse, ivec2(idx, row ? 0 : 1), 0);
    float coord = row ? vPos.x : vPos.y;
    float span = row ? uPlaneSize.x : uPlaneSize.y;
    float d = P.y >= 0.0 ? coord : span - coord;
    head = pulse(P, d);
    // half-current near the pointer
    float lineC = row ? vPos.y : vPos.x;
    float mC = row ? uMouse.y : uMouse.x;
    float mA = row ? uMouse.x : uMouse.y;
    float along = row ? vPos.x : vPos.y;
    float halfI = exp(-abs(lineC - mC) / 7.0) * exp(-abs(along - mA) / 150.0) * uMouse.z;
    lvl = clamp(head * 0.9 + halfI * 0.55, 0.0, 1.0);
    head = clamp(head, 0.0, 1.0);
  } else if (kind == 5) {
    float s = mix(vLit.x, vLit.y, spring((uTime - vLit.z) / 0.35));
    col = mix(uSegOff, uSegOn, clamp(s, 0.0, 1.0));
    head = clamp(s, 0.0, 1.0) * 0.6;
  } else if (kind == 6) {
    alpha *= uFaint;
  }

  vec3 lit = uSignal * (1.0 + uGlow * 0.9 * head);
  col = kind == 5 ? col * (1.0 + uGlow * 0.8 * head) : mix(col, lit, clamp(max(lvl, head), 0.0, 1.0));
  gl_FragColor = vec4(col, alpha * uOpacity);
}
`

let dummyTex: THREE.DataTexture | null = null
function dummy() {
  if (!dummyTex) {
    dummyTex = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType)
    dummyTex.needsUpdate = true
  }
  return dummyTex
}

export interface LineOpts {
  nets?: THREE.DataTexture
  gates?: THREE.DataTexture
  pulse?: THREE.DataTexture
  planeSize?: THREE.Vector2
  mouse?: { value: THREE.Vector3 }
  speed?: { value: number }
  opacity?: { value: number }
  blur?: { value: number }
  faint?: { value: number }
  /** scales the settled HIGH level (dense logic reads calmer below 1) */
  highK?: { value: number }
}

export class LineField {
  readonly mesh: THREE.Mesh
  readonly material: THREE.ShaderMaterial
  readonly geometry: THREE.InstancedBufferGeometry
  private litAttr: THREE.InstancedBufferAttribute
  readonly count: number

  constructor(segs: Seg[], o: LineOpts = {}) {
    const n = Math.max(1, segs.length)
    this.count = segs.length
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3))
    g.setIndex([0, 1, 2, 2, 1, 3])
    const seg = new Float32Array(n * 4)
    const dist = new Float32Array(n * 2)
    const meta = new Float32Array(n * 4)
    const lit = new Float32Array(n * 3)
    segs.forEach((s, i) => {
      seg.set([s.x1, s.y1, s.x2, s.y2], i * 4)
      dist.set([s.d1, s.d2], i * 2)
      meta.set([s.kind, s.index, s.hw, s.cap], i * 4)
      lit.set([0, 0, -1], i * 3)
    })
    g.setAttribute('aSeg', new THREE.InstancedBufferAttribute(seg, 4))
    g.setAttribute('aDist', new THREE.InstancedBufferAttribute(dist, 2))
    g.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 4))
    this.litAttr = new THREE.InstancedBufferAttribute(lit, 3)
    this.litAttr.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aLit', this.litAttr)
    g.instanceCount = segs.length
    this.geometry = g

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: U.uTime,
        uHigh: U.uHigh,
        uGlow: U.uGlow,
        uLine: U.uLine,
        uLineHi: U.uLineHi,
        uSignal: U.uSignal,
        uSegOff: U.uSegOff,
        uSegOn: U.uSegOn,
        uSpeed: o.speed ?? { value: 320 },
        uOpacity: o.opacity ?? { value: 1 },
        uBlur: o.blur ?? { value: 0 },
        uFaint: o.faint ?? { value: 0.5 },
        uHighK: o.highK ?? { value: 1 },
        uAA: { value: 1.5 },
        uNets: { value: o.nets ?? dummy() },
        uGates: { value: o.gates ?? dummy() },
        uPulse: { value: o.pulse ?? dummy() },
        uPlaneSize: { value: o.planeSize ?? new THREE.Vector2(1, 1) },
        uMouse: o.mouse ?? { value: new THREE.Vector3(0, 0, 0) },
      },
    })
    this.mesh = new THREE.Mesh(g, this.material)
    this.mesh.frustumCulled = false
  }

  /** Spring a display segment toward lit (1) or dark (0), starting at t0 (seconds). */
  setLit(i: number, to: number, t0: number, from?: number) {
    const a = this.litAttr.array as Float32Array
    const cur = from ?? a[i * 3 + 1]
    a[i * 3] = cur
    a[i * 3 + 1] = to
    a[i * 3 + 2] = t0
    this.litAttr.addUpdateRange(i * 3, 3)
    this.litAttr.needsUpdate = true
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/* ── circuit → segments ─────────────────────────────────────────────── */

type Intervals = Map<string, [number, number][]>

function uncovered(list: [number, number][], a: number, b: number): [number, number][] {
  let pieces: [number, number][] = [[a, b]]
  for (const [c0, c1] of list) {
    const next: [number, number][] = []
    for (const [p0, p1] of pieces) {
      if (c1 <= p0 + 0.01 || c0 >= p1 - 0.01) {
        next.push([p0, p1])
        continue
      }
      if (c0 > p0) next.push([p0, c0])
      if (c1 < p1) next.push([c1, p1])
    }
    pieces = next
  }
  return pieces.filter(([p0, p1]) => p1 - p0 > 0.05)
}

/** Distance along a net to the point `p` (first branch that passes through it). */
export function distanceOnNet(c: Circuit, net: number, p: Pt): number {
  for (const b of c.nets[net].branches) {
    for (let i = 1; i < b.pts.length; i++) {
      const a = b.pts[i - 1]
      const q = b.pts[i]
      const minx = Math.min(a.x, q.x) - 0.5
      const maxx = Math.max(a.x, q.x) + 0.5
      const miny = Math.min(a.y, q.y) - 0.5
      const maxy = Math.max(a.y, q.y) + 0.5
      if (p.x < minx || p.x > maxx || p.y < miny || p.y > maxy) continue
      const segLen = Math.hypot(q.x - a.x, q.y - a.y)
      const t = segLen > 0 ? Math.hypot(p.x - a.x, p.y - a.y) / segLen : 0
      return b.cum[i - 1] + t * segLen
    }
  }
  return 0
}

export function circuitSegs(c: Circuit, o: { wire?: number; body?: number; dot?: number } = {}): Seg[] {
  const wire = o.wire ?? 0.6
  const body = o.body ?? 0.6
  const out: Seg[] = []

  c.nets.forEach((net, ni) => {
    const cov: Intervals = new Map()
    for (const b of net.branches) {
      for (let i = 1; i < b.pts.length; i++) {
        const p = b.pts[i - 1]
        const q = b.pts[i]
        const dp = b.cum[i - 1]
        const dq = b.cum[i]
        const horiz = Math.abs(p.y - q.y) < 0.01
        const vert = Math.abs(p.x - q.x) < 0.01
        if (!horiz && !vert) {
          out.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y, d1: dp, d2: dq, kind: K.Net, index: ni, hw: wire, cap: 1 })
          continue
        }
        const key = horiz ? `h${Math.round(p.y * 100)}` : `v${Math.round(p.x * 100)}`
        const lo = horiz ? Math.min(p.x, q.x) : Math.min(p.y, q.y)
        const hi = horiz ? Math.max(p.x, q.x) : Math.max(p.y, q.y)
        const list = cov.get(key) ?? []
        const start = horiz ? p.x : p.y
        const end = horiz ? q.x : q.y
        for (const [u, v] of uncovered(list, lo, hi)) {
          const du = dp + ((u - start) / (end - start || 1)) * (dq - dp)
          const dv = dp + ((v - start) / (end - start || 1)) * (dq - dp)
          if (horiz) out.push({ x1: u, y1: p.y, x2: v, y2: p.y, d1: du, d2: dv, kind: K.Net, index: ni, hw: wire, cap: 1 })
          else out.push({ x1: p.x, y1: u, x2: p.x, y2: v, d1: du, d2: dv, kind: K.Net, index: ni, hw: wire, cap: 1 })
        }
        list.push([lo, hi])
        cov.set(key, list)
      }
    }
    for (const d of net.dots) {
      const dd = distanceOnNet(c, ni, d)
      out.push({ x1: d.x, y1: d.y, x2: d.x, y2: d.y, d1: dd, d2: dd, kind: K.Net, index: ni, hw: o.dot ?? 2, cap: 1 })
    }
  })

  // which net/branch feeds each gate input
  const feed = new Map<string, { net: number; d: number }>()
  c.nets.forEach((net, ni) => net.branches.forEach((b) => feed.set(`${b.sink}:${b.port}`, { net: ni, d: b.length })))

  c.gates.forEach((g, gi) => {
    const ins = Array.from({ length: g.n }, (_, p) => c.inPin(gi, p))
    const outPin = g.kind === 'OUT' ? null : c.outPin(gi)
    const ol = gateOutline(g, ins, outPin)
    for (const line of ol.body) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1]
        const b = line[i]
        out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, d1: 0, d2: 0, kind: K.Gate, index: gi, hw: body, cap: 1 })
      }
    }
    for (const d of ol.dots) out.push({ x1: d.p.x, y1: d.p.y, x2: d.p.x, y2: d.p.y, d1: 0, d2: 0, kind: K.Gate, index: gi, hw: d.r, cap: 1 })
    ol.inLeads.forEach((lead, port) => {
      if (!lead) return
      const f = feed.get(`${gi}:${port}`)
      const kind = f ? K.Net : K.Static
      out.push({ x1: lead[0].x, y1: lead[0].y, x2: lead[1].x, y2: lead[1].y, d1: f?.d ?? 0, d2: f?.d ?? 0, kind, index: f?.net ?? 0, hw: wire, cap: 1 })
    })
    if (ol.outLead) {
      const net = g.net
      const a = ol.outLead[0]
      const b = ol.outLead[1]
      if (net >= 0) out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, d1: 0, d2: 0, kind: K.Net, index: net, hw: wire, cap: 1 })
      else out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, d1: 0, d2: 0, kind: K.Gate, index: gi, hw: wire, cap: 1 })
    }
  })
  return out
}

/* ── live data textures ─────────────────────────────────────────────── */

/** Per-net fronts: texel 0 = (base, count), then (t, v, t, v) pairs. */
export class NetTexture {
  readonly texture: THREE.DataTexture
  private data: Float32Array
  constructor(private c: Circuit) {
    const h = Math.max(1, c.nets.length)
    this.data = new Float32Array(NET_TEXELS * 4 * h)
    this.texture = new THREE.DataTexture(this.data, NET_TEXELS, h, THREE.RGBAFormat, THREE.FloatType)
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter
    this.update()
  }
  update() {
    const d = this.data
    this.c.nets.forEach((net, i) => {
      const o = i * NET_TEXELS * 4
      d[o] = net.base ? 1 : 0
      const n = Math.min(MAX_FRONTS, net.fronts.length)
      const skip = net.fronts.length - n
      d[o + 1] = n
      for (let k = 0; k < MAX_FRONTS; k++) {
        const f = k < n ? net.fronts[skip + k] : null
        d[o + 4 + k * 2] = f ? f.t : 0
        d[o + 5 + k * 2] = f ? (f.v ? 1 : 0) : 0
      }
    })
    this.texture.needsUpdate = true
  }
}

/** Per-gate eased glow in the red channel, 256 gates per row. */
export class GateTexture {
  readonly texture: THREE.DataTexture
  private data: Float32Array
  constructor(private c: Circuit) {
    const h = Math.max(1, Math.ceil(c.gates.length / 256))
    this.data = new Float32Array(256 * h * 4)
    this.texture = new THREE.DataTexture(this.data, 256, h, THREE.RGBAFormat, THREE.FloatType)
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter
    this.update()
  }
  update() {
    const d = this.data
    this.c.gates.forEach((g, i) => {
      d[i * 4] = g.glow
    })
    this.texture.needsUpdate = true
  }
}

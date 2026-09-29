/* Procedural 1-bit marks, one per project. Each is drawn as a grayscale
   picture (0 = ink, 1 = paper), then error-diffused at core pitch.
   These are illustrations, not screenshots: they stand in until real
   captures of each project are supplied. */

import { bayer } from './bitmap'
import type { Project } from '../content/site'

type Draw = (c: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const glow = (c: CanvasRenderingContext2D, x: number, y: number, r: number, a = 0.85) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(0,0,0,${a})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.fillRect(0, 0, c.canvas.width, c.canvas.height)
}

const DRAW: Record<Project['mark'], Draw> = {
  // an agent orbiting its sandbox
  agent(c, w, h) {
    const cx = w * 0.5
    const cy = h * 0.5
    const R = Math.min(w, h) * 0.38
    glow(c, cx, cy, R * 1.25, 0.55)
    c.lineWidth = Math.max(2, R * 0.07)
    c.strokeStyle = '#000'
    c.beginPath()
    c.arc(cx, cy, R, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = '#fff'
    const s = R * 0.62
    c.fillRect(cx - s / 2, cy - s / 2, s, s)
    c.lineWidth = Math.max(2, R * 0.05)
    c.strokeRect(cx - s / 2, cy - s / 2, s, s)
    c.fillStyle = '#000'
    const inner = s * 0.18
    for (let i = 0; i < 3; i++) c.fillRect(cx - s / 2 + s * 0.16, cy - s * 0.25 + i * s * 0.22, s * (0.55 - i * 0.12), inner * 0.5)
    const a = -0.7
    c.beginPath()
    c.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.12, 0, Math.PI * 2)
    c.fill()
  },
  // many companies narrowing into a few sent drafts
  hiriqa(c, w, h, rnd) {
    c.fillStyle = '#000'
    const fx = w * 0.62
    const fy = h * 0.5
    for (let i = 0; i < 70; i++) {
      const x = w * (0.06 + rnd() * 0.36)
      const y = h * (0.08 + rnd() * 0.84)
      const r = Math.max(1.5, w * (0.008 + rnd() * 0.012))
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
      if (i % 3 === 0) {
        c.globalAlpha = 0.35
        c.lineWidth = Math.max(1, w * 0.004)
        c.strokeStyle = '#000'
        c.beginPath()
        c.moveTo(x, y)
        c.quadraticCurveTo(w * 0.5, y, fx, fy)
        c.stroke()
        c.globalAlpha = 1
      }
    }
    c.lineWidth = Math.max(2, w * 0.018)
    for (let i = 0; i < 5; i++) {
      const y = fy + (i - 2) * h * 0.075
      c.beginPath()
      c.moveTo(fx, fy)
      c.lineTo(fx + w * 0.07, y)
      c.lineTo(w * 0.95, y)
      c.stroke()
    }
    glow(c, fx, fy, w * 0.12, 0.9)
  },
  // an occupancy grid with the rover's path through it
  polar(c, w, h, rnd) {
    const n = 22
    const cw = w / n
    const ch = h / n
    const field = (x: number, y: number) => Math.sin(x * 0.55 + rnd() * 0.3) + Math.cos(y * 0.42) + Math.sin((x + y) * 0.23)
    c.fillStyle = '#000'
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = field(x, y)
        if (v > 1.25) c.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5)
        else if (v > 0.85) {
          c.globalAlpha = 0.45
          c.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5)
          c.globalAlpha = 1
        }
      }
    }
    c.fillStyle = '#fff'
    c.strokeStyle = '#000'
    c.lineWidth = Math.max(3, w * 0.02)
    c.lineJoin = 'round'
    c.beginPath()
    let x = w * 0.08
    let y = h * 0.86
    c.moveTo(x, y)
    for (let i = 0; i < 9; i++) {
      x += w * 0.1
      y -= h * (0.02 + rnd() * 0.12) * (i % 2 ? -0.6 : 1)
      c.lineTo(x, Math.max(h * 0.12, Math.min(h * 0.9, y)))
    }
    c.stroke()
    c.beginPath()
    c.arc(x, Math.max(h * 0.12, Math.min(h * 0.9, y)), w * 0.035, 0, Math.PI * 2)
    c.fillStyle = '#000'
    c.fill()
  },
  // a supervisor and its agents
  aica(c, w, h) {
    const cx = w * 0.5
    const cy = h * 0.5
    const R = Math.min(w, h) * 0.34
    glow(c, cx, cy, R * 0.9, 0.5)
    c.strokeStyle = '#000'
    c.fillStyle = '#000'
    c.lineWidth = Math.max(2, R * 0.035)
    const n = 6
    const pts = Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R] as const
    })
    pts.forEach(([x, y], i) => {
      c.beginPath()
      c.moveTo(cx, cy)
      c.lineTo(x, y)
      c.stroke()
      const [nx, ny] = pts[(i + 1) % n]
      c.globalAlpha = 0.4
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(nx, ny)
      c.stroke()
      c.globalAlpha = 1
    })
    pts.forEach(([x, y]) => {
      c.beginPath()
      c.arc(x, y, R * 0.13, 0, Math.PI * 2)
      c.fill()
    })
    c.beginPath()
    c.arc(cx, cy, R * 0.26, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(cx, cy, R * 0.12, 0, Math.PI * 2)
    c.fill()
  },
  // a local window, a remote window, and the key between them
  rdp(c, w, h) {
    c.strokeStyle = '#000'
    c.fillStyle = '#000'
    const lw = Math.max(2, w * 0.018)
    c.lineWidth = lw
    const win = (x: number, y: number, ww: number, hh: number, fill: number) => {
      c.fillStyle = '#fff'
      c.fillRect(x, y, ww, hh)
      c.strokeRect(x, y, ww, hh)
      c.fillStyle = '#000'
      c.fillRect(x, y, ww, hh * 0.12)
      c.globalAlpha = fill
      c.fillRect(x + ww * 0.08, y + hh * 0.24, ww * 0.84, hh * 0.66)
      c.globalAlpha = 1
    }
    win(w * 0.08, h * 0.16, w * 0.46, h * 0.38, 0.25)
    win(w * 0.44, h * 0.44, w * 0.48, h * 0.4, 0.55)
    // key
    c.beginPath()
    c.arc(w * 0.26, h * 0.76, w * 0.06, 0, Math.PI * 2)
    c.stroke()
    c.beginPath()
    c.moveTo(w * 0.32, h * 0.76)
    c.lineTo(w * 0.42, h * 0.76)
    c.lineTo(w * 0.42, h * 0.8)
    c.moveTo(w * 0.38, h * 0.76)
    c.lineTo(w * 0.38, h * 0.79)
    c.stroke()
  },
  seaside(c, w, h) {
    c.fillStyle = '#000'
    for (let i = 0; i < 6; i++) {
      c.globalAlpha = 0.25 + i * 0.13
      c.beginPath()
      c.moveTo(0, h * (0.45 + i * 0.09))
      for (let x = 0; x <= w; x += 4) c.lineTo(x, h * (0.45 + i * 0.09) + Math.sin(x / w * 7 + i) * h * 0.03)
      c.lineTo(w, h)
      c.lineTo(0, h)
      c.fill()
    }
    c.globalAlpha = 1
    glow(c, w * 0.7, h * 0.28, w * 0.14, 0.9)
  },
  robot(c, w, h) {
    c.strokeStyle = '#000'
    c.lineWidth = Math.max(2, w * 0.02)
    for (let i = 0; i < 5; i++) c.strokeRect(w * (0.1 + i * 0.04), h * (0.1 + i * 0.04), w * (0.8 - i * 0.08), h * (0.8 - i * 0.08))
    c.fillStyle = '#000'
    c.beginPath()
    c.arc(w * 0.5, h * 0.5, w * 0.08, 0, Math.PI * 2)
    c.fill()
  },
  site(c, w, h) {
    c.fillStyle = '#000'
    const n = 9
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      c.beginPath()
      c.arc(((x + 0.5) / n) * w, ((y + 0.5) / n) * h, (w / n) * 0.34, 0, Math.PI * 2)
      c.fill()
    }
  },
}

/** A project's mark as an ink field (1 = lit core), sized cols x rows. */
export function markInk(mark: Project['mark'], cols: number, rows: number): Float32Array {
  const S = 6
  const cv = document.createElement('canvas')
  cv.width = cols * S
  cv.height = rows * S
  const c = cv.getContext('2d', { willReadFrequently: true })!
  c.fillStyle = '#fff'
  c.fillRect(0, 0, cv.width, cv.height)
  // draw into a square centred in the plane so shapes never stretch
  const side = Math.min(cv.width, cv.height)
  c.save()
  c.translate((cv.width - side) / 2, (cv.height - side) / 2)
  DRAW[mark](c, side, side, rng(hash(mark)))
  c.restore()
  // downsample to one sample per core
  const small = document.createElement('canvas')
  small.width = cols
  small.height = rows
  const sc = small.getContext('2d', { willReadFrequently: true })!
  sc.imageSmoothingQuality = 'high'
  sc.drawImage(cv, 0, 0, cols, rows)
  const d = sc.getImageData(0, 0, cols, rows).data
  const ink = new Float32Array(cols * rows)
  for (let i = 0; i < ink.length; i++) ink[i] = 1 - d[i * 4] / 255
  return ink
}

/** The mark as bits: ordered dither, for places that do not animate. */
export function markBits(mark: Project['mark'], cols: number, rows: number): Uint8Array {
  const ink = markInk(mark, cols, rows)
  return bayer(Float32Array.from(ink, (v) => 1 - v), cols, rows, 0.03)
}

/** 8-bit address for a project, stable across builds. */
export function addressByte(slug: string) {
  return hash(slug) & 0xff
}

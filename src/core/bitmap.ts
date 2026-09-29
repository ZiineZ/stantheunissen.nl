/* Everything the memory shows is a 1-bit bitmap: type is rasterized at core
   pitch, images are dithered. */

export const DISPLAY = '"Mona Sans Variable", "Mona Sans", ui-sans-serif, system-ui, sans-serif'

export interface TextLine {
  text: string
  /** Mona Sans width axis, 75..125 */
  wdth: number
  weight: number
  /** em size in cells */
  size: number
  /** baseline row */
  baseline: number
  /** left column (or center/right anchor, see align) */
  x: number
  align?: 'left' | 'center' | 'right'
  tracking?: number // em
}

const STRETCH_STEPS: [number, string][] = [
  [75, 'condensed'],
  [87.5, 'semi-condensed'],
  [100, 'normal'],
  [112.5, 'semi-expanded'],
  [125, 'expanded'],
]

function ctx2d(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d', { willReadFrequently: true })
  if (!x) throw new Error('2d canvas unavailable')
  return x
}

const measureCtx = (() => {
  let c: CanvasRenderingContext2D | null = null
  return () => (c ??= ctx2d(8, 8))
})()

/** nearest canvas stretch keyword at or below `wdth`, plus the x scale that makes up the difference */
function stretchFor(wdth: number): { keyword: string; scale: number } {
  let best = STRETCH_STEPS[0]
  for (const s of STRETCH_STEPS) if (s[0] <= wdth + 0.01) best = s
  return { keyword: best[1], scale: wdth / best[0] }
}

function applyFont(c: CanvasRenderingContext2D, weight: number, px: number, wdth: number) {
  const st = stretchFor(wdth)
  c.font = `${weight} ${px}px ${DISPLAY}`
  if ('fontStretch' in c) c.fontStretch = st.keyword as CanvasFontStretch
  else st.scale = wdth / 100
  return st.scale
}

/** Width of `text` in em at a given width axis value. */
export function measureEm(text: string, wdth: number, weight: number, tracking = 0): number {
  const c = measureCtx()
  const px = 200
  const scale = applyFont(c, weight, px, wdth)
  const w = c.measureText(text).width * scale
  return w / px + tracking * Math.max(0, text.length - 1)
}

/** Rasterize lines of type into a cols x rows bitmap. Supersampled coverage, threshold 0.46. */
export function rasterText(cols: number, rows: number, lines: TextLine[], ss = 4, threshold = 0.46): Uint8Array {
  const cov = textCoverage(cols, rows, lines, ss)
  return Uint8Array.from(cov, (v) => (v > threshold ? 1 : 0))
}

/** Coverage of type per cell, 0..1 (1 = fully inside a glyph). */
export function textCoverage(cols: number, rows: number, lines: TextLine[], ss = 4): Float32Array {
  const c = ctx2d(cols * ss, rows * ss)
  c.fillStyle = '#000'
  c.fillRect(0, 0, cols * ss, rows * ss)
  c.fillStyle = '#fff'
  c.textBaseline = 'alphabetic'
  for (const l of lines) {
    const px = l.size * ss
    const scale = applyFont(c, l.weight, px, l.wdth)
    const track = (l.tracking ?? 0) * px
    const chars = [...l.text]
    const widths = chars.map((ch) => c.measureText(ch).width * scale)
    const total = track === 0 ? c.measureText(l.text).width * scale : widths.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1)
    let x = l.x * ss
    if (l.align === 'center') x -= total / 2
    else if (l.align === 'right') x -= total
    const y = l.baseline * ss
    if (track === 0) {
      c.save()
      c.translate(x, y)
      c.scale(scale, 1)
      c.fillText(l.text, 0, 0)
      c.restore()
    } else {
      chars.forEach((ch, i) => {
        c.save()
        c.translate(x, y)
        c.scale(scale, 1)
        c.fillText(ch, 0, 0)
        c.restore()
        x += widths[i] + track
      })
    }
  }
  return coverageField(c, cols, rows, ss)
}

function coverageField(c: CanvasRenderingContext2D, cols: number, rows: number, ss: number): Float32Array {
  const img = c.getImageData(0, 0, cols * ss, rows * ss).data
  const out = new Float32Array(cols * rows)
  const W = cols * ss
  const area = ss * ss * 255
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0
      for (let y = 0; y < ss; y++) {
        const row = (r * ss + y) * W
        for (let x = 0; x < ss; x++) sum += img[(row + col * ss + x) * 4]
      }
      out[r * cols + col] = sum / area
    }
  }
  return out
}

function coverage(c: CanvasRenderingContext2D, cols: number, rows: number, ss: number, threshold: number): Uint8Array {
  return Uint8Array.from(coverageField(c, cols, rows, ss), (v) => (v > threshold ? 1 : 0))
}

/* ── ink ────────────────────────────────────────────────────────────
   An "ink" field is 0..1 per core, 1 = lit. It is kept as tone and only
   diffused to bits when shown, so it can be shifted and re-shown cleanly. */

/** Atkinson error diffusion of an ink field (1 = lit). Deterministic. */
export function ditherInk(ink: Float32Array, cols: number, rows: number, out: Uint8Array = new Uint8Array(cols * rows)): Uint8Array {
  const g = Float32Array.from(ink)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const v = g[i]
      const on = v >= 0.5 ? 1 : 0
      out[i] = on
      const e = (v - on) / 8
      if (x + 1 < cols) g[i + 1] += e
      if (x + 2 < cols) g[i + 2] += e
      if (y + 1 < rows) {
        if (x > 0) g[i + cols - 1] += e
        g[i + cols] += e
        if (x + 1 < cols) g[i + cols + 1] += e
      }
      if (y + 2 < rows) g[i + cols * 2] += e
    }
  }
  return out
}

/** Move a level field by a fractional number of cells (bilinear; empty beyond the edges). */
export function shiftLevels(src: ArrayLike<number>, cols: number, rows: number, ox: number, oy: number, out: Float32Array): Float32Array {
  const fx = Math.floor(ox)
  const fy = Math.floor(oy)
  const ax = ox - fx
  const ay = oy - fy
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : src[y * cols + x])
  for (let y = 0; y < rows; y++) {
    const sy = y - fy
    for (let x = 0; x < cols; x++) {
      const sx = x - fx
      // out(x) = src(x - ox), between src(sx - 1) and src(sx)
      const top = at(sx, sy) * (1 - ax) + at(sx - 1, sy) * ax
      const bot = at(sx, sy - 1) * (1 - ax) + at(sx - 1, sy - 1) * ax
      out[y * cols + x] = top * (1 - ay) + bot * ay
    }
  }
  return out
}

/** Draw anything with a 2D context at `ss` px per cell, then take coverage. */
export function rasterDraw(cols: number, rows: number, draw: (c: CanvasRenderingContext2D, s: number) => void, ss = 4, threshold = 0.5): Uint8Array {
  const c = ctx2d(cols * ss, rows * ss)
  c.fillStyle = '#000'
  c.fillRect(0, 0, cols * ss, rows * ss)
  c.fillStyle = '#fff'
  c.strokeStyle = '#fff'
  draw(c, ss)
  return coverage(c, cols, rows, ss, threshold)
}

/** Grayscale field (0 = black, 1 = white) sampled at cols x rows. */
export function sampleGray(img: CanvasImageSource, cols: number, rows: number, fit: 'cover' | 'contain' = 'cover'): Float32Array {
  const c = ctx2d(cols, rows)
  c.fillStyle = '#fff'
  c.fillRect(0, 0, cols, rows)
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height
  const s = fit === 'cover' ? Math.max(cols / iw, rows / ih) : Math.min(cols / iw, rows / ih)
  const w = iw * s
  const h = ih * s
  c.imageSmoothingQuality = 'high'
  c.drawImage(img, (cols - w) / 2, (rows - h) / 2, w, h)
  const d = c.getImageData(0, 0, cols, rows).data
  const out = new Float32Array(cols * rows)
  for (let i = 0; i < out.length; i++) out[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255
  return out
}

/** Atkinson dither: bit = 1 where the image is dark. */
export function atkinson(gray: Float32Array, cols: number, rows: number, bias = 0): Uint8Array {
  const g = Float32Array.from(gray, (v) => Math.min(1, Math.max(0, v + bias)))
  const out = new Uint8Array(cols * rows)
  const spread = (x: number, y: number, e: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return
    g[y * cols + x] += e
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const old = g[i]
      const nv = old < 0.5 ? 0 : 1
      out[i] = nv === 0 ? 1 : 0
      const e = (old - nv) / 8
      spread(x + 1, y, e)
      spread(x + 2, y, e)
      spread(x - 1, y + 1, e)
      spread(x, y + 1, e)
      spread(x + 1, y + 1, e)
      spread(x, y + 2, e)
    }
  }
  return out
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Ordered 4x4 Bayer dither: regular, graphic tone. Bit = 1 where dark. */
export function bayer(gray: Float32Array, cols: number, rows: number, bias = 0): Uint8Array {
  const out = new Uint8Array(cols * rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const t = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16
      out[i] = gray[i] + bias < t ? 1 : 0
    }
  }
  return out
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

/** Copy `src` (sw x sh) into `dst` (dw x dh) at column/row offset. */
export function blit(dst: Uint8Array, dw: number, dh: number, src: Uint8Array, sw: number, sh: number, ox: number, oy: number) {
  for (let y = 0; y < sh; y++) {
    const ty = y + oy
    if (ty < 0 || ty >= dh) continue
    for (let x = 0; x < sw; x++) {
      const tx = x + ox
      if (tx < 0 || tx >= dw) continue
      if (src[y * sw + x]) dst[ty * dw + tx] = 1
    }
  }
}

export async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`900 100px ${DISPLAY}`),
      document.fonts.load(`600 100px ${DISPLAY}`),
      document.fonts.load(`400 16px ${DISPLAY}`),
    ])
    await document.fonts.ready
  } catch {
    /* fall back to system sans; rasters still work */
  }
}

/* Stan's portrait on a core plane, in greyscale. Source: the photo from his
   own CV, pre-processed to grayscale with a lifted background
   (public/media/portrait-gray.webp). The background is flood-filled from the
   edges and kept dark so only the person is stored, and its fringe is
   feathered so no halo of stray cores rings the head. Tones are stretched and
   locally sharpened: at this few cores a face needs the help. In the dark
   theme lit cores are the light parts of the face; in the light theme they
   are the ink. */

import { ditherInk, loadImage, sampleGray } from './bitmap'

let img: Promise<HTMLImageElement> | null = null
const source = () => (img ??= loadImage('/media/portrait-gray.webp'))

/** The portrait as an ink field (1 = lit core), background cleared. */
export async function portraitInk(cols: number, rows: number, dark: boolean): Promise<Float32Array> {
  const im = await source()
  const gray = sampleGray(im, cols, rows, 'cover')
  // background: near-white cells connected to the border
  const bg = new Uint8Array(cols * rows)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return
    const i = y * cols + x
    if (bg[i] || gray[i] < 0.9) return
    bg[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < cols; x++) {
    push(x, 0)
    push(x, rows - 1)
  }
  for (let y = 0; y < rows; y++) {
    push(0, y)
    push(cols - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()!
    const x = i % cols
    const y = (i / cols) | 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  // feather the fringe: cores touching the background fade out
  const near = new Float32Array(cols * rows).fill(1)
  for (let pass = 0; pass < 2; pass++) {
    const w = pass === 0 ? 0.25 : 0.7
    const next = near.slice()
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x
        if (bg[i] || near[i] < 1) continue
        let edge = false
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) continue
          const j = yy * cols + xx
          if (bg[j] || (pass === 1 && near[j] < 1)) edge = true
        }
        if (edge) next[i] = w
      }
    }
    near.set(next)
  }
  // stretch the person's tones to the full range (4th to 96th percentile)
  const fg: number[] = []
  for (let i = 0; i < gray.length; i++) if (!bg[i]) fg.push(gray[i])
  fg.sort((a, b) => a - b)
  const lo = fg[Math.floor(fg.length * 0.04)] ?? 0
  const hi = fg[Math.floor(fg.length * 0.96)] ?? 1
  const norm = Float32Array.from(gray, (v) => Math.min(1, Math.max(0, (v - lo) / Math.max(hi - lo, 1e-3))))
  // local contrast (unsharp mask) so brows, eyes and mouth survive the grid
  const sharp = new Float32Array(cols * rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || bg[yy * cols + xx]) continue
          sum += norm[yy * cols + xx]
          n++
        }
      }
      const i = y * cols + x
      sharp[i] = Math.min(1, Math.max(0, norm[i] + 0.9 * (norm[i] - sum / Math.max(n, 1))))
    }
  }
  const ink = new Float32Array(cols * rows)
  for (let i = 0; i < ink.length; i++) {
    if (bg[i]) continue
    const v = sharp[i]
    ink[i] = (dark ? Math.pow(v, 1.5) : Math.pow(1 - v, 1.15)) * near[i]
  }
  return ink
}

export async function portraitBits(cols: number, rows: number, dark: boolean): Promise<Uint8Array> {
  return ditherInk(await portraitInk(cols, rows, dark), cols, rows)
}

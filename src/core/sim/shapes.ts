/* IEEE distinctive-shape outlines as polylines, in plane px (y down).
   The body is sized by `s` (half height of a 2-input gate). Inputs past two
   extend the flat back edge instead of growing the body, as on real schematics.
   Leads are returned separately so renderers can colour them by the nets they
   belong to instead of by the gate. */

import type { Gate, Pt } from './circuit'
import { pinHalfSpan } from './circuit'

const TAU = Math.PI * 2

function quad(a: Pt, c: Pt, b: Pt, steps = 12): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    out.push({ x: mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x, y: mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y })
  }
  return out
}

export function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 16): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  return out
}

/** x of the OR/XOR concave back edge at normalized height y in [-1, 1] */
function orBack(y: number): number {
  return -1 + 0.45 * (1 - y * y)
}

export interface Outline {
  body: Pt[][]
  inLeads: (Pt[] | null)[] // one per port, from pin to body
  outLead: Pt[] | null // from body to output pin
  dots: { p: Pt; r: number }[]
}

export function gateOutline(g: Gate, inPins: Pt[], outPin: Pt | null): Outline {
  const s = g.s
  const X = (u: number) => g.x + u * s
  const Y = (v: number) => g.y + v * s
  const P = (u: number, v: number): Pt => ({ x: X(u), y: Y(v) })
  const body: Pt[][] = []
  const dots: { p: Pt; r: number }[] = []
  const bubble = (u: number) => body.push(arc(X(u), g.y, 0.2 * s, 0, TAU, 14))
  let inLeads: (Pt[] | null)[] = inPins.map(() => null)
  let outLead: Pt[] | null = null

  switch (g.kind) {
    case 'IN': {
      const h = 0.6
      body.push([P(-h, -h), P(h, -h), P(h, h), P(-h, h), P(-h, -h)])
      dots.push({ p: P(0, 0), r: 0.22 * s })
      if (outPin) outLead = [P(h, 0), outPin]
      break
    }
    case 'OUT': {
      body.push(arc(g.x, g.y, 0.6 * s, 0, TAU, 20))
      dots.push({ p: P(0, 0), r: 0.34 * s })
      if (inPins[0]) inLeads = [[inPins[0], P(-0.6, 0)]]
      break
    }
    case 'NOT':
    case 'BUF': {
      body.push([P(-0.9, -0.85), P(0.75, 0), P(-0.9, 0.85), P(-0.9, -0.85)])
      if (g.kind === 'NOT') bubble(0.95)
      if (inPins[0]) inLeads = [[inPins[0], { x: X(-0.9), y: inPins[0].y }]]
      if (outPin) outLead = [P(g.kind === 'NOT' ? 1.15 : 0.75, 0), outPin]
      break
    }
    case 'AND':
    case 'NAND': {
      // flat back, then the arc from bottom (pi/2) round the right side to top (-pi/2)
      body.push([P(0, -1), P(-1, -1), P(-1, 1), P(0, 1), ...arc(g.x, g.y, s, Math.PI / 2, -Math.PI / 2, 18)])
      const span = pinHalfSpan(g) / s
      if (span > 1) body.push([P(-1, -span), P(-1, span)])
      if (g.kind === 'NAND') bubble(1.2)
      inLeads = inPins.map((p) => [p, { x: X(-1), y: p.y }])
      if (outPin) outLead = [P(g.kind === 'NAND' ? 1.4 : 1, 0), outPin]
      break
    }
    default: {
      // OR, NOR, XOR, XNOR
      const back = quad(P(-1, 1), P(-0.55, 0), P(-1, -1), 12)
      const top = quad(P(-1, -1), P(0.35, -1), P(1.05, 0), 14)
      const bottom = quad(P(1.05, 0), P(0.35, 1), P(-1, 1), 14)
      body.push([...top, ...bottom.slice(1), ...back.slice(1)])
      const xor = g.kind === 'XOR' || g.kind === 'XNOR'
      if (xor) body.push(quad(P(-1.3, 1), P(-0.85, 0), P(-1.3, -1), 12))
      const span = pinHalfSpan(g) / s
      if (span > 1) {
        body.push([P(-1, -span), P(-1, -1)])
        body.push([P(-1, 1), P(-1, span)])
      }
      if (g.kind === 'NOR' || g.kind === 'XNOR') bubble(1.25)
      inLeads = inPins.map((p) => {
        const v = Math.max(-1, Math.min(1, (p.y - g.y) / s))
        return [p, { x: X(orBack(v) - (xor ? 0.3 : 0)), y: p.y }]
      })
      if (outPin) outLead = [P(g.kind === 'NOR' || g.kind === 'XNOR' ? 1.45 : 1.05, 0), outPin]
    }
  }
  return { body, inLeads, outLead, dots }
}

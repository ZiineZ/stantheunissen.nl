/* Motion preferences and the shared vocabulary of timing.
   Everything visible that moves is caused by a signal, so timings derive from
   distance over speed rather than from arbitrary staggers. */

const media = window.matchMedia('(prefers-reduced-motion: reduce)')
const KEY = 'motion'
let forced: 'reduce' | null = null
try {
  forced = localStorage.getItem(KEY) === 'reduce' ? 'reduce' : null
} catch {
  forced = null
}
const listeners = new Set<(reduced: boolean) => void>()

export function reducedMotion(): boolean {
  return forced === 'reduce' || media.matches
}

export function setReducedMotion(on: boolean) {
  forced = on ? 'reduce' : null
  try {
    if (on) localStorage.setItem(KEY, 'reduce')
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  document.documentElement.classList.toggle('reduced', reducedMotion())
  listeners.forEach((l) => l(reducedMotion()))
}

export function onMotion(fn: (reduced: boolean) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

media.addEventListener('change', () => {
  document.documentElement.classList.toggle('reduced', reducedMotion())
  listeners.forEach((l) => l(reducedMotion()))
})
document.documentElement.classList.toggle('reduced', reducedMotion())

/** UI signal speed in px/s: how fast "current" travels through the interface. */
export const UI_SPEED = 1400
/** Ambient simulation speed: calm. */
export const SIM_SPEED = 300

export const ease = {
  glide: 'expo.out',
  settle: 'power3.out',
  spring: 'elastic.out(1, 0.55)',
} as const

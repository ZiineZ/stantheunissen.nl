import Lenis from 'lenis'

let lenis: Lenis | null = null

export function initLenis(): () => void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {}
  }
  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  })
  let raf = 0
  const loop = (time: number) => {
    lenis?.raf(time)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    lenis?.destroy()
    lenis = null
  }
}

export function scrollToId(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  if (lenis) {
    lenis.scrollTo(target, { offset: -70, duration: 1.2 })
  } else {
    target.scrollIntoView({ behavior: 'smooth' })
  }
}

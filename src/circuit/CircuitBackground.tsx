import { useEffect, useRef } from 'react'
import { CircuitEngine } from './engine'

/* Fixed full-viewport canvas hosting the live logic simulation.
   Pre-rendered static traces + per-frame signal painting keeps the
   per-frame cost tiny; the loop pauses when the tab is hidden. */
export default function CircuitBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const engine = new CircuitEngine()
    let raf = 0
    let last = performance.now()
    let resizeTimer = 0

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      engine.build(w, h, dpr)
      if (engine.reducedMotion) {
        engine.tick(0)
        engine.render(ctx)
      }
    }

    const loop = (now: number) => {
      engine.tick(now - last)
      last = now
      engine.render(ctx)
      raf = requestAnimationFrame(loop)
    }

    const start = () => {
      if (engine.reducedMotion) return
      cancelAnimationFrame(raf)
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else start()
    }

    const onResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(fit, 180)
    }

    const onMouse = (e: MouseEvent) => engine.setMouse(e.clientX, e.clientY)

    fit()
    start()
    window.addEventListener('resize', onResize)
    window.addEventListener('mousemove', onMouse, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouse)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} className="circuit-bg" aria-hidden="true" />
}

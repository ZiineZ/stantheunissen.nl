/* The one WebGL context: renderer, camera, optional bloom, a paused-when-hidden
   loop and adaptive resolution. Units: 1 world unit = 1 CSS px on the focal
   plane, so DOM layout and GL layout share coordinates at rest. */

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { U, readPalette } from './palette'
import { onTheme } from '../theme'

export interface StageOpts {
  fov?: number
  bloom?: boolean
  maxDpr?: number
  ortho?: boolean
}

type FrameFn = (t: number, dt: number) => void

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
  readonly fov: number
  w = 1
  h = 1
  dpr = 1
  dark = false
  running = false
  private maxDpr: number
  private wantBloom: boolean
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private frameFns = new Set<FrameFn>()
  private resizeFns = new Set<(w: number, h: number) => void>()
  private t0 = performance.now()
  private last = 0
  private raf = 0
  private frames = 0
  private slow = 0

  constructor(readonly canvas: HTMLCanvasElement, o: StageOpts = {}) {
    this.fov = o.fov ?? 30
    this.maxDpr = o.maxDpr ?? 2
    this.wantBloom = o.bloom ?? true
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.renderer.setClearColor(0x000000, 1)
    this.camera = o.ortho ? new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000) : new THREE.PerspectiveCamera(this.fov, 1, 1, 60000)
    this.applyTheme()
    onTheme(() => this.applyTheme())
    this.resize()
    window.addEventListener('resize', () => this.resize())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop()
      else this.start()
    })
  }

  now() {
    return (performance.now() - this.t0) / 1000
  }

  /** Camera distance at which the focal plane maps 1 unit to 1 CSS px. */
  restDistance() {
    return this.h / 2 / Math.tan(THREE.MathUtils.degToRad(this.fov / 2))
  }

  applyTheme() {
    this.dark = readPalette()
    this.renderer.setClearColor(U.uGround.value, 1)
    this.setupPost()
  }

  private setupPost() {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const use = this.wantBloom && this.dark && !coarse
    if (!use) {
      this.composer?.dispose()
      this.composer = null
      this.bloom = null
      return
    }
    if (this.composer) return
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w, this.h), 0.9, 0.42, 0.96)
    this.composer.addPass(this.bloom)
    this.composer.setPixelRatio(this.dpr)
    this.composer.setSize(this.w, this.h)
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const changed = w !== this.w || Math.abs(h - this.h) > 1
    this.w = w
    this.h = h
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    this.composer?.setPixelRatio(this.dpr)
    this.composer?.setSize(w, h)
    this.bloom?.resolution.set(w, h)
    if (changed) this.resizeFns.forEach((f) => f(w, h))
  }

  onResize(fn: (w: number, h: number) => void) {
    this.resizeFns.add(fn)
    return () => this.resizeFns.delete(fn)
  }

  onFrame(fn: FrameFn) {
    this.frameFns.add(fn)
    return () => this.frameFns.delete(fn)
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = this.now()
    const loop = () => {
      if (!this.running) return
      const t = this.now()
      const dt = Math.min(0.05, t - this.last)
      this.last = t
      U.uTime.value = t
      this.frameFns.forEach((f) => f(t, dt))
      this.render()
      this.adapt(dt)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  render() {
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  /** Drop resolution when frames run long; never raise it again mid-visit (no oscillation). */
  private adapt(dt: number) {
    this.frames++
    if (dt > 0.024) this.slow++
    if (this.frames < 120) return
    if (this.slow > 50 && this.dpr > 1) {
      this.maxDpr = Math.max(1, this.dpr - 0.25)
      this.resize()
    }
    this.frames = 0
    this.slow = 0
  }
}

/* Kinetic type. Headings arrive stretched wide and spring back to their set
   width; paragraphs are "written" by a current sweeping left to right. Every
   delay is distance divided by the UI signal speed, so text appears in the
   order a signal would reach it. */

import { gsap } from 'gsap'
import { UI_SPEED, reducedMotion } from './motion'

export function split(el: HTMLElement): HTMLElement[] {
  if (el.dataset.split) return [...el.querySelectorAll<HTMLElement>('.k-char')]
  const text = el.textContent ?? ''
  el.setAttribute('aria-label', text.trim())
  el.dataset.split = '1'
  el.innerHTML = text
    .split(/(\s+)/)
    .map((w) => (/^\s+$/.test(w) ? w : `<span class="k-word" aria-hidden="true">${[...w].map((c) => `<span class="k-char">${c.replace(/[<&]/g, '')}</span>`).join('')}</span>`))
    .join('')
  return [...el.querySelectorAll<HTMLElement>('.k-char')]
}

function stretchOf(el: HTMLElement) {
  const v = getComputedStyle(el).fontStretch
  const n = parseFloat(v)
  if (!Number.isNaN(n)) return n
  return v === 'condensed' ? 75 : v === 'expanded' ? 125 : 100
}

/** Hide everything that will be revealed (only when motion is allowed). */
export function prime(root: HTMLElement) {
  if (reducedMotion()) return
  root.querySelectorAll<HTMLElement>('[data-kinetic]').forEach((el) => {
    split(el).forEach((c) => (c.style.opacity = '0'))
  })
  root.querySelectorAll<HTMLElement>('[data-scan]').forEach((el) => {
    el.style.clipPath = 'inset(0 100% 0 0)'
  })
}

export function revealHeading(el: HTMLElement, delay = 0) {
  const chars = split(el)
  if (reducedMotion()) {
    chars.forEach((c) => {
      c.style.opacity = ''
      c.style.fontStretch = ''
    })
    return
  }
  const base = stretchOf(el)
  const wide = Math.min(125, base + 42)
  const left = el.getBoundingClientRect().left
  chars.forEach((c) => {
    const d = (c.getBoundingClientRect().left - left) / UI_SPEED
    const at = delay + d * 1.8
    gsap.fromTo(c, { fontStretch: `${wide}%` }, { fontStretch: `${base}%`, duration: 1.1, delay: at, ease: 'elastic.out(1, 0.62)', clearProps: 'fontStretch' })
    gsap.fromTo(c, { opacity: 0 }, { opacity: 1, duration: 0.14, delay: at, ease: 'none', clearProps: 'opacity' })
  })
}

/** A current writes the element left to right, leaving a short orange trace. */
export function scan(el: HTMLElement, delay = 0) {
  if (reducedMotion()) {
    el.style.clipPath = ''
    return
  }
  const w = el.getBoundingClientRect().width
  const dur = Math.max(0.35, Math.min(1.1, w / UI_SPEED))
  const line = document.createElement('span')
  line.className = 'scanline'
  line.setAttribute('aria-hidden', 'true')
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
  el.appendChild(line)
  const tl = gsap.timeline({ delay, onComplete: () => line.remove() })
  tl.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: dur, ease: 'power2.inOut', clearProps: 'clipPath' }, 0)
  tl.fromTo(line, { left: '0%', opacity: 1 }, { left: '100%', duration: dur, ease: 'power2.inOut' }, 0)
  tl.to(line, { opacity: 0, duration: 0.25 }, dur)
}

/** Reveal a section: headings stretch in, then text is scanned in reading order. */
export function revealSection(root: HTMLElement, delay = 0) {
  if (root.dataset.revealed) return
  root.dataset.revealed = '1'
  const top = root.getBoundingClientRect().top
  root.querySelectorAll<HTMLElement>('[data-kinetic]').forEach((el) => revealHeading(el, delay))
  root.querySelectorAll<HTMLElement>('[data-scan]').forEach((el) => {
    const r = el.getBoundingClientRect()
    scan(el, delay + 0.18 + Math.max(0, r.top - top) / (UI_SPEED * 2.2))
  })
}

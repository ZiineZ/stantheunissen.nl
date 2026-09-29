/* One line of feedback, shown where the visitor acted. No toasts. */

let el: HTMLDivElement | null = null
let timer = 0

export function flash(text: string, x: number, y: number, ms = 1400) {
  if (!el) {
    el = document.createElement('div')
    el.className = 'flash'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  el.textContent = text
  const w = el.offsetWidth || 120
  el.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x + 14))}px`
  el.style.top = `${Math.max(8, y + 16)}px`
  el.classList.add('show')
  window.clearTimeout(timer)
  if (ms > 0) timer = window.setTimeout(() => el?.classList.remove('show'), ms)
}

export function unflash() {
  el?.classList.remove('show')
}

export async function copy(text: string, x: number, y: number) {
  try {
    await navigator.clipboard.writeText(text)
    flash('Copied', x, y)
  } catch {
    flash(text, x, y, 3000)
  }
}

/* Theme follows the system unless the visitor overrides it (palette / `t`).
   CSS owns the colours; this only resolves which set is active. */

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<(dark: boolean) => void>()

function stored(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let pref: ThemePref = stored()

export function isDark(): boolean {
  return pref === 'system' ? media.matches : pref === 'dark'
}

export function themePref(): ThemePref {
  return pref
}

function apply() {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = isDark() ? '#0a0a0a' : '#eeeeec'
  const dark = isDark()
  listeners.forEach((l) => l(dark))
}

export function setTheme(p: ThemePref) {
  pref = p
  try {
    if (p === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, p)
  } catch {
    /* storage blocked: preference lasts for this page only */
  }
  apply()
}

/** system → opposite of system → the other → system */
export function cycleTheme(): ThemePref {
  const order: ThemePref[] = media.matches ? ['system', 'light', 'dark'] : ['system', 'dark', 'light']
  const next = order[(order.indexOf(pref) + 1) % order.length]
  setTheme(next)
  return next
}

export function onTheme(fn: (dark: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

media.addEventListener('change', () => {
  if (pref === 'system') apply()
})

apply()

/* Command palette (⌘K, Ctrl+K, /). Doubles as the menu on small screens. */

export interface Command {
  id: string
  label: string
  group: string
  hint?: string
  keywords?: string
  run: () => void
}

export class Palette {
  private root: HTMLDivElement
  private input: HTMLInputElement
  private list: HTMLDivElement
  private items: Command[] = []
  private shown: Command[] = []
  private sel = 0
  private lastFocus: HTMLElement | null = null
  open = false

  constructor(private commands: () => Command[]) {
    this.root = document.createElement('div')
    this.root.className = 'palette'
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-modal', 'true')
    this.root.setAttribute('aria-label', 'Command palette')
    this.root.innerHTML = `
      <div class="palette-panel">
        <input class="palette-input" type="text" placeholder="Go to, copy, switch…" aria-label="Search commands" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palette-list">
        <div class="palette-list" id="palette-list" role="listbox"></div>
        <div class="palette-foot"><span>↑↓ move · ↵ run · esc close</span><span>⌘K</span></div>
      </div>`
    document.body.appendChild(this.root)
    this.input = this.root.querySelector('input')!
    this.list = this.root.querySelector('.palette-list')!
    this.input.addEventListener('input', () => this.render())
    this.input.addEventListener('keydown', (e) => this.key(e))
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.close()
    })
    this.list.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
      if (b) this.run(Number(b.dataset.i))
    })
    this.list.addEventListener('pointermove', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
      if (b && Number(b.dataset.i) !== this.sel) {
        this.sel = Number(b.dataset.i)
        this.mark()
      }
    })
  }

  show() {
    if (this.open) return
    this.open = true
    this.lastFocus = document.activeElement as HTMLElement | null
    this.items = this.commands()
    this.input.value = ''
    this.sel = 0
    this.render()
    this.root.classList.add('open')
    requestAnimationFrame(() => this.input.focus())
  }

  close() {
    if (!this.open) return
    this.open = false
    this.root.classList.remove('open')
    this.lastFocus?.focus?.()
  }

  toggle() {
    if (this.open) this.close()
    else this.show()
  }

  private match(c: Command, q: string) {
    if (!q) return 1
    const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase()
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.every((w) => hay.includes(w))) return hay.startsWith(words[0]) ? 3 : 2
    // loose subsequence match on the label
    let i = 0
    const l = c.label.toLowerCase()
    for (const ch of q.toLowerCase().replace(/\s/g, '')) {
      i = l.indexOf(ch, i)
      if (i < 0) return 0
      i++
    }
    return 1
  }

  private render() {
    const q = this.input.value.trim()
    this.shown = this.items
      .map((c) => ({ c, s: this.match(c, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => (q ? b.s - a.s : 0))
      .map((x) => x.c)
    this.sel = Math.min(this.sel, Math.max(0, this.shown.length - 1))
    if (!this.shown.length) {
      this.list.innerHTML = `<p class="palette-empty">Nothing stored under “${q.replace(/[<&]/g, '')}”.</p>`
      return
    }
    let html = ''
    let group = ''
    this.shown.forEach((c, i) => {
      if (!q && c.group !== group) {
        group = c.group
        html += `<p class="palette-group">${group}</p>`
      }
      html += `<button class="palette-item" type="button" role="option" data-i="${i}" id="pc-${i}"><span>${c.label}</span>${c.hint ? `<span class="hint">${c.hint}</span>` : ''}</button>`
    })
    this.list.innerHTML = html
    this.mark()
  }

  private mark() {
    this.list.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => {
      const on = Number(b.dataset.i) === this.sel
      b.setAttribute('aria-selected', String(on))
      if (on) b.scrollIntoView({ block: 'nearest' })
    })
    this.input.setAttribute('aria-activedescendant', `pc-${this.sel}`)
  }

  private key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.sel = (this.sel + 1) % Math.max(1, this.shown.length)
      this.mark()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.sel = (this.sel - 1 + this.shown.length) % Math.max(1, this.shown.length)
      this.mark()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      this.run(this.sel)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.close()
    } else if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  private run(i: number) {
    const c = this.shown[i]
    if (!c) return
    this.close()
    // let the palette fade before the action moves the page
    window.setTimeout(() => c.run(), 60)
  }
}

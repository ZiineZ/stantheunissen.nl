import '@fontsource-variable/mona-sans/standard.css'
import '@fontsource-variable/geist-mono'
import '../styles/base.css'
import '../styles/stack.css'
import { cycleTheme, isDark, setTheme, themePref } from '../core/theme'
import { reducedMotion, setReducedMotion } from '../core/motion'
import { Stage, webglAvailable } from '../core/gl/stage'
import { fontsReady } from '../core/bitmap'
import { Palette, type Command } from '../core/ui/palette'
import { flash, unflash, copy } from '../core/ui/flash'
import { prime, revealSection } from '../core/kinetic'
import * as api from '../core/api'
import { profile, projects, featured, timeline } from '../content/site'
import { caseStudy, cv, colophon, labPage, sandboxPage, corner } from './templates'
import { Stack, type Factory } from './stack'
import { HeroPlane } from './planes/hero'
import { WorkPlane } from './planes/work'
import { IndexPlane } from './planes/index'
import { AboutPlane } from './planes/about'
import { SkillsPlane } from './planes/skills'
import { LabPlane } from './planes/lab'
import { ContactPlane } from './planes/contact'
import { GuestbookPlane, type Mark } from './planes/guestbook'
import { CasePlane } from './planes/case'
import { mountSandbox } from './sandbox'

const root = document.documentElement
const app = document.getElementById('app') as HTMLElement
let stack: Stack | null = null
let stage: Stage | null = null

/* ── DOM-only behaviour: works with or without WebGL ─────────────────── */

function timelineBars() {
  const now = new Date()
  const toM = (s: string) => {
    const [y, m] = s.split('-').map(Number)
    return y * 12 + (m - 1)
  }
  const nowM = now.getFullYear() * 12 + now.getMonth()
  const min = Math.min(...timeline.map((s) => toM(s.start)))
  const span = Math.max(1, nowM - min)
  document.querySelectorAll<HTMLElement>('[data-timeline] li').forEach((li) => {
    const start = toM(li.dataset.start ?? '')
    const end = li.dataset.end ? toM(li.dataset.end) : nowM
    li.style.setProperty('--from', String((start - min) / span))
    li.style.setProperty('--len', String((end - start) / span))
  })
}

function sectionFor(id: string): HTMLElement | null {
  const el = document.getElementById(id)
  return el ? (el.closest('section') as HTMLElement) ?? el : null
}

function goSection(id: string) {
  if (id === 'lab' || id === 'sandbox') {
    navigate(`/${id}`)
    return
  }
  if (location.pathname !== '/') {
    navigate(`/#${id}`)
    return
  }
  const el = sectionFor(id)
  if (!el) return
  window.scrollTo({ top: el.offsetTop, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

function sectionsInOrder() {
  return [...app.querySelectorAll<HTMLElement>('section.sec')]
}

function step(dir: 1 | -1) {
  const secs = sectionsInOrder()
  const y = window.scrollY + 4
  let i = 0
  secs.forEach((s, k) => {
    if (s.offsetTop <= y) i = k
  })
  const next = secs[Math.max(0, Math.min(secs.length - 1, i + dir))]
  window.scrollTo({ top: next.offsetTop, behavior: reducedMotion() ? 'auto' : 'smooth' })
}

const navOf = (id: string) =>
  id.startsWith('work-') ? 'work' : id === 'skills' ? 'about' : id === 'guestbook' ? 'contact' : id === 'top' ? '' : id

function setNav(id: string) {
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach((a) => {
    if (a.dataset.nav === navOf(id) && id !== 'top') a.setAttribute('aria-current', 'true')
    else a.removeAttribute('aria-current')
  })
}

/* ── commands: palette, keys ─────────────────────────────────────────── */

function commands(): Command[] {
  const pref = themePref()
  const list: Command[] = [
    { id: 'top', label: 'Home', group: 'Go to', hint: '1', run: () => goSection('top') },
    { id: 'work', label: 'Work', group: 'Go to', hint: '2', run: () => goSection('work') },
    { id: 'index', label: 'Index', group: 'Go to', hint: '3', run: () => goSection('index') },
    { id: 'about', label: 'About', group: 'Go to', hint: '4', run: () => goSection('about') },
    { id: 'skills', label: 'Skills', group: 'Go to', run: () => goSection('skills') },
    { id: 'lab', label: 'Lab: the adder', group: 'Go to', hint: '5', run: () => navigate('/lab') },
    { id: 'contact', label: 'Contact', group: 'Go to', hint: '6', run: () => goSection('contact') },
    { id: 'guestbook', label: 'Guestbook', group: 'Go to', run: () => goSection('guestbook') },
    { id: 'sandbox', label: 'Sandbox: wire your own gates', group: 'Go to', run: () => navigate('/sandbox') },
    { id: 'cv', label: 'CV', group: 'Go to', run: () => navigate('/cv') },
    { id: 'colophon', label: 'How this works', group: 'Go to', run: () => navigate('/colophon') },
    ...featured.map((p) => ({ id: `p-${p.slug}`, label: p.title, group: 'Projects', keywords: `${p.kind} ${p.stack.join(' ')}`, run: () => navigate(`/work/${p.slug}`) })),
    { id: 'copy', label: 'Copy email address', group: 'Do', hint: 'e', keywords: 'mail contact', run: () => copy(profile.email, innerWidth / 2 - 40, innerHeight / 2) },
    { id: 'mail', label: 'Write an email', group: 'Do', keywords: 'mail contact', run: () => (location.href = `mailto:${profile.email}`) },
    { id: 'gh', label: 'GitHub', group: 'Do', run: () => window.open(profile.links.github, '_blank', 'noopener') },
    { id: 'li', label: 'LinkedIn', group: 'Do', run: () => window.open(profile.links.linkedin, '_blank', 'noopener') },
    {
      id: 'theme',
      label: `Theme: ${pref === 'system' ? `system (${isDark() ? 'dark' : 'light'})` : pref} → switch`,
      group: 'Settings',
      hint: 't',
      keywords: 'dark light mode',
      run: () => toggleTheme(),
    },
    { id: 'motion', label: reducedMotion() ? 'Motion: reduced → allow' : 'Motion: on → reduce', group: 'Settings', keywords: 'animation', run: () => setReducedMotion(!reducedMotion()) },
    { id: 'invert', label: 'Invert memory', group: 'Memory', keywords: 'not nand easter', run: () => invertMemory() },
    { id: 'add', label: 'Load 7 + 8 into the adder', group: 'Memory', keywords: 'adder lab sum', run: () => loadAdder(7, 8) },
  ]
  if (profile.links.x) list.splice(15, 0, { id: 'x', label: 'X', group: 'Do', run: () => window.open(profile.links.x, '_blank', 'noopener') })
  if (pref !== 'system') list.push({ id: 'sys', label: 'Theme: follow the system', group: 'Settings', run: () => setTheme('system') })
  return list
}

function toggleTheme() {
  const p = cycleTheme()
  flash(`Theme: ${p === 'system' ? `system (${isDark() ? 'dark' : 'light'})` : p}`, innerWidth - 220, 40)
}

function invertMemory() {
  const hero = stack?.plane<HeroPlane>('top')
  if (hero && stage) {
    goSection('top')
    window.setTimeout(() => hero.invertAll(stage!.now()), 500)
  }
}

async function loadAdder(a: number, b: number) {
  if (location.pathname !== '/lab') await route('/lab', '', true)
  window.setTimeout(() => (stack?.docPlane as LabPlane | null)?.load(a, b), 300)
}

const palette = new Palette(commands)

function keys() {
  let typed = ''
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']
  let k = 0
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement
    const typing = t.closest('input, textarea, [contenteditable]')
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      palette.toggle()
      return
    }
    if (typing || palette.open || e.metaKey || e.ctrlKey || e.altKey) return
    k = e.key === konami[k] ? k + 1 : e.key === konami[0] ? 1 : 0
    if (k === konami.length) {
      k = 0
      degauss()
    }
    if (e.key === '/') {
      e.preventDefault()
      palette.show()
      return
    }
    const home = location.pathname === '/'
    if (home && (e.key === 'j' || e.key === 'J')) step(1)
    else if (home && (e.key === 'k' || e.key === 'K')) step(-1)
    else if (e.key === 'e') copy(profile.email, innerWidth / 2 - 40, innerHeight / 2)
    else if (e.key === 't') toggleTheme()
    else if (/^[1-6]$/.test(e.key)) goSection(['top', 'work', 'index', 'about', 'lab', 'contact'][Number(e.key) - 1])
    else if (e.key === '?') palette.show()
    typed = (typed + e.key.toLowerCase()).slice(-4)
    if (typed === 'nand') {
      invertMemory()
      flash('Every circuit on this page could be rebuilt from NAND gates alone.', innerWidth / 2 - 220, innerHeight - 80, 3200)
    }
  })
}

/* A burst of stray field: every core flips at random, then remanence wins. */
function degauss() {
  if (!stack || !stage) return
  const t = stage.now()
  stack.planes.forEach((p) => {
    const fields = (p as unknown as { field?: import('../core/gl/rings').RingField; ring?: import('../core/gl/rings').RingField })
    const f = fields.field ?? fields.ring
    if (!f) return
    const keep = f.levels.slice()
    const noise = Float32Array.from(keep, () => (Math.random() < 0.5 ? 1 : 0))
    f.wave(noise, t, f.x0 + (f.cols * f.pitch) / 2, f.y0 + (f.rows * f.pitch) / 2, t, 2200, 0.3)
    window.setTimeout(() => {
      const t2 = stage!.now()
      f.wave(keep, t2, f.x0, f.y0, t2, 1500, 0.4)
    }, 900)
  })
  flash('Degaussed. Remanence restored everything.', innerWidth / 2 - 160, innerHeight - 80, 2600)
}

/* ── forms ───────────────────────────────────────────────────────────── */

function contactForm() {
  const form = document.querySelector<HTMLFormElement>('[data-form="contact"]')
  if (!form) return
  const status = form.querySelector<HTMLElement>('.status')!
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>
    status.classList.remove('err')
    if (!data.name?.trim() || !/^\S+@\S+\.\S+$/.test(data.email ?? '') || !data.message?.trim()) {
      status.textContent = 'Name, a valid email and a message, please.'
      status.classList.add('err')
      return
    }
    status.textContent = 'Sending…'
    stack?.plane<ContactPlane>('contact')?.burst(data.message)
    const res = await api.contact({ name: data.name, email: data.email, message: data.message, website: data.website ?? '' })
    if (res.ok) {
      status.textContent = `Sent. I'll reply to ${data.email}.`
      form.reset()
    } else {
      status.innerHTML = `Couldn't send right now. <a class="wire" href="mailto:${profile.email}">Email me directly</a>.`
      status.classList.add('err')
    }
  })
}

function guestbookForm(plane: () => GuestbookPlane | undefined) {
  const form = document.querySelector<HTMLFormElement>('[data-form="guestbook"]')
  const pad = form?.querySelector<HTMLElement>('[data-pad]')
  if (!form || !pad) return
  const bits = new Uint8Array(64)
  let painting = -1
  for (let i = 0; i < 64; i++) {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('aria-pressed', 'false')
    b.setAttribute('aria-label', `Row ${Math.floor(i / 8) + 1}, cell ${(i % 8) + 1}`)
    const set = (v: number) => {
      bits[i] = v
      b.setAttribute('aria-pressed', String(v === 1))
    }
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      painting = bits[i] ? 0 : 1
      set(painting)
    })
    b.addEventListener('pointerenter', () => {
      if (painting >= 0) set(painting)
    })
    b.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        set(bits[i] ? 0 : 1)
      }
      const move: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }
      if (move[e.key] !== undefined) {
        e.preventDefault()
        const j = i + move[e.key]
        if (j >= 0 && j < 64) (pad.children[j] as HTMLElement).focus()
      }
    })
    pad.appendChild(b)
  }
  window.addEventListener('pointerup', () => (painting = -1))
  const status = form.querySelector<HTMLElement>('.status')!
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = String(new FormData(form).get('name') ?? '').trim()
    const website = String(new FormData(form).get('website') ?? '')
    status.classList.remove('err')
    if (!bits.some(Boolean) || !name) {
      status.textContent = 'Draw at least one cell and sign it.'
      status.classList.add('err')
      return
    }
    const s = [...bits].join('')
    status.textContent = 'Writing…'
    const res = await api.sign(name, s, website)
    if (res.ok) {
      const mark: Mark = { name, bits: s, pending: true }
      plane()?.add(mark)
      try {
        localStorage.setItem('mark', JSON.stringify(mark))
      } catch {
        /* ignore */
      }
      status.textContent = 'Written. Everyone sees it once I’ve had a look.'
      bits.fill(0)
      pad.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'))
      form.reset()
    } else {
      status.textContent = res.error === 'rate' ? 'That’s enough writing for now. Try later.' : 'Memory is offline right now. Try again later.'
      status.classList.add('err')
    }
  })
}

/* ── routing ─────────────────────────────────────────────────────────── */

let doc: HTMLElement | null = null
let homeScroll = 0

function docFactory(kind: string): Factory | undefined {
  if (kind === 'case') return (el, ctx) => new CasePlane(el, ctx)
  if (kind === 'lab') return (el, ctx) => new LabPlane(el, ctx)
  return undefined
}

/* the fixed door in the bottom-right: home → lab → sandbox */
function updateCorner(path: string) {
  document.querySelector('[data-corner]')?.remove()
  if (!/^\/($|lab\/?$|sandbox\/?$)/.test(path)) return
  document.body.insertAdjacentHTML('beforeend', corner(path))
}

async function showDoc(html: string, title: string) {
  if (!doc) {
    homeScroll = window.scrollY
  }
  root.classList.remove('home')
  app.style.opacity = '0'
  await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 220))
  app.hidden = true
  doc?.remove()
  doc = document.createElement('div')
  doc.className = 'page'
  doc.innerHTML = html
  document.body.appendChild(doc)
  window.scrollTo(0, 0)
  document.title = `${title} · ${profile.name}`
  const art = doc.firstElementChild as HTMLElement
  prime(art)
  // everything but the kinetic title scans in on arrival, not before the flight lands
  art.querySelectorAll<HTMLElement>('.back, .doc-head > :not([data-kinetic]), .doc-body section, .doc-body .facts li, .doc-next').forEach((el) => (el.dataset.scan = ''))
  prime(art)
  // the document's text starts to arrive late in the flight, as the camera slows
  const flying = stack?.openDoc(art, docFactory(art.dataset.plane ?? ''), () => revealSection(art))
  if (!stack) revealSection(art)
  art.querySelectorAll<HTMLElement>('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()))
  if (art.classList.contains('sandbox')) mountSandbox(art, () => stage)
  await flying
}

async function showHome(hash: string) {
  document.title = `${profile.name} · Software engineer`
  if (doc) {
    doc.remove()
    doc = null
    app.hidden = false
    root.classList.add('home')
    const target = hash ? sectionFor(hash) : null
    window.scrollTo(0, target ? target.offsetTop : homeScroll)
    const back = stack?.closeDoc()
    requestAnimationFrame(() => (app.style.opacity = '1'))
    await back
    return
  }
  app.hidden = false
  app.style.opacity = '1'
  root.classList.add('home')
  if (hash) {
    const target = sectionFor(hash)
    if (target) window.scrollTo({ top: target.offsetTop, behavior: 'auto' })
  }
}

async function route(path: string, hash: string, push = false) {
  if (push) history.pushState(null, '', path + (hash ? `#${hash}` : ''))
  updateCorner(path)
  setNav(path.startsWith('/lab') || path.startsWith('/sandbox') ? 'lab' : 'top')
  const m = path.match(/^\/work\/([\w-]+)\/?$/)
  if (m) {
    const p = projects.find((q) => q.slug === m[1] && q.featured)
    if (p) return showDoc(caseStudy(p), p.title)
  }
  if (path === '/cv' || path === '/cv/') return showDoc(cv(), 'CV')
  if (path === '/colophon' || path === '/colophon/') return showDoc(colophon(), 'How this works')
  if (path === '/lab' || path === '/lab/') return showDoc(labPage(), 'Lab')
  if (path === '/sandbox' || path === '/sandbox/') return showDoc(sandboxPage(), 'Sandbox')
  return showHome(hash)
}

function navigate(href: string, replace = false) {
  const url = new URL(href, location.href)
  if (url.origin !== location.origin) {
    location.href = href
    return
  }
  const same = url.pathname === location.pathname
  if (replace) history.replaceState(null, '', url.pathname + url.hash)
  else history.pushState(null, '', url.pathname + url.hash)
  if (same && url.pathname === '/' && url.hash) {
    goSection(url.hash.slice(1))
    return
  }
  void route(url.pathname, url.hash.slice(1))
}

function links() {
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]')
    if (a && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !a.target) {
      const url = new URL(a.href, location.href)
      if (url.origin === location.origin && !a.hasAttribute('download')) {
        e.preventDefault()
        if (url.pathname === location.pathname && url.hash && url.pathname === '/') {
          history.pushState(null, '', url.hash)
          goSection(url.hash.slice(1))
        } else navigate(url.pathname + url.hash)
        return
      }
    }
    const pal = (e.target as HTMLElement).closest('[data-palette]')
    if (pal) palette.show()
    const cp = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]')
    if (cp) copy(cp.dataset.copy ?? '', (e as MouseEvent).clientX, (e as MouseEvent).clientY)
    const mark = (e.target as HTMLElement).closest<HTMLElement>('.slot-mark')
    if (mark) {
      const slug = mark.closest<HTMLElement>('[data-slug]')?.dataset.slug
      if (slug) navigate(`/work/${slug}`)
    }
  })
  window.addEventListener('popstate', () => void route(location.pathname, location.hash.slice(1)))
}

/* ── boot ────────────────────────────────────────────────────────────── */

async function boot() {
  timelineBars()
  updateCorner(location.pathname)
  links()
  keys()
  contactForm()
  guestbookForm(() => stack?.plane<GuestbookPlane>('guestbook'))
  root.classList.add('home')

  const counter = api.visit()
  const marks = api.marks()

  const glOk = webglAvailable()
  if (!glOk) root.classList.add('no-gl')
  else root.classList.add('gl')

  const motion = !reducedMotion()
  if (motion) sectionsInOrder().forEach((s) => prime(s))
  root.classList.remove('pre')
  // hero text is scanned in while the name is being written
  window.setTimeout(() => revealSection(document.getElementById('top')!, 0.5), 30)
  let px = 0
  let py = 0
  window.addEventListener('pointermove', (e) => ((px = e.clientX), (py = e.clientY)), { passive: true })

  if (glOk) {
    const tf = performance.now()
    await fontsReady()
    if (import.meta.env.DEV) console.debug(`fonts ready after ${(performance.now() - tf).toFixed(0)} ms (page ${performance.now().toFixed(0)} ms)`)
    stage = new Stage(document.getElementById('gl') as HTMLCanvasElement)
    const factories: Record<string, Factory> = {
      hero: (el, ctx) => new HeroPlane(el, ctx),
      work: (el, ctx) => new WorkPlane(el, ctx),
      index: (el, ctx) => new IndexPlane(el, ctx),
      about: (el, ctx) => new AboutPlane(el, ctx),
      skills: (el, ctx) => new SkillsPlane(el, ctx),
      lab: (el, ctx) => new LabPlane(el, ctx),
      contact: (el, ctx) => new ContactPlane(el, ctx),
      guestbook: (el, ctx) => new GuestbookPlane(el, ctx),
    }
    stack = new Stack(stage, factories, app)
    stack.onActive = (i, el) => {
      setNav(el.id)
      if (i > 0) revealSection(el, 0.05)
    }
    await stack.build()
    stage.start()
    if (import.meta.env.DEV) {
      requestAnimationFrame(() => console.debug(`first frame at ${performance.now().toFixed(0)} ms`))
      Object.assign(window, { __stack: stack, __stage: stage })
    }
    const gb = stack.plane<GuestbookPlane>('guestbook')
    if (gb) {
      let shown: Mark | null = null
      gb.onHover = (m) => {
        if (m === shown) return
        shown = m
        if (m) flash(m.pending ? `${m.name} · waiting for review` : m.name, px, py, 0)
        else unflash()
      }
    }
    marks.then((list) => {
      let own: Mark | null = null
      try {
        own = JSON.parse(localStorage.getItem('mark') ?? 'null')
      } catch {
        own = null
      }
      const all: Mark[] = list.map((e) => ({ name: e.name, bits: e.bits, at: e.at }))
      if (own && !all.some((m) => m.bits === own!.bits && m.name === own!.name)) all.push({ ...own, pending: true })
      gb?.setMarks(all)
    })
    counter.then((n) => {
      if (n == null) return
      gb?.setCount(n)
      const sr = document.querySelector('[data-visitors]')
      if (sr) sr.textContent = `number ${n}`
    })
  } else {
    // no WebGL: reveal each section as it scrolls into view
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && revealSection(en.target as HTMLElement)),
      { threshold: 0.25 },
    )
    sectionsInOrder().forEach((s) => io.observe(s))
  }

  if (location.pathname !== '/') void route(location.pathname, location.hash.slice(1))
  ;(window as unknown as Record<string, unknown>).stan = {
    dump() {
      const hero = stack?.plane<HeroPlane>('top')
      if (!hero) return 'no memory mounted'
      const f = hero.ring
      let out = ''
      for (let r = 0; r < f.rows; r++) {
        for (let c = 0; c < f.cols; c++) out += ' ░▒▓█'[Math.round(f.levels[r * f.cols + c] * 4)]
        out += '\n'
      }
      return out
    },
  }
  console.log(
    '%cStan Theunissen%c\nEverything on this page is stored in a simulated core memory and computed by simulated logic.\nTry stan.dump(), the palette (⌘K), or typing "nand".\nSource: ' + profile.source,
    'font: 700 16px system-ui',
    'font: 12px ui-monospace, monospace',
  )
}

void boot()

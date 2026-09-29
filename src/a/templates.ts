/* Pure data → HTML. Used at build time (prerender into index.html) and at
   runtime (client routes). No DOM access at import. */

import { profile, projects, featured, timeline, skills, type Project } from '../content/site.ts'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const mail = `mailto:${profile.email}`

export function bar(active = 'top') {
  const items = [
    ['work', 'Work', '/#work'],
    ['index', 'Index', '/#index'],
    ['about', 'About', '/#about'],
    ['lab', 'Lab', '/lab'],
    ['contact', 'Contact', '/#contact'],
  ]
  return `
<header class="bar">
  <a class="brand" href="/#top" data-nav="top">${esc(profile.name)}</a>
  <nav aria-label="Sections">
    ${items.map(([id, label, href]) => `<a class="wire" href="${href}" data-nav="${id}"${id === active ? ' aria-current="true"' : ''}>${label}</a>`).join('')}
    <button class="kbd wire" type="button" data-palette aria-label="Open command palette">⌘K</button>
  </nav>
  <button class="menu wire" type="button" data-palette aria-label="Open menu">Menu</button>
</header>`
}

function hero() {
  return `
<section class="sec hero" id="top" data-plane="hero" aria-labelledby="hero-name">
  <h1 id="hero-name" class="hero-fallback">${esc(profile.name)}</h1>
  <div class="slot slot-name" data-slot="name" aria-hidden="true"></div>
  <div class="hero-foot">
    <p class="lead" data-scan>${esc(profile.statement)}</p>
    <div class="hero-side">
      <p class="avail" data-scan><span>Available</span> ${esc(profile.availability)}</p>
      <p class="now" data-scan>${esc(profile.now)}</p>
      <div class="hero-cta">
        <a class="wire cta" href="${mail}">Email me</a>
        <button class="mono copy" type="button" data-copy="${esc(profile.email)}" aria-label="Copy email address">${esc(profile.email)}</button>
      </div>
    </div>
  </div>
</section>`
}

function links(p: Project) {
  const own = p.featured ? `<a class="wire" href="/work/${p.slug}" data-route>Read the build</a>` : ''
  const ext = p.links.map((l) => `<a class="wire" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')
  return own + ext
}

function work(p: Project, i: number) {
  return `
<section class="sec work${i % 2 ? ' flip' : ''}" id="work-${p.slug}" data-plane="work" data-slug="${p.slug}" aria-labelledby="t-${p.slug}">
  ${i === 0 ? '<span class="anchor" id="work"></span>' : ''}
  <div class="work-grid">
    <div class="work-text">
      <p class="kicker mono">${esc(p.kicker)}</p>
      <h2 class="title" id="t-${p.slug}" data-kinetic>${esc(p.title)}</h2>
      <p class="summary" data-scan>${esc(p.summary)}</p>
      ${p.facts.length ? `<ul class="facts">${p.facts.map((f) => `<li data-scan>${esc(f)}</li>`).join('')}</ul>` : ''}
      ${p.stack.length ? `<p class="stack mono" data-scan>${p.stack.map(esc).join('<span> · </span>')}</p>` : ''}
      <p class="more">${links(p)}</p>
    </div>
    <div class="slot slot-mark" data-slot="mark" aria-hidden="true"></div>
  </div>
</section>`
}

function index() {
  const row = (p: Project) => {
    const href = p.featured ? `/work/${p.slug}` : p.links[0]?.href ?? ''
    const ext = !p.featured && href.startsWith('http')
    const tag = href ? 'a' : 'div'
    const attrs = href ? ` href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ' data-route'}` : ''
    return `<li><${tag} class="row" data-row="${p.slug}"${attrs}>
      <span class="r-title">${esc(p.title)}</span>
      <span class="r-kind">${esc(p.kind)}</span>
      <span class="r-stack mono">${esc(p.stack.slice(0, 3).join(' · '))}</span>
      <span class="r-year mono">${esc(p.year)}</span>
    </${tag}></li>`
  }
  return `
<section class="sec index" id="index" data-plane="index" aria-labelledby="h-index">
  <h2 class="head" id="h-index" data-kinetic>Index</h2>
  <ol class="rows">${projects.map(row).join('')}</ol>
  <div class="slot slot-index" data-slot="index" aria-hidden="true"></div>
</section>`
}

function span(s: (typeof timeline)[number]) {
  const [y, m] = s.start.split('-')
  return `<li data-start="${s.start}" data-end="${s.end ?? ''}"><span class="t-label">${esc(s.label)}</span><span class="t-detail">${esc(s.detail)}</span><span class="t-when mono">${m}.${y} → ${s.end ? s.end.replace('-', '.') : 'now'}</span></li>`
}

function about() {
  return `
<section class="sec about" id="about" data-plane="about" aria-labelledby="h-about">
  <div class="about-grid">
    <div class="about-text">
      <h2 class="head" id="h-about" data-kinetic>About</h2>
      <p class="bio" data-scan>Third-year Computer Science at TU/e, in Eindhoven. I write a lot of software, and most of it now runs on agents: harnesses, tool layers, pipelines that finish real work. I also keep infrastructure running at LIS and work on autonomy for Team Polar.</p>
      <ol class="timeline" data-timeline>${timeline.map(span).join('')}</ol>
    </div>
    <div class="slot slot-portrait" data-slot="portrait" role="img" aria-label="Portrait of Stan, dithered into the core memory"></div>
  </div>
</section>`
}

function skillsSec() {
  return `
<section class="sec skills" id="skills" data-plane="skills" aria-labelledby="h-skills">
  <h2 class="head" id="h-skills" data-kinetic>Skills</h2>
  <p class="explain" data-scan>Skills are inputs. Switch one on and the signal runs to everything it built.</p>
  <div class="slot slot-skills" data-slot="skills">
    <div class="skill-row" role="group" aria-label="Skills">${skills.map((s, i) => `<button class="skill" type="button" data-skill="${i}" aria-pressed="false">${esc(s.name)}</button>`).join('')}</div>
    <ol class="skill-outs" aria-label="Projects">${projects.map((p) => `<li data-out="${p.slug}">${esc(p.title)}</li>`).join('')}</ol>
  </div>
</section>`
}

function contact() {
  const x = profile.links.x ? `<a class="wire" href="${esc(profile.links.x)}" target="_blank" rel="noopener">X</a>` : ''
  return `
<section class="sec contact" id="contact" data-plane="contact" aria-labelledby="h-contact">
  <h2 class="head" id="h-contact" data-kinetic>Contact</h2>
  <a class="wire email" href="${mail}">${esc(profile.email)}</a>
  <div class="contact-grid">
    <form class="form" data-form="contact" novalidate>
      <label><span class="mono">Name</span><input name="name" autocomplete="name" required maxlength="80"></label>
      <label><span class="mono">Email</span><input name="email" type="email" autocomplete="email" required maxlength="160"></label>
      <label class="full"><span class="mono">Message</span><textarea name="message" rows="3" required maxlength="4000" data-uart></textarea></label>
      <input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="form-foot"><button class="wire send" type="submit">Send</button><p class="status mono" role="status"></p></div>
    </form>
    <div class="elsewhere">
      <a class="wire" href="${esc(profile.links.github)}" target="_blank" rel="noopener">GitHub</a>
      <a class="wire" href="${esc(profile.links.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>
      ${x}
      <a class="wire" href="/cv" data-route>CV</a>
    </div>
  </div>
  <div class="slot slot-uart" data-slot="uart" aria-hidden="true"></div>
</section>`
}

function guestbook() {
  return `
<section class="sec guestbook" id="guestbook" data-plane="guestbook" aria-labelledby="h-guestbook">
  <h2 class="head" id="h-guestbook" data-kinetic>Guestbook</h2>
  <div class="gb-grid">
    <div class="gb-text">
      <p>Write yourself into memory. Draw a mark, sign it, and it stays with the rest.</p>
      <form class="gb-form" data-form="guestbook">
        <div class="gb-pad" role="grid" aria-label="Your mark, 8 by 8 cells" data-pad></div>
        <label><span class="mono">Signed</span><input name="name" maxlength="24" required autocomplete="nickname"></label>
        <input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form-foot"><button class="wire send" type="submit">Write to memory</button><p class="status mono" role="status"></p></div>
      </form>
    </div>
    <div class="slot slot-guestbook" data-slot="guestbook" aria-hidden="true"></div>
  </div>
  <footer class="foot">
    <p class="visitors mono"><span>Visitor</span><span class="slot slot-counter" data-slot="counter" aria-hidden="true"></span><span class="sr" data-visitors></span></p>
    <p class="mono">© 2026 ${esc(profile.name)} · ${esc(profile.location)} · <a class="wire" href="/colophon" data-route>How this works</a></p>
  </footer>
</section>`
}

export function home() {
  return [hero(), ...featured.map(work), index(), about(), skillsSec(), contact(), guestbook()].join('\n')
}

/* ── sub pages ──────────────────────────────────────────────────────── */

export function caseStudy(p: Project) {
  const next = featured[(featured.indexOf(p) + 1) % featured.length]
  return `
<article class="doc case" data-plane="case" data-slug="${p.slug}">
  <a class="wire back mono" href="/#work-${p.slug}" data-route>← Work</a>
  <div class="slot slot-case" data-slot="mark" aria-hidden="true"></div>
  <header class="doc-head">
    <p class="kicker mono">${esc(p.kicker)}</p>
    <h1 class="title" data-kinetic>${esc(p.title)}</h1>
    <p class="summary">${esc(p.summary)}</p>
  </header>
  <div class="doc-body">
    ${p.facts.length ? `<ul class="facts">${p.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    ${p.story.map((s) => `<section><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p></section>`).join('')}
    ${p.stack.length ? `<section><h2>Stack</h2><p class="mono">${p.stack.map(esc).join(' · ')}</p></section>` : ''}
    ${p.links.length ? `<p class="more">${p.links.map((l) => `<a class="wire" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>` : ''}
  </div>
  <nav class="doc-next"><a class="wire" href="/work/${next.slug}" data-route><span class="mono">Next</span> ${esc(next.title)}</a></nav>
</article>`
}

export function cv() {
  const exp = timeline
    .map((s) => `<li><span class="mono when">${s.start.replace('-', '.')} → ${s.end ? s.end.replace('-', '.') : 'now'}</span><span class="what">${esc(s.label)}</span><span class="detail">${esc(s.detail)}</span></li>`)
    .join('')
  const work = projects
    .map((p) => `<li><span class="mono when">${esc(p.year)}</span><span class="what">${esc(p.title)}</span><span class="detail">${esc(p.summary)}</span></li>`)
    .join('')
  return `
<article class="doc cv" data-plane="doc">
  <header class="doc-head">
    <a class="wire back mono" href="/" data-route>← Home</a>
    <h1 class="title">${esc(profile.name)}</h1>
    <p class="summary">${esc(profile.statement)}</p>
    <p class="mono cv-contact"><a class="wire" href="${mail}">${esc(profile.email)}</a> · ${esc(profile.location)} · <a class="wire" href="${esc(profile.links.github)}">github.com/ZiineZ</a></p>
  </header>
  <div class="doc-body">
    <section><h2>Now</h2><ol class="cv-list">${exp}</ol></section>
    <section><h2>Work</h2><ol class="cv-list">${work}</ol></section>
    <section><h2>Skills</h2><p>${skills.map((s) => esc(s.name)).join(', ')}.</p></section>
    <section><h2>Languages</h2><p>Dutch and English, both native.</p></section>
    <p class="more"><button class="wire" type="button" data-print>Print or save as PDF</button></p>
  </div>
</article>`
}

export function labPage() {
  return `
<article class="doc lab-page" data-plane="lab">
  <header class="doc-head">
    <a class="wire back mono" href="/" data-route>← Home</a>
    <h1 class="title" data-kinetic>Lab</h1>
    <p class="summary" data-scan>My favourite basic logic circuit (aside from the <abbr title="carry-lookahead adder">CLA</abbr>): a four-bit ripple-carry adder.</p>
    <p class="explain" data-scan>Flip the switches. Every carry has to arrive before the next bit is allowed to settle, so you can watch the answer ripple across.</p>
  </header>
  <div class="slot slot-adder" data-slot="adder"></div>
</article>`
}

export function sandboxPage() {
  return `
<article class="doc sandbox" data-plane="doc">
  <header class="doc-head">
    <a class="wire back mono" href="/lab" data-route>← Lab</a>
    <h1 class="title" data-kinetic>Sandbox</h1>
    <p class="summary" data-scan>Place gates, wire them, flip the inputs. Signals take real time to travel, so watch the order things change.</p>
  </header>
  <div class="sb" data-sandbox></div>
</article>`
}

/** Fixed bottom-right door: home → lab → sandbox. */
export function corner(path: string) {
  const to = path.startsWith('/lab') ? ['/sandbox', 'Sandbox'] : path.startsWith('/sandbox') ? ['/lab', 'Lab'] : ['/lab', 'Lab']
  return `<a class="corner" href="${to[0]}" data-route data-corner><svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true"><path d="M1 6h6M1 14h6M21 10h6" /><path d="M7 2h7a8 8 0 0 1 0 16H7z" /></svg><span>${to[1]}</span><span class="arrow" aria-hidden="true">→</span></a>`
}

export function colophon() {
  return `
<article class="doc colophon" data-plane="doc">
  <header class="doc-head">
    <a class="wire back mono" href="/" data-route>← Home</a>
    <h1 class="title">How this works</h1>
    <p class="summary">Everything on the home page is stored in a simulated magnetic-core memory and computed by simulated logic.</p>
  </header>
  <div class="doc-body">
    <section><h2>Core memory</h2><p>Before chips, computers stored bits in tiny ferrite rings threaded on a grid of wires. Send half the current needed down one row and half down one column, and only the ring where they cross flips. Here, every ring is an instanced quad drawn by a shader, and writing a bit flips it around its diagonal like a flip-dot.</p></section>
    <section><h2>The logic</h2><p>Gates are simulated event by event. A changed output sends a front down its wire at a fixed speed; the next gate sees it when it arrives and answers after its own delay. The orange you see is exactly the part of each wire that is high right now.</p></section>
    <section><h2>The refresh counter</h2><p>The row decoder on the home page is fed by a counter that counts in Gray code, so only one address bit changes per step and the decoder never glitches.</p></section>
    <section><h2>Built with</h2><p class="mono">TypeScript · three.js · GSAP · Mona Sans · Geist Mono · Node with SQLite</p></section>
  </div>
</article>`
}

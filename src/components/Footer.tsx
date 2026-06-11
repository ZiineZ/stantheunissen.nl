import { links } from '../data/cv'

/* Solid orange band with a square-wave timing diagram running through it. */
function TimingWave() {
  const period = 96
  const hi = 18
  const lo = 44
  let d = `M 0 ${lo}`
  let level = false
  for (let x = 0; x <= 1248; x += period / 2) {
    level = !level
    const y = level ? hi : lo
    d += ` H ${x} V ${y}`
  }
  d += ' H 1300'
  return (
    <svg viewBox="0 0 1248 60" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="2" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer>
      <div className="stripe">
        <TimingWave />
      </div>
      <div className="footer">
        <div className="container footer-inner">
          <p className="footer-note">© 2026 Stan Theunissen · Eindhoven</p>
          <div className="footer-links">
            <a href={`mailto:${links.email}`}>Email</a>
            <a href={links.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={links.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

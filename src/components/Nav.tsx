import { motion, useScroll, useSpring } from 'motion/react'
import { scrollToId } from '../lib/scroll'

const items = [
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
]

export default function Nav() {
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.4 })

  return (
    <header className="nav">
      <motion.div className="scroll-trace" style={{ scaleX: progress }} />
      <div className="nav-inner">
        <a
          href="#top"
          className="nav-brand"
          onClick={(e) => {
            e.preventDefault()
            scrollToId('top')
          }}
        >
          <svg width="26" height="22" viewBox="0 0 36 31" fill="none" stroke="#fa520f" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
            <path d="M2 11 H9 M2 20 H9 M28 15.5 H34" />
            <path d="M9 7 H18 A 8.5 8.5 0 0 1 18 24 H9 Z" />
          </svg>
          STAN THEUNISSEN
        </a>
        <nav className="nav-links" aria-label="Sections">
          {items.map((it) => (
            <a
              key={it.id}
              href={`#${it.id}`}
              className="nav-link"
              onClick={(e) => {
                e.preventDefault()
                scrollToId(it.id)
              }}
            >
              {it.label}
            </a>
          ))}
        </nav>
        <a
          href="#contact"
          className="btn btn-primary nav-cta"
          onClick={(e) => {
            e.preventDefault()
            scrollToId('contact')
          }}
        >
          Get in touch
        </a>
      </div>
    </header>
  )
}

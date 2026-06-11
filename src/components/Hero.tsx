import { motion } from 'motion/react'
import { scrollToId } from '../lib/scroll'

const ease = [0.22, 1, 0.36, 1] as const

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container">
        <div className="hero-copy">
          <motion.h1
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.1 }}
          >
            Logic, all the
            <br />
            way <em>down.</em>
          </motion.h1>
          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.3 }}
          >
            I'm <strong>Stan Theunissen</strong>. I study computer science at TU/e and
            run technical infrastructure at LIS. Simple parts, honest behaviour, no
            magic.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.45 }}
          >
            <a
              href="#projects"
              className="btn btn-dark"
              onClick={(e) => {
                e.preventDefault()
                scrollToId('projects')
              }}
            >
              View projects
            </a>
            <a href="/StanTheunissen-CV.pdf" className="btn btn-ghost" download>
              Download CV
            </a>
            <span className="status-pill">
              <span className="dot" />
              OPEN TO OPPORTUNITIES
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

import { motion } from 'motion/react'
import SectionHead from './SectionHead'
import GateGlyph from './GateGlyph'
import { projects } from '../data/cv'

export default function Projects() {
  return (
    <section className="section" id="projects">
      <div className="container">
        <SectionHead num="03" title="Projects" />
        <div className="proj-grid">
          {projects.map((p, i) => {
            const card = (
              <>
                <GateGlyph kind={p.gate} />
                <h3 className="proj-title">{p.title}</h3>
                <p className="proj-desc">{p.desc}</p>
                <div className="proj-foot">
                  {p.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                {p.link && <span className="proj-link">{p.link.label}</span>}
              </>
            )
            const common = {
              className: 'proj-card',
              initial: { opacity: 0, y: 30 },
              whileInView: { opacity: 1, y: 0 },
              viewport: { once: true, margin: '-60px' },
              transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay: (i % 3) * 0.09 },
            }
            return p.link ? (
              <motion.a key={p.title} href={p.link.href} target="_blank" rel="noreferrer" {...common}>
                {card}
              </motion.a>
            ) : (
              <motion.article key={p.title} {...common}>
                {card}
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

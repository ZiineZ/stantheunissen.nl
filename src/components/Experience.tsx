import Reveal from './Reveal'
import SectionHead from './SectionHead'
import { experience } from '../data/cv'

export default function Experience() {
  return (
    <section className="section" id="experience">
      <div className="container">
        <SectionHead num="02" title="Experience" />
        <Reveal delay={0.1}>
          <div className="xp-list">
            {experience.map((xp) => (
              <article className="xp-row" key={xp.org + xp.role}>
                <div className="xp-when">
                  {xp.current ? (
                    <>
                      {xp.when.replace('NOW', '')}
                      <span className="now">NOW</span>
                    </>
                  ) : (
                    xp.when
                  )}
                </div>
                <div>
                  <h3 className="xp-role">{xp.role}</h3>
                  <p className="xp-org">{xp.org}</p>
                  <p className="xp-desc">{xp.desc}</p>
                </div>
                <div className="xp-tags">
                  {xp.tags.map((t) => (
                    <span className="tag" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

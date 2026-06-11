import Reveal from './Reveal'
import SectionHead from './SectionHead'

export default function About() {
  return (
    <section className="section" id="about">
      <div className="container">
        <SectionHead num="01" title="About" />
        <Reveal delay={0.12}>
          <div className="about-panel">
            <div className="about-body">
              <p className="about-pull">
                Simple parts. Honest behaviour. <em>No magic.</em>
              </p>
              <p>
                I got hooked on computing at the lowest level, where everything clever
                is a handful of gates taking turns. Today that means running networks,
                access and databases for the Mathematics and Computer Science department
                at TU/e, and building whatever I can think up: games, robots, trading
                bots, this site.
              </p>
            </div>
            <ul className="feature-list">
              <li>
                <span>
                  <b>Fundamentals.</b> Data structures, networks, cryptology, systems
                </span>
              </li>
              <li>
                <span>
                  <b>Range.</b> Desktop, web, robotics
                </span>
              </li>
              <li>
                <span>
                  <b>Operations.</b> Networks, access management, databases
                </span>
              </li>
              <li>
                <span>
                  <b>Languages.</b> Dutch and English, both native
                </span>
              </li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

import Reveal from './Reveal'
import { links } from '../data/cv'

export default function Contact() {
  return (
    <section className="section" id="contact">
      <div className="container">
        <Reveal>
          <div className="contact-panel">
            <h2>
              Let's <em>talk.</em>
            </h2>
            <div className="contact-actions">
              <a className="btn btn-dark" href={`mailto:${links.email}`}>
                {links.email}
              </a>
              <a className="btn btn-ghost" href={links.github} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a className="btn btn-ghost" href={links.linkedin} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </div>
            <p className="contact-meta mono">EINDHOVEN, NL · UTC+2</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

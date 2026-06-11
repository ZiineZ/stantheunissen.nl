import Reveal from './Reveal'
import SectionHead from './SectionHead'
import { pinsLeft, pinsRight, skillGroups } from '../data/cv'

function ChipPinout() {
  const pinY = (i: number) => 64 + i * 47

  return (
    <svg viewBox="0 0 430 460" role="img" aria-label="STAN-1 chip pinout of skills">
      <rect x="150" y="28" width="130" height="404" rx="9" fill="#fffefa" stroke="#1f1f1f" strokeWidth="1.8" />
      <path d="M 201 28 A 14 14 0 0 0 229 28" fill="#ffffff" stroke="#1f1f1f" strokeWidth="1.8" />
      <circle cx="168" cy="52" r="4" fill="#fa520f" />

      <text
        x="215"
        y="241"
        textAnchor="middle"
        fontFamily="'Instrument Serif', serif"
        fontSize="38"
        letterSpacing="0.06em"
        fill="#1f1f1f"
        transform="rotate(90 215 230)"
      >
        STAN-1
      </text>

      {pinsLeft.map((label, i) => (
        <g className="pin-group" key={label}>
          <rect className="pin-leg" x="126" y={pinY(i) - 5} width="24" height="10" rx="2" fill="rgba(31,31,31,0.25)" />
          <text className="pin-label" x="116" y={pinY(i) + 4} textAnchor="end">
            {label}
          </text>
          <text x="160" y={pinY(i) + 3.5} fontFamily="'IBM Plex Mono', monospace" fontSize="8" fill="rgba(31,31,31,0.35)">
            {i + 1}
          </text>
        </g>
      ))}
      {pinsRight.map((label, i) => (
        <g className="pin-group" key={label}>
          <rect className="pin-leg" x="280" y={pinY(7 - i) - 5} width="24" height="10" rx="2" fill="rgba(31,31,31,0.25)" />
          <text className="pin-label" x="314" y={pinY(7 - i) + 4} textAnchor="start">
            {label}
          </text>
          <text x="270" y={pinY(7 - i) + 3.5} textAnchor="end" fontFamily="'IBM Plex Mono', monospace" fontSize="8" fill="rgba(31,31,31,0.35)">
            {i + 9}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function Skills() {
  return (
    <section className="section" id="skills">
      <div className="container">
        <SectionHead num="04" title="Skills" />
        <Reveal delay={0.1}>
          <div className="skills-grid">
            <div className="chip-wrap">
              <ChipPinout />
            </div>
            <div>
              {skillGroups.map((g) => (
                <div className="skill-group" key={g.name}>
                  <h3>{g.name}</h3>
                  <div className="skill-tags">
                    {g.items.map((s) => (
                      <span className="tag" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

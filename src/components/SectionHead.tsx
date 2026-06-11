import Reveal from './Reveal'

interface Props {
  num: string
  title: React.ReactNode
}

export default function SectionHead({ num, title }: Props) {
  return (
    <div className="head-halo">
      <Reveal>
        <div className="section-head mono">
          <span className="num">{num}</span>
          <span className="rule" />
        </div>
        <h2 className="section-title">{title}</h2>
      </Reveal>
    </div>
  )
}

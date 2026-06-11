import { useEffect } from 'react'
import CircuitBackground from './circuit/CircuitBackground'
import Nav from './components/Nav'
import Hero from './components/Hero'
import About from './components/About'
import Experience from './components/Experience'
import Projects from './components/Projects'
import Skills from './components/Skills'
import Contact from './components/Contact'
import Footer from './components/Footer'
import { initLenis } from './lib/scroll'

export default function App() {
  useEffect(() => initLenis(), [])

  return (
    <>
      <CircuitBackground />
      <div className="site">
        <Nav />
        <main>
          <Hero />
          <About />
          <Experience />
          <Projects />
          <Skills />
          <Contact />
        </main>
        <Footer />
      </div>
    </>
  )
}

export interface Experience {
  when: string
  current?: boolean
  role: string
  org: string
  desc: string
  tags: string[]
}

export const experience: Experience[] = [
  {
    when: '2026.05 → NOW',
    current: true,
    role: 'Technical Infrastructure & IT',
    org: 'LIS · MetaForum · TU Eindhoven',
    desc: 'First call for every technical problem in the Mathematics and Computer Science department. Networks, access management, databases.',
    tags: ['Networks', 'Databases'],
  },
  {
    when: '2023.11 → 2026.05',
    role: 'Medior Sales Advocate',
    org: 'Amac · Apple Premium Reseller',
    desc: 'Consultative sales. Three years of making complex tech sound simple.',
    tags: ['Advisory'],
  },
  {
    when: '2024.09 → NOW',
    current: true,
    role: 'BSc Computer Science',
    org: 'Eindhoven University of Technology',
    desc: 'Data structures, software design and specification, cryptology, networks, computer systems.',
    tags: ['Year 2'],
  },
  {
    when: '2024.09 → NOW',
    current: true,
    role: 'MASV Member · ex-Treasurer',
    org: 'GEWIS · Study Association',
    desc: 'Long-term strategy for the association. Previously treasurer of the first-year committee.',
    tags: ['Strategy'],
  },
  {
    when: '2022.05 → 2023.05',
    role: 'Elderly Support Worker',
    org: 'Lyvia · Landgraaf',
    desc: 'Support work in elderly care. Calm under responsibility.',
    tags: ['Care'],
  },
]

export type GateGlyphKind = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOT'

export interface Project {
  title: string
  desc: string
  tags: string[]
  gate: GateGlyphKind
  link?: { href: string; label: string }
}

export const projects: Project[] = [
  {
    title: 'ChainReaction',
    desc: 'Grid-based strategy game in JavaFX. Custom animations, fast and predictable core logic.',
    tags: ['Java', 'JavaFX'],
    gate: 'XOR',
  },
  {
    title: 'BalanceOS',
    desc: 'Full-stack administration tool: receipt imports, spending tracking, balance sheets.',
    tags: ['Java', 'Full-stack'],
    gate: 'AND',
  },
  {
    title: 'City-Mapping Robot',
    desc: 'Autonomous TurtleBot3 that maps its surroundings in real time. Simulated in Unity and Gazebo.',
    tags: ['ROS2', 'Unity'],
    gate: 'NAND',
  },
  {
    title: 'huisgenootjes.nl',
    desc: 'Chore scheduler for housemates. Seed-based, synchronized, no backend.',
    tags: ['JavaScript', 'Live'],
    gate: 'OR',
    link: { href: 'https://huisgenootjes.nl', label: 'VISIT →' },
  },
  {
    title: 'Optiver Arbitrage Bot',
    desc: 'Trading algorithm with Black-Scholes pricing, built for raw speed at the Optiver hackathon.',
    tags: ['Python', 'Quant'],
    gate: 'NOT',
  },
  {
    title: 'This site',
    desc: 'Hand-written canvas engine simulating the live logic circuit behind this text.',
    tags: ['TypeScript', 'Canvas'],
    gate: 'XOR',
    link: { href: 'https://github.com/ZiineZ', label: 'SOURCE →' },
  },
]

export const pinsLeft = ['JAVA', 'C / C++', 'PYTHON', 'JAVASCRIPT', 'SQL', 'GIT', 'LINUX', 'ROS2']
export const pinsRight = ['NEXT.JS', 'JAVAFX', 'SUPABASE', 'UNITY', 'GODOT', 'SCRUM', 'TDD', 'NETWORKS']

export const skillGroups: Array<{ name: string; items: string[] }> = [
  {
    name: 'LANGUAGES',
    items: ['Java', 'C', 'C++', 'Python', 'JavaScript / TypeScript', 'SQL'],
  },
  {
    name: 'TOOLS',
    items: ['JavaFX', 'Next.js', 'Supabase', 'Git', 'Linux', 'ROS2', 'Unity', 'Godot'],
  },
  {
    name: 'PRACTICE',
    items: ['Agile / SCRUM', 'TDD', 'Spec-driven development', 'IOCO'],
  },
  {
    name: 'SPOKEN',
    items: ['Dutch (native)', 'English (native)'],
  },
]

export const links = {
  email: 's.l.h.theunissen@gmail.com',
  github: 'https://github.com/ZiineZ',
  linkedin: 'https://www.linkedin.com/in/stan-theunissen-002aa6291',
  site: 'https://stantheunissen.nl',
}

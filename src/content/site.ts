/* All site copy and facts live here. Stan edits this file; everything else reads it.
   Rule: nothing in here is invented. Unknowns stay out or are marked `confirm`. */

export const profile = {
  name: 'Stan Theunissen',
  first: 'Stan',
  last: 'Theunissen',
  role: 'Software engineer',
  statement: 'Software engineer. I build AI agents, autonomous systems and the infrastructure they run on.',
  now: 'Computer Science at TU/e, year three. Infrastructure at LIS. Autonomy at Team Polar.',
  location: 'Eindhoven, NL',
  timezone: 'Europe/Amsterdam',
  availability: 'for internships and ambitious projects',
  email: 's.l.h.theunissen@gmail.com',
  links: {
    github: 'https://github.com/ZiineZ',
    linkedin: 'https://www.linkedin.com/in/stan-theunissen-002aa6291',
    // confirm: X handle not known yet. Set it and the link appears everywhere.
    x: '' as string,
  },
  source: 'https://github.com/ZiineZ',
} as const

export interface Project {
  slug: string
  title: string
  /** what it is, in two or three words (index column) */
  kind: string
  /** one short line under the title: role, context, year */
  kicker: string
  summary: string
  facts: string[]
  stack: string[]
  /** longer case-study paragraphs, rendered on /work/:slug */
  story: { heading: string; body: string }[]
  links: { label: string; href: string }[]
  /** which procedural bitmap the memory plane stores for this project */
  mark: 'agent' | 'hiriqa' | 'polar' | 'aica' | 'rdp' | 'seaside' | 'robot' | 'site'
  featured: boolean
  year: string
}

export const projects: Project[] = [
  {
    slug: 'agent',
    kind: 'AI agent',
    title: 'Personal agent',
    kicker: 'Solo build · ongoing',
    summary:
      'My own AI agent. A harness I wrote myself, wrapped around a sandboxed virtual machine with its own tools, so it can do the work instead of describing it.',
    facts: ['Custom harness', 'Own sandboxed VM', 'Own tooling layer'],
    stack: [],
    story: [
      {
        heading: 'Why',
        body: 'Chat assistants stop at advice. I wanted something that finishes the job: opens the files, runs the code, checks the result.',
      },
      {
        heading: 'What it is',
        body: 'A custom agent harness with its own environment: a sandboxed VM it can break without breaking my machine, and a tooling layer I control end to end.',
      },
    ],
    links: [],
    mark: 'agent',
    featured: true,
    year: 'Now',
  },
  {
    slug: 'hiriqa',
    kind: 'AI platform',
    title: 'Hiriqa',
    kicker: 'Built solo · 2026 · in development',
    summary:
      'Cold job outreach, automated. Hiriqa collects companies, finds the right person, reads their site and drafts the email. You review, then send.',
    facts: [
      'Five agent workers behind a semaphore queue',
      'Live run view over Server-Sent Events',
      'Replies pulled over IMAP and sorted by intent',
      'Follow-ups that cancel themselves on reply',
    ],
    stack: ['Next.js', 'Prisma', 'PostgreSQL', 'OpenRouter', 'Nodemailer', 'Cheerio'],
    story: [
      {
        heading: 'The pipeline',
        body: 'Each worker enriches (verified contact finder first, then site scraping, then a clearly labelled guess), researches the company’s own pages, and drafts through an LLM. Drafts stream into a review panel as they finish.',
      },
      {
        heading: 'The rest of the job',
        body: 'A real mailbox pulls replies over IMAP and sorts them: wants to meet, open to talk, rejected, auto-reply. One polite follow-up threads under the original after a few quiet days and cancels itself the moment they answer.',
      },
      {
        heading: 'Where it started',
        body: 'Massa, a native desktop cockpit in Tauri v2 and Rust with a local SQLite store. Hiriqa is the same idea rebuilt as a web workspace.',
      },
    ],
    links: [],
    mark: 'hiriqa',
    featured: true,
    year: '2026',
  },
  {
    slug: 'polar',
    kind: 'Autonomy',
    title: 'Team Polar',
    kicker: 'Autonomy · TU/e student team',
    summary:
      'Software for Team Polar’s autonomous rover: the part that lets it drive itself. The repository is private; ask and I’ll walk you through it.',
    facts: ['Autonomous rover', 'TU/e student team', 'Private repository'],
    stack: [],
    story: [
      {
        heading: 'Note',
        body: 'This work sits under a team agreement, so the details stay off the public web. I’m glad to go through the architecture in a conversation.',
      },
    ],
    links: [],
    mark: 'polar',
    featured: true,
    year: 'Now',
  },
  {
    slug: 'aica-3',
    kind: 'Multi-agent tutor',
    title: 'AICA-3',
    kicker: 'Multi-agent tutor · 2026',
    summary:
      'A tutor for university courses. Behind one chat box, a supervisor and a small team of agents plan the turn, pull the course material, choose the teaching move and check the answer.',
    facts: [
      'Turn time down from ~40 s to ~8 s',
      'Parallel worker agents on Cerebras',
      'Answers stream token by token',
      'Roadmap, exercises and wiki update themselves',
    ],
    stack: ['Next.js', 'TypeScript', 'FastAPI', 'PostgreSQL + pgvector', 'Cerebras', 'OpenRouter'],
    story: [
      {
        heading: 'One message, many agents',
        body: 'The supervisor plans while a knowledge agent does retrieval and doubles as a relevance gate. A pedagogical agent picks the teaching move, specialists write examples or catch misconceptions, and an evaluation agent checks the reply before it goes out.',
      },
      {
        heading: 'Speed',
        body: 'Independent stages run in parallel, the worker agents run on Cerebras, and the answer streams as it is written. Together that took a turn from about forty seconds to about eight.',
      },
    ],
    links: [{ label: 'Source', href: 'https://github.com/ZiineZ/aica-3' }],
    mark: 'aica',
    featured: true,
    year: '2026',
  },
  {
    slug: 'gewis-rdp',
    kind: 'Native app',
    title: 'GEWIS Remote Desktop',
    kicker: 'Rust · Tauri 2 · 2026',
    summary:
      'Microsoft’s Mac client can’t speak the Kerberos the GEWIS gateway requires, and Homebrew’s FreeRDP ships without it. So I built a client that can.',
    facts: [
      'Bundled FreeRDP built with Kerberos',
      'Hardware H.264 decode via VideoToolbox',
      'Skips the gateway on TU/e WiFi',
      'Installers for macOS and Windows',
    ],
    stack: ['Rust', 'Tauri 2', 'FreeRDP', 'SDL3', 'Metal'],
    story: [
      {
        heading: 'The problem',
        body: 'The GEWIS RD Gateway requires Kerberos. Microsoft’s macOS client only speaks NTLM and fails with 0x3707; the Homebrew FreeRDP bottle is compiled with Kerberos switched off.',
      },
      {
        heading: 'The fix',
        body: 'A native app that ships its own FreeRDP with Kerberos on, hardware H.264 decode and SDL3 + Metal rendering. On TU/e WiFi it detects that the RDP server is reachable directly and skips the HTTPS gateway for Windows-level latency.',
      },
    ],
    links: [
      { label: 'Source', href: 'https://github.com/ZiineZ/gewis-rdp' },
      { label: 'Releases', href: 'https://github.com/ZiineZ/gewis-rdp/releases' },
    ],
    mark: 'rdp',
    featured: true,
    year: '2026',
  },
  {
    slug: 'seaside',
    kind: 'Website',
    title: 'Seaside Technologies',
    kicker: 'Company site · 2026',
    summary: 'A cinematic single-page company site built on shaders.',
    facts: [],
    stack: ['vinext', 'Paper Shaders'],
    story: [],
    links: [],
    mark: 'seaside',
    featured: false,
    year: '2026',
  },
  {
    slug: 'city-robot',
    kind: 'Robotics',
    title: 'City-mapping robot',
    kicker: 'TU/e challenge-based learning · 2025',
    summary: 'An autonomous TurtleBot3 that maps its surroundings in real time. Simulated in Gazebo and Unity.',
    facts: [],
    stack: ['ROS2', 'Python', 'Gazebo', 'Unity'],
    story: [],
    links: [],
    mark: 'robot',
    featured: false,
    year: '2025',
  },
  {
    slug: 'this-site',
    kind: 'This site',
    title: 'This site',
    kicker: 'Core memory, simulated · 2026',
    summary: 'A magnetic-core memory and the logic that drives it, written from scratch in TypeScript and WebGL.',
    facts: [],
    stack: ['TypeScript', 'WebGL', 'three.js', 'GSAP'],
    story: [],
    links: [{ label: 'Source', href: 'https://github.com/ZiineZ' }],
    mark: 'site',
    featured: false,
    year: '2026',
  },
]

export const featured = projects.filter((p) => p.featured)
export const archive = projects.filter((p) => !p.featured)

export interface Span {
  label: string
  detail: string
  /** YYYY-MM */
  start: string
  /** YYYY-MM or null for ongoing */
  end: string | null
}

export const timeline: Span[] = [
  { label: 'Computer Science, TU/e', detail: 'BSc, year three', start: '2024-09', end: null },
  { label: 'Technical infrastructure, LIS', detail: 'Networks, access management, databases', start: '2026-05', end: null },
]

/** Skills are inputs; each lights the projects that used it. Only verified pairings. */
export const skills: { name: string; projects: string[] }[] = [
  { name: 'TypeScript', projects: ['aica-3', 'this-site'] },
  { name: 'JavaScript', projects: ['hiriqa', 'seaside'] },
  { name: 'Python', projects: ['aica-3', 'city-robot'] },
  { name: 'Rust', projects: ['gewis-rdp', 'hiriqa'] },
  { name: 'LLM agents', projects: ['agent', 'hiriqa', 'aica-3'] },
  { name: 'PostgreSQL', projects: ['hiriqa', 'aica-3'] },
  { name: 'ROS2', projects: ['city-robot'] },
  { name: 'WebGL', projects: ['this-site', 'seaside'] },
]

export const sections = [
  { id: 'top', label: 'Stan Theunissen' },
  { id: 'work', label: 'Work' },
  { id: 'index', label: 'Index' },
  { id: 'about', label: 'About' },
  { id: 'lab', label: 'Lab' },
  { id: 'contact', label: 'Contact' },
] as const

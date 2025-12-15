type Project = {
  name: string
  description: string
  link: string
  video?: string
  image?: string
  id: string
}

type WorkExperience = {
  company: string
  title: string
  start: string
  end: string
  link: string
  id: string
}

type BlogPost = {
  title: string
  description: string
  link: string
  uid: string
}

type SocialLink = {
  label: string
  link: string
}

export const PROJECTS: Project[] = [
  {
    name: 'ChainReaction',
    description:
      'A grid-based strategy game featuring custom animations and scalable UI logic (JavaFX).',
    link: 'https://github.com/ZiineZ',
    id: 'project1',
    image: '/images/chain_reaction.png',
  },
  {
    name: 'BalanceOS',
    description: 'Full-stack administrative toolbox for financial administration workflows (JavaFX).',
    link: 'https://github.com/ZiineZ',
    id: 'project2',
    image: '/images/balance_os.png',
  },
  {
    name: 'City-Mapping Robot',
    description: 'Autonomous robot for real-time navigation using ROS2, TurtleBot3, and Unity/Gazebo.',
    link: 'https://github.com/ZiineZ',
    id: 'project3',
    image: '/images/city_mapping.png',
  },
  {
    name: 'CleaningSchedule',
    description:
      'Lightweight site generating synchronized local seed-based task schedules.',
    link: 'https://huisgenootjes.nl',
    id: 'project4',
    image: '/images/cleaning_schedule.png',
  },
  {
    name: 'Stock Prediction Bot',
    description: 'Competitive arbitrage trading algorithm utilizing Black-Scholes pricing.',
    link: 'https://github.com/ZiineZ',
    id: 'project5',
    image: '/images/stock_prediction.png',
  },
]

export const WORK_EXPERIENCE: WorkExperience[] = [
  {
    company: 'Amac Apple Premium Reseller',
    title: 'Medior Sales Advocate',
    start: '2023',
    end: 'Present',
    link: 'https://amac.nl',
    id: 'work1',
  },
  {
    company: 'Lyvia',
    title: 'Standby Elderly Support Worker',
    start: '2022',
    end: '2023',
    link: 'https://lyvia.nl',
    id: 'work2',
  },
]

export const BLOG_POSTS: BlogPost[] = []

type Education = {
  school: string
  degree: string
  start: string
  end: string
  id: string
}

type Skill = {
  category: string
  items: string[]
  id: string
}

export const EDUCATION: Education[] = [
  {
    school: 'Eindhoven University of Technology',
    degree: '2nd year Bachelor of Computer Science and Engineering',
    start: '2024',
    end: 'Present',
    id: 'edu1',
  },
]

export const SKILLS: Skill[] = [
  {
    category: 'Technical',
    items: ['Java', 'C', 'C++', 'Python', 'JavaScript', 'SQL', 'Supabase', 'Git', 'JavaFX', 'Next.js', 'Godot', 'ROS2', 'Linux', 'Unity', 'Gazebo'],
    id: 'skill1',
  },
  {
    category: 'Engineering',
    items: ['Agile', 'SCRUM', 'Waterfall', 'Test-Driven Development', 'Spec-Driven Development', 'IOCO'],
    id: 'skill2',
  },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Github',
    link: 'https://github.com/ZiineZ',
  },
  {
    label: 'LinkedIn',
    link: 'https://www.linkedin.com/in/stan-theunissen-002aa6291',
  },
]

export const EMAIL = 's.l.h.theunissen@gmail.com'

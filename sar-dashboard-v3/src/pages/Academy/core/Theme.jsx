export const LUXURY = {
  obsidian: '#050505',
  charcoal: '#0a0a0a',
  graphite: '#141414',
  
  gold: '#C9A96E',
  goldLight: '#D4B87A',
  goldDark: '#A68A4F',
  goldGlow: 'rgba(201, 169, 110, 0.15)',
  
  emerald: '#059669',
  emeraldLight: '#10B981',
  emeraldGlow: 'rgba(5, 150, 105, 0.2)',
  emeraldGradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
  
  ruby: '#DC2626',
  sapphire: '#2563EB',
  pearl: '#F5F5F0',
  platinum: '#A3A3A3',
  glassBorder: 'rgba(255,255,255,0.08)',
  
  gradients: {
    gold: 'linear-gradient(135deg, #C9A96E 0%, #D4B87A 50%, #A68A4F 100%)',
    emerald: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    architect: 'linear-gradient(135deg, #7C3AED 0%, #C9A96E 100%)',
  },
  
  shadows: {
    gold: '0 8px 32px rgba(201, 169, 110, 0.15)',
    emerald: '0 8px 32px rgba(5, 150, 105, 0.15)',
    lift: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  }
}

export const LEVEL_THEME = {
  explorer: {
    name: 'Explorer',
    subtitle: 'SAR Fundamentals',
    color: LUXURY.emerald,
    icon: 'Compass',
    description: 'Understand what SAR is, how it sees Earth, and why it matters.',
    timeEstimate: '4-6 hours',
    prerequisites: [],
    passingScore: 80,
  },
  operator: {
    name: 'Operator',
    subtitle: 'Processing & Analysis',
    color: LUXURY.gold,
    icon: 'Cpu',
    description: 'Master RDA, InSAR, and extract intelligence from SAR data.',
    timeEstimate: '8-12 hours',
    prerequisites: ['explorer'],
    passingScore: 85,
  },
  architect: {
    name: 'Architect',
    subtitle: 'System Design',
    color: LUXURY.sapphire,
    icon: 'Layers',
    description: 'Design distributed SAR pipelines at NASA/ESA scale.',
    timeEstimate: '12-16 hours',
    prerequisites: ['operator'],
    passingScore: 90,
  }
}

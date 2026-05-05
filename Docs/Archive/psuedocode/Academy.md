src/
├── academy/
│   ├── core/
│   │   ├── Theme.jsx          # Luxury design tokens
│   │   ├── Layout.jsx         # Shell with nav/progress
│   │   └── ProgressContext.jsx # Global state management
│   ├── domains/               # 6 knowledge domains
│   │   ├── PhysicsDomain.jsx
│   │   ├── DataDomain.jsx
│   │   ├── FocusingDomain.jsx
│   │   ├── SuperpowersDomain.jsx
│   │   ├── MapGridDomain.jsx
│   │   └── StackDomain.jsx
│   ├── levels/                # 3 certification levels
│   │   ├── LevelOneExplorer.jsx    # SAR Fundamentals
│   │   ├── LevelTwoOperator.jsx    # Processing & Analysis
│   │   └── LevelThreeArchitect.jsx # System Design
│   ├── components/
│   │   ├── QuizEngine.jsx     # Assessment system
│   │   ├── Simulations.jsx    # Interactive labs
│   │   ├── PersonaLens.jsx    # Perspective switcher
│   │   └── Certification.jsx  # Digital badge/verify
│   └── data/
│       ├── curriculum.js      # All learning content
│       ├── questions.js       # Question banks by level
│       └── achievements.js    # Badge definitions





Theme.jsx
```
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
  
  ruby: '#DC2626',
  sapphire: '#2563EB',
  pearl: '#F5F5F0',
  platinum: '#A3A3A3',
  
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
```
ProgressContext.jsx
```
import React, { createContext, useContext, useReducer, useEffect } from 'react'

const ProgressContext = createContext()

const initialState = {
  persona: 'kid',              // kid | dev | ops | scientist
  completedTopics: new Set(),
  quizScores: {},              // { 'physics-p1': { attempts: 2, best: 100, passed: true } }
  levelProgress: {
    explorer: { unlocked: true, completed: false, examPassed: false, certificateId: null },
    operator: { unlocked: false, completed: false, examPassed: false, certificateId: null },
    architect: { unlocked: false, completed: false, examPassed: false, certificateId: null },
  },
  simulationsCompleted: new Set(),
  streakDays: 0,
  lastActive: null,
}

function progressReducer(state, action) {
  switch (action.type) {
    case 'SET_PERSONA':
      return { ...state, persona: action.payload }
    
    case 'COMPLETE_TOPIC':
      return {
        ...state,
        completedTopics: new Set([...state.completedTopics, action.payload])
      }
    
    case 'RECORD_QUIZ':
      const key = action.payload.topicId
      const existing = state.quizScores[key] || { attempts: 0, best: 0, passed: false }
      const updated = {
        attempts: existing.attempts + 1,
        best: Math.max(existing.best, action.payload.score),
        passed: action.payload.score >= action.payload.required,
        lastAttempt: new Date().toISOString()
      }
      return {
        ...state,
        quizScores: { ...state.quizScores, [key]: updated }
      }
    
    case 'UNLOCK_LEVEL':
      return {
        ...state,
        levelProgress: {
          ...state.levelProgress,
          [action.payload]: { ...state.levelProgress[action.payload], unlocked: true }
        }
      }
    
    case 'PASS_EXAM':
      return {
        ...state,
        levelProgress: {
          ...state.levelProgress,
          [action.payload.level]: {
            ...state.levelProgress[action.payload.level],
            examPassed: true,
            certificateId: action.payload.certificateId,
            completedAt: new Date().toISOString()
          }
        }
      }
    
    case 'COMPLETE_SIMULATION':
      return {
        ...state,
        simulationsCompleted: new Set([...state.simulationsCompleted, action.payload])
      }
    
    default:
      return state
  }
}

export function ProgressProvider({ children }) {
  const [state, dispatch] = useReducer(progressReducer, initialState)
  
  // Persist to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sar-academy-progress')
    if (saved) {
      const parsed = JSON.parse(saved)
      // Restore Sets from arrays
      parsed.completedTopics = new Set(parsed.completedTopics || [])
      parsed.simulationsCompleted = new Set(parsed.simulationsCompleted || [])
      // Merge with initial to handle schema updates
      Object.assign(state, parsed)
    }
  }, [])
  
  useEffect(() => {
    const serializable = {
      ...state,
      completedTopics: Array.from(state.completedTopics),
      simulationsCompleted: Array.from(state.simulationsCompleted),
    }
    localStorage.setItem('sar-academy-progress', JSON.stringify(serializable))
  }, [state])
  
  // Auto-unlock levels based on prerequisites
  useEffect(() => {
    if (state.levelProgress.explorer.examPassed && !state.levelProgress.operator.unlocked) {
      dispatch({ type: 'UNLOCK_LEVEL', payload: 'operator' })
    }
    if (state.levelProgress.operator.examPassed && !state.levelProgress.architect.unlocked) {
      dispatch({ type: 'UNLOCK_LEVEL', payload: 'architect' })
    }
  }, [state.levelProgress])
  
  return (
    <ProgressContext.Provider value={{ state, dispatch }}>
      {children}
    </ProgressContext.Provider>
  )
}

export const useProgress = () => useContext(ProgressContext)
```


curriculum.js
```
export const LEVELS = {
  explorer: {
    id: 'explorer',
    modules: [
      {
        id: 'e1-physics',
        title: 'Wave Physics Essentials',
        duration: '45 min',
        topics: ['active-sensor', 'passive-sensor', 'backscatter', 'chirp'],
        quizRequired: true,
        simulation: 'wave-playground',
      },
      {
        id: 'e2-geometry',
        title: 'SAR Geometry',
        duration: '40 min',
        topics: ['azimuth', 'range', 'incidence-angle', 'look-angle'],
        quizRequired: true,
        simulation: 'geometry-visualizer',
      },
      {
        id: 'e3-data',
        title: 'Data Fundamentals',
        duration: '35 min',
        topics: ['hdf5-format', 'slc-product', 'metadata'],
        quizRequired: true,
        simulation: null,
      },
      {
        id: 'e4-applications',
        title: 'Why SAR Matters',
        duration: '30 min',
        topics: ['all-weather', 'night-vision', 'disaster-response'],
        quizRequired: false,
        simulation: null,
      }
    ],
    exam: {
      id: 'explorer-exam',
      title: 'Explorer Certification Exam',
      duration: '60 min',
      questions: 25,
      passingScore: 80,
      format: 'multiple-choice',
      retakeDelay: '24 hours',
    }
  },
  
  operator: {
    id: 'operator',
    modules: [
      {
        id: 'o1-focusing',
        title: 'Range-Doppler Algorithm',
        duration: '90 min',
        topics: ['range-compression', 'azimuth-fft', 'rcmc', 'chirp-rate'],
        quizRequired: true,
        simulation: 'rda-pipeline',
      },
      {
        id: 'o2-insar',
        title: 'Interferometry (InSAR)',
        duration: '75 min',
        topics: ['phase', 'coherence', 'unwrapping', 'displacement'],
        quizRequired: true,
        simulation: 'phase-visualizer',
      },
      {
        id: 'o3-polsar',
        title: 'Polarimetry',
        duration: '60 min',
        topics: ['scattering-matrix', 'polarization', 'decomposition'],
        quizRequired: true,
        simulation: null,
      },
      {
        id: 'o4-applications',
        title: 'Operational Analysis',
        duration: '60 min',
        topics: ['ship-detection', 'change-detection', 'classification'],
        quizRequired: true,
        simulation: 'cfar-minigame',
      }
    ],
    exam: {
      id: 'operator-exam',
      title: 'Operator Certification Exam',
      duration: '90 min',
      questions: 40,
      passingScore: 85,
      format: 'multiple-choice-with-scenario',
      retakeDelay: '48 hours',
    }
  },
  
  architect: {
    id: 'architect',
    modules: [
      {
        id: 'a1-systems',
        title: 'Distributed Processing',
        duration: '120 min',
        topics: ['kubernetes', 'parallel-processing', 'storage', 'streaming'],
        quizRequired: true,
        simulation: 'cluster-rush-game',
      },
      {
        id: 'a2-pipeline',
        title: 'Pipeline Architecture',
        duration: '90 min',
        topics: ['crd-operator', 'gateway-pattern', 'sse-telemetry', 's3-streaming'],
        quizRequired: true,
        simulation: 'pipeline-builder',
      },
      {
        id: 'a3-optimization',
        title: 'Performance Engineering',
        duration: '90 min',
        topics: ['memory-safety', 'rayon-parallelism', 'chunked-io', 'tiling'],
        quizRequired: true,
        simulation: 'memory-optimizer',
      },
      {
        id: 'a4-production',
        title: 'Production Deployment',
        duration: '60 min',
        topics: ['gitops', 'monitoring', 'scaling-policies', 'disaster-recovery'],
        quizRequired: true,
        simulation: null,
      }
    ],
    exam: {
      id: 'architect-exam',
      title: 'Architect Certification Exam',
      duration: '120 min',
      questions: 50,
      passingScore: 90,
      format: 'scenario-based-design',
      retakeDelay: '72 hours',
      includes: ['system-design-whiteboard', 'troubleshooting-scenario']
    }
  }
}

export const DOMAINS = {
  physics: {
    id: 'physics',
    title: 'Wave Physics & Sensors',
    icon: 'Zap',
    color: '#C9A96E',
    topics: {
      'active-sensor': {
        term: 'Active Sensor',
        definitions: {
          kid: 'Like playing Marco Polo in a pool. You shout, listen for echo, figure out where things are.',
          dev: 'POST request pattern. Transmit signal, await response, parse return payload for distance/amplitude.',
          ops: 'Transceiver infrastructure. Must manage transmit power, duty cycles, and thermal budgets.',
          scientist: 'System transmitting electromagnetic energy and measuring backscattered return. Radar equation governs link budget: P_r = P_t G_t G_r λ²σ / (4π)³R⁴'
        }
      },
      'passive-sensor': {
        term: 'Passive Sensor',
        definitions: {
          kid: 'Like using your eyes. No sun or flashlight? You see nothing.',
          dev: 'Event-driven subscriber. External publisher (sun) controls availability. No SLA guarantees.',
          ops: 'Dependent on external infrastructure. No control over uptime or signal quality.',
          scientist: 'Detects naturally occurring radiation. Planck\'s law: B_λ(T) = 2hc²/λ⁵ · 1/(e^(hc/λkT)-1). Limited by atmospheric windows.'
        }
      },
      'backscatter': {
        term: 'Backscatter (σ⁰)',
        definitions: {
          kid: 'Throw ball at mirror: bounces away. Throw at rough wall: bounces everywhere, some comes back.',
          dev: 'Return signal amplitude. Corner reflectors = high response. Specular surfaces = null pointer.',
          ops: 'Signal-to-noise ratio driver. Determines detectability and classification confidence.',
          scientist: 'Normalized radar cross-section. σ⁰ = σ/A. Depends on surface roughness (ks), dielectric constant (ε), and local incidence angle.'
        }
      },
      'chirp': {
        term: 'Chirp Signal',
        definitions: {
          kid: 'Bird whistle sliding from low to high. Longer slide = more information when it bounces back.',
          dev: 'Linear frequency modulation. f(t) = f₀ + Kt. Matched filter correlation for pulse compression gain.',
          ops: 'Bandwidth efficiency. Trade-off between range resolution and processing complexity.',
          scientist: 'LFM pulse: s(t) = rect(t/T) · exp(jπKt²). Ambiguity function χ(τ,ν) = ∫s(t)s*(t+τ)e^(-j2πνt)dt. Thumbtack response for K=B/T.'
        }
      }
    }
  },
  // ... other domains
}
```
QuizEngine.jsx

```
import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw,
  Trophy, AlertTriangle, Sparkles, BarChart3, Lock
} from 'lucide-react'
import { useProgress } from './ProgressContext'
import { LUXURY, LEVEL_THEME } from './Theme'

function QuizEngine({ levelId, moduleId, questions, onComplete, onExit }) {
  const { state, dispatch } = useProgress()
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(questions.length * 90) // 90s per question
  const [history, setHistory] = useState([]) // { question, correct, time }
  const [showReview, setShowReview] = useState(false)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)

  const level = LEVEL_THEME[levelId]
  const question = questions[currentQ]
  const progress = ((currentQ) / questions.length) * 100
  const isLast = currentQ === questions.length - 1

  // Timer
  useEffect(() => {
    if (answered || showReview) return
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          handleAnswer(-1) // Time out
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [answered, showReview, currentQ])

  const handleAnswer = useCallback((choice) => {
    if (answered) return
    setAnswered(true)
    setSelected(choice)
    
    const isCorrect = choice === question.correct
    const points = isCorrect ? Math.ceil((timeLeft / 90) * 100) : 0
    const newScore = score + points
    const newStreak = isCorrect ? streak + 1 : 0
    
    setScore(newScore)
    setStreak(newStreak)
    setMaxStreak(Math.max(maxStreak, newStreak))
    setHistory([...history, { 
      question: question.id, 
      correct: isCorrect, 
      time: 90 - timeLeft,
      choice 
    }])

    // Auto-advance after delay
    if (!isLast) {
      setTimeout(() => {
        setCurrentQ(c => c + 1)
        setSelected(null)
        setAnswered(false)
        setTimeLeft(90)
      }, 2000)
    }
  }, [answered, question, score, streak, maxStreak, history, timeLeft, isLast])

  const finishQuiz = () => {
    const percentage = Math.round((score / (questions.length * 100)) * 100)
    const passed = percentage >= level.passingScore
    
    dispatch({
      type: 'RECORD_QUIZ',
      payload: {
        topicId: `${levelId}-${moduleId}`,
        score: percentage,
        required: level.passingScore,
        history
      }
    })

    if (passed) {
      dispatch({ type: 'COMPLETE_TOPIC', payload: `${levelId}-${moduleId}` })
    }

    onComplete?.({ score: percentage, passed, history, streak: maxStreak })
  }

  if (showReview) {
    return <QuizReview history={history} questions={questions} onClose={onExit} />
  }

  // Results screen
  if (answered && isLast) {
    const percentage = Math.round((score / (questions.length * 100)) * 100)
    const passed = percentage >= level.passingScore
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          padding: '40px',
          textAlign: 'center'
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: passed ? LUXURY.emeraldGradient : `linear-gradient(135deg, #666, #333)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
            boxShadow: passed ? LUXURY.shadows.emerald : 'none'
          }}
        >
          {passed ? <Trophy size={56} color="#fff" /> : <AlertTriangle size={56} color="#fff" />}
        </motion.div>

        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
          {passed ? 'Assessment Passed' : 'Not Yet Complete'}
        </h2>
        <p style={{ color: LUXURY.platinum, fontSize: '1.1rem', marginBottom: '32px' }}>
          {passed 
            ? `Outstanding. You scored ${percentage}% and earned module credit.`
            : `You scored ${percentage}%. The passing threshold is ${level.passingScore}%. Review and retry.`}
        </p>

        <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
          <StatCard label="Score" value={`${percentage}%`} color={passed ? LUXURY.emerald : LUXURY.platinum} />
          <StatCard label="Best Streak" value={maxStreak} color={LUXURY.gold} />
          <StatCard label="Time" value={`${Math.floor((questions.length * 90 - timeLeft) / 60)}m`} color={LUXURY.sapphire} />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={() => setShowReview(true)}
            style={{
              padding: '14px 32px',
              background: 'transparent',
              border: `1px solid ${LUXURY.gold}40`,
              borderRadius: '12px',
              color: LUXURY.gold,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <BarChart3 size={18} /> Review Answers
          </button>
          {passed ? (
            <button
              onClick={finishQuiz}
              style={{
                padding: '14px 32px',
                background: LUXURY.emerald,
                border: 'none',
                borderRadius: '12px',
                color: '#000',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Sparkles size={18} /> Claim Credit
            </button>
          ) : (
            <button
              onClick={() => {
                setCurrentQ(0); setScore(0); setHistory([]); 
                setSelected(null); setAnswered(false); setTimeLeft(90)
              }}
              style={{
                padding: '14px 32px',
                background: LUXURY.ruby,
                border: 'none',
                borderRadius: '12px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RotateCcw size={18} /> Retry Module
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '6px 12px',
              background: `${level.color}15`,
              color: level.color,
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {level.name} Assessment
            </div>
            {streak > 2 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: `${LUXURY.gold}15`,
                  color: LUXURY.gold,
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
              >
                <Zap size={12} /> {streak}x Streak
              </motion.div>
            )}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: timeLeft < 15 ? LUXURY.ruby : LUXURY.platinum,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.9rem'
          }}>
            <Clock size={16} />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ height: '4px', background: LUXURY.graphite, borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            style={{ height: '100%', background: level.color, borderRadius: '2px' }}
          />
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '8px',
          fontSize: '0.75rem',
          color: LUXURY.platinum
        }}>
          <span>Question {currentQ + 1} of {questions.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
      </div>

      {/* Question Card */}
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        style={{
          background: LUXURY.charcoal,
          border: `1px solid ${LUXURY.glassBorder}`,
          borderRadius: '20px',
          padding: '40px',
          marginBottom: '24px'
        }}
      >
        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          background: `${question.difficulty === 'gold' ? LUXURY.gold : question.difficulty === 'silver' ? LUXURY.platinum : '#8B4515'}15`,
          color: question.difficulty === 'gold' ? LUXURY.gold : question.difficulty === 'silver' ? LUXURY.platinum : '#CD7F32',
          borderRadius: '6px',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          marginBottom: '20px'
        }}>
          {question.difficulty} Tier
        </div>

        <h3 style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.5,
          marginBottom: '32px'
        }}>
          {question.question}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {question.options.map((option, idx) => {
            const isSelected = selected === idx
            const isCorrect = idx === question.correct
            const showCorrect = answered && isCorrect
            const showWrong = answered && isSelected && !isCorrect
            
            return (
              <motion.button
                key={idx}
                whileHover={!answered ? { scale: 1.02, x: 4 } : {}}
                whileTap={!answered ? { scale: 0.98 } : {}}
                onClick={() => handleAnswer(idx)}
                disabled={answered}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '20px 24px',
                  background: showCorrect 
                    ? `${LUXURY.emerald}15` 
                    : showWrong 
                      ? `${LUXURY.ruby}15`
                      : isSelected 
                        ? `${level.color}15`
                        : LUXURY.graphite,
                  border: `2px solid ${showCorrect 
                    ? LUXURY.emerald 
                    : showWrong 
                      ? LUXURY.ruby 
                      : isSelected 
                        ? level.color 
                        : 'transparent'}`,
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  textAlign: 'left',
                  cursor: answered ? 'default' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: showCorrect 
                    ? LUXURY.emerald 
                    : showWrong 
                      ? LUXURY.ruby 
                      : LUXURY.charcoal,
                  border: `1px solid ${showCorrect 
                    ? LUXURY.emerald 
                    : showWrong 
                      ? LUXURY.ruby 
                      : LUXURY.glassBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}>
                  {showCorrect ? <CheckCircle2 size={18} /> : showWrong ? <XCircle size={18} /> : String.fromCharCode(65 + idx)}
                </div>
                <span style={{ flex: 1 }}>{option}</span>
                {showCorrect && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Sparkles size={20} color={LUXURY.emerald} /></motion.div>}
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Explanation (shown after answer) */}
      <AnimatePresence>
        {answered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              background: `${LUXURY.sapphire}10`,
              border: `1px solid ${LUXURY.sapphire}30`,
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: LUXURY.sapphire, fontWeight: 700 }}>
              <Brain size={18} /> Explanation
            </div>
            <p style={{ color: LUXURY.pearl, lineHeight: 1.7, marginBottom: '12px' }}>
              {question.explanation}
            </p>
            <div style={{ 
              padding: '12px', 
              background: 'rgba(201, 169, 110, 0.1)', 
              borderRadius: '8px',
              borderLeft: `3px solid ${LUXURY.gold}`
            }}>
              <div style={{ fontSize: '0.75rem', color: LUXURY.gold, fontWeight: 700, marginBottom: '4px' }}>
                SCIENTIST NOTE
              </div>
              <p style={{ color: LUXURY.platinum, fontSize: '0.9rem', margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                {question.scientistNote}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      padding: '20px 32px',
      background: LUXURY.charcoal,
      border: `1px solid ${color}30`,
      borderRadius: '12px',
      textAlign: 'center',
      minWidth: '120px'
    }}>
      <div style={{ fontSize: '0.75rem', color: LUXURY.platinum, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>
        {value}
      </div>
    </div>
  )
}

function QuizReview({ history, questions, onClose }) {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      <h2 style={{ color: '#fff', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BarChart3 size={28} color={LUXURY.gold} /> Answer Review
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {history.map((h, i) => {
          const q = questions.find(q => q.id === h.question)
          return (
            <div key={i} style={{
              padding: '24px',
              background: LUXURY.charcoal,
              border: `1px solid ${h.correct ? `${LUXURY.emerald}30` : `${LUXURY.ruby}30`}`,
              borderRadius: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                {h.correct ? <CheckCircle2 size={20} color={LUXURY.emerald} /> : <XCircle size={20} color={LUXURY.ruby} />}
                <span style={{ color: '#fff', fontWeight: 600 }}>Question {i + 1}</span>
                <span style={{ color: LUXURY.platinum, fontSize: '0.85rem' }}>({h.time}s)</span>
              </div>
              <p style={{ color: LUXURY.pearl, marginBottom: '12px' }}>{q.question}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.options.map((opt, idx) => (
                  <div key={idx} style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: idx === q.correct 
                      ? `${LUXURY.emerald}15` 
                      : idx === h.choice && !h.correct 
                        ? `${LUXURY.ruby}15`
                        : 'transparent',
                    border: `1px solid ${idx === q.correct 
                      ? LUXURY.emerald 
                      : idx === h.choice && !h.correct 
                        ? LUXURY.ruby 
                        : LUXURY.glassBorder}`,
                    color: idx === q.correct ? LUXURY.emerald : idx === h.choice && !h.correct ? LUXURY.ruby : LUXURY.platinum,
                    fontSize: '0.9rem'
                  }}>
                    {String.fromCharCode(65 + idx)}. {opt}
                    {idx === q.correct && ' ✓'}
                    {idx === h.choice && !h.correct && ' ✗ Your answer'}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      
      <button
        onClick={onClose}
        style={{
          marginTop: '32px',
          padding: '14px 32px',
          background: LUXURY.gold,
          border: 'none',
          borderRadius: '12px',
          color: '#000',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        Return to Course
      </button>
    </div>
  )
}

export default QuizEngine
```

LevelOneExplorer.jsx
```
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Unlock, Play, CheckCircle2, Clock, BookOpen, Zap } from 'lucide-react'
import { useProgress } from '../core/ProgressContext'
import { LEVELS, LUXURY, LEVEL_THEME } from '../core/Theme'
import QuizEngine from '../components/QuizEngine'
import { WavePhysicsSim, GeometrySim } from '../components/Simulations'

export default function LevelOneExplorer() {
  const { state } = useProgress()
  const [activeModule, setActiveModule] = useState(null)
  const [activeQuiz, setActiveQuiz] = useState(null)
  
  const level = LEVELS.explorer
  const theme = LEVEL_THEME.explorer
  const progress = state.levelProgress.explorer

  if (activeQuiz) {
    return (
      <QuizEngine
        levelId="explorer"
        moduleId={activeQuiz}
        questions={getQuestionsForModule(activeQuiz)}
        onComplete={(result) => {
          setActiveQuiz(null)
          if (result.passed) setActiveModule(null)
        }}
        onExit={() => setActiveQuiz(null)}
      />
    )
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Level Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
            borderRadius: '20px',
            background: LUXURY.emeraldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: LUXURY.shadows.emerald
          }}
        >
          <Compass size={40} color="#fff" />
        </motion.div>
        
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
          {theme.name} Certification
        </h1>
        <p style={{ color: LUXURY.platinum, fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 16px' }}>
          {theme.description}
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Badge icon={Clock} text={theme.timeEstimate} />
          <Badge icon={BookOpen} text={`${level.modules.length} Modules`} />
          <Badge icon={Zap} text={`${theme.passingScore}% to Pass`} />
        </div>
      </div>

      {/* Modules Path */}
      <div style={{ position: 'relative' }}>
        {/* Connection Line */}
        <div style={{
          position: 'absolute',
          left: '39px',
          top: '60px',
          bottom: '60px',
          width: '2px',
          background: `linear-gradient(to bottom, ${LUXURY.emerald}40, ${LUXURY.emerald}10)`,
          zIndex: 0
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {level.modules.map((module, idx) => {
            const isCompleted = state.completedTopics.has(`explorer-${module.id}`)
            const isLocked = idx > 0 && !state.completedTopics.has(`explorer-${level.modules[idx-1].id}`)
            const isActive = activeModule === module.id
            
            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'flex-start'
                }}
              >
                {/* Status Node */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: isCompleted 
                    ? LUXURY.emerald 
                    : isLocked 
                      ? LUXURY.graphite 
                      : isActive 
                        ? `${LUXURY.emerald}30`
                        : LUXURY.charcoal,
                  border: `2px solid ${isCompleted 
                    ? LUXURY.emerald 
                    : isLocked 
                      ? LUXURY.glassBorder 
                      : LUXURY.emerald}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '4px'
                }}>
                  {isCompleted ? <CheckCircle2 size={24} color="#fff" /> : 
                   isLocked ? <Lock size={20} color={LUXURY.platinum} /> : 
                   <span style={{ color: LUXURY.emerald, fontWeight: 700 }}>{idx + 1}</span>}
                </div>

                {/* Module Card */}
                <div style={{ flex: 1 }}>
                  <motion.div
                    whileHover={!isLocked ? { scale: 1.01 } : {}}
                    onClick={() => !isLocked && setActiveModule(isActive ? null : module.id)}
                    style={{
                      background: LUXURY.charcoal,
                      border: `1px solid ${isActive ? `${LUXURY.emerald}50` : LUXURY.glassBorder}`,
                      borderRadius: '16px',
                      padding: '24px',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      opacity: isLocked ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px' }}>
                          {module.title}
                        </h3>
                        <div style={{ display: 'flex', gap: '12px', color: LUXURY.platinum, fontSize: '0.85rem' }}>
                          <span>{module.duration}</span>
                          <span>•</span>
                          <span>{module.topics.length} topics</span>
                        </div>
                      </div>
                      {!isLocked && (
                        <div style={{
                          padding: '8px 16px',
                          background: isActive ? `${LUXURY.emerald}20` : LUXURY.graphite,
                          borderRadius: '8px',
                          color: isActive ? LUXURY.emerald : LUXURY.platinum,
                          fontSize: '0.85rem',
                          fontWeight: 600
                        }}>
                          {isActive ? 'In Progress' : isCompleted ? 'Completed' : 'Start'}
                        </div>
                      )}
                    </div>

                    {/* Topics */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {module.topics.map(topic => (
                        <span key={topic} style={{
                          padding: '4px 10px',
                          background: LUXURY.graphite,
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: LUXURY.platinum,
                          textTransform: 'capitalize'
                        }}>
                          {topic.replace(/-/g, ' ')}
                        </span>
                      ))}
                    </div>

                    {/* Expanded Content */}
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        style={{ marginTop: '20px' }}
                      >
                        <div style={{ 
                          padding: '20px',
                          background: LUXURY.obsidian,
                          borderRadius: '12px',
                          marginBottom: '16px'
                        }}>
                          <p style={{ color: LUXURY.pearl, lineHeight: 1.7, marginBottom: '16px' }}>
                            Learn how SAR uses its own energy to see Earth, why microwaves penetrate clouds,
                            and how the geometry of orbit affects what we observe.
                          </p>
                          
                          {/* Simulation Preview */}
                          {module.simulation && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{ 
                                fontSize: '0.75rem', 
                                color: LUXURY.gold, 
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '8px'
                              }}>
                                Interactive Lab
                              </div>
                              <div style={{
                                padding: '16px',
                                background: LUXURY.charcoal,
                                border: `1px solid ${LUXURY.gold}30`,
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer'
                              }}>
                                <Zap size={20} color={LUXURY.gold} />
                                <div>
                                  <div style={{ color: '#fff', fontWeight: 600 }}>
                                    {module.simulation === 'wave-playground' ? 'Wave Physics Playground' : 'Geometry Visualizer'}
                                  </div>
                                  <div style={{ color: LUXURY.platinum, fontSize: '0.85rem' }}>
                                    Manipulate parameters in real-time
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setActiveQuiz(module.id) }}
                            style={{
                              flex: 1,
                              padding: '14px 24px',
                              background: LUXURY.emerald,
                              border: 'none',
                              borderRadius: '12px',
                              color: '#000',
                              fontWeight: 700,
                              fontSize: '1rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                          >
                            <Play size={18} /> Take Assessment
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Final Exam Gate */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{
          marginTop: '48px',
          padding: '40px',
          background: allModulesComplete() 
            ? `linear-gradient(135deg, ${LUXURY.emerald}20, ${LUXURY.gold}10)`
            : LUXURY.charcoal,
          border: `2px solid ${allModulesComplete() ? LUXURY.emerald : LUXURY.glassBorder}`,
          borderRadius: '20px',
          textAlign: 'center'
        }}
      >
        <h3 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>
          {allModulesComplete() ? 'Ready for Certification' : 'Complete All Modules'}
        </h3>
        <p style={{ color: LUXURY.platinum, marginBottom: '24px' }}>
          {allModulesComplete() 
            ? 'You have mastered all Explorer topics. Take the final exam to earn your certificate.'
            : `Complete ${remainingModules()} more module${remainingModules() !== 1 ? 's' : ''} to unlock the exam.`}
        </p>
        <button
          disabled={!allModulesComplete()}
          onClick={() => setActiveQuiz('explorer-exam')}
          style={{
            padding: '16px 48px',
            background: allModulesComplete() ? LUXURY.emerald : LUXURY.graphite,
            border: 'none',
            borderRadius: '12px',
            color: allModulesComplete() ? '#000' : LUXURY.platinum,
            fontWeight: 700,
            fontSize: '1.1rem',
            cursor: allModulesComplete() ? 'pointer' : 'not-allowed'
          }}
        >
          {allModulesComplete() ? 'Begin Certification Exam' : 'Locked'}
        </button>
      </motion.div>
    </div>
  )

  function allModulesComplete() {
    return level.modules.every(m => state.completedTopics.has(`explorer-${m.id}`))
  }
  
  function remainingModules() {
    return level.modules.filter(m => !state.completedTopics.has(`explorer-${m.id}`)).length
  }
}

function Badge({ icon: Icon, text }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 14px',
      background: LUXURY.graphite,
      borderRadius: '100px',
      fontSize: '0.85rem',
      color: LUXURY.platinum
    }}>
      <Icon size={14} />
      {text}
    </div>
  )
}
```

Certification.jsx
```
import React from 'react'
import { motion } from 'framer-motion'
import { Award, CheckCircle2, Download, Share2, QrCode } from 'lucide-react'
import { LUXURY, LEVEL_THEME } from './Theme'

export default function Certification({ levelId, certificateId, completedAt, score }) {
  const theme = LEVEL_THEME[levelId]
  
  const verifyUrl = `https://sar.academy/verify/${certificateId}`
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 20px'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <motion.div
          initial={{ rotateY: 180 }}
          animate={{ rotateY: 0 }}
          transition={{ duration: 1, type: 'spring' }}
          style={{
            width: '100px',
            height: '100px',
            margin: '0 auto 24px',
            borderRadius: '50%',
            background: theme.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 20px 60px ${theme.color}40`
          }}
        >
          <Award size={48} color="#fff" />
        </motion.div>
        
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
          Certification Earned
        </h1>
        <p style={{ color: LUXURY.platinum }}>
          Verified credential issued by SAR Academy
        </p>
      </div>

      {/* Certificate Card */}
      <div style={{
        position: 'relative',
        background: LUXURY.charcoal,
        border: `2px solid ${theme.color}50`,
        borderRadius: '24px',
        padding: '48px',
        overflow: 'hidden',
        boxShadow: `0 25px 50px -12px ${theme.color}20`
      }}>
        {/* Watermark */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '8rem',
          fontWeight: 800,
          color: `${theme.color}05`,
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          CERTIFIED
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '32px'
          }}>
            <div>
              <div style={{
                fontSize: '0.75rem',
                color: theme.color,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                fontWeight: 700,
                marginBottom: '8px'
              }}>
                SAR Academy
              </div>
              <h2 style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: '#fff',
                margin: 0
              }}>
                {theme.name} Operator
              </h2>
              <p style={{ color: LUXURY.platinum, marginTop: '4px' }}>
                {theme.subtitle}
              </p>
            </div>
            <div style={{
              padding: '12px 20px',
              background: `${theme.color}15`,
              border: `1px solid ${theme.color}40`,
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.75rem', color: LUXURY.platinum }}>SCORE</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: theme.color }}>
                {score}%
              </div>
            </div>
          </div>

          <div style={{
            padding: '24px',
            background: LUXURY.obsidian,
            borderRadius: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: LUXURY.platinum, marginBottom: '4px' }}>CERTIFICATE ID</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', color: '#fff', fontSize: '0.9rem' }}>
                  {certificateId}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: LUXURY.platinum, marginBottom: '4px' }}>ISSUED</div>
                <div style={{ color: '#fff', fontSize: '0.9rem' }}>
                  {new Date(completedAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              background: `${LUXURY.emerald}10`,
              borderRadius: '8px',
              borderLeft: `3px solid ${LUXURY.emerald}`
            }}>
              <CheckCircle2 size={16} color={LUXURY.emerald} />
              <span style={{ color: LUXURY.emerald, fontSize: '0.85rem', fontWeight: 600 }}>
                Verified on Blockchain • Tamper-proof credential
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{
              flex: 1,
              padding: '14px 24px',
              background: theme.color,
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <Download size={18} /> Download PDF
            </button>
            <button style={{
              padding: '14px 24px',
              background: 'transparent',
              border: `1px solid ${LUXURY.glassBorder}`,
              borderRadius: '12px',
              color: LUXURY.platinum,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* QR Verification */}
      <div style={{
        marginTop: '24px',
        padding: '24px',
        background: LUXURY.charcoal,
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#fff',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <QrCode size={48} color={LUXURY.charcoal} />
        </div>
        <div>
          <h4 style={{ color: '#fff', margin: '0 0 4px' }}>Verify Authenticity</h4>
          <p style={{ color: LUXURY.platinum, fontSize: '0.9rem', margin: 0 }}>
            Scan or visit <span style={{ color: theme.color, fontFamily: '"JetBrains Mono", monospace' }}>{verifyUrl}</span>
          </p>
        </div>
      </div>
    </motion.div>
  )
}
```

| Level         | Title                 | Focus                          | Time      | Questions | Pass | Prerequisite  |
| ------------- | --------------------- | ------------------------------ | --------- | --------- | ---- | ------------- |
| **Explorer**  | SAR Fundamentals      | Physics, geometry, data basics | 4-6 hrs   | 25        | 80%  | None          |
| **Operator**  | Processing & Analysis | RDA, InSAR, PolSAR, detection  | 8-12 hrs  | 40        | 85%  | Explorer exam |
| **Architect** | System Design         | K8s, pipelines, optimization   | 12-16 hrs | 50        | 90%  | Operator exam |
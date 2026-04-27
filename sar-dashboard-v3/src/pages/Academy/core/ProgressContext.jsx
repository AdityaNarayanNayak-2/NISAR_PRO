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
    
    case 'RECORD_QUIZ': {
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
    try {
      const saved = localStorage.getItem('sar-academy-progress')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.completedTopics) parsed.completedTopics = new Set(parsed.completedTopics)
        if (parsed.simulationsCompleted) parsed.simulationsCompleted = new Set(parsed.simulationsCompleted)
        Object.assign(state, parsed)
      }
    } catch (e) {
      console.warn("Failed to load progress", e)
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

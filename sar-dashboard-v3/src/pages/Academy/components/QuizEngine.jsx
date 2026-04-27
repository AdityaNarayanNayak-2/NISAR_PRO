import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw,
  Trophy, AlertTriangle, Sparkles, BarChart3, Lock,
  Zap, Brain
} from 'lucide-react'
import { useProgress } from '../core/ProgressContext'
import { LUXURY, LEVEL_THEME } from '../core/Theme'

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
        topicId: moduleId, // FIXED topic mapping
        score: percentage,
        required: level.passingScore,
        history
      }
    })

    if (passed) {
      dispatch({ type: 'COMPLETE_TOPIC', payload: moduleId }) // FIXED topic mapping
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
                setSelected(null); setAnswered(false); setTimeLeft(questions.length * 90)
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
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
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
      </AnimatePresence>

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

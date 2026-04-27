import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Play, CheckCircle2, Clock, BookOpen, Zap, Compass } from 'lucide-react'
import { useProgress } from '../core/ProgressContext'
import { LUXURY, LEVEL_THEME } from '../core/Theme'
import { LEVELS } from '../data/curriculum'
import { getQuestionsForModule } from '../data/questions'
import QuizEngine from '../components/QuizEngine'
import { WavePhysicsSim, GeometrySim } from '../components/Simulations'

export default function LevelOneExplorer() {
  const { state } = useProgress()
  const [activeModule, setActiveModule] = useState(null)
  const [activeQuiz, setActiveQuiz] = useState(null)
  
  const level = LEVELS.explorer
  const theme = LEVEL_THEME.explorer

  if (activeQuiz) {
    return (
      <QuizEngine
        levelId="explorer"
        moduleId={activeQuiz}
        questions={getQuestionsForModule(`explorer-${activeQuiz}`)}
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
            const isCompleted = state.completedTopics.has(module.id)
            const isLocked = idx > 0 && !state.completedTopics.has(level.modules[idx-1].id)
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
                              {module.simulation === 'wave-playground' ? <WavePhysicsSim /> : <GeometrySim />}
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
    return level.modules.every(m => state.completedTopics.has(m.id))
  }
  
  function remainingModules() {
    return level.modules.filter(m => !state.completedTopics.has(m.id)).length
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

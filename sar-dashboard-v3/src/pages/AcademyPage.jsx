import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radar, Crosshair, Cpu, HardDrive, Zap, Shield,
  Terminal, Play, RotateCcw, Lock, Unlock, Trophy,
  Server, Activity, Box, ArrowRight, AlertTriangle
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  bg: '#02040a',
  panel: '#0a0f1c',
  panelLit: '#111827',
  border: 'rgba(255,255,255,0.08)',
  text: '#e2e8f0',
  muted: 'rgba(255,255,255,0.5)',
  kid: '#3b82f6',      // Blue
  dev: '#10b981',      // Emerald
  ops: '#f59e0b',      // Amber
  danger: '#ef4444',
  accent: '#00E5CC'
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const Button = ({ children, onClick, color = PALETTE.accent, disabled = false, style = {} }) => (
  <motion.button
    whileHover={disabled ? {} : { scale: 1.05 }}
    whileTap={disabled ? {} : { scale: 0.95 }}
    onClick={onClick}
    disabled={disabled}
    style={{
      background: `${color}15`,
      border: `1px solid ${color}40`,
      color: color,
      padding: '12px 28px',
      borderRadius: '10px',
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      fontSize: '1rem',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      ...style
    }}
  >
    {children}
  </motion.button>
)

const Card = ({ children, style = {}, glow = false }) => (
  <div style={{
    background: PALETTE.panel,
    border: `1px solid ${glow ? PALETTE.accent + '40' : PALETTE.border}`,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: glow ? `0 0 40px ${PALETTE.accent}10` : 'none',
    ...style
  }}>
    {children}
  </div>
)

const Badge = ({ children, color }) => (
  <span style={{
    background: `${color}15`, color: color, border: `1px solid ${color}30`,
    padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem',
    fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', textTransform: 'uppercase'
  }}>
    {children}
  </span>
)

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 1: ORBIT SCOUT (The Kid / Explorer)
// ─────────────────────────────────────────────────────────────────────────────
// Mechanics: Satellite sweeps left→right. Press SPACE or click to PING.
// Pings reveal hidden targets on a 6×6 planetary grid.
// Metal ships are bright. Trees confuse the signal. Water is dark.
// ─────────────────────────────────────────────────────────────────────────────
const LEVEL1_CONFIG = {
  gridSize: 6,
  ships: 4,
  forests: 5,
  maxPings: 12,
  sweepSpeed: 2.5 // seconds per crossing
}

function Level1Game({ onComplete, onScore }) {
  const [satX, setSatX] = useState(0)
  const [grid, setGrid] = useState([])
  const [revealed, setRevealed] = useState(new Set())
  const [pingAnim, setPingAnim] = useState(null)
  const [pingsLeft, setPingsLeft] = useState(LEVEL1_CONFIG.maxPings)
  const [score, setScore] = useState(0)
  const [message, setMessage] = useState('Press SPACE or Click to Ping!')
  const [gameOver, setGameOver] = useState(false)
  const [shipsFound, setShipsFound] = useState(0)
  const sweepRef = useRef()
  const containerRef = useRef()

  // Generate grid
  useEffect(() => {
    const g = Array(LEVEL1_CONFIG.gridSize).fill(null).map(() =>
      Array(LEVEL1_CONFIG.gridSize).fill('water'))
    let placed = 0
    while (placed < LEVEL1_CONFIG.ships) {
      const r = Math.floor(Math.random() * LEVEL1_CONFIG.gridSize)
      const c = Math.floor(Math.random() * LEVEL1_CONFIG.gridSize)
      if (g[r][c] === 'water') { g[r][c] = 'ship'; placed++ }
    }
    placed = 0
    while (placed < LEVEL1_CONFIG.forests) {
      const r = Math.floor(Math.random() * LEVEL1_CONFIG.gridSize)
      const c = Math.floor(Math.random() * LEVEL1_CONFIG.gridSize)
      if (g[r][c] === 'water') { g[r][c] = 'forest'; placed++ }
    }
    setGrid(g)
  }, [])

  // Satellite sweep loop
  useEffect(() => {
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = ((ts - start) / 1000) % (LEVEL1_CONFIG.sweepSpeed * 2)
      // Triangular wave: 0→1→0
      const x = progress <= LEVEL1_CONFIG.sweepSpeed
        ? progress / LEVEL1_CONFIG.sweepSpeed
        : 2 - (progress / LEVEL1_CONFIG.sweepSpeed)
      setSatX(x)
      sweepRef.current = requestAnimationFrame(step)
    }
    sweepRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(sweepRef.current)
  }, [])

  // Keyboard control
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && !gameOver) {
        e.preventDefault()
        triggerPing()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [satX, pingsLeft, grid, gameOver])

  const triggerPing = useCallback(() => {
    if (pingsLeft <= 0 || gameOver) return

    const col = Math.min(Math.floor(satX * LEVEL1_CONFIG.gridSize), LEVEL1_CONFIG.gridSize - 1)
    setPingAnim(col)
    setTimeout(() => setPingAnim(null), 400)

    // Reveal entire column from top until first hit or bottom
    const newRevealed = new Set(revealed)
    let hitSomething = false
    let newScore = score
    let newShips = shipsFound

    for (let row = 0; row < LEVEL1_CONFIG.gridSize; row++) {
      const key = `${row}-${col}`
      if (newRevealed.has(key)) continue

      newRevealed.add(key)
      const cell = grid[row]?.[col]

      if (cell === 'ship') {
        newScore += 250
        newShips++
        setMessage('🚢 SHIP DETECTED! Metal reflects radar brightly.')
        hitSomething = true
        break
      } else if (cell === 'forest') {
        newScore -= 50
        setMessage('🌲 FOREST! Leaves scatter the signal. Confusing!')
        hitSomething = true
        break
      } else {
        newScore += 10
      }
    }

    if (!hitSomething) setMessage('💧 Just calm water... Keep scanning!')

    const nextPings = pingsLeft - 1
    setPingsLeft(nextPings)
    setRevealed(newRevealed)
    setScore(newScore)
    setShipsFound(newShips)

    // Win/Lose check
    if (newShips >= LEVEL1_CONFIG.ships) {
      const bonus = nextPings * 100
      setGameOver(true)
      onScore(newScore + bonus)
      setMessage(`🎉 MISSION COMPLETE! All ships found. Energy Bonus: +${bonus}`)
    } else if (nextPings === 0 && newShips < LEVEL1_CONFIG.ships) {
      setGameOver(true)
      onScore(newScore)
      setMessage('⚠️ OUT OF POWER! The ships are still hiding...')
    }
  }, [satX, pingsLeft, grid, revealed, score, shipsFound, gameOver])

  const cellType = (r, c) => grid[r]?.[c] || 'water'
  const isRevealed = (r, c) => revealed.has(`${r}-${c}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
      {/* HUD */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Card style={{ minWidth: '140px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: PALETTE.muted, marginBottom: '4px' }}>SCORE</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: PALETTE.kid }}>{score}</div>
        </Card>
        <Card style={{ minWidth: '140px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: PALETTE.muted, marginBottom: '4px' }}>PINGS LEFT</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: pingsLeft < 4 ? PALETTE.danger : '#fff' }}>{pingsLeft}</div>
        </Card>
        <Card style={{ minWidth: '140px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: PALETTE.muted, marginBottom: '4px' }}>SHIPS FOUND</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: PALETTE.accent }}>{shipsFound} / {LEVEL1_CONFIG.ships}</div>
        </Card>
      </div>

      {/* GAME BOARD */}
      <div
        ref={containerRef}
        onClick={triggerPing}
        style={{
          position: 'relative', width: '100%', maxWidth: '520px', aspectRatio: '1',
          cursor: gameOver ? 'default' : 'crosshair'
        }}
      >
        {/* Planet Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${LEVEL1_CONFIG.gridSize}, 1fr)`,
          gap: '6px',
          width: '100%', height: '100%',
          padding: '40px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          border: `1px solid ${PALETTE.kid}30`
        }}>
          {grid.map((row, r) => row.map((cell, c) => {
            const revealed = isRevealed(r, c)
            const type = cellType(r, c)
            let bg = 'rgba(255,255,255,0.03)'
            let content = null
            let glow = 'none'

            if (revealed) {
              if (type === 'ship') {
                bg = 'rgba(59,130,246,0.3)'
                content = <Radar size={20} color={PALETTE.kid} />
                glow = `0 0 20px ${PALETTE.kid}`
              } else if (type === 'forest') {
                bg = 'rgba(16,185,129,0.2)'
                content = <Activity size={20} color={PALETTE.dev} />
              } else {
                bg = 'rgba(6,182,212,0.15)'
                content = <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4' }} />
              }
            } else if (gameOver) {
              // Show answer
              if (type === 'ship') {
                bg = 'rgba(239,68,68,0.2)'
                content = <Radar size={16} color={PALETTE.danger} style={{ opacity: 0.5 }} />
              }
            }

            return (
              <motion.div
                key={`${r}-${c}`}
                animate={{
                  background: bg,
                  scale: pingAnim === c && !revealed ? [1, 1.2, 1] : 1,
                  boxShadow: glow
                }}
                transition={{ duration: 0.3 }}
                style={{
                  borderRadius: '12px',
                  border: `1px solid ${revealed ? PALETTE.kid + '50' : PALETTE.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', position: 'relative', overflow: 'hidden'
                }}
              >
                {content}
                {pingAnim === c && (
                  <motion.div
                    initial={{ height: '0%', opacity: 0.8 }}
                    animate={{ height: '100%', opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: `linear-gradient(to top, ${PALETTE.kid}, transparent)`
                    }}
                  />
                )}
              </motion.div>
            )
          }))}
        </div>

        {/* Satellite */}
        <motion.div
          style={{
            position: 'absolute',
            top: '-10px',
            left: `${satX * 100}%`,
            transform: 'translateX(-50%)',
            color: PALETTE.kid,
            filter: `drop-shadow(0 0 10px ${PALETTE.kid})`
          }}
        >
          <Crosshair size={32} />
          {/* Beam */}
          <div style={{
            position: 'absolute', top: '28px', left: '50%', transform: 'translateX(-50%)',
            width: '2px', height: '40px',
            background: `linear-gradient(to bottom, ${PALETTE.kid}, transparent)`,
            opacity: 0.6
          }} />
        </motion.div>
      </div>

      {/* MESSAGE */}
      <motion.div
        key={message}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', maxWidth: '500px', minHeight: '60px' }}
      >
        <p style={{ color: PALETTE.text, fontSize: '1.1rem', fontFamily: '"Outfit", sans-serif' }}>
          {message}
        </p>
      </motion.div>

      {gameOver && (
        <Button onClick={() => onComplete(score)} color={PALETTE.kid}>
          <Trophy size={18} /> Continue Mission
        </Button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 2: PIPELINE PANIC (The Software Engineer)
// ─────────────────────────────────────────────────────────────────────────────
// Mechanics: Drag-and-swap code blocks to build the correct SAR processing 
// pipeline. Execute and watch data packets flow. Fix "Borrow Checker" errors.
// ─────────────────────────────────────────────────────────────────────────────
const PIPELINE_BLOCKS = [
  { id: 'read', label: 'read_hdf5()', icon: <Box size={16} />, desc: 'Opens the 7GB satellite file' },
  { id: 'range', label: 'range_fft()', icon: <ArrowRight size={16} />, desc: 'Compresses the distance signal' },
  { id: 'rcmc', label: 'rcmc_sinc()', icon: <Activity size={16} />, desc: 'Fixes the satellite movement curve' },
  { id: 'azimuth', label: 'azimuth_fft()', icon: <ArrowRight size={16} style={{ transform: 'rotate(90deg)' }} />, desc: 'Compresses the along-track signal' },
  { id: 'georef', label: 'georef_output()', icon: <HardDrive size={16} />, desc: 'Maps pixels to Earth coordinates' }
]
const CORRECT_ORDER = ['read', 'range', 'rcmc', 'azimuth', 'georef']

function Level2Game({ onComplete, onScore }) {
  const [slots, setSlots] = useState([...CORRECT_ORDER].sort(() => Math.random() - 0.5))
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Fix the pipeline order. Click two blocks to swap them.')
  const [statusColor, setStatusColor] = useState(PALETTE.text)
  const [completed, setCompleted] = useState(false)

  const handleSlotClick = (idx) => {
    if (running || completed) return
    if (selectedSlot === null) {
      setSelectedSlot(idx)
      setStatus(`Selected: ${PIPELINE_BLOCKS.find(b => b.id === slots[idx]).label}`)
    } else if (selectedSlot === idx) {
      setSelectedSlot(null)
      setStatus('Click another block to swap.')
    } else {
      // Swap
      const newSlots = [...slots]
        ;[newSlots[selectedSlot], newSlots[idx]] = [newSlots[idx], newSlots[selectedSlot]]
      setSlots(newSlots)
      setSelectedSlot(null)
      setStatus('Blocks swapped. Check the logic!')
    }
  }

  const runPipeline = () => {
    if (running || completed) return
    setRunning(true)
    setStatus('Compiling...')
    setProgress(0)

    let step = 0
    const interval = setInterval(() => {
      step++
      setProgress((step / 5) * 100)

      if (step <= 5) {
        const currentBlock = slots[step - 1]
        const expectedBlock = CORRECT_ORDER[step - 1]

        if (currentBlock !== expectedBlock) {
          clearInterval(interval)
          setRunning(false)
          setStatusColor(PALETTE.danger)
          setStatus(`❌ BORROW CHECKER ERROR at step ${step}! Expected ${PIPELINE_BLOCKS.find(b => b.id === expectedBlock).label}. Value moved incorrectly.`)
          return
        }

        setStatus(`✅ Step ${step}/5: ${PIPELINE_BLOCKS.find(b => b.id === currentBlock).desc}`)
      }

      if (step >= 5) {
        clearInterval(interval)
        setTimeout(() => {
          setRunning(false)
          setCompleted(true)
          setStatusColor(PALETTE.dev)
          setStatus('🎉 PIPELINE EXECUTED! Image rendered successfully. Memory safe. Zero leaks.')
          onScore(1000 + Math.floor(Math.random() * 500))
        }, 600)
      }
    }, 800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', width: '100%', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        <Badge color={PALETTE.dev}>SYSTEMS ARCHITECT CHALLENGE</Badge>
        <h2 style={{ color: '#fff', fontFamily: '"Space Grotesk", sans-serif', marginTop: '12px' }}>
          Fix the Processing Pipeline
        </h2>
        <p style={{ color: PALETTE.muted, fontSize: '0.95rem' }}>
          Raw radar data is garbage until you process it in the right order.
        </p>
      </div>

      {/* Pipeline Visual */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ color: PALETTE.muted, fontSize: '0.8rem', fontFamily: '"JetBrains Mono", monospace' }}>
            INPUT: raw_iq_data.h5
          </div>
          <div style={{ color: PALETTE.muted, fontSize: '0.8rem', fontFamily: '"JetBrains Mono", monospace' }}>
            OUTPUT: geo_image.png
          </div>
        </div>

        {/* Connection Line */}
        <div style={{ position: 'relative', height: '80px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '2px', background: PALETTE.border, zIndex: 0 }} />

          {/* Animated packet */}
          {running && (
            <motion.div
              animate={{ left: `${progress}%` }}
              transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
              style={{
                position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                width: '12px', height: '12px', borderRadius: '50%',
                background: PALETTE.dev, boxShadow: `0 0 20px ${PALETTE.dev}`,
                zIndex: 2
              }}
            />
          )}

          {slots.map((slotId, idx) => {
            const block = PIPELINE_BLOCKS.find(b => b.id === slotId)
            const isSelected = selectedSlot === idx
            const isCorrect = completed && slotId === CORRECT_ORDER[idx]

            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSlotClick(idx)}
                style={{
                  flex: 1, zIndex: 1, position: 'relative',
                  background: isSelected ? `${PALETTE.dev}30` : isCorrect ? `${PALETTE.dev}20` : PALETTE.panelLit,
                  border: `2px solid ${isSelected ? PALETTE.dev : isCorrect ? `${PALETTE.dev}60` : PALETTE.border}`,
                  borderRadius: '12px', padding: '16px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  cursor: running ? 'wait' : 'pointer',
                  opacity: running && idx > Math.floor(progress / 20) ? 0.5 : 1
                }}
              >
                <div style={{ color: isSelected || isCorrect ? PALETTE.dev : PALETTE.text }}>
                  {block.icon}
                </div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem', color: PALETTE.text,
                  wordBreak: 'break-all', textAlign: 'center'
                }}>
                  {block.label}
                </div>
                {isSelected && (
                  <div style={{ position: 'absolute', inset: '-4px', borderRadius: '14px', border: `2px dashed ${PALETTE.dev}` }} />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Status Terminal */}
      <Card style={{ width: '100%', background: '#000', borderColor: `${PALETTE.dev}30`, fontFamily: '"JetBrains Mono", monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Terminal size={14} color={PALETTE.dev} />
          <span style={{ color: PALETTE.dev, fontSize: '0.75rem' }}>sar_processor@rust-dev:~</span>
        </div>
        <motion.div
          key={status}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ color: statusColor || PALETTE.text, fontSize: '0.9rem', lineHeight: 1.5 }}
        >
          $ {status}
        </motion.div>
      </Card>

      <div style={{ display: 'flex', gap: '16px' }}>
        {!completed ? (
          <>
            <Button onClick={runPipeline} color={PALETTE.dev} disabled={running}>
              <Play size={18} /> {running ? 'Running...' : 'Execute Pipeline'}
            </Button>
            <Button onClick={() => { setSlots([...CORRECT_ORDER].sort(() => Math.random() - 0.5)); setSelectedSlot(null); setStatus('Blocks shuffled. Try again.') }} color={PALETTE.muted} disabled={running}>
              <RotateCcw size={18} /> Shuffle
            </Button>
          </>
        ) : (
          <Button onClick={() => onComplete(1000)} color={PALETTE.dev}>
            <Unlock size={18} /> Unlock Next Level
          </Button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 3: CLUSTER RUSH (The DevOps Engineer)
// ─────────────────────────────────────────────────────────────────────────────
// Mechanics: Jobs spawn from the top queue. Player must assign them to K8s 
// nodes before they timeout. Manage CPU/RAM. Handle node failures.
// ─────────────────────────────────────────────────────────────────────────────
const NODE_CAPACITY = { cpu: 8, ram: 32 }

function Level3Game({ onComplete, onScore }) {
  const [nodes, setNodes] = useState([
    { id: 'node-1', name: 'rust-pool-01', cpu: 0, ram: 0, jobs: [] },
    { id: 'node-2', name: 'rust-pool-02', cpu: 0, ram: 0, jobs: [] },
    { id: 'node-3', name: 'rust-pool-03', cpu: 0, ram: 0, jobs: [] },
  ])
  const [queue, setQueue] = useState([])
  const [completedJobs, setCompletedJobs] = useState(0)
  const [failedJobs, setFailedJobs] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [gameActive, setGameActive] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [eventMsg, setEventMsg] = useState('Deploy SAR jobs to nodes before they expire!')
  const [score, setScore] = useState(0)

  // Spawner
  useEffect(() => {
    if (!gameActive) return
    const spawner = setInterval(() => {
      setQueue(prev => {
        if (prev.length >= 6) return prev // Max backlog
        const types = [
          { name: 'Small-Scan', cpu: 1, ram: 2, color: '#60a5fa', time: 8 },
          { name: 'Medium-RDA', cpu: 2, ram: 8, color: '#a78bfa', time: 12 },
          { name: 'NISAR-Burst', cpu: 4, ram: 16, color: PALETTE.ops, time: 15 }
        ]
        const type = types[Math.floor(Math.random() * types.length)]
        return [...prev, {
          id: Math.random().toString(36).slice(2),
          ...type,
          maxTime: type.time,
          timeLeft: type.time
        }]
      })
    }, 3500)
    return () => clearInterval(spawner)
  }, [gameActive])

  // Timer countdown
  useEffect(() => {
    if (!gameActive) return
    const tick = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameActive(false)
          setEventMsg('⏰ TIME UP! Mission complete.')
          return 0
        }
        return t - 1
      })

      // Job timer decay & processing
      setQueue(prev => {
        const updated = prev.map(j => ({ ...j, timeLeft: j.timeLeft - 1 }))
        const expired = updated.filter(j => j.timeLeft <= 0)
        if (expired.length > 0) {
          setFailedJobs(f => f + expired.length)
          setEventMsg(`💥 ${expired.length} job(s) timed out! Backpressure critical!`)
        }
        return updated.filter(j => j.timeLeft > 0)
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [gameActive])

  // Job completion processor
  useEffect(() => {
    if (!gameActive) return
    const processor = setInterval(() => {
      setNodes(prev => prev.map(node => {
        const updatedJobs = node.jobs.map(j => ({ ...j, processLeft: (j.processLeft || 5) - 1 }))
        const done = updatedJobs.filter(j => j.processLeft <= 0)
        const active = updatedJobs.filter(j => j.processLeft > 0)

        if (done.length > 0) {
          setCompletedJobs(c => c + done.length)
          setScore(s => s + done.reduce((a, j) => a + (j.ram * 50), 0))
          setEventMsg(`✅ ${done.length} job(s) completed on ${node.name}`)
          // Free resources
          const freedCpu = done.reduce((a, j) => a + j.cpu, 0)
          const freedRam = done.reduce((a, j) => a + j.ram, 0)
          return { ...node, cpu: node.cpu - freedCpu, ram: node.ram - freedRam, jobs: active }
        }
        return { ...node, jobs: active }
      }))
    }, 1000)
    return () => clearInterval(processor)
  }, [gameActive])

  const assignJob = (job, nodeId) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    if (node.cpu + job.cpu > NODE_CAPACITY.cpu || node.ram + job.ram > NODE_CAPACITY.ram) {
      setEventMsg(`❌ ${node.name} overloaded! CPU: ${node.cpu + job.cpu}/${NODE_CAPACITY.cpu} RAM: ${node.ram + job.ram}/${NODE_CAPACITY.ram}`)
      return
    }

    setNodes(prev => prev.map(n => n.id === nodeId ? {
      ...n,
      cpu: n.cpu + job.cpu,
      ram: n.ram + job.ram,
      jobs: [...n.jobs, { ...job, processLeft: 4 }]
    } : n))
    setQueue(prev => prev.filter(j => j.id !== job.id))
    setSelectedJob(null)
    setEventMsg(`🚀 Scheduled ${job.name} on ${node.name}`)
  }

  const endGame = () => {
    setGameActive(false)
    const finalScore = score + (completedJobs * 100) - (failedJobs * 200)
    onScore(Math.max(finalScore, 0))
    onComplete(Math.max(finalScore, 0))
  }

  if (!gameActive && timeLeft === 0) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        <Trophy size={64} color={PALETTE.ops} />
        <h2 style={{ color: '#fff', fontFamily: '"Space Grotesk", sans-serif' }}>Cluster Stabilized</h2>
        <div style={{ display: 'flex', gap: '24px' }}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ color: PALETTE.muted, fontSize: '0.8rem' }}>COMPLETED</div>
            <div style={{ color: PALETTE.dev, fontSize: '2rem', fontWeight: 800 }}>{completedJobs}</div>
          </Card>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ color: PALETTE.muted, fontSize: '0.8rem' }}>FAILED</div>
            <div style={{ color: PALETTE.danger, fontSize: '2rem', fontWeight: 800 }}>{failedJobs}</div>
          </Card>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ color: PALETTE.muted, fontSize: '0.8rem' }}>SCORE</div>
            <div style={{ color: PALETTE.ops, fontSize: '2rem', fontWeight: 800 }}>{score}</div>
          </Card>
        </div>
        <Button onClick={endGame} color={PALETTE.ops}>Transmit Results</Button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      {/* HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Card style={{ padding: '12px 20px' }}>
            <span style={{ color: PALETTE.muted, fontSize: '0.8rem' }}>TIME</span>
            <div style={{ color: timeLeft < 15 ? PALETTE.danger : '#fff', fontSize: '1.5rem', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace' }}>
              {timeLeft}s
            </div>
          </Card>
          <Card style={{ padding: '12px 20px' }}>
            <span style={{ color: PALETTE.muted, fontSize: '0.8rem' }}>JOBS DONE</span>
            <div style={{ color: PALETTE.dev, fontSize: '1.5rem', fontWeight: 700 }}>{completedJobs}</div>
          </Card>
        </div>
        <Button onClick={() => setGameActive(false)} color={PALETTE.danger} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          Abort Mission
        </Button>
      </div>

      {/* Event Feed */}
      <Card style={{ background: '#000', borderColor: `${PALETTE.ops}30` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Activity size={14} color={PALETTE.ops} />
          <span style={{ color: PALETTE.ops, fontSize: '0.75rem', fontFamily: '"JetBrains Mono", monospace' }}>CLUSTER EVENTS</span>
        </div>
        <motion.div key={eventMsg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: PALETTE.text, fontSize: '0.9rem' }}>
          {eventMsg}
        </motion.div>
      </Card>

      {/* Incoming Queue */}
      <div>
        <div style={{ color: PALETTE.muted, fontSize: '0.8rem', marginBottom: '12px', fontFamily: '"JetBrains Mono", monospace' }}>
          INCOMING SAR JOBS (Click to select)
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', minHeight: '80px' }}>
          <AnimatePresence>
            {queue.map(job => (
              <motion.button
                key={job.id}
                layout
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                style={{
                  background: selectedJob?.id === job.id ? `${job.color}30` : `${job.color}15`,
                  border: `2px solid ${selectedJob?.id === job.id ? job.color : `${job.color}40`}`,
                  borderRadius: '10px', padding: '12px 16px',
                  color: '#fff', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                  minWidth: '120px', position: 'relative', overflow: 'hidden'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{job.name}</div>
                <div style={{ fontSize: '0.7rem', color: PALETTE.muted, fontFamily: '"JetBrains Mono", monospace' }}>
                  CPU:{job.cpu} RAM:{job.ram}GB
                </div>
                {/* Timeout bar */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', width: '100%', background: 'rgba(255,255,255,0.1)' }}>
                  <motion.div
                    animate={{ width: `${(job.timeLeft / job.maxTime) * 100}%` }}
                    style={{ height: '100%', background: job.timeLeft < 3 ? PALETTE.danger : PALETTE.ops }}
                  />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          {queue.length === 0 && (
            <div style={{ color: PALETTE.muted, padding: '20px', fontStyle: 'italic' }}>No pending jobs...</div>
          )}
        </div>
      </div>

      {/* Nodes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {nodes.map(node => {
          const cpuPct = (node.cpu / NODE_CAPACITY.cpu) * 100
          const ramPct = (node.ram / NODE_CAPACITY.ram) * 100
          const isOverloaded = cpuPct > 90 || ramPct > 90

          return (
            <motion.button
              key={node.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => selectedJob && assignJob(selectedJob, node.id)}
              style={{
                background: isOverloaded ? 'rgba(239,68,68,0.1)' : PALETTE.panel,
                border: `2px solid ${isOverloaded ? PALETTE.danger : selectedJob ? `${PALETTE.ops}60` : PALETTE.border}`,
                borderRadius: '16px', padding: '20px',
                cursor: selectedJob ? 'pointer' : 'default',
                textAlign: 'left', position: 'relative',
                boxShadow: isOverloaded ? `0 0 20px ${PALETTE.danger}30` : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 700 }}>
                  <Server size={18} color={isOverloaded ? PALETTE.danger : PALETTE.ops} />
                  {node.name}
                </div>
                {node.jobs.length > 0 && (
                  <Badge color={PALETTE.ops}>{node.jobs.length} pods</Badge>
                )}
              </div>

              {/* CPU Bar */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: PALETTE.muted, marginBottom: '4px' }}>
                  <span>CPU</span><span>{node.cpu} / {NODE_CAPACITY.cpu}</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <motion.div animate={{ width: `${cpuPct}%` }} style={{ height: '100%', background: cpuPct > 80 ? PALETTE.danger : PALETTE.ops }} />
                </div>
              </div>

              {/* RAM Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: PALETTE.muted, marginBottom: '4px' }}>
                  <span>RAM</span><span>{node.ram} / {NODE_CAPACITY.ram} GB</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <motion.div animate={{ width: `${ramPct}%` }} style={{ height: '100%', background: ramPct > 80 ? PALETTE.danger : PALETTE.kid }} />
                </div>
              </div>

              {selectedJob && (
                <div style={{ marginTop: '12px', textAlign: 'center', color: PALETTE.ops, fontSize: '0.8rem', fontWeight: 700 }}>
                  Click to deploy {selectedJob.name}
                </div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MENU & GAME SHELL
// ─────────────────────────────────────────────────────────────────────────────
const LEVELS = [
  {
    id: 1,
    title: 'Orbit Scout',
    role: 'Space Cadet',
    desc: 'Hunt hidden ships from space using radar pings.',
    color: PALETTE.kid,
    icon: <Crosshair size={32} />
  },
  {
    id: 2,
    title: 'Pipeline Panic',
    role: 'Code Architect',
    desc: 'Build the processing chain. Fix the borrow checker.',
    color: PALETTE.dev,
    icon: <Terminal size={32} />
  },
  {
    id: 3,
    title: 'Cluster Rush',
    role: 'Fleet Commander',
    desc: 'Manage Kubernetes pods before the data floods in.',
    color: PALETTE.ops,
    icon: <Server size={32} />
  }
]

const FACTS = [
  "🛰️ NISAR is a joint NASA-ISRO satellite launching in 2024!",
  "📡 SAR radar can see through clouds and in complete darkness.",
  "💾 A single NISAR image is 7GB of complex math, not a photo.",
  "🦀 Rust ensures memory safety—no leaks during 30k×30k matrix math!",
  "☸️ Kubernetes autoscales pods so massive jobs don't crash your laptop."
]

export default function AcademyGame() {
  const [screen, setScreen] = useState('menu') // menu, playing, intel
  const [currentLevel, setCurrentLevel] = useState(1)
  const [unlocked, setUnlocked] = useState(1)
  const [scores, setScores] = useState({ 1: 0, 2: 0, 3: 0 })
  const [factIndex, setFactIndex] = useState(0)

  const startLevel = (lvl) => {
    if (lvl > unlocked) return
    setCurrentLevel(lvl)
    setScreen('playing')
  }

  const handleComplete = (level, score) => {
    setScores(prev => ({ ...prev, [level]: Math.max(prev[level], score) }))
    const next = level + 1
    if (next <= 3) setUnlocked(prev => Math.max(prev, next))
    setFactIndex(Math.floor(Math.random() * FACTS.length))
    setScreen('intel')
  }

  const totalScore = scores[1] + scores[2] + scores[3]

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        paddingTop: '80px',
        minHeight: '100vh',
        background: PALETTE.bg,
        fontFamily: '"DM Sans", sans-serif',
        color: PALETTE.text,
        overflow: 'hidden'
      }}
    >
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <Badge color={PALETTE.accent}>TRAINING SIMULATION</Badge>
            <h1 style={{
              fontFamily: '"Space Grotesk", sans-serif', fontSize: '3.5rem',
              fontWeight: 800, color: '#fff', margin: '16px 0 8px', letterSpacing: '-0.02em'
            }}>
              Signal Ops Academy
            </h1>
            <p style={{ color: PALETTE.muted, fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
              No geospatial knowledge required. Play three missions. Become a radar operator.
            </p>
          </motion.div>
        </div>

        {/* MENU SCREEN */}
        {screen === 'menu' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
              width: '100%',
              marginBottom: '20px'
            }}>
              {LEVELS.map(lvl => {
                const isUnlocked = lvl.id <= unlocked
                const isCompleted = scores[lvl.id] > 0

                return (
                  <motion.div
                    key={lvl.id}
                    whileHover={isUnlocked ? { y: -5 } : {}}
                    onClick={() => startLevel(lvl.id)}
                    style={{
                      background: PALETTE.panel,
                      border: `1px solid ${isCompleted ? `${lvl.color}60` : PALETTE.border}`,
                      borderRadius: '20px',
                      padding: '32px',
                      cursor: isUnlocked ? 'pointer' : 'not-allowed',
                      opacity: isUnlocked ? 1 : 0.5,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {isCompleted && (
                      <div style={{ position: 'absolute', top: '16px', right: '16px', color: lvl.color }}>
                        <Trophy size={20} />
                      </div>
                    )}
                    {!isUnlocked && (
                      <div style={{ position: 'absolute', top: '50%', right: '32px', transform: 'translateY(-50%)', color: PALETTE.muted }}>
                        <Lock size={24} />
                      </div>
                    )}

                    <div style={{ color: lvl.color, marginBottom: '16px' }}>{lvl.icon}</div>
                    <h3 style={{ color: '#fff', fontFamily: '"Space Grotesk", sans-serif', fontSize: '1.4rem', margin: '0 0 8px' }}>
                      {lvl.title}
                    </h3>
                    <Badge color={lvl.color}>{lvl.role}</Badge>
                    <p style={{ color: PALETTE.muted, fontSize: '0.95rem', marginTop: '12px', lineHeight: 1.5 }}>
                      {lvl.desc}
                    </p>

                    {isCompleted && (
                      <div style={{ marginTop: '16px', fontFamily: '"JetBrains Mono", monospace', color: lvl.color, fontSize: '0.9rem' }}>
                        Best Score: {scores[lvl.id]}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {totalScore > 0 && (
              <Card glow style={{ textAlign: 'center', marginTop: '20px' }}>
                <div style={{ color: PALETTE.muted, fontSize: '0.9rem' }}>TOTAL OPERATOR SCORE</div>
                <div style={{ fontSize: '3rem', fontWeight: 800, color: PALETTE.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                  {totalScore}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* PLAYING SCREEN */}
        {screen === 'playing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div>
                <h2 style={{ color: LEVELS[currentLevel - 1].color, margin: 0, fontFamily: '"Space Grotesk", sans-serif' }}>
                  Level {currentLevel}: {LEVELS[currentLevel - 1].title}
                </h2>
                <p style={{ color: PALETTE.muted, margin: '4px 0 0', fontSize: '0.9rem' }}>
                  Playing as {LEVELS[currentLevel - 1].role}
                </p>
              </div>
              <Button onClick={() => setScreen('menu')} color={PALETTE.muted} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                Exit Mission
              </Button>
            </div>

            {currentLevel === 1 && (
              <Level1Game
                onScore={(s) => { }}
                onComplete={(s) => handleComplete(1, s)}
              />
            )}
            {currentLevel === 2 && (
              <Level2Game
                onScore={(s) => { }}
                onComplete={(s) => handleComplete(2, s)}
              />
            )}
            {currentLevel === 3 && (
              <Level3Game
                onScore={(s) => { }}
                onComplete={(s) => handleComplete(3, s)}
              />
            )}
          </motion.div>
        )}

        {/* INTEL SCREEN (Between levels) */}
        {screen === 'intel' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto', padding: '60px 20px' }}
          >
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              style={{ fontSize: '4rem', marginBottom: '24px' }}
            >
              🎓
            </motion.div>
            <h2 style={{ color: '#fff', fontFamily: '"Space Grotesk", sans-serif', fontSize: '2.5rem', marginBottom: '16px' }}>
              Intel Unlocked!
            </h2>
            <Card style={{ marginBottom: '32px', borderColor: `${PALETTE.accent}30` }}>
              <p style={{ fontSize: '1.2rem', lineHeight: 1.6, margin: 0, color: PALETTE.text }}>
                {FACTS[factIndex]}
              </p>
            </Card>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <Button onClick={() => setScreen('menu')} color={PALETTE.accent}>
                Return to Base
              </Button>
              {currentLevel < 3 && (
                <Button onClick={() => startLevel(currentLevel + 1)} color={LEVELS[currentLevel].color}>
                  Next Mission <ArrowRight size={18} />
                </Button>
              )}
            </div>
          </motion.div>
        )}

      </div>
    </motion.main>
  )
}
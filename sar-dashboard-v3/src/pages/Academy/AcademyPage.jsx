import React from 'react'
import { ProgressProvider } from './core/ProgressContext'
import LevelOneExplorer from './levels/LevelOneExplorer'
import { LUXURY } from './core/Theme'

export default function AcademyPage() {
  return (
    <ProgressProvider>
      <div style={{
        minHeight: '100vh',
        background: LUXURY.obsidian,
        fontFamily: '"DM Sans", -apple-system, sans-serif',
        paddingTop: '80px' // offset for global navbar
      }}>
        {/* Simple layout wrapper. In the future this could house a global academy nav */}
        <LevelOneExplorer />
      </div>
    </ProgressProvider>
  )
}

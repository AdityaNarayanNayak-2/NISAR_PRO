import React from 'react'
import { motion } from 'framer-motion'
import { Award, CheckCircle2, Download, Share2, QrCode } from 'lucide-react'
import { LUXURY, LEVEL_THEME } from '../core/Theme'

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

/**
 * AttractButton — Ported from kokonutui/attract-button
 * Particles scatter on idle, attract to center on hover, scatter back on leave.
 * Chegg theme: emerald/gold particles, dark background, no violet.
 */
import { motion, useAnimation } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

export default function AttractButton({
  children,
  onClick,
  particleCount = 12,
  color = 'emerald',
  className = '',
  disabled = false,
  ...props
}) {
  const [isAttracting, setIsAttracting] = useState(false)
  const [particles, setParticles] = useState([])
  const particlesControl = useAnimation()

  const palette =
    color === 'gold'
      ? {
          bg: 'rgba(201,168,76,0.1)',
          bgHover: 'rgba(201,168,76,0.18)',
          text: '#F0C040',
          border: 'rgba(201,168,76,0.5)',
          borderHover: '#F0C040',
          particle: '#F0C040',
          shadow: '0 0 20px rgba(201,168,76,0.2)',
          shadowHover: '0 0 36px rgba(240,192,64,0.35)',
        }
      : {
          bg: 'rgba(16,185,129,0.1)',
          bgHover: 'rgba(16,185,129,0.18)',
          text: '#34D399',
          border: 'rgba(16,185,129,0.5)',
          borderHover: '#34D399',
          particle: '#34D399',
          shadow: '0 0 20px rgba(16,185,129,0.2)',
          shadowHover: '0 0 36px rgba(52,211,153,0.35)',
        }

  useEffect(() => {
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 360 - 180,
      y: Math.random() * 360 - 180,
    }))
    setParticles(newParticles)
  }, [particleCount])

  const handleInteractionStart = useCallback(async () => {
    if (disabled) return
    setIsAttracting(true)
    await particlesControl.start({
      x: 0,
      y: 0,
      transition: { type: 'spring', stiffness: 50, damping: 10 },
    })
  }, [particlesControl, disabled])

  const handleInteractionEnd = useCallback(async () => {
    setIsAttracting(false)
    await particlesControl.start((i) => ({
      x: particles[i].x,
      y: particles[i].y,
      transition: { type: 'spring', stiffness: 100, damping: 15 },
    }))
  }, [particlesControl, particles])

  return (
    <button
      className={className}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={handleInteractionStart}
      onMouseLeave={handleInteractionEnd}
      onTouchStart={handleInteractionStart}
      onTouchEnd={handleInteractionEnd}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.9rem 2.25rem',
        fontFamily: 'var(--font-label)',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        minWidth: '170px',
        touchAction: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: isAttracting ? palette.bgHover : palette.bg,
        color: palette.text,
        border: `1px solid ${isAttracting ? palette.borderHover : palette.border}`,
        borderRadius: '0.5rem',
        boxShadow: isAttracting ? palette.shadowHover : palette.shadow,
        transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {particles.map((p, index) => (
        <motion.div
          key={index}
          custom={index}
          animate={particlesControl}
          initial={{ x: p.x, y: p.y }}
          style={{
            position: 'absolute',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: palette.particle,
            opacity: isAttracting ? 1 : 0.4,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          }}
        />
      ))}
      <span
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          zIndex: 1,
        }}
      >
        {children}
      </span>
    </button>
  )
}

/**
 * Loader — Emerald-themed animated loading spinner
 * Based on kokonutui loader, adapted for CHEGG obsidian/emerald theme.
 * Multi-ring concentric animation with emerald green accents.
 */
import { motion } from 'framer-motion'

const ease = [0.4, 0, 0.2, 1]

export default function Loader({
  title = 'Connecting to backend...',
  subtitle = '',
  size = 'md',
  className = '',
}) {
  const sizeMap = {
    sm: { container: 80, titleSize: '0.85rem', subSize: '0.72rem' },
    md: { container: 128, titleSize: '1rem', subSize: '0.82rem' },
    lg: { container: 160, titleSize: '1.15rem', subSize: '0.9rem' },
  }
  const cfg = sizeMap[size] || sizeMap.md

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        padding: '2rem',
      }}
    >
      {/* Multi-ring spinner */}
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        style={{ position: 'relative', width: cfg.container, height: cfg.container }}
        transition={{ duration: 4, repeat: Infinity, ease }}
      >
        {/* Outer ring — shimmer */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, transparent 0deg, #10b981 90deg, transparent 180deg)',
            mask: 'radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)',
            WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)',
            opacity: 0.8,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />

        {/* Primary ring — main gradient */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, transparent 0deg, #10b981 120deg, rgba(16,185,129,0.5) 240deg, transparent 360deg)',
            mask: 'radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)',
            WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)',
            opacity: 0.9,
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease }}
        />

        {/* Secondary ring — counter-rotation */}
        <motion.div
          animate={{ rotate: [0, -360] }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'conic-gradient(from 180deg, transparent 0deg, rgba(16,185,129,0.6) 45deg, transparent 90deg)',
            mask: 'radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)',
            WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)',
            opacity: 0.35,
          }}
          transition={{ duration: 4, repeat: Infinity, ease }}
        />

        {/* Accent particles */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'conic-gradient(from 270deg, transparent 0deg, rgba(16,185,129,0.4) 20deg, transparent 40deg)',
            mask: 'radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)',
            WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)',
            opacity: 0.5,
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        />

        {/* Gold accent ring */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'conic-gradient(from 90deg, transparent 0deg, rgba(201,168,76,0.35) 30deg, transparent 60deg)',
            mask: 'radial-gradient(circle at 50% 50%, transparent 26%, black 27%, black 28%, transparent 29%)',
            WebkitMask: 'radial-gradient(circle at 50% 50%, transparent 26%, black 27%, black 28%, transparent 29%)',
            opacity: 0.6,
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>

      {/* Text */}
      {title && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1, ease }}
          style={{ textAlign: 'center' }}
        >
          <motion.h2
            className="font-display"
            style={{
              fontSize: cfg.titleSize,
              fontWeight: 600,
              color: 'var(--emerald)',
              letterSpacing: '0.04em',
              marginBottom: subtitle ? '0.5rem' : 0,
            }}
            animate={{ opacity: [0.9, 0.7, 0.9] }}
            transition={{ duration: 3, repeat: Infinity, ease }}
          >
            {title}
          </motion.h2>
          {subtitle && (
            <motion.p
              className="font-body"
              style={{
                fontSize: cfg.subSize,
                color: 'var(--stone-light)',
                letterSpacing: '0.02em',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: [0.6, 0.4, 0.6], y: 0 }}
              transition={{ delay: 0.6, duration: 1, ease }}
            >
              {subtitle}
            </motion.p>
          )}
        </motion.div>
      )}
    </div>
  )
}

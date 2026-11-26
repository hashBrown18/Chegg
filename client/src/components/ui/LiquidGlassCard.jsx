import React, { useId } from 'react'

const GlassFilter = React.memo(({ id, scale = 30 }) => (
  <svg style={{ display: 'none' }}>
    <defs>
      <filter
        colorInterpolationFilters="sRGB"
        height="200%"
        id={id}
        width="200%"
        x="-50%"
        y="-50%"
      >
        <feTurbulence
          baseFrequency="0.05 0.05"
          numOctaves="1"
          result="turbulence"
          seed="1"
          type="fractalNoise"
        />
        <feGaussianBlur
          in="turbulence"
          result="blurredNoise"
          stdDeviation="2"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="blurredNoise"
          result="displaced"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="B"
        />
        <feGaussianBlur in="displaced" result="finalBlur" stdDeviation="4" />
        <feComposite in="finalBlur" in2="finalBlur" operator="over" />
      </filter>
    </defs>
  </svg>
))
GlassFilter.displayName = 'GlassFilter'

export default function LiquidGlassCard({ children, className = '', style = {}, ...props }) {
  const filterId = useId()

  const cardStyle = {
    position: 'relative',
    background: 'rgba(15, 13, 20, 0.92)',
    border: '1px solid var(--brand-border-strong)',
    borderRadius: '1.25rem',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: `
      0 0 32px rgba(139, 61, 255, 0.10),
      0 8px 32px rgba(0, 0, 0, 0.5),
      inset 0 0 12px rgba(139, 61, 255, 0.10)
    `,
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    ...style,
  }

  return (
    <div className={`liquid-glass-card ${className}`} style={cardStyle} {...props}>
      {/* SVG liquid glass displacement overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          overflow: 'hidden',
          borderRadius: 'inherit',
          backdropFilter: `url("#${filterId}")`,
          WebkitBackdropFilter: `url("#${filterId}")`,
          pointerEvents: 'none',
        }}
      />
      <GlassFilter id={filterId} scale={30} />

      {/* Card contents */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {children}
      </div>

      {/* Decorative hover light sweep */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          borderRadius: 'inherit',
          background: 'linear-gradient(90deg, transparent, rgba(139, 61, 255, 0.08), transparent)',
          opacity: 0,
          transition: 'opacity 0.3s ease',
        }}
        className="glass-sweep-overlay"
      />
    </div>
  )
}

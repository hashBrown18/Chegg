/**
 * GlowBackground — Landing page background
 * Inspired by 21st.dev dark animated backgrounds
 * Replaces BackgroundSVG for the landing page only.
 *
 * Layers:
 *  1. Obsidian base
 *  2. Animated stone-grid (SVG pattern + drift)
 *  3. Radial emerald glow (bottom-left)
 *  4. Radial gold glow (top-right)
 *  5. Scanline shimmer sweep
 *  6. Floating chess piece silhouettes
 */
export default function GlowBackground() {
  const pieces = [
    { symbol: '♔', x: '8%',  y: '18%', delay: '0s',   duration: '9s',  size: '5rem',  opacity: 0.06 },
    { symbol: '♛', x: '88%', y: '12%', delay: '2.5s', duration: '11s', size: '4rem',  opacity: 0.05 },
    { symbol: '♜', x: '75%', y: '72%', delay: '1.2s', duration: '13s', size: '3.5rem',opacity: 0.05 },
    { symbol: '♞', x: '15%', y: '80%', delay: '4s',   duration: '10s', size: '3rem',  opacity: 0.04 },
    { symbol: '♝', x: '50%', y: '5%',  delay: '0.8s', duration: '14s', size: '2.8rem',opacity: 0.04 },
    { symbol: '♟', x: '92%', y: '50%', delay: '3s',   duration: '8s',  size: '2.2rem',opacity: 0.035},
  ]

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'var(--obsidian)',
      }}
    >
      {/* ── Layer 1: Stone grid SVG pattern ── */}
      <div
        style={{
          position: 'absolute',
          inset: '-60px',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='%234A4A52' stroke-width='0.4' stroke-opacity='0.35'/%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
          animation: 'grid-drift 18s linear infinite',
          opacity: 0.7,
        }}
      />

      {/* ── Layer 2: Emerald radial glow (bottom-left) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '70vw',
          height: '70vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.06) 40%, transparent 70%)',
          animation: 'glow-breathe 7s ease-in-out infinite',
          filter: 'blur(2px)',
        }}
      />

      {/* ── Layer 3: Gold radial glow (top-right) ── */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-8%',
          width: '55vw',
          height: '55vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.14) 0%, rgba(201,168,76,0.05) 40%, transparent 70%)',
          animation: 'glow-breathe 9s ease-in-out infinite',
          animationDelay: '3s',
          filter: 'blur(2px)',
        }}
      />

      {/* ── Layer 4: Center deep emerald vignette ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60vw',
          height: '60vh',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(16,185,129,0.04) 0%, transparent 65%)',
        }}
      />

      {/* ── Layer 5: Scanline sweep ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, transparent 0%, rgba(240,192,64,0.025) 50%, transparent 100%)',
          backgroundSize: '100% 200px',
          animation: 'scanline 12s linear infinite',
          opacity: 0.8,
        }}
      />

      {/* ── Layer 6: Floating chess pieces ── */}
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            fontSize: p.size,
            color: i % 2 === 0 ? 'var(--emerald)' : 'var(--gold)',
            opacity: p.opacity,
            animation: `float-piece ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
            userSelect: 'none',
            lineHeight: 1,
            filter: `drop-shadow(0 0 12px ${i % 2 === 0 ? 'rgba(52,211,153,0.3)' : 'rgba(240,192,64,0.3)'})`,
          }}
        >
          {p.symbol}
        </div>
      ))}

      {/* ── Layer 7: Vignette edges ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 120% 100% at 50% 50%, transparent 50%, rgba(10,10,12,0.85) 100%)',
        }}
      />
    </div>
  )
}

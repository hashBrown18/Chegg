/**
 * HeroSection — Dark animated hero for CHEGG
 * Structure inspired by 21st.dev animated hero patterns.
 *
 * Features:
 *  - Animated gradient CHEGG title with emerald+gold shimmer
 *  - Eyebrow badge: CHESS × MINECRAFT
 *  - Subheadline with typewriter feel
 *  - Two CTA buttons with magnetic particle attraction (AttractButton)
 *  - Decorative chess board mini-grid
 */
import AttractButton from '../ui/AttractButton.jsx'

export default function HeroSection({ onJoin, onCreate, onSingleplayer }) {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 2rem 4rem',
      }}
    >
      {/* ── Eyebrow badge ── */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 1rem',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '999px',
          marginBottom: '2rem',
          animation: 'fadeInUp 0.5s var(--ease-out) 0.05s both',
        }}
      >
        <span style={{ color: 'var(--emerald)', fontSize: '0.75rem' }}>♟</span>
        <span
          className="font-label"
          style={{
            fontSize: '0.6rem',
            letterSpacing: '0.22em',
            color: 'var(--emerald-glow)',
          }}
        >
          CHESS × MINECRAFT
        </span>
        <span style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>♙</span>
      </div>

      {/* ── Main title ── */}
      <h1
        className="font-display"
        style={{
          fontSize: 'clamp(5rem, 16vw, 11rem)',
          fontWeight: 700,
          lineHeight: 0.88,
          letterSpacing: '-0.04em',
          background: `linear-gradient(
            135deg,
            var(--gold-bright)   0%,
            var(--parchment)    30%,
            var(--emerald-glow) 60%,
            var(--gold)         80%,
            var(--gold-bright) 100%
          )`,
          backgroundSize: '300% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'hero-title-in 0.9s var(--ease-out) 0.1s both, shimmer-gold 5s linear 1s infinite',
          marginBottom: '1.25rem',
          position: 'relative',
        }}
      >
        CHEGG
      </h1>

      {/* ── Divider ── */}
      <div
        style={{
          width: '8rem',
          height: '1px',
          margin: '0 auto 1.5rem',
          background: 'linear-gradient(90deg, transparent, var(--gold) 30%, var(--emerald) 70%, transparent)',
          animation: 'fadeInUp 0.5s var(--ease-out) 0.3s both',
        }}
      />

      {/* ── Subtitle ── */}
      <p
        className="font-body"
        style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          color: 'var(--parchment-muted)',
          maxWidth: '480px',
          lineHeight: 1.65,
          marginBottom: '1rem',
          animation: 'fadeInUp 0.6s var(--ease-out) 0.35s both',
        }}
      >
        Command your pieces. Harvest your world.
      </p>

      <p
        className="font-label"
        style={{
          fontSize: '0.68rem',
          letterSpacing: '0.18em',
          color: 'var(--stone-light)',
          marginBottom: '3rem',
          animation: 'fadeInUp 0.5s var(--ease-out) 0.42s both',
        }}
      >
        2 PLAYERS · ONLINE MULTIPLAYER · DECK-BUILDING
      </p>

      {/* ── CTA Buttons ── */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          animation: 'fadeInUp 0.6s var(--ease-out) 0.48s both',
        }}
      >
        {/* Join Room — emerald particle attraction */}
        <AttractButton onClick={onJoin} color="emerald">
          ⚔️ <span>Join Room</span>
        </AttractButton>

        {/* Create Room — gold particle attraction */}
        <AttractButton onClick={onCreate} color="gold">
          ♟ <span>Create Room</span>
        </AttractButton>
      </div>

      {/* ── Singleplayer CTA ── */}
      <div
        style={{
          marginTop: '1rem',
          animation: 'fadeInUp 0.6s var(--ease-out) 0.56s both',
        }}
      >
        <AttractButton onClick={onSingleplayer} color="emerald" particleCount={8}>
          🎮 <span>Singleplayer Mode (If You Don't Have Friends Skill Issue)</span>
        </AttractButton>
      </div>

      {/* ── Decorative chess mini-board ── */}
      <div
        style={{
          marginTop: '4rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 0,
          width: 'min(280px, 55vw)',
          aspectRatio: '8 / 1',
          borderRadius: '0.25rem',
          overflow: 'hidden',
          border: '1px solid rgba(74,74,82,0.4)',
          animation: 'fadeInUp 0.5s var(--ease-out) 0.6s both',
          opacity: 0.6,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              aspectRatio: '1',
              background: i % 2 === 0
                ? 'rgba(37,37,41,0.9)'
                : 'rgba(16,185,129,0.12)',
            }}
          />
        ))}
      </div>

      <p
        className="font-label"
        style={{
          marginTop: '1rem',
          fontSize: '0.58rem',
          letterSpacing: '0.2em',
          color: 'rgba(138,138,150,0.5)',
          animation: 'fadeInUp 0.4s var(--ease-out) 0.65s both',
        }}
      >
        SCROLL TO EXPLORE
      </p>
    </section>
  )
}
